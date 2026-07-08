import 'server-only'

/**
 * Cliente mínimo de Firestore (modo nativo) vía REST.
 *
 * Se usa REST en lugar de @google-cloud/firestore a propósito: el SDK oficial
 * arrastra gRPC/protobufjs (~50 MB, cold start lento) y el output standalone
 * de Next no lo tracea bien. Las operaciones que necesitamos son 4 y caben
 * en este archivo.
 *
 * Autenticación: token OAuth del metadata server (Cloud Run / GCE). El
 * projectId sale de GOOGLE_CLOUD_PROJECT o del propio metadata server.
 */

const METADATA_BASE = 'http://metadata.google.internal/computeMetadata/v1'

let cachedToken: { token: string; expiresAt: number } | null = null
let cachedProjectId: string | null = process.env.GOOGLE_CLOUD_PROJECT ?? null

async function metadataFetch(path: string): Promise<string> {
  const res = await fetch(`${METADATA_BASE}${path}`, {
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) throw new Error(`Metadata server ${res.status} en ${path}`)
  return res.text()
}

async function getProjectId(): Promise<string> {
  if (cachedProjectId) return cachedProjectId
  cachedProjectId = await metadataFetch('/project/project-id')
  return cachedProjectId
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token
  const raw = await metadataFetch('/instance/service-accounts/default/token')
  const data = JSON.parse(raw) as { access_token: string; expires_in: number }
  cachedToken = {
    token: data.access_token,
    // margen de 60 s para no usar tokens a punto de expirar
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.token
}

async function firestoreFetch(path: string, init?: RequestInit): Promise<Response> {
  const [projectId, token] = await Promise.all([getProjectId(), getAccessToken()])
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15_000),
  })
}

// ---------------------------------------------------------------------------
// Codificación JS <-> valores tipados de Firestore
// ---------------------------------------------------------------------------

type FsValue = Record<string, unknown>

export function toFsValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } }
  if (typeof v === 'object') {
    const fields: Record<string, FsValue> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val !== undefined) fields[k] = toFsValue(val)
    }
    return { mapValue: { fields } }
  }
  throw new Error(`Tipo no soportado en Firestore: ${typeof v}`)
}

export function fromFsValue(v: FsValue): unknown {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) {
    const arr = (v.arrayValue as { values?: FsValue[] }).values ?? []
    return arr.map(fromFsValue)
  }
  if ('mapValue' in v) {
    return fromFsFields((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {})
  }
  return null
}

export function toFsFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const fields: Record<string, FsValue> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFsValue(v)
  }
  return fields
}

export function fromFsFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) obj[k] = fromFsValue(v)
  return obj
}

// ---------------------------------------------------------------------------
// Operaciones sobre documentos
// ---------------------------------------------------------------------------

export async function fsGetDoc(collection: string, id: string): Promise<Record<string, unknown> | null> {
  const res = await firestoreFetch(`/${collection}/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Firestore GET ${collection}/${id}: ${res.status} ${await res.text()}`)
  const doc = (await res.json()) as { fields?: Record<string, FsValue> }
  return fromFsFields(doc.fields ?? {})
}

/** Crea o reemplaza el documento completo. */
export async function fsSetDoc(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
  const res = await firestoreFetch(`/${collection}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFsFields(data) }),
  })
  if (!res.ok) throw new Error(`Firestore SET ${collection}/${id}: ${res.status} ${await res.text()}`)
}

/** Actualiza solo los campos indicados (updateMask). */
export async function fsUpdateFields(
  collection: string,
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const mask = Object.keys(fields)
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join('&')
  const res = await firestoreFetch(`/${collection}/${encodeURIComponent(id)}?${mask}&currentDocument.exists=true`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFsFields(fields) }),
  })
  if (!res.ok) throw new Error(`Firestore UPDATE ${collection}/${id}: ${res.status} ${await res.text()}`)
}

export async function fsDeleteDoc(collection: string, id: string): Promise<boolean> {
  const res = await firestoreFetch(`/${collection}/${encodeURIComponent(id)}?currentDocument.exists=true`, {
    method: 'DELETE',
  })
  if (res.status === 404 || res.status === 409) return false
  if (!res.ok) throw new Error(`Firestore DELETE ${collection}/${id}: ${res.status} ${await res.text()}`)
  return true
}

export interface FsQueryOptions {
  collection: string
  where?: Array<{ field: string; op: 'EQUAL'; value: unknown }>
  orderBy?: { field: string; direction: 'ASCENDING' | 'DESCENDING' }
  limit?: number
}

export async function fsQuery(opts: FsQueryOptions): Promise<Array<Record<string, unknown>>> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: opts.collection }],
  }
  if (opts.where?.length) {
    const filters = opts.where.map((w) => ({
      fieldFilter: { field: { fieldPath: w.field }, op: w.op, value: toFsValue(w.value) },
    }))
    structuredQuery.where =
      filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } }
  }
  if (opts.orderBy) {
    structuredQuery.orderBy = [
      { field: { fieldPath: opts.orderBy.field }, direction: opts.orderBy.direction },
    ]
  }
  if (opts.limit) structuredQuery.limit = opts.limit

  const res = await firestoreFetch(':runQuery', {
    method: 'POST',
    body: JSON.stringify({ structuredQuery }),
  })
  if (!res.ok) throw new Error(`Firestore QUERY ${opts.collection}: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as Array<{ document?: { fields?: Record<string, FsValue> } }>
  return rows.filter((r) => r.document).map((r) => fromFsFields(r.document!.fields ?? {}))
}

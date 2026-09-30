import 'server-only'
import { nextEmailRetry, type EmailAlert, type EmailRecipientRole } from './analysis'
import type { SecurityMutation } from '../security-state'
import { createHash } from 'node:crypto'

export async function fsCreateUser(data: Record<string, unknown>): Promise<void> {
  const root = `projects/${await getProjectId()}/databases/(default)/documents`
  const identity = [ `username:${String(data.username).toLowerCase()}`, ...(data.email ? [`email:${String(data.email).toLowerCase()}`] : []) ]
  const writes = [
    { update: { name: `${root}/users/${data.id}`, fields: toFsFields(data) }, currentDocument: { exists: false } },
    ...identity.map(value => ({ update: { name: `${root}/user_identity/${createHash('sha256').update(value).digest('hex')}`, fields: toFsFields({ userId: data.id }) }, currentDocument: { exists: false } })),
  ]
  const res = await firestoreFetch(':commit', { method: 'POST', body: JSON.stringify({ writes }) })
  if (res.status === 409 || res.status === 400) throw new Error('Cuenta duplicada.')
  if (!res.ok) throw new Error(`User creation failed: ${res.status}`)
}

/** Keep email reservations consistent with edits, without releasing another account's identity. */
export async function fsUpdateUser(id: string, fields: Record<string, unknown>): Promise<void> {
  if (!('email' in fields)) return fsUpdateFields('users', id, fields)
  const root = `projects/${await getProjectId()}/databases/(default)/documents`
  const res = await firestoreFetch(`/users/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error('Usuario no disponible.')
  const doc = await res.json() as { fields: Record<string, FsValue>; updateTime: string }
  const current = fromFsFields(doc.fields)
  const key = (email: unknown) => createHash('sha256').update(`email:${String(email).toLowerCase()}`).digest('hex')
  const writes: Record<string, unknown>[] = [{ update: { name: `${root}/users/${id}`, fields: toFsFields(fields) }, updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: { updateTime: doc.updateTime } }]
  if (fields.email !== current.email) {
    const reservationId = key(fields.email)
    const reserved = await firestoreFetch(`/user_identity/${reservationId}`)
    if (!reserved.ok && reserved.status !== 404) throw new Error('Reserva de correo no disponible.')
    if (reserved.ok) {
      const owner = await reserved.json() as { fields: Record<string, FsValue> }
      if (fromFsFields(owner.fields).userId !== id) throw new Error('Cuenta duplicada.')
    } else writes.push({ update: { name: `${root}/user_identity/${reservationId}`, fields: toFsFields({ userId: id }) }, currentDocument: { exists: false } })
    if (current.email) {
      const previous = await firestoreFetch(`/user_identity/${key(current.email)}`)
      if (previous.ok) {
        const identity = await previous.json() as { fields: Record<string, FsValue>; updateTime: string }
        if (fromFsFields(identity.fields).userId === id) writes.push({ delete: `${root}/user_identity/${key(current.email)}`, currentDocument: { updateTime: identity.updateTime } })
      } else if (previous.status !== 404) throw new Error('Reserva de correo no disponible.')
    }
  }
  const committed = await firestoreFetch(':commit', { method: 'POST', body: JSON.stringify({ writes }) })
  if (!committed.ok) throw new Error('No se pudo actualizar el usuario. Intente nuevamente.')
}

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

export async function fsMutateSecurity<T>(id: string, change: (current: Record<string, unknown>) => SecurityMutation<T>): Promise<T> {
  const project = await getProjectId()
  const root = `projects/${project}/databases/(default)/documents`
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await firestoreFetch(`/security_state/${id}`)
    if (!res.ok && res.status !== 404) throw new Error(`Security state read: ${res.status}`)
    const doc = res.status === 404 ? null : await res.json() as { fields: Record<string, FsValue>; updateTime: string }
    const next = change(doc ? fromFsFields(doc.fields) : {})
    const fields = toFsFields(next.data)
    if (typeof next.data.expiresAt === 'number') fields.ttl = { timestampValue: new Date(next.data.expiresAt).toISOString() }
    const writes: Record<string, unknown>[] = [{
      update: { name: `${root}/security_state/${id}`, fields },
      currentDocument: doc ? { updateTime: doc.updateTime } : { exists: false },
    }]
    if (next.passwordChange) {
      const p = next.passwordChange
      const userRes = await firestoreFetch(`/users/${encodeURIComponent(p.id)}`)
      if (!userRes.ok) throw new Error('La cuenta ha cambiado. Solicite otro codigo.')
      const userDoc = await userRes.json() as { fields: Record<string, FsValue>; updateTime: string }
      const user = fromFsFields(userDoc.fields)
      if (user.password !== p.previousPassword || user.active !== true || String(user.email).toLowerCase() !== p.email) throw new Error('La cuenta ha cambiado. Solicite otro codigo.')
      writes.push({ update: { name: `${root}/users/${p.id}`, fields: toFsFields({ password: p.password }) },
        updateMask: { fieldPaths: ['password'] }, currentDocument: { updateTime: userDoc.updateTime } })
    }
    const committed = await firestoreFetch(':commit', { method: 'POST', body: JSON.stringify({ writes }) })
    if (committed.ok) return next.result
    const error = await committed.json() as { error?: { status?: string } }
    if (!['FAILED_PRECONDITION', 'ABORTED', 'ALREADY_EXISTS'].includes(error.error?.status ?? '')) throw new Error(`Security state commit: ${committed.status}`)
  }
  throw new Error('Servicio ocupado. Intente nuevamente.')
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

/** Compare-and-set prevents concurrent instances from sending the same alert. */
export async function fsClaimEmailAlert(id: string, alert: unknown): Promise<boolean> {
  const path = `/analyses/${encodeURIComponent(id)}`
  const res = await firestoreFetch(path)
  if (!res.ok) throw new Error(`Firestore alert read: ${res.status}`)
  const doc = await res.json() as { fields?: Record<string, FsValue>; updateTime: string }
  if (doc.fields?.emailAlert) return false
  const claimed = await firestoreFetch(`${path}?updateMask.fieldPaths=emailAlert&currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`, {
    method: 'PATCH', body: JSON.stringify({ fields: { emailAlert: toFsValue(alert) } }),
  })
  if (claimed.status === 409 || claimed.status === 400) return false
  if (!claimed.ok) throw new Error(`Firestore alert claim: ${claimed.status}`)
  return true
}

/** Compare-and-set ensures only one instance can claim a recipient retry. */
export async function fsClaimEmailRetry(id: string, role: EmailRecipientRole, now: Date): Promise<EmailAlert | null> {
  const path = `/analyses/${encodeURIComponent(id)}`
  const res = await firestoreFetch(path)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Firestore retry read: ${res.status}`)
  const doc = await res.json() as { fields?: Record<string, FsValue>; updateTime: string }
  const current = fromFsFields(doc.fields ?? {}).emailAlert as EmailAlert | undefined
  if (!current) return null
  const next = nextEmailRetry(current, role, now)
  if (!next) return null
  const claimed = await firestoreFetch(`${path}?updateMask.fieldPaths=emailAlert&currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`, {
    method: 'PATCH', body: JSON.stringify({ fields: { emailAlert: toFsValue(next) } }),
  })
  if (claimed.status === 409 || claimed.status === 400) return null
  if (!claimed.ok) throw new Error(`Firestore retry claim: ${claimed.status}`)
  return next
}

export async function fsSetEmailDelivery(id: string, role: EmailRecipientRole, delivery: unknown): Promise<void> {
  const path = `/analyses/${encodeURIComponent(id)}?updateMask.fieldPaths=emailAlert.${role}&currentDocument.exists=true`
  const res = await firestoreFetch(path, {
    method: 'PATCH', body: JSON.stringify({ fields: { emailAlert: toFsValue({ [role]: delivery }) } }),
  })
  if (!res.ok) throw new Error(`Firestore delivery update: ${res.status}`)
}

export interface FsQueryOptions {
  collection: string
  where?: Array<{ field: string; op: 'EQUAL'; value: unknown }>
  orderBy?: { field: string; direction: 'ASCENDING' | 'DESCENDING' }
  limit?: number
  after?: { createdAt: string; id: string }
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
  if (opts.after) {
    const project = await getProjectId()
    structuredQuery.orderBy = [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }, { field: { fieldPath: '__name__' }, direction: 'DESCENDING' }]
    structuredQuery.startAt = { before: false, values: [toFsValue(opts.after.createdAt), { referenceValue: `projects/${project}/databases/(default)/documents/${opts.collection}/${opts.after.id}` }] }
  }

  const res = await firestoreFetch(':runQuery', {
    method: 'POST',
    body: JSON.stringify({ structuredQuery }),
  })
  if (!res.ok) throw new Error(`Firestore QUERY ${opts.collection}: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as Array<{ document?: { fields?: Record<string, FsValue> } }>
  return rows.filter((r) => r.document).map((r) => fromFsFields(r.document!.fields ?? {}))
}

export class UploadLimitError extends Error {}

/** Count real bytes while reading; Content-Length alone is not trusted. */
export async function readBoundedBody(request: Request, maximum: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maximum) throw new UploadLimitError('Solicitud demasiado grande.')
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > maximum) { await reader.cancel(); throw new UploadLimitError('Solicitud demasiado grande.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length }
  return body
}

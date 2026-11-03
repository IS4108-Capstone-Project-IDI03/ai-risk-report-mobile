// Calls the gateway (ai-risk-report-generator/server) for MB-01. Used by the
// session and the screens. The gateway's `session` cookie is stored and sent by
// the phone's own HTTP stack, so no token is handled here.
import { read, write } from './store'

// A non-2xx reply, carrying the gateway's `{ error }` text to show the engineer,
// and its `fields` (field name → problem) for a form to show under each field.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message)
  }
}

// What to tell the engineer about a failure: the field's problem first when
// the gateway names one, else its message. Used by the capture sheet and the
// offline queue (MB-10), so a refusal reads the same online and queued.
export const errorText = (e: unknown) =>
  (e instanceof ApiError && Object.values(e.fields)[0]) || (e instanceof Error ? e.message : String(e))

// `fetch` itself failed: no signal, wrong IP or the gateway is down (AC4).
export class NetworkError extends Error {
  constructor() {
    super("Can't reach the server. Check your connection, then try again.")
  }
}

// Set by the session so any expired session returns the engineer to sign-in
// (AC6), whichever screen made the call.
let onSessionExpired = () => {}
export function setOnSessionExpired(handler: () => void) {
  onSessionExpired = handler
}

// Told whether each call reached the gateway (MB-10), so the offline provider
// can show the offline note and upload the queue once the signal is back.
let onReach = (_reached: boolean) => {}
export function setOnReach(handler: (reached: boolean) => void) {
  onReach = handler
}

// The gateway couldn't be reached: tells onReach, then throws.
function unreachable(): never {
  onReach(false)
  throw new NetworkError()
}

// Sends one request to the gateway. Throws NetworkError when it can't be reached.
async function send(path: string, init: RequestInit): Promise<Response> {
  // Read per call, not at import: EXPO_PUBLIC_ vars are inlined at build time,
  // and tests set it after import. A phone can't use localhost (see .env.example).
  const base = process.env.EXPO_PUBLIC_API_URL
  // Without this, a missing .env reads as "no connection" and sends a teammate
  // off to debug Wi-Fi.
  if (!base) throw new Error('EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env.')
  // An upload (MB-03) sets no Content-Type, so the phone adds the multipart
  // boundary itself; one set here would leave the gateway unable to read the files.
  const json = !(init.body instanceof FormData)
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...(json && { 'Content-Type': 'application/json' }), ...init.headers },
    })
  } catch {
    unreachable()
  }
}

// A refusal as an ApiError with the gateway's own words.
function refused(path: string, status: number, body: { error?: string; fields?: Record<string, string> } | null) {
  // A 401 from /api/auth/ isn't an expiry: login's means wrong credentials
  // (AC2), and the launch /me check's means not signed in yet.
  if (status === 401 && !path.startsWith('/api/auth/')) onSessionExpired()
  return new ApiError(status, body?.error ?? `The server replied ${status}.`, body?.fields)
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init)
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  // A 200 that isn't JSON is a Wi-Fi login page (captive portal), not the
  // gateway: treat it as no connection.
  if (response.ok && body === null) unreachable()
  onReach(true)
  if (!response.ok) throw refused(path, response.status, body)
  return body as T
}

// For a reply read as it arrives (the chat's event stream, MB-06): the same
// checks as request(), then the Response, whose body the caller reads.
export async function stream(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await send(path, init)
  if (!response.ok) throw refused(path, response.status, await response.json().catch(() => null))
  // A 200 that isn't an event stream (or has no body) is a Wi-Fi login page,
  // not the gateway: treat it as no connection, as request() does.
  const type = response.headers?.get('content-type') ?? ''
  if (!response.body || !type.includes('text/event-stream')) unreachable()
  onReach(true)
  return response
}

// A file from the gateway (a voice note's audio, MB-11): the same checks as
// request(), then the bytes. Without them a Wi-Fi login page would be saved
// as the audio, and an expired session would show a vague error, not sign-in.
export async function download(path: string): Promise<Uint8Array> {
  const response = await send(path, {})
  if (!response.ok) throw refused(path, response.status, null)
  if (response.headers?.get('content-type')?.includes('text/html')) unreachable()
  onReach(true)
  return new Uint8Array(await response.arrayBuffer())
}

// A GET whose reply is kept on the phone (MB-10 AC1). With no signal it returns
// the last copy, so Home, the workspace and the picker still open offline. With
// no copy, or any other failure, it throws as request() does.
export async function cached<T>(path: string): Promise<T> {
  const key = `cache${path}`
  try {
    const body = await request<T>(path)
    write(key, body)
    return body
  } catch (error) {
    const copy = error instanceof NetworkError ? read<T>(key) : undefined
    if (copy === undefined) throw error
    return copy
  }
}

// Calls the gateway (ai-risk-report-generator/server) for MB-01. Used by the
// session and the screens. The gateway's `session` cookie is stored and sent by
// the phone's own HTTP stack, so no token is handled here.

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
    throw new NetworkError()
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
  if (response.ok && body === null) throw new NetworkError()
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
  if (!response.body || !type.includes('text/event-stream')) throw new NetworkError()
  return response
}

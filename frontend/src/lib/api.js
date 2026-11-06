function getCsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)meetinglog_csrf=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

async function request(method, path, body, opts = {}) {
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
  const isFormData = body instanceof FormData

  const headers = { ...opts.headers }
  if (isMutating) {
    headers['X-CSRF-Token'] = getCsrfToken()
  }
  if (!isFormData && body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(path, {
    method,
    headers,
    body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    credentials: 'same-origin',
  })

  if (res.status === 204) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    const e = new Error(err.error || 'Erro inesperado')
    e.status = res.status
    throw e
  }
  return res.json()
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path, {}),
  upload: (path, formData) => request('POST', path, formData, { headers: { 'X-CSRF-Token': getCsrfToken() } }),
}

// POST /api/chat → SSE. Chama onText(chunk) por pedaço; resolve em `done`, rejeita em erro HTTP ou evento `error`.
// fetch + reader porque EventSource não suporta POST.
export async function chatStream(pergunta, historico, onText, signal) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
    body: JSON.stringify({ pergunta, historico }),
    credentials: 'same-origin',
    signal,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Erro inesperado')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  // Retorna true quando o evento encerra o stream (done).
  function handle(block) {
    let event = 'message'
    const data = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
    }
    if (!data.length) return false
    if (event === 'done') return true
    let payload
    try { payload = JSON.parse(data.join('\n')) } catch { return false }
    if (event === 'error') throw new Error(payload.error || 'Erro inesperado')
    if (payload.text) onText(payload.text)
    return false
  }

  for (;;) {
    const { value, done } = await reader.read()
    buf += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      if (handle(block)) return
    }
    if (done) {
      if (buf.trim()) handle(buf)
      return
    }
  }
}

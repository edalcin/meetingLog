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

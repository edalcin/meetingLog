import { writable } from 'svelte/store'
import { api } from '../api.js'

export const authenticated = writable(false)

export async function login(pin) {
  await api.post('/api/login', { pin })
  authenticated.set(true)
}

export async function logout() {
  await api.post('/api/logout', {})
  authenticated.set(false)
}

export async function checkAuth() {
  try {
    await api.get('/api/meetings?limit=1')
    authenticated.set(true)
    return true
  } catch (e) {
    authenticated.set(false)
    return false
  }
}

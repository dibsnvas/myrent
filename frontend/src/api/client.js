import axios from 'axios'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const TOKENS_KEY = 'myrent.tokens'
const NO_REFRESH_URLS = ['/auth/login/', '/auth/register/', '/auth/refresh/']

// Tokens live in localStorage: simple for the MVP. Known trade-off, written down in README.
export const tokenStore = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(TOKENS_KEY))
    } catch {
      return null
    }
  },
  set(tokens) {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  },
  clear() {
    localStorage.removeItem(TOKENS_KEY)
  },
}

export const api = axios.create({ baseURL: `${API_URL}/api` })

api.interceptors.request.use((config) => {
  const tokens = tokenStore.get()
  if (tokens?.access) config.headers.Authorization = `Bearer ${tokens.access}`
  return config
})

let onSessionExpired = () => {}
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler
}

// When the 30-minute access token expires, get a new one with the refresh token and retry once.
// Parallel requests share one refresh call.
let refreshing = null
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const tokens = tokenStore.get()
    const canRefresh =
      error.response?.status === 401 && !original?._retried && !NO_REFRESH_URLS.includes(original?.url) && tokens?.refresh
    if (!canRefresh) {
      if (error.response?.status === 401 && !NO_REFRESH_URLS.includes(original?.url)) onSessionExpired()
      return Promise.reject(error)
    }
    original._retried = true
    try {
      refreshing ??= axios
        .post(`${API_URL}/api/auth/refresh/`, { refresh: tokens.refresh })
        .then(({ data }) => {
          tokenStore.set({ ...tokens, access: data.access })
          return data.access
        })
        .finally(() => {
          refreshing = null
        })
      const access = await refreshing
      original.headers.Authorization = `Bearer ${access}`
      return api(original)
    } catch (refreshError) {
      onSessionExpired()
      return Promise.reject(refreshError)
    }
  },
)

function firstMessage(value) {
  if (Array.isArray(value)) return firstMessage(value[0])
  if (value && typeof value === 'object') return firstMessage(Object.values(value)[0])
  return value ? String(value) : ''
}

/** One human sentence for a notification. */
export function errorMessage(error) {
  if (!error?.response) return 'Cannot reach the server. If it was asleep, wait a minute and try again.'
  const data = error.response.data
  if (error.response.status >= 500 || typeof data !== 'object' || data === null) {
    return 'Something went wrong on the server. Please try again.'
  }
  return firstMessage(data.detail ?? data.non_field_errors ?? data) || 'Something went wrong.'
}

/** DRF field errors -> { field: 'message' } for Mantine's form.setErrors. */
export function fieldErrors(error) {
  const data = error?.response?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  return Object.fromEntries(
    Object.entries(data)
      .filter(([field]) => !['detail', 'non_field_errors'].includes(field))
      .map(([field, value]) => [field, firstMessage(value)]),
  )
}

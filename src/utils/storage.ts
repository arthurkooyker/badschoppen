export function saveData<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data))
}

export function loadData<T>(key: string) {
  const raw = localStorage.getItem(key)

  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

import { useEffect, useState } from "react"

export function usePersistentState<T>(
  key: string,
  initial: T,
  normalize?: (value: T) => T
) {

  const [state, setState] = useState<T>(() => {

    const stored = localStorage.getItem(key)

    if (!stored) return initial

    try {
      const parsed = JSON.parse(stored) as T

      return normalize ? normalize(parsed) : parsed
    } catch {
      return initial
    }

  })

  useEffect(() => {
    const valueToStore = normalize ? normalize(state) : state

    localStorage.setItem(key, JSON.stringify(valueToStore))

  }, [key, normalize, state])

  return [state, setState] as const
}

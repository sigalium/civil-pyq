import { useSyncExternalStore } from 'react'

const entries = new Map()
const listeners = new Set()

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setScanEntry(id, entry) {
  entries.set(id, entry)
  listeners.forEach((listener) => listener())
}

export const isScanning = (id) => entries.get(id)?.state === 'scanning'

export const useScanEntry = (id) => useSyncExternalStore(subscribe, () => entries.get(id))

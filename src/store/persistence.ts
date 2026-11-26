/**
 * Custom persistence (NOT zustand `persist`): load/seed on startup, debounced save,
 * quota handling, cross-tab sync via the `storage` event.
 */
import { toast } from 'sonner'
import { generateSeed } from '@/data/generateSeed'
import type { DbState } from '@/types/domain'

export const DB_KEY = 'navya-erp:db:v1'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function parseDb(json: string | null): DbState | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as Partial<DbState>
    if (parsed && parsed.version === 1 && Array.isArray(parsed.branches) && parsed.salesDays) return parsed as DbState
  } catch {
    /* fall through */
  }
  return null
}

export function loadDb(): DbState | null {
  try {
    return parseDb(storage()?.getItem(DB_KEY) ?? null)
  } catch {
    return null
  }
}

export type SaveResult = { ok: true; json: string } | { ok: false; quota: boolean }

export function saveDb(db: DbState): SaveResult {
  const json = JSON.stringify(db)
  try {
    storage()?.setItem(DB_KEY, json)
    return { ok: true, json }
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    return { ok: false, quota }
  }
}

/** Load the persisted db, or seed (and save) a fresh one. */
export function loadOrSeed(): DbState {
  const existing = loadDb()
  if (existing) return existing
  const seeded = generateSeed(new Date())
  saveDb(seeded)
  return seeded
}

interface StoreLike {
  getState: () => { db: DbState }
  setState: (s: { db: DbState }) => void
  subscribe: (l: (s: { db: DbState }, prev: { db: DbState }) => void) => () => void
}

/** Wire debounced saving + cross-tab sync. Returns a disposer. Call once from main.tsx. */
export function initPersistence(store: StoreLike, debounceMs = 300): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastJson: string | null = null
  let warned = false

  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
    const res = saveDb(store.getState().db)
    if (res.ok) {
      lastJson = res.json
      warned = false
    } else if (!warned) {
      warned = true
      toast.error(res.quota ? 'Storage full — reset demo data' : 'Could not save data to this browser')
    }
  }

  const unsub = store.subscribe((s, prev) => {
    if (s.db === prev.db) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  })

  const onStorage = (e: StorageEvent) => {
    if (e.key !== DB_KEY || !e.newValue || e.newValue === lastJson) return
    const next = parseDb(e.newValue)
    if (!next) return
    lastJson = e.newValue
    if (timer) clearTimeout(timer)
    timer = undefined
    store.setState({ db: next })
  }
  const onHide = () => {
    if (document.visibilityState === 'hidden' && timer) flush()
  }
  const onPageHide = () => {
    if (timer) flush()
  }

  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onPageHide)
  return () => {
    unsub()
    if (timer) clearTimeout(timer)
    window.removeEventListener('storage', onStorage)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onPageHide)
  }
}

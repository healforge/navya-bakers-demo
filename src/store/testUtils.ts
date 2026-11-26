import { generateSeed } from '@/data/generateSeed'
import type { DbState } from '@/types/domain'
import type { OpCtx } from './ops'

export const NOW = new Date('2026-11-26T14:00:00')
export const TODAY = '2026-11-26'

let cached: DbState | null = null
/** Fresh deep copy of the seed anchored at NOW (14:00 on 26 Nov 2026). */
export function freshDb(): DbState {
  cached ??= generateSeed(NOW)
  return structuredClone(cached)
}

let n = 0
export const testCtx = (now: Date = NOW): OpCtx => ({ now, uid: () => `t${++n}` })

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { EVENT_LOG_LIMIT, type StorageAdapter, type StreamEvent } from './adapter'

const DATA_DIRECTORY = join(process.cwd(), '.data')

/** Vercel's filesystem is read-only, so persistence is skipped when deployed. */
const canPersistToDisk = !process.env.VERCEL

interface MemoryState {
  collections: Map<string, unknown[]>
  events: StreamEvent[]
  nextEventId: number
  loadedCollections: Set<string>
}

/**
 * Next.js hot-reloads modules in development, which would otherwise reset all
 * state on every file save. Hanging state off `globalThis` keeps it alive.
 */
const globalState = globalThis as typeof globalThis & { __aegisState?: MemoryState }

const state: MemoryState = (globalState.__aegisState ??= {
  collections: new Map(),
  events: [],
  nextEventId: 1,
  loadedCollections: new Set(),
})

async function loadFromDisk(name: string): Promise<void> {
  if (state.loadedCollections.has(name)) return
  state.loadedCollections.add(name)

  if (!canPersistToDisk) return

  try {
    const raw = await readFile(join(DATA_DIRECTORY, `${name}.json`), 'utf8')
    state.collections.set(name, JSON.parse(raw) as unknown[])
  } catch {
    // No file yet — a first run. Starting empty is correct.
  }
}

async function saveToDisk(name: string, items: readonly unknown[]): Promise<void> {
  if (!canPersistToDisk) return

  try {
    await mkdir(DATA_DIRECTORY, { recursive: true })
    await writeFile(join(DATA_DIRECTORY, `${name}.json`), JSON.stringify(items, null, 2), 'utf8')
  } catch {
    // Persistence is a convenience, never a correctness requirement. A failed
    // write must not take down an emergency broadcast.
  }
}

/**
 * In-memory storage with best-effort JSON persistence to `.data/`.
 * This is the default: clone the repo, `npm run dev`, and it works with no
 * database, no account, and no configuration.
 */
export const memoryAdapter: StorageAdapter = {
  async readCollection<T>(name: string): Promise<T[]> {
    await loadFromDisk(name)
    return [...((state.collections.get(name) ?? []) as T[])]
  },

  async writeCollection<T>(name: string, items: readonly T[]): Promise<void> {
    state.collections.set(name, [...items])
    await saveToDisk(name, items)
  },

  async appendEvent(type: string, payload: unknown): Promise<StreamEvent> {
    const event: StreamEvent = {
      id: state.nextEventId++,
      type,
      payload,
      at: new Date().toISOString(),
    }

    state.events.push(event)
    if (state.events.length > EVENT_LOG_LIMIT) {
      state.events.splice(0, state.events.length - EVENT_LOG_LIMIT)
    }

    return event
  },

  async readEventsSince(cursor: number): Promise<StreamEvent[]> {
    return state.events.filter((event) => event.id > cursor)
  },

  async latestEventId(): Promise<number> {
    return state.nextEventId - 1
  },
}

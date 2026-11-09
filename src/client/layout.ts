/**
 * Small browser-local persistence for the game's own window geometry. Nothing
 * here is durable product state: it only makes drag/resize survive the overlay
 * unmounting at the end of an Agent run.
 */

export interface SavedLayout {
  readonly x?: number
  readonly y?: number
  readonly cell?: number
}

const LAYOUT_KEY = 'dsh.token-tetris.layout.v1'

export function loadLayout(): SavedLayout {
  try {
    const raw = globalThis.localStorage?.getItem(LAYOUT_KEY)
    if (raw === null || raw === undefined) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return {}
    const value = parsed as Record<string, unknown>
    const layout: { x?: number; y?: number; cell?: number } = {}
    if (typeof value.x === 'number' && Number.isFinite(value.x)) layout.x = value.x
    if (typeof value.y === 'number' && Number.isFinite(value.y)) layout.y = value.y
    if (typeof value.cell === 'number' && Number.isFinite(value.cell)) layout.cell = value.cell
    return layout
  } catch {
    return {}
  }
}

export function saveLayout(layout: SavedLayout): void {
  try {
    globalThis.localStorage?.setItem(LAYOUT_KEY, JSON.stringify(layout))
  } catch {
    // Private windows and storage policy can reject writes; geometry still works
    // for the current run.
  }
}

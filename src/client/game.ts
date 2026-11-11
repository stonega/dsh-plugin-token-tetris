/**
 * Pure Tetris rules. No React, no DOM, no timers — the overlay owns those.
 *
 * The gravity interval is supplied by the component from the live assistant
 * token rate, which keeps the rules deterministic and easy to reason about.
 */

export const BOARD_WIDTH = 10
export const BOARD_HEIGHT = 20

export const PIECE_KINDS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'] as const
export type PieceKind = (typeof PIECE_KINDS)[number]

export type Board = (PieceKind | null)[][]

export interface ActivePiece {
  readonly kind: PieceKind
  readonly rotation: number
  readonly x: number
  readonly y: number
}

export type GameStatus = 'playing' | 'paused' | 'over'

/** Grace period after a piece touches down; horizontal moves can still adjust it. */
export const LOCK_DELAY_MS = 260

/** One piece's last locked cells, used by the presentation layer's sand effect. */
export interface LockEvent {
  readonly id: number
  readonly kind: PieceKind
  readonly cells: readonly (readonly [number, number])[]
}

export interface GameState {
  readonly board: Board
  readonly active: ActivePiece
  readonly queue: readonly PieceKind[]
  readonly score: number
  readonly lines: number
  readonly level: number
  readonly status: GameStatus
  readonly highScore: number
  /** Milliseconds spent resting on the stack during the current lock delay. */
  readonly lockTime: number
  /** The most recent lock, or null before the first piece settles. */
  readonly lastLock: LockEvent | null
  /** Monotonic game identity; restarts increment it so per-game stats reset. */
  readonly gameId: number
}

export type GameAction =
  | { readonly type: 'tick'; readonly dt: number }
  | { readonly type: 'move'; readonly dx: -1 | 1 }
  | { readonly type: 'rotate'; readonly dir: -1 | 1 }
  | { readonly type: 'soft-drop' }
  | { readonly type: 'hard-drop' }
  | { readonly type: 'toggle-pause' }
  | { readonly type: 'restart' }

export interface RenderCell {
  readonly kind: PieceKind
  readonly ghost: boolean
}

export type RenderGrid = (RenderCell | null)[][]

/**
 * Base matrices. The first rotation is the spawn pose; the remaining unique
 * rotations are derived once at module load.
 */
const BASE_MATRICES: Record<PieceKind, readonly (readonly number[])[]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
}

type Offset = readonly [number, number]

function rotateMatrix(matrix: readonly (readonly number[])[]): number[][] {
  const size = matrix.length
  return matrix.map((row, y) => row.map((_, x) => matrix[size - 1 - x]?.[y] ?? 0))
}

function shapeCells(matrix: readonly (readonly number[])[]): Offset[] {
  const cells: Offset[] = []
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < (matrix[y]?.length ?? 0); x += 1) {
      if (matrix[y]?.[x] === 1) cells.push([x, y])
    }
  }
  return cells
}

function uniqueRotations(base: readonly (readonly number[])[]): readonly (readonly Offset[])[] {
  const rotations: Offset[][] = []
  const seen = new Set<string>()
  let matrix = base.map((row) => [...row])
  for (let turn = 0; turn < 4; turn += 1) {
    const cells = shapeCells(matrix)
    const key = cells.map(([x, y]) => `${String(x)},${String(y)}`).join(';')
    if (!seen.has(key)) {
      seen.add(key)
      rotations.push(cells)
    }
    matrix = rotateMatrix(matrix)
  }
  return rotations
}

export const SHAPES: Record<PieceKind, readonly (readonly Offset[])[]> = Object.fromEntries(
  PIECE_KINDS.map((kind) => [kind, uniqueRotations(BASE_MATRICES[kind])]),
) as Record<PieceKind, readonly (readonly Offset[])[]>

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array<PieceKind | null>(BOARD_WIDTH).fill(null))
}

export function createPiece(kind: PieceKind): ActivePiece {
  const cells = SHAPES[kind][0] ?? []
  const minX = Math.min(...cells.map(([x]) => x))
  const maxX = Math.max(...cells.map(([x]) => x))
  const width = maxX - minX + 1
  return {
    kind,
    rotation: 0,
    x: Math.floor((BOARD_WIDTH - width) / 2) - minX,
    y: 0,
  }
}

function shuffledBag(): PieceKind[] {
  const bag = [...PIECE_KINDS]
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const value = bag[index] as PieceKind
    bag[index] = bag[swap] as PieceKind
    bag[swap] = value
  }
  return bag
}

function fillQueue(queue: readonly PieceKind[], minimum = 5): PieceKind[] {
  const next = [...queue]
  while (next.length < minimum) next.push(...shuffledBag())
  return next
}

function cellsOf(piece: ActivePiece, rotation = piece.rotation): readonly Offset[] {
  return SHAPES[piece.kind][rotation] ?? []
}

export function collides(
  board: Board,
  piece: ActivePiece,
  x = piece.x,
  y = piece.y,
  rotation = piece.rotation,
): boolean {
  for (const [dx, dy] of cellsOf(piece, rotation)) {
    const cellX = x + dx
    const cellY = y + dy
    if (cellX < 0 || cellX >= BOARD_WIDTH || cellY >= BOARD_HEIGHT) return true
    if (cellY >= 0 && board[cellY]?.[cellX] !== null) return true
  }
  return false
}

export function ghostY(board: Board, piece: ActivePiece): number {
  let y = piece.y
  while (!collides(board, piece, piece.x, y + 1)) y += 1
  return y
}

function withHighScore(state: GameState): GameState {
  if (state.score <= state.highScore) return state
  return { ...state, highScore: state.score }
}

function lockPiece(state: GameState): GameState {
  const board = state.board.map((row) => [...row])
  const lockedCells: Array<readonly [number, number]> = []
  let toppedOut = false
  for (const [dx, dy] of cellsOf(state.active)) {
    const x = state.active.x + dx
    const y = state.active.y + dy
    if (y < 0) {
      toppedOut = true
      continue
    }
    if (board[y] !== undefined) {
      board[y]![x] = state.active.kind
      lockedCells.push([x, y])
    }
  }

  const kept = board.filter((row) => row.some((cell) => cell === null))
  const cleared = BOARD_HEIGHT - kept.length
  const nextBoard: Board = [
    ...Array.from({ length: cleared }, () => Array<PieceKind | null>(BOARD_WIDTH).fill(null)),
    ...kept,
  ]

  const lineScores = [0, 100, 300, 500, 800]
  const gained = (lineScores[cleared] ?? 0) * state.level
  const lines = state.lines + cleared
  const level = Math.floor(lines / 10) + 1
  const queue = fillQueue(state.queue.slice(1))
  const kind = queue[0] ?? 'I'
  const active = createPiece(kind)
  const over = toppedOut || collides(nextBoard, active)

  return withHighScore({
    ...state,
    board: nextBoard,
    active,
    queue,
    score: state.score + gained,
    lines,
    level,
    status: over ? 'over' : 'playing',
    lockTime: 0,
    lastLock:
      lockedCells.length === 0
        ? state.lastLock
        : {
            id: (state.lastLock?.id ?? 0) + 1,
            kind: state.active.kind,
            cells: lockedCells,
          },
  })
}

function stepDown(state: GameState, manual: boolean, dt: number): GameState {
  if (state.status !== 'playing') return state
  if (!collides(state.board, state.active, state.active.x, state.active.y + 1)) {
    return withHighScore({
      ...state,
      active: { ...state.active, y: state.active.y + 1 },
      score: state.score + (manual ? 1 : 0),
      lockTime: 0,
    })
  }

  if (dt === 0) return state
  const lockTime = state.lockTime + dt
  if (lockTime >= LOCK_DELAY_MS) return lockPiece(state)
  return { ...state, lockTime }
}

export function createInitialState(highScore = 0, gameId = 1): GameState {
  const queue = fillQueue([], 5)
  const kind = queue[0] ?? 'I'
  return {
    board: createEmptyBoard(),
    active: createPiece(kind),
    queue: fillQueue(queue.slice(1), 5),
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
    highScore: Math.max(0, highScore),
    lockTime: 0,
    lastLock: null,
    gameId,
  }
}

export function reduceGame(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'tick':
      return stepDown(state, false, action.dt)
    case 'soft-drop':
      return stepDown(state, true, 0)
    case 'move': {
      if (state.status !== 'playing') return state
      if (!collides(state.board, state.active, state.active.x + action.dx, state.active.y)) {
        return { ...state, active: { ...state.active, x: state.active.x + action.dx }, lockTime: 0 }
      }
      return state
    }
    case 'rotate': {
      if (state.status !== 'playing') return state
      const rotations = SHAPES[state.active.kind].length
      const rotation = (state.active.rotation + action.dir + rotations) % rotations
      const kicks: readonly Offset[] = [
        [0, 0],
        [-1, 0],
        [1, 0],
        [-2, 0],
        [2, 0],
        [0, -1],
      ]
      for (const [dx, dy] of kicks) {
        if (!collides(state.board, state.active, state.active.x + dx, state.active.y + dy, rotation)) {
          return { ...state, active: { ...state.active, rotation, x: state.active.x + dx, y: state.active.y + dy }, lockTime: 0 }
        }
      }
      return state
    }
    case 'hard-drop': {
      if (state.status !== 'playing') return state
      const targetY = ghostY(state.board, state.active)
      const distance = targetY - state.active.y
      return lockPiece({
        ...state,
        active: { ...state.active, y: targetY },
        score: state.score + distance * 2,
      })
    }
    case 'toggle-pause':
      if (state.status === 'over') return state
      return { ...state, status: state.status === 'paused' ? 'playing' : 'paused' }
    case 'restart':
      return createInitialState(state.highScore, state.gameId + 1)
  }
}

/**
 * Falling interval in milliseconds for a level and streaming rate.
 * The baseline is a relaxed 900ms; every token/s tightens it, down to 70ms.
 */
export function gravityInterval(level: number, tokensPerSecond: number): number {
  // Idle gravity starts brisk (520ms) instead of the old 900ms, and keeps a
  // 95ms floor so even a hot stream stays controllable with the lock delay.
  const levelBase = Math.max(300, 520 - (Math.max(1, level) - 1) * 30)
  const rate = Math.max(0, Number.isFinite(tokensPerSecond) ? tokensPerSecond : 0)
  const interval = levelBase / (1 + rate * 0.085)
  return Math.max(95, Math.round(interval))
}

export function renderGrid(state: GameState): RenderGrid {
  const grid: RenderGrid = state.board.map((row) =>
    row.map((kind) => (kind === null ? null : { kind, ghost: false })),
  )

  const ghost = ghostY(state.board, state.active)
  if (ghost !== state.active.y) {
    for (const [dx, dy] of cellsOf(state.active)) {
      const x = state.active.x + dx
      const y = ghost + dy
      if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH && grid[y]?.[x] === null) {
        grid[y]![x] = { kind: state.active.kind, ghost: true }
      }
    }
  }

  for (const [dx, dy] of cellsOf(state.active)) {
    const x = state.active.x + dx
    const y = state.active.y + dy
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
      grid[y]![x] = { kind: state.active.kind, ghost: false }
    }
  }

  return grid
}

/** A 4x2 preview grid for the next piece, trimmed and centered. */
export function previewGrid(kind: PieceKind): (PieceKind | null)[][] {
  const cells = SHAPES[kind][0] ?? []
  const minX = Math.min(...cells.map(([x]) => x))
  const maxX = Math.max(...cells.map(([x]) => x))
  const minY = Math.min(...cells.map(([, y]) => y))
  const maxY = Math.max(...cells.map(([, y]) => y))
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  const offsetX = Math.floor((4 - width) / 2)
  const offsetY = Math.floor((2 - height) / 2)
  const grid = Array.from({ length: 2 }, () => Array<PieceKind | null>(4).fill(null))
  for (const [x, y] of cells) {
    grid[offsetY + y - minY]![offsetX + x - minX] = kind
  }
  return grid
}

const HIGH_SCORE_KEY = 'dsh.token-tetris.high-score.v1'

export function loadHighScore(): number {
  try {
    const value = Number(globalThis.localStorage?.getItem(HIGH_SCORE_KEY) ?? 0)
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  } catch {
    return 0
  }
}

export function saveHighScore(score: number): void {
  try {
    globalThis.localStorage?.setItem(HIGH_SCORE_KEY, String(Math.max(0, Math.floor(score))))
  } catch {
    // Storage may be unavailable in private windows; the game still works.
  }
}

import assert from 'node:assert/strict'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  collides,
  createEmptyBoard,
  createInitialState,
  createPiece,
  ghostY,
  gravityInterval,
  previewGrid,
  reduceGame,
  renderGrid,
  SHAPES,
} from '../src/client/game'

assert.equal(createEmptyBoard().length, BOARD_HEIGHT)
assert.equal(createEmptyBoard()[0]?.length, BOARD_WIDTH)
assert.equal(SHAPES.I.length, 4)
assert.equal(SHAPES.O.length, 1)
assert.equal(SHAPES.T.length, 4)

const initial = createInitialState(123)
assert.equal(initial.status, 'playing')
assert.equal(initial.highScore, 123)
assert.equal(initial.gameId, 1)
assert.ok(initial.queue.length >= 5)
assert.ok(collides(initial.board, createPiece('I'), -1, 0))
assert.ok(!collides(initial.board, createPiece('I'), 0, 0))

assert.equal(gravityInterval(1, 0), 520)
assert.ok(gravityInterval(1, 10) < 520)
assert.equal(gravityInterval(1, 100), 95)
assert.equal(gravityInterval(1, 1000), 95)
assert.equal(gravityInterval(1, 70), gravityInterval(1, 70))

const preview = previewGrid('I')
assert.equal(preview.length, 2)
assert.equal(preview[0]?.length, 4)

const board = createEmptyBoard()
for (let x = 2; x < BOARD_WIDTH; x += 1) board[BOARD_HEIGHT - 1]![x] = 'J'
const almost = {
  ...initial,
  board,
  active: { kind: 'O' as const, rotation: 0, x: 0, y: BOARD_HEIGHT - 2 },
  score: 0,
  lines: 0,
  level: 1,
  queue: ['T', 'S', 'Z', 'L', 'J'] as const,
}
const cleared = reduceGame(almost as any, { type: 'hard-drop' })
assert.equal(cleared.lines, 1)
assert.equal(cleared.score, 100)
assert.equal(cleared.lastLock?.kind, 'O')
assert.equal(cleared.lastLock?.cells.length, 4)
assert.equal(cleared.lastClear?.count, 1)
assert.equal(cleared.lastClear?.cells.length, 10)
assert.equal(cleared.board[BOARD_HEIGHT - 1]?.[2], null)
assert.equal(cleared.board[BOARD_HEIGHT - 1]?.[0], 'O')

const grounded = {
  ...initial,
  board: createEmptyBoard(),
  active: { kind: 'O' as const, rotation: 0, x: 0, y: BOARD_HEIGHT - 2 },
  lockTime: 0,
}
const resting = reduceGame(grounded as any, { type: 'tick', dt: 100 })
assert.equal(resting.status, 'playing')
assert.equal(resting.lockTime, 100)
assert.equal(reduceGame(resting, { type: 'move', dx: 1 }).lockTime, 0)
const locked = reduceGame(resting, { type: 'tick', dt: 200 })
assert.equal(locked.lockTime, 0)
assert.equal(locked.board[BOARD_HEIGHT - 1]?.[0], 'O')

const ghost = ghostY(almost.board, almost.active)
assert.equal(ghost, BOARD_HEIGHT - 2)
const grid = renderGrid(almost)
assert.equal(grid[BOARD_HEIGHT - 1]?.[0]?.kind, 'O')
assert.equal(grid[BOARD_HEIGHT - 1]?.[0]?.ghost, false)

const paused = reduceGame(initial, { type: 'toggle-pause' })
assert.equal(paused.status, 'paused')
assert.equal(reduceGame(paused, { type: 'tick', dt: 100 }), paused)
assert.equal(reduceGame(paused, { type: 'toggle-pause' }).status, 'playing')
assert.equal(reduceGame(initial, { type: 'restart' }).gameId, 2)

console.log('game: ok')

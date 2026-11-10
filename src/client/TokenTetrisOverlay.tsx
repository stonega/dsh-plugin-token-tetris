import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import {
  createInitialState,
  gravityInterval,
  loadHighScore,
  previewGrid,
  reduceGame,
  renderGrid,
  saveHighScore,
  type GameAction,
  type LockEvent,
  type PieceKind,
} from './game'
import { loadLayout, saveLayout } from './layout'
import type { TokenRateSnapshot } from './token-rate'

type Translate = (key: string, params?: Record<string, string | number>) => string

interface SessionStatusLike {
  readonly running?: boolean
}

interface PanelInfoLike {
  readonly activePanelId: unknown
}

interface Viewport {
  readonly width: number
  readonly height: number
}

interface Position {
  readonly x: number
  readonly y: number
}

interface ScreenRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

interface DragState {
  readonly pointerId: number
  readonly startX: number
  readonly startY: number
  readonly left: number
  readonly top: number
}

interface ResizeState {
  readonly pointerId: number
  readonly startX: number
  readonly startY: number
  readonly cell: number
}

interface RepeatState {
  timeout: number
  interval: number
}

interface SandParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  spin: number
  life: number
  maxLife: number
  alphaScale: number
  color: string
}

const MIN_CELL = 10
const MAX_CELL = 40
const MIN_FULLSCREEN_CELL = 16
const SIDE_MIN = 74

export interface TokenTetrisOverlayProps {
  useSessionStatus: (selector: (snapshot: ReadonlyMap<string, SessionStatusLike>) => boolean) => boolean
  usePanelInfo: (selector: (info: PanelInfoLike) => boolean) => boolean
  useTokenRate: <T>(selector: (snapshot: TokenRateSnapshot) => T) => T
  t: Translate
}

function anySessionRunning(statuses: ReadonlyMap<string, SessionStatusLike>): boolean {
  for (const status of statuses.values()) {
    if (status.running === true) return true
  }
  return false
}

function conversationVisible(info: PanelInfoLike): boolean {
  return info.activePanelId === null
}

function selectTokenRate(snapshot: TokenRateSnapshot): number {
  return snapshot.tokensPerSecond
}

function currentViewport(): Viewport {
  if (typeof window === 'undefined') return { width: 1440, height: 900 }
  return { width: window.innerWidth, height: window.innerHeight }
}

function defaultCellFor(viewport: Viewport): number {
  if (viewport.width < 520) return 10
  if (viewport.width < 720) return 11
  return 13
}

function sideFor(cell: number): number {
  return Math.max(SIDE_MIN, Math.round(cell * 5.2))
}

function miniCellFor(cell: number): number {
  return Math.max(8, Math.round(cell * 0.62))
}

function maxCellFor(viewport: Viewport): number {
  const byHeight = (viewport.height - 120) / 20
  const byWidth = (viewport.width - 80) / 15.5
  return Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(Math.min(byHeight, byWidth))))
}

function fullscreenCellFor(viewport: Viewport): number {
  const byHeight = (viewport.height - 180) / 20
  const byWidth = (viewport.width - 300) / 15.5
  return Math.max(MIN_FULLSCREEN_CELL, Math.min(MAX_CELL, Math.floor(Math.min(byHeight, byWidth))))
}

function clampCell(cell: number, viewport: Viewport): number {
  return Math.max(MIN_CELL, Math.min(maxCellFor(viewport), Math.round(cell)))
}

function panelEstimate(cell: number): { width: number; height: number } {
  return {
    width: 10 * cell + 19 + sideFor(cell) + 34,
    height: 20 * cell + 110,
  }
}

function clampPosition(x: number, y: number, cell: number, viewport: Viewport): Position {
  const panel = panelEstimate(cell)
  const margin = 8
  const maxX = Math.max(margin, viewport.width - panel.width - margin)
  const maxY = Math.max(margin, viewport.height - panel.height - margin)
  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY),
  }
}

/**
 * Frame-wide entry point. The overlay is mounted for the whole page lifetime,
 * but the game itself exists only while at least one Agent is running.
 */
export function TokenTetrisOverlay(props: TokenTetrisOverlayProps) {
  const agentRunning = props.useSessionStatus(anySessionRunning)
  const onConversation = props.usePanelInfo(conversationVisible)
  const tokensPerSecond = props.useTokenRate(selectTokenRate)

  if (!agentRunning || !onConversation) return null
  return <TetrisGame t={props.t} tokensPerSecond={tokensPerSecond} />
}

interface TetrisGameProps {
  t: Translate
  tokensPerSecond: number
}

function TetrisGame({ t, tokensPerSecond }: TetrisGameProps) {
  const [state, dispatch] = useReducer(reduceGame, undefined, () => createInitialState(loadHighScore()))
  const viewport0 = currentViewport()
  const savedLayout = useRef<{ x?: number; y?: number; cell?: number } | null>(null)
  if (savedLayout.current === null) savedLayout.current = loadLayout()
  const saved = savedLayout.current ?? {}
  const initialCell = clampCell(saved.cell ?? defaultCellFor(viewport0), viewport0)
  const initialPosition =
    typeof saved.x === 'number' && typeof saved.y === 'number'
      ? clampPosition(saved.x, saved.y, initialCell, viewport0)
      : null

  const [cell, setCell] = useState(initialCell)
  const [position, setPosition] = useState<Position | null>(initialPosition)
  const [viewport, setViewport] = useState(viewport0)
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenRect, setFullscreenRect] = useState<ScreenRect | null>(null)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<SandParticle[]>([])
  const sandFrameRef = useRef<number | null>(null)
  const sandDprRef = useRef(1)
  const autoFocusRef = useRef(true)
  const stateRef = useRef(state)
  stateRef.current = state
  const cellRef = useRef(cell)
  cellRef.current = cell
  const positionRef = useRef<Position | null>(position)
  positionRef.current = position
  const fullscreenRef = useRef(fullscreen)
  fullscreenRef.current = fullscreen
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  const tokens = Math.max(0, tokensPerSecond)
  const interval = gravityInterval(state.level, tokens)
  const intervalRef = useRef(interval)
  intervalRef.current = interval

  const displayCell = fullscreen ? fullscreenCellFor(fullscreenRect ?? viewport) : cell
  const displaySide = sideFor(displayCell)
  const displayMini = miniCellFor(displayCell)
  const panelStyle = {
    '--tt-cell': `${String(displayCell)}px`,
    '--tt-side': `${String(displaySide)}px`,
    '--tt-mini-cell': `${String(displayMini)}px`,
  } as CSSProperties
  const fullscreenStyle: CSSProperties | undefined =
    fullscreen && fullscreenRect !== null
      ? {
          left: fullscreenRect.left,
          top: fullscreenRect.top,
          width: fullscreenRect.width,
          height: fullscreenRect.height,
          right: 'auto',
          bottom: 'auto',
          transform: 'none',
        }
      : undefined
  const rootStyle: CSSProperties | undefined = fullscreen
    ? fullscreenStyle
    : position !== null
      ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto', transform: 'none' }
      : undefined

  const grid = useMemo(() => renderGrid(state), [state])
  const next = useMemo(() => previewGrid(state.queue[0] ?? 'I'), [state.queue])
  const ratePercent = Math.min(100, (tokens / 80) * 100)

  const resolvePieceColor = (kind: PieceKind): string => {
    const panel = panelRef.current
    if (panel === null) return '#888888'
    const swatch = document.createElement('span')
    swatch.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;background:var(--tt-${kind.toLowerCase()})`
    panel.append(swatch)
    const color = getComputedStyle(swatch).backgroundColor
    swatch.remove()
    return color === '' || color === 'rgba(0, 0, 0, 0)' ? '#888888' : color
  }

  const startSandLoop = (): void => {
    if (sandFrameRef.current !== null) return
    let last = performance.now()
    const frame = (now: number): void => {
      sandFrameRef.current = null
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (canvas === null || context === null) return
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const dpr = sandDprRef.current
      const width = canvas.width / dpr
      const height = canvas.height / dpr
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      const particles = particlesRef.current
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index]
        if (particle === undefined) continue
        particle.life -= dt
        if (particle.life <= 0 || particle.y > height + 24) {
          particles.splice(index, 1)
          continue
        }
        particle.vy += 320 * dt
        particle.vx *= 1 - Math.min(0.2, dt * 1.8)
        particle.x += particle.vx * dt
        particle.y += particle.vy * dt
        particle.rotation += particle.spin * dt
        const alpha = Math.max(0, particle.life / particle.maxLife) * particle.alphaScale
        context.globalAlpha = alpha
        context.fillStyle = particle.color
        context.save()
        context.translate(particle.x, particle.y)
        context.rotate(particle.rotation)
        context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size)
        context.restore()
      }
      context.globalAlpha = 1
      if (particles.length === 0) return
      sandFrameRef.current = requestAnimationFrame(frame)
    }
    sandFrameRef.current = requestAnimationFrame(frame)
  }

  const spawnSand = (lock: LockEvent): void => {
    const cell = displayCell
    const step = cell + 1
    const pad = 5
    const color = resolvePieceColor(lock.kind)
    const particles = particlesRef.current
    for (const [cellX, cellY] of lock.cells) {
      const centerX = pad + cellX * step + cell / 2
      const centerY = pad + cellY * step + cell / 2
      const grains = 16 + Math.floor(Math.random() * 6)
      for (let index = 0; index < grains; index += 1) {
        const size = Math.max(1.4, cell * (0.08 + Math.random() * 0.1))
        const life = 0.85 + Math.random() * 0.5
        particles.push({
          x: centerX + (Math.random() - 0.5) * cell * 0.9,
          y: centerY + (Math.random() - 0.5) * cell * 0.9,
          vx: (Math.random() - 0.5) * cell * 5,
          vy: -cell * (0.8 + Math.random() * 1.6),
          size,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 14,
          life,
          maxLife: life,
          alphaScale: 0.82 + Math.random() * 0.18,
          color,
        })
      }
      for (let index = 0; index < 4; index += 1) {
        const size = Math.max(3, cell * (0.28 + Math.random() * 0.2))
        const life = 0.5 + Math.random() * 0.35
        particles.push({
          x: centerX + (Math.random() - 0.5) * cell * 0.7,
          y: centerY + (Math.random() - 0.5) * cell * 0.7,
          vx: (Math.random() - 0.5) * cell * 2.2,
          vy: -cell * (0.3 + Math.random() * 0.8),
          size,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 4,
          life,
          maxLife: life,
          alphaScale: 0.18 + Math.random() * 0.16,
          color,
        })
      }
    }
    if (particles.length > 900) particles.splice(0, particles.length - 900)
    startSandLoop()
  }

  useEffect(() => {
    saveHighScore(state.highScore)
  }, [state.highScore])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = canvas?.parentElement
    if (canvas === null || wrap === null || wrap === undefined) return
    const measure = (): void => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      sandDprRef.current = dpr
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [displayCell, fullscreen])

  const lastLock = state.lastLock
  useEffect(() => {
    if (lastLock !== null) spawnSand(lastLock)
    // spawnSand reads the current geometry and theme; only a new lock should spawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastLock])

  useEffect(() => {
    return () => {
      if (sandFrameRef.current !== null) cancelAnimationFrame(sandFrameRef.current)
      sandFrameRef.current = null
      particlesRef.current = []
    }
  }, [])

  useEffect(() => {
    const onFocusShortcut = (event: KeyboardEvent): void => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.code !== 'KeyG' && event.key.toLowerCase() !== 'g') return
      const modal = document.querySelector('[role="dialog"][aria-modal="true"]')
      if (modal !== null && !modal.closest('[data-token-tetris]')) return
      event.preventDefault()
      panelRef.current?.focus({ preventScroll: true })
    }
    window.addEventListener('keydown', onFocusShortcut)
    return () => window.removeEventListener('keydown', onFocusShortcut)
  }, [])

  useEffect(() => {
    const panel = panelRef.current
    if (panel === null) return
    let cancelled = false
    let userLeft = false
    const externalModalOpen = (): boolean => {
      const modal = document.querySelector('[role="dialog"][aria-modal="true"]')
      return modal !== null && modal.closest('[data-token-tetris]') === null
    }
    const tryFocus = (): void => {
      if (cancelled || userLeft) return
      if (externalModalOpen()) return
      if (panel.contains(document.activeElement)) return
      panel.focus({ preventScroll: true })
    }
    const frame = requestAnimationFrame(tryFocus)
    const timers = [
      window.setTimeout(tryFocus, 150),
      window.setTimeout(tryFocus, 400),
      window.setTimeout(tryFocus, 700),
    ]
    const settle = window.setTimeout(() => {
      autoFocusRef.current = false
    }, 750)
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && panel.contains(event.target)) return
      userLeft = true
      autoFocusRef.current = false
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      for (const timer of timers) clearTimeout(timer)
      clearTimeout(settle)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [])

  useEffect(() => {
    const panel = panelRef.current
    if (panel === null) return
    const pauseIfPlaying = (): void => {
      if (stateRef.current.status === 'playing') dispatch({ type: 'toggle-pause' })
    }
    const onFocusOut = (event: FocusEvent): void => {
      if (autoFocusRef.current) return
      const next = event.relatedTarget
      if (next instanceof Node && panel.contains(next)) return
      pauseIfPlaying()
    }
    const onVisibilityChange = (): void => {
      if (document.hidden) pauseIfPlaying()
    }
    panel.addEventListener('focusout', onFocusOut)
    window.addEventListener('blur', pauseIfPlaying)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      panel.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('blur', pauseIfPlaying)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useLayoutEffect(() => {
    if (!fullscreen) {
      setFullscreenRect(null)
      return
    }
    const root = rootRef.current
    if (root === null) return
    let observed: HTMLElement | null = null

    const measure = (): void => {
      const layer = root.closest('[data-shell-overlay]')
      const frame = layer?.parentElement
      const children = frame === undefined || frame === null ? [] : (Array.from(frame.children) as HTMLElement[])
      const center = children.find((element) => {
        if (element === layer) return false
        if (
          element.hasAttribute('data-shell-bottom') ||
          element.hasAttribute('data-shell-overlay') ||
          element.hasAttribute('data-shell-leading')
        ) {
          return false
        }
        const style = getComputedStyle(element)
        return style.display === 'flex' && style.flexDirection === 'column' && style.minWidth === '0px'
      })
      observed = center ?? null
      const rect = center?.getBoundingClientRect()
      setFullscreenRect(
        rect === undefined
          ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
          : { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      )
    }

    measure()
    const observer = observed === null ? undefined : new ResizeObserver(measure)
    if (observed !== null && observer !== undefined) observer.observe(observed)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [fullscreen])

  useEffect(() => {
    const onResize = (): void => {
      const nextViewport = currentViewport()
      setViewport(nextViewport)
      const nextCell = clampCell(cellRef.current, nextViewport)
      if (nextCell !== cellRef.current) {
        cellRef.current = nextCell
        setCell(nextCell)
      }
      const currentPosition = positionRef.current
      if (currentPosition !== null) {
        const clamped = clampPosition(currentPosition.x, currentPosition.y, nextCell, nextViewport)
        positionRef.current = clamped
        setPosition(clamped)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    let accumulated = 0

    const tick = (now: number): void => {
      const delta = Math.min(now - last, 250)
      last = now
      if (!document.hidden && stateRef.current.status === 'playing') {
        accumulated += delta
        let guard = 0
        while (accumulated >= intervalRef.current && guard < 4) {
          accumulated -= intervalRef.current
          dispatch({ type: 'tick', dt: intervalRef.current })
          guard += 1
        }
        if (guard === 4) accumulated = 0
      } else {
        accumulated = 0
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const repeats = new Map<string, RepeatState>()

    const stopRepeat = (code: string): void => {
      const record = repeats.get(code)
      if (record === undefined) return
      clearTimeout(record.timeout)
      clearInterval(record.interval)
      repeats.delete(code)
    }

    const stopAllRepeats = (): void => {
      for (const code of [...repeats.keys()]) stopRepeat(code)
    }

    const startRepeat = (code: string, action: GameAction, delay: number, every: number): void => {
      if (repeats.has(code)) return
      const record: RepeatState = { timeout: 0, interval: 0 }
      record.timeout = window.setTimeout(() => {
        if (panelRef.current?.contains(document.activeElement) !== true) {
          stopRepeat(code)
          return
        }
        record.interval = window.setInterval(() => {
          if (panelRef.current?.contains(document.activeElement) !== true) {
            stopRepeat(code)
            return
          }
          dispatch(action)
        }, every)
      }, delay)
      repeats.set(code, record)
    }

    const repeatCode = (key: string): string | null => {
      switch (key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          return 'left'
        case 'ArrowRight':
        case 'd':
        case 'D':
          return 'right'
        case 'ArrowDown':
        case 's':
        case 'S':
          return 'down'
        default:
          return null
      }
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      const panel = panelRef.current
      if (panel === null || !panel.contains(document.activeElement)) return
      if (event.repeat) return
      const target = event.target
      if (target instanceof HTMLElement) {
        if (target.isContentEditable) return
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (tag === 'BUTTON' && (event.key === ' ' || event.key === 'Enter')) return
      }

      const key = event.key
      switch (key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          event.preventDefault()
          dispatch({ type: 'move', dx: -1 })
          stopRepeat('right')
          startRepeat('left', { type: 'move', dx: -1 }, 165, 45)
          return
        case 'ArrowRight':
        case 'd':
        case 'D':
          event.preventDefault()
          dispatch({ type: 'move', dx: 1 })
          stopRepeat('left')
          startRepeat('right', { type: 'move', dx: 1 }, 165, 45)
          return
        case 'ArrowDown':
        case 's':
        case 'S':
          event.preventDefault()
          dispatch({ type: 'soft-drop' })
          startRepeat('down', { type: 'soft-drop' }, 115, 45)
          return
        case 'ArrowUp':
        case 'w':
        case 'W':
          event.preventDefault()
          dispatch({ type: 'rotate', dir: 1 })
          return
        case ' ':
        case 'Spacebar':
          event.preventDefault()
          dispatch({ type: 'hard-drop' })
          return
        case 'p':
        case 'P':
          event.preventDefault()
          dispatch({ type: 'toggle-pause' })
          return
        case 'f':
        case 'F':
          event.preventDefault()
          setFullscreen((value) => !value)
          return
        case 'Escape':
          event.preventDefault()
          if (fullscreenRef.current) setFullscreen(false)
          else dispatch({ type: 'toggle-pause' })
          return
        case 'r':
        case 'R':
          event.preventDefault()
          dispatch({ type: 'restart' })
          return
        default:
          return
      }
    }

    const onKeyUp = (event: KeyboardEvent): void => {
      const code = repeatCode(event.key)
      if (code !== null) stopRepeat(code)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', stopAllRepeats)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', stopAllRepeats)
      stopAllRepeats()
    }
  }, [])

  const focusPanel = (event: PointerEvent<HTMLElement>): void => {
    const target = event.target
    if (target instanceof HTMLElement && target.closest('button, input, textarea, select') !== null) return
    panelRef.current?.focus({ preventScroll: true })
  }

  const toggleFullscreen = (): void => {
    setFullscreen((value) => {
      fullscreenRef.current = !value
      return !value
    })
    panelRef.current?.focus({ preventScroll: true })
  }

  const onRootPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!fullscreenRef.current) return
    if (event.target === event.currentTarget) setFullscreen(false)
  }

  const persistLayout = (): void => {
    const currentPosition = positionRef.current
    saveLayout({
      cell: cellRef.current,
      ...(currentPosition === null ? {} : { x: currentPosition.x, y: currentPosition.y }),
    })
  }

  const onHeaderPointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (fullscreenRef.current || event.button !== 0) return
    const target = event.target
    if (target instanceof HTMLElement && target.closest('button') !== null) return
    const root = rootRef.current
    if (root === null) return
    const rect = root.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    setDragging(true)
    panelRef.current?.focus({ preventScroll: true })
  }

  const onHeaderPointerMove = (event: PointerEvent<HTMLElement>): void => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    const next = clampPosition(
      drag.left + event.clientX - drag.startX,
      drag.top + event.clientY - drag.startY,
      cellRef.current,
      viewport,
    )
    positionRef.current = next
    setPosition(next)
  }

  const endDrag = (event: PointerEvent<HTMLElement>): void => {
    const drag = dragRef.current
    if (drag === null) return
    dragRef.current = null
    setDragging(false)
    try {
      event.currentTarget.releasePointerCapture(drag.pointerId)
    } catch {
      // The pointer can already be released by the browser.
    }
    persistLayout()
  }

  const onResizePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (fullscreenRef.current || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cell: cellRef.current,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizing(true)
  }

  const onResizePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const resize = resizeRef.current
    if (resize === null || resize.pointerId !== event.pointerId) return
    const delta = ((event.clientX - resize.startX) / 10 + (event.clientY - resize.startY) / 20) / 2
    const next = clampCell(Math.round(resize.cell + delta), viewport)
    cellRef.current = next
    setCell(next)
  }

  const endResize = (event: PointerEvent<HTMLDivElement>): void => {
    const resize = resizeRef.current
    if (resize === null) return
    resizeRef.current = null
    setResizing(false)
    try {
      event.currentTarget.releasePointerCapture(resize.pointerId)
    } catch {
      // The pointer can already be released by the browser.
    }
    const currentPosition = positionRef.current
    if (currentPosition !== null) {
      const clamped = clampPosition(currentPosition.x, currentPosition.y, cellRef.current, viewport)
      positionRef.current = clamped
      setPosition(clamped)
    }
    persistLayout()
  }

  const act = (action: GameAction): void => {
    dispatch(action)
    panelRef.current?.focus({ preventScroll: true })
  }
  const boardLabel = t('aria.board', { score: state.score, lines: state.lines })

  return (
    <div
      ref={rootRef}
      className="tt-root"
      data-token-tetris=""
      data-fullscreen={fullscreen || undefined}
      data-dragging={dragging || undefined}
      data-resizing={resizing || undefined}
      style={rootStyle}
      onPointerDown={onRootPointerDown}
    >
      <section
        ref={panelRef}
        className="tt-panel"
        style={panelStyle}
        role={fullscreen ? 'dialog' : 'region'}
        aria-modal={fullscreen || undefined}
        aria-label={t('aria.region')}
        tabIndex={0}
        onPointerDown={focusPanel}
      >
        <header
          className="tt-head"
          title={fullscreen ? undefined : t('aria.drag')}
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={() => {
            if (dragRef.current !== null) {
              dragRef.current = null
              setDragging(false)
              persistLayout()
            }
          }}
        >
          <span className="tt-grip" aria-hidden="true">
            ⠿
          </span>
          <span className="tt-live">
            <span className="tt-dot" aria-hidden="true" />
            <span className="tt-title">{t('title')}</span>
          </span>
          <button
            type="button"
            className="tt-icon"
            aria-label={fullscreen ? t('aria.exitFullscreen') : t('aria.fullscreen')}
            onClick={toggleFullscreen}
          >
            {fullscreen ? '⤡' : '⛶'}
          </button>
          <button
            type="button"
            className="tt-icon"
            aria-label={state.status === 'paused' ? t('aria.resume') : t('aria.pause')}
            onClick={() => act({ type: 'toggle-pause' })}
          >
            {state.status === 'paused' ? '▶' : '❚❚'}
          </button>
        </header>

        <div className="tt-body">
          <div className="tt-board-wrap">
            <div className="tt-board" role="img" aria-label={boardLabel}>
              {grid.map((row, y) =>
                row.map((cell, x) => (
                  <div
                    key={`${String(x)}-${String(y)}`}
                    className="tt-cell"
                    aria-hidden="true"
                    data-piece={cell?.kind.toLowerCase()}
                    data-ghost={cell?.ghost === true ? '' : undefined}
                  />
                )),
              )}
            </div>
            <canvas ref={canvasRef} className="tt-sand" aria-hidden="true" />

            {state.status === 'paused' && (
              <div className="tt-modal" role="status">
                <div className="tt-modal-title">{t('paused')}</div>
                <div className="tt-modal-sub">{t('paused.hint')}</div>
                <button
                  type="button"
                  className="tt-modal-btn"
                  onClick={() => act({ type: 'toggle-pause' })}
                >
                  {t('resume')}
                </button>
              </div>
            )}

            {state.status === 'over' && (
              <div className="tt-modal" role="status">
                <div className="tt-modal-title">{t('gameOver')}</div>
                <div className="tt-modal-sub">{t('finalScore', { score: state.score })}</div>
                <button type="button" className="tt-modal-btn" onClick={() => act({ type: 'restart' })}>
                  {t('restart')}
                </button>
              </div>
            )}
          </div>

          <aside className="tt-side">
            <div className="tt-block">
              <span className="tt-label">{t('next')}</span>
              <div className="tt-next" role="img" aria-label={t('aria.next')}>
                {next.map((row, y) =>
                  row.map((kind, x) => (
                    <div
                      key={`${String(x)}-${String(y)}`}
                      className="tt-mini"
                      aria-hidden="true"
                      data-piece={kind?.toLowerCase()}
                    />
                  )),
                )}
              </div>
            </div>

            <div className="tt-stats">
              <Stat label={t('stat.score')} value={formatNumber(state.score)} />
              <Stat label={t('stat.lines')} value={formatNumber(state.lines)} />
              <Stat label={t('stat.level')} value={formatNumber(state.level)} />
              <Stat label={t('stat.best')} value={formatNumber(state.highScore)} />
              <Stat label={t('stat.gravity')} value={`${String(interval)}ms`} />
            </div>

            <div className="tt-pad">
              <button
                type="button"
                className="tt-pad-btn"
                aria-label={t('aria.moveLeft')}
                onClick={() => act({ type: 'move', dx: -1 })}
              >
                ←
              </button>
              <button
                type="button"
                className="tt-pad-btn"
                aria-label={t('aria.rotate')}
                onClick={() => act({ type: 'rotate', dir: 1 })}
              >
                ↻
              </button>
              <button
                type="button"
                className="tt-pad-btn"
                aria-label={t('aria.moveRight')}
                onClick={() => act({ type: 'move', dx: 1 })}
              >
                →
              </button>
              <button
                type="button"
                className="tt-pad-btn"
                aria-label={t('aria.softDrop')}
                onClick={() => act({ type: 'soft-drop' })}
              >
                ↓
              </button>
              <button
                type="button"
                className="tt-pad-btn"
                data-span="2"
                aria-label={t('aria.hardDrop')}
                onClick={() => act({ type: 'hard-drop' })}
              >
                ⤓
              </button>
            </div>
          </aside>
        </div>

        <footer className="tt-foot">
          <div className="tt-bar" aria-hidden="true">
            <span className="tt-bar-fill" style={{ width: `${String(Math.round(ratePercent))}%` }} />
          </div>
          <span className="tt-rate" data-hot={tokens > 0}>
            {t('tokensPerSecond', { rate: Math.round(tokens) })}
          </span>
          <span className="tt-kbd" title={t('hint.full')}>
            {t('focus.shortcut')}
          </span>
        </footer>

        <div
          className="tt-resize"
          role="separator"
          aria-label={t('aria.resize')}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onLostPointerCapture={() => {
            if (resizeRef.current !== null) {
              resizeRef.current = null
              setResizing(false)
              persistLayout()
            }
          }}
        />
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="tt-stat">
      <span className="tt-stat-key">{label}</span>
      <span className="tt-stat-value">{value}</span>
    </div>
  )
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}

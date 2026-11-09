/**
 * Live assistant token-rate source for the game.
 *
 * The browser's Session Controller publishes an append-only event window per
 * retained Session. We subscribe to every currently running Session's window,
 * read only `assistant/live-chunk` appends, and estimate output tokens from the
 * streamed text/reasoning/tool-argument deltas. A rolling two-second window
 * gives the game a smooth, visibly streaming gravity.
 *
 * This is presentation-side telemetry only: nothing here is persisted and
 * nothing reaches a model request.
 */

export interface TokenRateSnapshot {
  /** Estimated streamed output tokens per second over the rolling window. */
  readonly tokensPerSecond: number
  /** Number of Session rows currently reported as running. */
  readonly activeSessions: number
}

export interface TokenRateSource {
  getSnapshot(): TokenRateSnapshot
  subscribe(listener: () => void): () => void
}

interface ObservableSnapshot<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

interface Entry {
  readonly type: 'event' | 'transient'
  readonly event: {
    readonly type: string
    readonly data?: {
      readonly chunk?: {
        readonly type: string
        readonly text?: string
        readonly argumentsDelta?: string
      }
    }
  }
}

interface EventWindow {
  readonly change: {
    readonly kind: 'replace' | 'prepend' | 'append' | 'settle-assistant'
    readonly entries?: readonly Entry[]
  }
}

interface SessionSummary {
  readonly running?: boolean
}

interface SessionListState {
  readonly ids: readonly string[]
  readonly byId: Readonly<Record<string, SessionSummary | undefined>>
}

interface SessionBinding {
  readonly sessionId: string
  readonly eventSource: ObservableSnapshot<EventWindow>
}

export interface SessionsFace {
  readonly list: ObservableSnapshot<SessionListState>
  binding(id: string): SessionBinding | undefined
}

export interface TokenRateContext {
  readonly sessions: SessionsFace
  effect(callback: () => (() => void) | void, label?: string): void
}

const WINDOW_MS = 2000
const IDLE_MS = 1500
const TICK_MS = 200

interface Sample {
  readonly at: number
  readonly tokens: number
}

interface BindingRecord {
  readonly binding: SessionBinding
  readonly unsubscribe: () => void
}

/**
 * Estimate tokens from a streamed text fragment. CJK characters are close to
 * one token each, while Latin text averages roughly four characters per token.
 */
export function estimateTokens(text: string): number {
  let cjk = 0
  let other = 0
  for (const character of text) {
    if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(character)) cjk += 1
    else other += 1
  }
  return cjk + other / 4
}

function chunkTokens(entry: Entry): number {
  if (entry.type !== 'transient' || entry.event.type !== 'assistant/live-chunk') return 0
  const chunk = entry.event.data?.chunk
  if (chunk === undefined) return 0
  switch (chunk.type) {
    case 'text-delta':
    case 'reasoning-delta':
      return typeof chunk.text === 'string' ? estimateTokens(chunk.text) : 0
    case 'tool-call-delta':
      return typeof chunk.argumentsDelta === 'string' ? estimateTokens(chunk.argumentsDelta) : 0
    default:
      return 0
  }
}

export class TokenRateMonitor implements TokenRateSource {
  private readonly sessions: SessionsFace
  private readonly listeners = new Set<() => void>()
  private readonly samples: Sample[] = []
  private readonly bindings = new Map<string, BindingRecord>()
  private listUnsubscribe: (() => void) | undefined
  private timer: ReturnType<typeof setInterval> | undefined
  private snapshot: TokenRateSnapshot = { tokensPerSecond: 0, activeSessions: 0 }
  private runningCount = 0

  readonly source: TokenRateSource

  constructor(sessions: SessionsFace) {
    this.sessions = sessions
    this.source = {
      getSnapshot: () => this.snapshot,
      subscribe: (listener) => this.subscribe(listener),
    }
  }

  start(): void {
    this.listUnsubscribe = this.sessions.list.subscribe(() => {
      this.syncBindings()
      this.publish()
    })
    this.syncBindings()
    this.timer = setInterval(() => {
      this.prune(performance.now())
      this.syncBindings()
      this.publish()
    }, TICK_MS)
  }

  dispose(): void {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
    this.listUnsubscribe?.()
    this.listUnsubscribe = undefined
    for (const record of this.bindings.values()) record.unsubscribe()
    this.bindings.clear()
    this.listeners.clear()
    this.samples.length = 0
  }

  getSnapshot(): TokenRateSnapshot {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private syncBindings(): void {
    const state = this.sessions.list.getSnapshot()
    const running = new Set<string>()
    for (const id of state.ids) {
      if (state.byId[id]?.running === true) running.add(id)
    }
    this.runningCount = running.size

    for (const [id, record] of this.bindings) {
      if (running.has(id)) continue
      record.unsubscribe()
      this.bindings.delete(id)
    }

    for (const id of running) {
      const binding = this.sessions.binding(id)
      if (binding === undefined) continue
      const existing = this.bindings.get(id)
      if (existing?.binding === binding) continue
      existing?.unsubscribe()
      const unsubscribe = binding.eventSource.subscribe(() => {
        this.accept(binding)
      })
      this.bindings.set(id, { binding, unsubscribe })
    }
  }

  private accept(binding: SessionBinding): void {
    const window = binding.eventSource.getSnapshot()
    const change = window.change
    if (change.kind !== 'append' || change.entries === undefined) return

    let tokens = 0
    for (const entry of change.entries) tokens += chunkTokens(entry)
    if (tokens <= 0) return

    const now = performance.now()
    this.samples.push({ at: now, tokens })
    this.prune(now)
    this.publish()
  }

  private prune(now: number): void {
    const cutoff = now - WINDOW_MS
    while (this.samples.length > 0 && (this.samples[0]?.at ?? now) < cutoff) this.samples.shift()
  }

  private rate(now: number): number {
    this.prune(now)
    const last = this.samples[this.samples.length - 1]
    if (last === undefined || now - last.at > IDLE_MS) return 0
    let tokens = 0
    for (const sample of this.samples) tokens += sample.tokens
    return tokens / (WINDOW_MS / 1000)
  }

  private publish(): void {
    const tokensPerSecond = Math.round(this.rate(performance.now()) * 10) / 10
    if (
      tokensPerSecond === this.snapshot.tokensPerSecond &&
      this.runningCount === this.snapshot.activeSessions
    ) {
      return
    }
    this.snapshot = { tokensPerSecond, activeSessions: this.runningCount }
    for (const listener of this.listeners) listener()
  }
}

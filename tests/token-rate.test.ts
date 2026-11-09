import assert from 'node:assert/strict'
import { TokenRateMonitor } from '../src/client/token-rate'

class Source<T> {
  private listeners = new Set<() => void>()
  private value: T
  constructor(value: T) { this.value = value }
  getSnapshot(): T { return this.value }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  set(value: T): void {
    this.value = value
    for (const listener of this.listeners) listener()
  }
}

const list = new Source<any>({ ids: ['s1'], byId: { s1: { running: true } } })
const events = new Source<any>({ change: { kind: 'replace', entries: [] } })
const binding = { sessionId: 's1', eventSource: events }
const sessions = { list, binding: (id: string) => (id === 's1' ? binding : undefined) }

const monitor = new TokenRateMonitor(sessions as any)
monitor.start()
await new Promise((resolve) => setTimeout(resolve, 250))

function pushChunk(chunk: any): void {
  events.set({ change: { kind: 'append', entries: [{ type: 'transient', event: { type: 'assistant/live-chunk', data: { chunk } } }] } })
}

for (let i = 0; i < 12; i += 1) pushChunk({ type: 'text-delta', text: 'hello world! '.repeat(3) })
await new Promise((resolve) => setTimeout(resolve, 250))
const hot = monitor.getSnapshot()
assert.ok(hot.tokensPerSecond > 20, `expected a hot rate, got ${String(hot.tokensPerSecond)}`)
assert.equal(hot.activeSessions, 1)

const before = monitor.getSnapshot().tokensPerSecond
for (let i = 0; i < 4; i += 1) pushChunk({ type: 'reasoning-delta', text: '思考一下'.repeat(10) })
await new Promise((resolve) => setTimeout(resolve, 250))
assert.ok(monitor.getSnapshot().tokensPerSecond >= before)

events.set({ change: { kind: 'replace', entries: [{ type: 'transient', event: { type: 'assistant/live-chunk', data: { chunk: { type: 'text-delta', text: 'x'.repeat(1000) } } } }] } })
const afterReplace = monitor.getSnapshot().tokensPerSecond
await new Promise((resolve) => setTimeout(resolve, 250))
assert.ok(monitor.getSnapshot().tokensPerSecond <= afterReplace + 1)

await new Promise((resolve) => setTimeout(resolve, 2200))
assert.equal(monitor.getSnapshot().tokensPerSecond, 0)

list.set({ ids: ['s1'], byId: { s1: { running: false } } })
await new Promise((resolve) => setTimeout(resolve, 250))
assert.equal(monitor.getSnapshot().activeSessions, 0)

monitor.dispose()
console.log('token-rate: ok')

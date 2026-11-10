/**
 * Browser half of the Token Tetris plugin.
 *
 * The game is a `shell.overlay` list entry: the frame-wide floating layer sits
 * above every column, is click-through by default, and lets each entry opt into
 * pointer events. The entry is always registered; the component renders only
 * while a Session reports `running`, which is exactly "the agent is working".
 */
import { TokenTetrisOverlay } from './TokenTetrisOverlay'
import { EN, ZH } from './locale'
import { STYLES } from './styles'
import { TokenRateMonitor, type SessionsFace } from './token-rate'

interface LocaleFace {
  register(namespace: string, locale: string, dictionary: Record<string, string>): () => void
}

interface SlotOptions {
  name: string
  id: string
  order?: number
  locale?: string
  inject?: () => { hooks: Record<string, unknown> }
}

interface SlotsFace {
  inject(key: string, callback: () => () => void): () => void
  register(options: SlotOptions, component: unknown): () => void
}

interface ClientContext {
  slots: SlotsFace
  sessions: SessionsFace
  locale: LocaleFace
  effect(callback: () => (() => void) | void, label?: string): void
}

export const name = 'dsh-plugin-token-tetris'
export const inject = ['slots', 'sessions', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.dshTokenTetris = ''
    style.textContent = STYLES
    document.head.append(style)
    return () => style.remove()
  }, 'token-tetris: styles')

  ctx.effect(() => {
    const disposers = [
      ctx.locale.register('token-tetris', 'en', EN),
      ctx.locale.register('token-tetris', 'zh', ZH),
    ]
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'token-tetris: locale dictionaries')

  const monitor = new TokenRateMonitor(ctx.sessions)
  ctx.effect(() => {
    monitor.start()
    return () => monitor.dispose()
  }, 'token-tetris: token rate')

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'token-tetris',
        order: 100,
        locale: 'token-tetris',
        inject: () => ({ hooks: { tokenRate: monitor.source } }),
      },
      TokenTetrisOverlay,
    ),
  )
}

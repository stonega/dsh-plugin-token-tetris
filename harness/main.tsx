import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { TokenTetrisOverlay } from '../src/client/TokenTetrisOverlay'
import { EN, ZH } from '../src/client/locale'
import { STYLES } from '../src/client/styles'

type Dict = Record<string, string>

function makeTranslate(dict: Dict) {
  return (key: string, params?: Record<string, string | number>): string => {
    let text = dict[key] ?? key
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }
}

function Harness() {
  const [running, setRunning] = useState(true)
  const [rate, setRate] = useState(0)
  const [locale, setLocale] = useState<'en' | 'zh'>('en')
  const [dark, setDark] = useState(false)
  const [onConversation, setOnConversation] = useState(true)

  if (dark) document.body.dataset.dsDarkTheme = ''
  else delete document.body.dataset.dsDarkTheme

  const t = makeTranslate(locale === 'en' ? EN : ZH)
  const useSessionStatus = () => running
  const usePanelInfo = () => onConversation
  const useTokenRate = <T,>(select: (snapshot: { tokensPerSecond: number; activeSessions: number }) => T): T =>
    select({ tokensPerSecond: rate, activeSessions: 1 })

  return (
    <>
      <div className="harness-controls">
        <button type="button" onClick={() => setRunning((value) => !value)}>
          {running ? 'agent running' : 'agent idle'}
        </button>
        <label>
          token rate {rate}
          <input
            type="range"
            min="0"
            max="120"
            step="1"
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
          />
        </label>
        <button type="button" onClick={() => setLocale((value) => (value === 'en' ? 'zh' : 'en'))}>
          locale: {locale}
        </button>
        <button type="button" onClick={() => setDark((value) => !value)}>
          theme: {dark ? 'dark' : 'light'}
        </button>
        <button type="button" onClick={() => setOnConversation((value) => !value)}>
          panel: {onConversation ? 'conversation' : 'plugins'}
        </button>
      </div>

      <TokenTetrisOverlay
        useSessionStatus={useSessionStatus}
        usePanelInfo={usePanelInfo}
        useTokenRate={useTokenRate}
        t={t}
      />
    </>
  )
}

const style = document.createElement('style')
style.textContent = STYLES
document.head.append(style)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)

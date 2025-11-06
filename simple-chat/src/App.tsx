import React, { useEffect, useRef, useState } from 'react'

const API_BASE = 'http://localhost:3001/api'

type Provider = 'gemini' | 'openai'

type ChatMsg = { id: string; text: string; from: 'me' | 'bot'; at: string }

export default function App() {
  const [provider, setProvider] = useState<Provider>('gemini')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: 999999, behavior: 'smooth' })
  }, [msgs.length])

  async function send() {
    if (!text.trim() || busy) return
    const user: ChatMsg = { id: String(Date.now()), text: text.trim(), from: 'me', at: new Date().toLocaleTimeString() }
    setMsgs(m => [...m, user])
    setText('')
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: user.text, agentId: 'default', provider })
      })
      const bodyText = await res.text()
      if (!res.ok) {
        setMsgs(m => [...m, { id: user.id + '-e', text: `Error ${res.status}: ${bodyText}`, from: 'bot', at: new Date().toLocaleTimeString() }])
        return
      }
      const data = JSON.parse(bodyText)
      const bot: ChatMsg = { id: user.id + '-a', text: data.response ?? String(bodyText), from: 'bot', at: new Date().toLocaleTimeString() }
      setMsgs(m => [...m, bot])
    } catch (e: any) {
      setMsgs(m => [...m, { id: 'err-' + Date.now(), text: e?.message || 'Network error', from: 'bot', at: new Date().toLocaleTimeString() }])
    } finally {
      setBusy(false)
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') send()
  }

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row">
          <label>Provider:</label>
          <select value={provider} onChange={e => setProvider(e.target.value as Provider)}>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
          </select>
          <span className="muted">Backend: {API_BASE}</span>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div ref={listRef} className="messages">
          {msgs.map(m => (
            <div key={m.id} className={"msg " + (m.from === 'me' ? 'me' : 'bot')}> 
              <div>{m.text}</div>
              <div className="muted" style={{ marginTop: 4 }}>{m.from === 'me' ? 'You' : 'Assistant'} • {m.at}</div>
            </div>
          ))}
          {msgs.length === 0 && (
            <div className="muted">Type a message below and press Enter</div>
          )}
        </div>

        <div className="row">
          <input 
            placeholder="Type your message..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKey}
            style={{ flex: 1 }}
          />
          <button onClick={send} disabled={busy}>Send</button>
        </div>
      </div>
    </div>
  )
}

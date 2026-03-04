import { useEffect, useRef, useState, type KeyboardEventHandler } from 'react';
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css';
import { createSession, sendChatMessage } from './utils/api';
import { getActiveTab, sendMessageToTab } from './utils/tab';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  level?: 'info' | 'error'
  content: string
  streaming?: boolean
}

type TabSession = {
  url: string
  sessionId: string
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Hi! I can help summarize this page.',
}

const notifySessionInitialized = (sessionId: string) => {
  const runtime = (globalThis as {
    chrome?: {
      runtime?: {
        sendMessage?: (message: { type: string; session_id: string }) => void
      }
    }
  }).chrome?.runtime

  if (typeof runtime?.sendMessage === 'function') {
    runtime.sendMessage({ type: 'init_session', session_id: sessionId })
  }
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  const tabSessionsRef = useRef<Map<number, TabSession>>(new Map())
  const messagesContainerRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) {
      return
    }

    container.scrollTop = container.scrollHeight
  }, [messages])

  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
  }, [input])

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message])
  }

  const appendAssistantDelta = (delta: string) => {
    setMessages((prev) => {
      const index = prev.findLastIndex((message) => message.role === 'assistant' && message.streaming)
      if (index === -1) {
        return prev
      }

      const next = [...prev]
      const target = next[index]
      next[index] = {
        ...target,
        content: `${target.content}${delta}`,
      }
      return next
    })
  }

  const finishAssistantStreaming = (fallbackText: string) => {
    setMessages((prev) => {
      const index = prev.findLastIndex((message) => message.role === 'assistant' && message.streaming)
      if (index === -1) {
        return prev
      }

      const next = [...prev]
      const target = next[index]
      next[index] = {
        ...target,
        content: target.content || fallbackText,
        streaming: false,
      }
      return next
    })
  }

  const createSessionForCurrentTab = async (): Promise<{
    sessionId: string
    isNewSession: boolean
  }> => {
    const tab = await getActiveTab()
    const currentUrl = tab.url ?? 'about:blank'
    const existing = tabSessionsRef.current.get(tab.id)

    if (existing && existing.url === currentUrl) {
      return {
        sessionId: existing.sessionId,
        isNewSession: false,
      }
    }

    let contentResponse: { content?: string } | null = null
    try {
      contentResponse = await sendMessageToTab(tab.id, { action: 'get_content' })
    } catch {
      contentResponse = null
    }

    const payload = {
      url: currentUrl,
      content: (contentResponse?.content as string | undefined)?.trim() || 'No content extracted',
    }

    const data = await createSession(payload)
    tabSessionsRef.current.set(tab.id, {
      url: currentUrl,
      sessionId: data.session_id,
    })

    notifySessionInitialized(data.session_id)

    return {
      sessionId: data.session_id,
      isNewSession: true,
    }
  }

  const onSend = async () => {
    const message = input.trim()
    if (!message || isSending) {
      return
    }

    setInput('')
    setIsSending(true)

    try {
      const { sessionId, isNewSession } = await createSessionForCurrentTab()

      if (isNewSession) {
        setMessages([
          INITIAL_MESSAGE,
          {
            role: 'system',
            level: 'info',
            content: 'Detected tab/page change. Started a new session for this URL.',
          },
          { role: 'user', content: message },
          { role: 'assistant', content: '', streaming: true },
        ])
      } else {
        appendMessage({ role: 'user', content: message })
        appendMessage({ role: 'assistant', content: '', streaming: true })
      }

      const data = await sendChatMessage({
        session_id: sessionId,
        message,
        highlights: [],
      }, {
        onDelta: appendAssistantDelta,
      })
      finishAssistantStreaming(data.reply ?? 'No response from backend')
    } catch (error) {
      appendMessage({
        role: 'system',
        level: 'error',
        content: `Error: ${(error as Error).message}`,
      })
    } finally {
      setIsSending(false)
    }
  }

  const onInputKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    const isComposing =
      event.nativeEvent.isComposing
      || (event.nativeEvent as unknown as { keyCode?: number }).keyCode === 229

    const shouldSend = event.key === 'Enter' && (event.metaKey || event.ctrlKey)

    if (shouldSend && !isComposing) {
      event.preventDefault()
      void onSend()
    }
  }

  return (
    <div className="chat-shell">
      <header className="chat-header">
        <h1>AI Reading Assistant</h1>
      </header>

      <main className="chat-messages" ref={messagesContainerRef}>
        {messages.map((message, index) => (
          <div key={index} className={['message', message.role, message.level].filter(Boolean).join(' ')}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ))}
      </main>

      <footer className="chat-input-bar">
        <textarea
          ref={inputRef}
          placeholder="Ask about this page..."
          aria-label="Chat input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onInputKeyDown}
          disabled={isSending}
          rows={1}
        />
        <button type="button" onClick={() => void onSend()} disabled={isSending}>
          {isSending ? 'Sending' : 'Send'}
        </button>
      </footer>
    </div>
  );
}

export default App;

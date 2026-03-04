const WS_BASE_URL = 'ws://127.0.0.1:8000'
const WS_RECONNECT_DELAY_MS = 3000

type BackgroundMessage = {
  type?: string
  session_id?: string
}

type WebsocketActionMessage = {
  action: string
  text?: string
}

let ws: WebSocket | null = null
let currentSessionId: string | null = null

const getSessionWebSocketUrl = (sessionId: string): string => `${WS_BASE_URL}/ws/${sessionId}`

const forwardHighlightToActiveTab = async (sessionId: string, message: WebsocketActionMessage) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  console.debug('[bg] forwarding highlight to tab', {
    tabId: tab?.id,
    tabUrl: tab?.url,
    sessionId,
  })

  if (!tab?.id) {
    return
  }

  chrome.tabs.sendMessage(tab.id, message, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[bg] sendMessage failed', {
        tabId: tab.id,
        error: chrome.runtime.lastError.message,
      })
      return
    }

    console.debug('[bg] sendMessage success', { tabId: tab.id, response })
  })
}

const tryParseWebsocketMessage = (raw: unknown): WebsocketActionMessage | null => {
  try {
    return JSON.parse(String(raw)) as WebsocketActionMessage
  } catch (error) {
    console.error('[bg] failed to parse websocket message', { error, raw })
    return null
  }
}

function connectWebSocket(sessionId: string) {
  if (ws) {
    console.debug('[bg] closing existing websocket before reconnect', { currentSessionId })
    ws.close()
  }
  currentSessionId = sessionId
  const url = getSessionWebSocketUrl(sessionId)
  console.debug('[bg] connecting websocket', { url })
  ws = new WebSocket(url)

  ws.onopen = () => {
    console.debug('[bg] websocket connected', { sessionId })
  }

  ws.onerror = (event) => {
    console.error('[bg] websocket error', { sessionId, event })
  }

  ws.onmessage = async (event) => {
    const msg = tryParseWebsocketMessage(event.data)
    if (!msg) {
      return
    }

    console.debug('[bg] websocket message received', {
      sessionId,
      action: msg.action,
      textPreview: String(msg.text ?? '').slice(0, 80),
    })

    if (msg.action === 'highlight') {
      await forwardHighlightToActiveTab(sessionId, msg)
    }
  }

  ws.onclose = () => {
    console.debug('[bg] websocket closed', { sessionId })
    // auto-reconnect after 3 s if session is still active
    if (currentSessionId === sessionId) {
      setTimeout(() => connectWebSocket(sessionId), WS_RECONNECT_DELAY_MS)
    }
  }
}

export default defineBackground(() => {
  // 每次 service worker 啟動都執行，確保全域預設為停用
  void chrome.sidePanel.setOptions({ enabled: false });
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id === undefined) return;
    const tabId = tab.id;
    // 只為這個 tab 啟用 panel，其他 tab 維持停用
    await chrome.sidePanel.setOptions({ tabId, enabled: true, path: 'sidepanel.html' });
    await chrome.sidePanel.open({ tabId });
  });

  chrome.runtime.onMessage.addListener((msg: BackgroundMessage) => {
    if (msg.type === 'init_session' && msg.session_id) {
      console.debug('[bg] init_session received', { sessionId: msg.session_id })
      connectWebSocket(msg.session_id)
    }
  })
});

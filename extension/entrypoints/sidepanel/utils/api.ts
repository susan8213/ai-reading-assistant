export const API_BASE_URL = 'http://127.0.0.1:8000'

type CreateSessionPayload = {
  url: string
  content: string
}

type CreateSessionResponse = {
  session_id: string
}

type ChatPayload = {
  session_id: string
  message: string
  highlights: string[]
}

type ChatResponse = {
  reply?: string
}

type SendChatOptions = {
  onDelta?: (delta: string) => void
}

const extractTextDelta = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const record = payload as Record<string, unknown>

  if (record.type === 'text-delta' && typeof record.delta === 'string') {
    return record.delta
  }

  if (record.type === 'output_text_delta' && typeof record.delta === 'string') {
    return record.delta
  }

  if (typeof record.delta === 'string' && String(record.type ?? '').includes('text')) {
    return record.delta
  }

  return ''
}

const parseUIMessageStreamToText = async (
  response: Response,
  options?: SendChatOptions,
): Promise<string> => {
  const stream = response.body
  if (!stream) {
    return ''
  }

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let replyText = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }

    pending += decoder.decode(value, { stream: true })
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) {
        continue
      }

      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') {
        continue
      }

      try {
        const parsed = JSON.parse(data)
        const delta = extractTextDelta(parsed)
        if (!delta) {
          continue
        }
        replyText += delta
        options?.onDelta?.(delta)
      } catch {
        continue
      }
    }
  }

  return replyText.trim()
}

export const createSession = async (
  payload: CreateSessionPayload,
): Promise<CreateSessionResponse> => {
  const response = await fetch(`${API_BASE_URL}/session/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to create session')
  }

  return (await response.json()) as CreateSessionResponse
}

export const sendChatMessage = async (
  payload: ChatPayload,
  options?: SendChatOptions,
): Promise<ChatResponse> => {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Chat request failed')
  }

  const reply = await parseUIMessageStreamToText(response, options)
  return {
    reply,
  }
}

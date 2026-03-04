import { parseUIMessageStreamToText } from './uiMessageStreamParser'

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

  const reply = await parseUIMessageStreamToText(response, options?.onDelta)
  return {
    reply,
  }
}

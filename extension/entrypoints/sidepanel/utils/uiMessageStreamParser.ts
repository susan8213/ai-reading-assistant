type UnknownRecord = Record<string, unknown>

const extractTextDelta = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const record = payload as UnknownRecord

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

const extractStreamErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as UnknownRecord
  const type = String(record.type ?? '')

  if (type !== 'error') {
    return null
  }

  if (typeof record.errorText === 'string' && record.errorText.trim()) {
    return record.errorText
  }

  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error
  }

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message
  }

  return 'Stream error from backend'
}

const parseStreamDataLine = (line: string): unknown | null => {
  if (!line.startsWith('data:')) {
    return null
  }

  const data = line.slice(5).trim()
  if (!data || data === '[DONE]') {
    return null
  }

  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export const parseUIMessageStreamToText = async (
  response: Response,
  onDelta?: (delta: string) => void,
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
      const parsed = parseStreamDataLine(rawLine.trim())
      if (!parsed) {
        continue
      }

      const streamErrorMessage = extractStreamErrorMessage(parsed)
      if (streamErrorMessage) {
        throw new Error(streamErrorMessage)
      }

      const delta = extractTextDelta(parsed)
      if (!delta) {
        continue
      }

      replyText += delta
      onDelta?.(delta)
    }
  }

  return replyText.trim()
}

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { v4 as uuid } from "uuid"

export type Role = "user" | "assistant"

export type Message = {
  role: Role
  content: string
}

export type Highlight = {
  id: string
  text: string
  created_at: string
}

export type Note = {
  id: string
  content: string
  created_at: string
}

export type SessionFile = {
  session_id: string
  url: string
  content: string
  messages: Message[]
  highlights: Highlight[]
  notes: Note[]
  created_at: string
  last_message_at: string
}

const sessionsDir = process.env.SESSIONS_DIR ?? "./sessions"
const sessionWriteQueues = new Map<string, Promise<void>>()

const sessionPath = (sessionId: string) => join(sessionsDir, `${sessionId}.json`)

const writeSession = async (session: SessionFile) => {
  await mkdir(sessionsDir, { recursive: true })
  await writeFile(sessionPath(session.session_id), JSON.stringify(session, null, 2), "utf8")
}

const runSessionMutation = async <T>(
  sessionId: string,
  mutation: (session: SessionFile) => Promise<T> | T,
): Promise<T> => {
  const previous = sessionWriteQueues.get(sessionId) ?? Promise.resolve()

  let releaseCurrent!: () => void
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve
  })
  sessionWriteQueues.set(sessionId, previous.then(() => current))

  await previous

  try {
    const session = await getSession(sessionId)
    const result = await mutation(session)
    await writeSession(session)
    return result
  } finally {
    releaseCurrent()
    if (sessionWriteQueues.get(sessionId) === current) {
      sessionWriteQueues.delete(sessionId)
    }
  }
}

export async function createSession(url: string, content: string): Promise<SessionFile> {
  const now = new Date().toISOString()

  const session: SessionFile = {
    session_id: uuid(),
    url,
    content,
    messages: [],
    highlights: [],
    notes: [],
    created_at: now,
    last_message_at: now,
  }

  await writeSession(session)
  return session
}

export async function getSession(sessionId: string): Promise<SessionFile> {
  const raw = await readFile(sessionPath(sessionId), "utf8")
  return JSON.parse(raw) as SessionFile
}

export async function appendMessage(
  sessionId: string,
  role: Role,
  content: string,
): Promise<void> {
  await runSessionMutation(sessionId, (session) => {
    session.messages.push({ role, content })
    session.last_message_at = new Date().toISOString()
  })
}

export async function addHighlight(sessionId: string, text: string): Promise<string> {
  return runSessionMutation(sessionId, (session) => {
    const highlight: Highlight = {
      id: uuid(),
      text,
      created_at: new Date().toISOString(),
    }

    session.highlights.push(highlight)
    return highlight.id
  })
}

export async function addHighlightDistinct(sessionId: string, text: string): Promise<boolean> {
  const normalizedText = text.trim()
  if (!normalizedText) {
    return false
  }

  return runSessionMutation(sessionId, (session) => {
    const exists = session.highlights.some((highlight) => highlight.text === normalizedText)
    if (exists) {
      return false
    }

    session.highlights.push({
      id: uuid(),
      text: normalizedText,
      created_at: new Date().toISOString(),
    })
    return true
  })
}

export async function addNotePathDistinct(sessionId: string, path: string): Promise<boolean> {
  const normalizedPath = path.trim()
  if (!normalizedPath) {
    return false
  }

  return runSessionMutation(sessionId, (session) => {
    const exists = session.notes.some((note) => note.content === normalizedPath)
    if (exists) {
      return false
    }

    session.notes.push({
      id: uuid(),
      content: normalizedPath,
      created_at: new Date().toISOString(),
    })
    return true
  })
}

export async function setHighlights(sessionId: string, texts: string[]): Promise<void> {
  await runSessionMutation(sessionId, (session) => {
    session.highlights = texts.map((text) => ({
      id: uuid(),
      text,
      created_at: new Date().toISOString(),
    }))
  })
}

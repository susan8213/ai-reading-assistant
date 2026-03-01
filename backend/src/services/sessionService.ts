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

const sessionPath = (sessionId: string) => join(sessionsDir, `${sessionId}.json`)

const writeSession = async (session: SessionFile) => {
  await mkdir(sessionsDir, { recursive: true })
  await writeFile(sessionPath(session.session_id), JSON.stringify(session, null, 2), "utf8")
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
  const session = await getSession(sessionId)
  session.messages.push({ role, content })
  session.last_message_at = new Date().toISOString()
  await writeSession(session)
}

export async function addHighlight(sessionId: string, text: string): Promise<string> {
  const session = await getSession(sessionId)
  const highlight: Highlight = {
    id: uuid(),
    text,
    created_at: new Date().toISOString(),
  }

  session.highlights.push(highlight)
  await writeSession(session)

  return highlight.id
}

export async function setHighlights(sessionId: string, texts: string[]): Promise<void> {
  const session = await getSession(sessionId)
  session.highlights = texts.map((text) => ({
    id: uuid(),
    text,
    created_at: new Date().toISOString(),
  }))
  await writeSession(session)
}

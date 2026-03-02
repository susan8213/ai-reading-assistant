import { readdir, readFile, unlink } from "node:fs/promises"
import { join } from "node:path"

type SessionRetentionRecord = {
  last_message_at?: string
  created_at?: string
}

const sessionsDir = process.env.SESSIONS_DIR ?? "./sessions"
const retentionDays = Number.parseInt(process.env.RETENTION_DAYS ?? "30", 10)

const retentionMs = Number.isFinite(retentionDays)
  ? Math.max(retentionDays, 0) * 86_400_000
  : 30 * 86_400_000

const resolveAnchorTimestamp = (session: SessionRetentionRecord): number | null => {
  const anchor = session.last_message_at ?? session.created_at

  if (!anchor) {
    return null
  }

  const timestamp = new Date(anchor).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export async function cleanupExpiredSessions(now = Date.now()): Promise<number> {
  let files: string[]

  try {
    files = await readdir(sessionsDir)
  } catch {
    return 0
  }

  const cutoff = now - retentionMs
  let deleted = 0

  for (const file of files.filter((name) => name.endsWith(".json"))) {
    try {
      const fullPath = join(sessionsDir, file)
      const raw = await readFile(fullPath, "utf8")
      const data = JSON.parse(raw) as SessionRetentionRecord
      const anchorTimestamp = resolveAnchorTimestamp(data)

      if (anchorTimestamp !== null && anchorTimestamp < cutoff) {
        await unlink(fullPath)
        deleted += 1
      }
    } catch {
      continue
    }
  }

  return deleted
}




import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export async function withTempSessions(fn: (dir: string) => Promise<void>) {
  const originalSessionsDir = process.env.SESSIONS_DIR
  const dir = await mkdtemp(join(tmpdir(), "sessions-"))

  process.env.SESSIONS_DIR = dir

  try {
    await fn(dir)
  } finally {
    if (originalSessionsDir === undefined) {
      delete process.env.SESSIONS_DIR
    } else {
      process.env.SESSIONS_DIR = originalSessionsDir
    }

    await rm(dir, { recursive: true, force: true })
  }
}

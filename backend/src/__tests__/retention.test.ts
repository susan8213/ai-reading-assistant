import { mkdir, writeFile, access } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { withTempSessions } from "./fixtures.js"

describe("retentionService", () => {
  it("deletes expired session files based on last_message_at", async () => {
    await withTempSessions(async (dir) => {
      vi.resetModules()

      const originalRetentionDays = process.env.RETENTION_DAYS
      process.env.RETENTION_DAYS = "30"

      const now = Date.parse("2026-03-01T00:00:00.000Z")
      const expired = {
        session_id: "expired-session",
        created_at: "2026-01-01T00:00:00.000Z",
        last_message_at: "2026-01-10T00:00:00.000Z",
      }
      const active = {
        session_id: "active-session",
        created_at: "2026-02-20T00:00:00.000Z",
        last_message_at: "2026-02-25T00:00:00.000Z",
      }

      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, "expired.json"), JSON.stringify(expired), "utf8")
      await writeFile(join(dir, "active.json"), JSON.stringify(active), "utf8")

      const { cleanupExpiredSessions } = await import("../services/retentionService.js")
      const deleted = await cleanupExpiredSessions(now)

      expect(deleted).toBe(1)

      await expect(access(join(dir, "active.json"))).resolves.toBeUndefined()
      await expect(access(join(dir, "expired.json"))).rejects.toBeTruthy()

      if (originalRetentionDays === undefined) {
        delete process.env.RETENTION_DAYS
      } else {
        process.env.RETENTION_DAYS = originalRetentionDays
      }
    })
  })

  it("falls back to created_at when last_message_at is missing", async () => {
    await withTempSessions(async (dir) => {
      vi.resetModules()

      const originalRetentionDays = process.env.RETENTION_DAYS
      process.env.RETENTION_DAYS = "30"

      const now = Date.parse("2026-03-01T00:00:00.000Z")
      const legacy = {
        session_id: "legacy-session",
        created_at: "2026-01-01T00:00:00.000Z",
      }

      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, "legacy.json"), JSON.stringify(legacy), "utf8")

      const { cleanupExpiredSessions } = await import("../services/retentionService.js")
      const deleted = await cleanupExpiredSessions(now)

      expect(deleted).toBe(1)
      await expect(access(join(dir, "legacy.json"))).rejects.toBeTruthy()

      if (originalRetentionDays === undefined) {
        delete process.env.RETENTION_DAYS
      } else {
        process.env.RETENTION_DAYS = originalRetentionDays
      }
    })
  })

  it("skips corrupted JSON files without deleting them", async () => {
    await withTempSessions(async (dir) => {
      vi.resetModules()

      const originalRetentionDays = process.env.RETENTION_DAYS
      process.env.RETENTION_DAYS = "30"

      const now = Date.parse("2026-03-01T00:00:00.000Z")

      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, "corrupted.json"), "not-json", "utf8")

      const { cleanupExpiredSessions } = await import("../services/retentionService.js")
      const deleted = await cleanupExpiredSessions(now)

      expect(deleted).toBe(0)
      await expect(access(join(dir, "corrupted.json"))).resolves.toBeUndefined()

      if (originalRetentionDays === undefined) {
        delete process.env.RETENTION_DAYS
      } else {
        process.env.RETENTION_DAYS = originalRetentionDays
      }
    })
  })

  it("runs periodic cleanup every 24 hours and can be stopped", async () => {
    vi.useFakeTimers()

    try {
      vi.resetModules()

      const cleanupFn = vi.fn().mockResolvedValue(0)
      const onDeleted = vi.fn()

      const { RETENTION_INTERVAL_MS, createRetentionCleanupJob } = await import(
        "../services/retentionJob.js"
      )

      const service = createRetentionCleanupJob({ cleanupFn, onDeleted })
      service.start()

      await vi.advanceTimersByTimeAsync(RETENTION_INTERVAL_MS)
      expect(cleanupFn).toHaveBeenCalledTimes(1)
      expect(onDeleted).toHaveBeenCalledWith(0)

      await vi.advanceTimersByTimeAsync(RETENTION_INTERVAL_MS)
      expect(cleanupFn).toHaveBeenCalledTimes(2)

      service.stop()

      await vi.advanceTimersByTimeAsync(RETENTION_INTERVAL_MS)
      expect(cleanupFn).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

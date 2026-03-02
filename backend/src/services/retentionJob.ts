import type { FastifyInstance } from "fastify"
import { cleanupExpiredSessions } from "./retentionService.js"

type CleanupFunction = (now?: number) => Promise<number>

type RetentionCleanupJobOptions = {
  intervalMs?: number
  cleanupFn?: CleanupFunction
  onDeleted?: (deleted: number) => void
  onError?: (error: unknown) => void
}

type RetentionCleanupJob = {
  runOnce: () => Promise<number>
  stop: () => void
}

type RetentionCleanupScheduler = RetentionCleanupJob & {
  start: () => void
}

export const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000

export const createRetentionCleanupJob = (
  options: RetentionCleanupJobOptions = {},
): RetentionCleanupScheduler => {
  const intervalMs = options.intervalMs ?? RETENTION_INTERVAL_MS
  const cleanupFn = options.cleanupFn ?? cleanupExpiredSessions
  let running = false
  let timer: ReturnType<typeof setInterval> | undefined

  const runOnce = async () => {
    if (running) {
      return 0
    }

    running = true

    try {
      const deleted = await cleanupFn()
      options.onDeleted?.(deleted)
      return deleted
    } catch (error) {
      options.onError?.(error)
      return 0
    } finally {
      running = false
    }
  }

  const start = () => {
    if (timer) {
      return
    }

    timer = setInterval(() => {
      void runOnce()
    }, intervalMs)

    timer.unref?.()
  }

  const stop = () => {
    if (!timer) {
      return
    }

    clearInterval(timer)
    timer = undefined
  }

  return { start, runOnce, stop }
}

export async function registerRetentionService(app: FastifyInstance): Promise<void> {
  const service = createRetentionCleanupJob({
    onDeleted: (deletedSessions) => {
      if (deletedSessions > 0) {
        app.log.info({ deletedSessions }, "Session retention cleanup completed")
      }
    },
    onError: (error) => {
      app.log.error({ error }, "Session retention cleanup failed")
    },
  })

  await service.runOnce()
  service.start()

  app.addHook("onClose", async () => {
    service.stop()
  })
}

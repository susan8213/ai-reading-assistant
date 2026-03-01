import Fastify from "fastify"
import { afterEach, describe, expect, it, vi } from "vitest"
import { withTempSessions } from "./fixtures.js"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("POST /chat", () => {
  it("returns 400 when required fields are missing", async () => {
    vi.resetModules()

    const { default: chatRoutes } = await import("../routes/chat.js")
    const app = Fastify()
    await app.register(chatRoutes)

    const response = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: "session_id and message are required",
    })

    await app.close()
  })

  it("returns 404 when session does not exist", async () => {
    await withTempSessions(async () => {
      vi.resetModules()

      const { default: chatRoutes } = await import("../routes/chat.js")
      const app = Fastify()
      await app.register(chatRoutes)

      const response = await app.inject({
        method: "POST",
        url: "/chat",
        payload: {
          session_id: "missing-session",
          message: "hello",
          highlights: [],
        },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({
        error: "session not found",
      })

      await app.close()
    })
  })
})

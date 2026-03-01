import Fastify from "fastify"
import { describe, expect, it, vi } from "vitest"
import { withTempSessions } from "./fixtures.js"

describe("sessionService", () => {
  it("creates and retrieves a session file", async () => {
    await withTempSessions(async () => {
      vi.resetModules()

      const sessionService = await import("../services/sessionService.js")
      const created = await sessionService.createSession("https://example.com", "article content")
      const loaded = await sessionService.getSession(created.session_id)

      expect(loaded.session_id).toBe(created.session_id)
      expect(loaded.url).toBe("https://example.com")
      expect(loaded.content).toBe("article content")
      expect(loaded.messages).toEqual([])
      expect(loaded.highlights).toEqual([])
      expect(loaded.notes).toEqual([])
    })
  })

  it("appends user and assistant messages and updates last_message_at", async () => {
    await withTempSessions(async () => {
      vi.resetModules()

      const sessionService = await import("../services/sessionService.js")
      const session = await sessionService.createSession("https://example.com", "content")
      const before = session.last_message_at

      await sessionService.appendMessage(session.session_id, "user", "hello")
      await sessionService.appendMessage(session.session_id, "assistant", "hi")

      const updated = await sessionService.getSession(session.session_id)
      expect(updated.messages).toEqual([
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
      ])
      expect(new Date(updated.last_message_at).getTime()).toBeGreaterThanOrEqual(
        new Date(before).getTime(),
      )
    })
  })

  it("replaces highlights with setHighlights", async () => {
    await withTempSessions(async () => {
      vi.resetModules()

      const sessionService = await import("../services/sessionService.js")
      const session = await sessionService.createSession("https://example.com", "content")

      await sessionService.setHighlights(session.session_id, ["one", "two"])
      const updated = await sessionService.getSession(session.session_id)

      expect(updated.highlights).toHaveLength(2)
      expect(updated.highlights.map((highlight) => highlight.text)).toEqual(["one", "two"])
    })
  })

  it("keeps existing highlights when appending a new message", async () => {
    await withTempSessions(async () => {
      vi.resetModules()

      const sessionService = await import("../services/sessionService.js")
      const session = await sessionService.createSession("https://example.com", "content")

      await sessionService.setHighlights(session.session_id, ["focus point"])
      await sessionService.appendMessage(session.session_id, "user", "new message with highlights")

      const updated = await sessionService.getSession(session.session_id)
      expect(updated.highlights.map((highlight) => highlight.text)).toEqual(["focus point"])
      expect(updated.messages).toEqual([
        { role: "user", content: "new message with highlights" },
      ])
    })
  })

  it("keeps existing messages when replacing highlights", async () => {
    await withTempSessions(async () => {
      vi.resetModules()

      const sessionService = await import("../services/sessionService.js")
      const session = await sessionService.createSession("https://example.com", "content")

      await sessionService.appendMessage(session.session_id, "user", "message before highlight")
      await sessionService.setHighlights(session.session_id, ["new highlight"])

      const updated = await sessionService.getSession(session.session_id)
      expect(updated.messages).toEqual([
        { role: "user", content: "message before highlight" },
      ])
      expect(updated.highlights.map((highlight) => highlight.text)).toEqual(["new highlight"])
    })
  })

  it("creates session and reads notes via session routes", async () => {
    await withTempSessions(async () => {
      vi.resetModules()

      const { default: sessionRoutes } = await import("../routes/session.js")
      const app = Fastify()
      await app.register(sessionRoutes)

      const createResponse = await app.inject({
        method: "POST",
        url: "/session/create",
        payload: {
          url: "https://example.com",
          content: "page content",
        },
      })

      expect(createResponse.statusCode).toBe(200)
      const createPayload = createResponse.json() as { session_id: string }
      expect(createPayload.session_id).toBeTruthy()

      const notesResponse = await app.inject({
        method: "GET",
        url: `/session/${createPayload.session_id}/notes`,
      })

      expect(notesResponse.statusCode).toBe(200)
      expect(notesResponse.json()).toEqual({ notes: [] })

      await app.close()
    })
  })
})

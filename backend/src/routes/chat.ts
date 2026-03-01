import type { FastifyPluginAsync } from "fastify"
import * as sessionService from "../services/sessionService.js"

const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: {
      session_id?: string
      message?: string
      highlights?: string[]
    }
  }>("/chat", async (request, reply) => {
    const { session_id, message, highlights } = request.body ?? {}

    if (!session_id || !message) {
      return reply.status(400).send({
        error: "session_id and message are required",
      })
    }

    let session: Awaited<ReturnType<typeof sessionService.getSession>>
    try {
      session = await sessionService.getSession(session_id)
    } catch {
      return reply.status(404).send({
        error: "session not found",
      })
    }

    if (Array.isArray(highlights)) {
      await sessionService.setHighlights(session_id, highlights)
      session = await sessionService.getSession(session_id)
    }

    await sessionService.appendMessage(session_id, "user", message)

    const assistantReply = `收到你的訊息：${message}`
    await sessionService.appendMessage(session_id, "assistant", assistantReply)

    const updatedSession = await sessionService.getSession(session_id)

    return {
      session_id,
      reply: assistantReply,
      highlights: updatedSession.highlights,
      message_count: updatedSession.messages.length,
    }
  })
}

export default chatRoutes

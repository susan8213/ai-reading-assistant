import type { FastifyPluginAsync } from "fastify"
import { streamText } from "ai"
import { chatStream } from "../agent/index.js"
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

    const latestSession = await sessionService.getSession(session_id)

    let result: ReturnType<typeof streamText>
    try {
      result = streamText({
        ...(await chatStream({
          messages: latestSession.messages,
          article: latestSession.content,
          highlights: latestSession.highlights,
        })),
        onFinish: async ({ text }) => {
          if (text.trim().length > 0) {
            await sessionService.appendMessage(session_id, "assistant", text)
          }
        },
      })
    } catch (error) {
      request.log.error({ error }, "Gemini request failed")
      return reply.status(502).send({
        error: "failed to get response from model",
      })
    }

    return reply.send(result.toUIMessageStreamResponse())
  })
}

export default chatRoutes

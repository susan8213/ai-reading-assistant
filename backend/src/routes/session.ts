import type { FastifyPluginAsync } from "fastify"
import * as sessionService from "../services/sessionService.js"

const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: {
      url?: string
      content?: string
    }
  }>("/session/create", async (request, reply) => {
    const { url, content } = request.body ?? {}

    if (!url || !content) {
      return reply.status(400).send({
        error: "url and content are required",
      })
    }

    const session = await sessionService.createSession(url, content)

    return {
      session_id: session.session_id,
      created_at: session.created_at,
    }
  })

  app.get<{
    Params: {
      id: string
    }
  }>("/session/:id/notes", async (request, reply) => {
    try {
      const session = await sessionService.getSession(request.params.id)
      return { notes: session.notes }
    } catch {
      return reply.status(404).send({
        error: "session not found",
      })
    }
  })
}

export default sessionRoutes

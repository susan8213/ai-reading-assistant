import type { FastifyPluginAsync } from "fastify"
import { websocketConnections } from "../agent/tools/highlight.js"

const websocketRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { session_id: string } }>(
    "/ws/:session_id",
    { websocket: true },
    (socket, req) => {
      const { session_id } = req.params
      websocketConnections.set(session_id, socket)
      req.log.info({ session_id, totalConnections: websocketConnections.size }, "WebSocket connected")

      socket.on("error", (error: unknown) => {
        req.log.error({ session_id, error }, "WebSocket error")
      })

      socket.on("message", (payload: string | Buffer) => {
        req.log.debug({ session_id, payload: String(payload) }, "WebSocket message from client")
      })

      socket.on("close", () => {
        websocketConnections.delete(session_id)
        req.log.info({ session_id, totalConnections: websocketConnections.size }, "WebSocket disconnected")
      })
    },
  )
}

export default websocketRoutes

import Fastify from "fastify"
import cors from "@fastify/cors"
import websocket from "@fastify/websocket"
import dotenv from "dotenv"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import sessionRoutes from "./routes/session.js"
import chatRoutes from "./routes/chat.js"
import websocketRoutes from "./routes/websocket.js"
import { registerRetentionService } from "./services/retentionJob.js"

const currentDir = dirname(fileURLToPath(import.meta.url))
const backendRoot = resolve(currentDir, "..")

dotenv.config({ path: resolve(backendRoot, ".env") })

const app = Fastify({ logger: true })
const port = Number(process.env.PORT ?? 8000)
const host = process.env.HOST ?? "0.0.0.0"

await app.register(cors, {
  origin: true,
})
await app.register(websocket)

app.get("/health", async () => {
  return { ok: true }
})

await app.register(sessionRoutes)
await app.register(chatRoutes)
await app.register(websocketRoutes)
await registerRetentionService(app)

try {
  await app.listen({ port, host })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}

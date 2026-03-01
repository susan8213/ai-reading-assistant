import Fastify from "fastify"
import cors from "@fastify/cors"
import sessionRoutes from "./routes/session.js"
import chatRoutes from "./routes/chat.js"

const app = Fastify({ logger: true })
const port = Number(process.env.PORT ?? 8000)
const host = process.env.HOST ?? "0.0.0.0"

await app.register(cors, {
  origin: true,
})

app.get("/health", async () => {
  return { ok: true }
})

await app.register(sessionRoutes)
await app.register(chatRoutes)

try {
  await app.listen({ port, host })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}

import type { FastifyPluginAsync } from "fastify"
import { streamText } from "ai"
import { chatStream } from "../agent/index.js"
import { listToolNames, toToolResultDetail } from "../agent/tools/utils/toolResultParsers.js"
import * as sessionService from "../services/sessionService.js"

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0
}

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

    try {
      const { cleanup, ...streamConfig } = await chatStream({
        sessionId: session_id,
        messages: latestSession.messages,
        article: latestSession.content,
        highlights: latestSession.highlights,
      })

      request.log.info(
        {
          session_id,
          availableTools: listToolNames((streamConfig as { tools?: unknown }).tools),
          messagePreview: message.slice(0, 120),
        },
        "chat stream initialized",
      )

      const result = streamText({
        ...streamConfig,
        onStepFinish: async ({ stepNumber, toolCalls, toolResults, finishReason, text }) => {
          const toolResultDetails = (toolResults ?? []).map(toToolResultDetail)
          const notePaths = toolResultDetails
            .filter((detail) => !detail.isError)
            .map((detail) => detail.writePath)
            .filter(isNonEmptyString)

          for (const path of notePaths) {
            await sessionService.addNotePathDistinct(session_id, path)
          }

          request.log.info(
            {
              session_id,
              stepNumber,
              finishReason,
              toolCalls: toolCalls?.map((call) => call.toolName) ?? [],
              toolCallInputs:
                toolCalls?.map((call) => ({ toolName: call.toolName, input: call.input })) ?? [],
              toolResultsCount: toolResults?.length ?? 0,
              toolResultDetails,
              text,
            },
            "chat stream step finished",
          )
        },
        onFinish: async ({ text, toolCalls, stepNumber, finishReason }) => {
          await cleanup()
          if (text.trim().length > 0) {
            await sessionService.appendMessage(session_id, "assistant", text)
          }

          request.log.info(
            {
              session_id,
              stepNumber,
              finishReason,
              toolCalls: toolCalls?.map((call) => call.toolName) ?? [],
              text,
            },
            "chat stream finished",
          )
        },
        onError: async (error) => {
          await cleanup()
          request.log.error({ session_id, error }, "chat stream error")
        },
      })
      return reply.send(result.toUIMessageStreamResponse())
    } catch (error) {
      request.log.error({ error }, "Gemini request failed")
      return reply.status(502).send({
        error: "failed to get response from model",
      })
    }
  })
}

export default chatRoutes

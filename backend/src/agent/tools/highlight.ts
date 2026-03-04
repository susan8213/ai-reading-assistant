import { tool } from "ai"
import { z } from "zod"
import type { WebSocket } from "@fastify/websocket"

// Shared map — websocket route registers connections here; highlight tool reads from it
export const websocketConnections = new Map<string, WebSocket>()

const highlightParams = z.object({
  text: z.string().describe("Exact quote from the current article only. Must match article text verbatim; do not paraphrase or invent."),
  reason: z.string().optional().describe("Brief reason for highlighting"),
})

export const highlightTool = (sessionId: string) =>
  // tool() from ai SDK has Zod v4 generic incompatibility — cast to resolve
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tool as any)({
    description:
      "Use this tool whenever the user expresses highlight/mark intent (e.g., asks to mark key points or key sentences). The text must be an exact quote from the current article content.",
    inputSchema: highlightParams,
    execute: async ({ text }: { text: string; reason?: string }) => {
      const ws = websocketConnections.get(sessionId)
      if (!ws) {
        console.warn("[highlightTool] no websocket connection", {
          sessionId,
          textPreview: text.slice(0, 80),
        })
        return { success: false, reason: "no_websocket_connection", text }
      }

      console.info("[highlightTool] dispatch highlight", {
        sessionId,
        readyState: ws.readyState,
        textLength: text.length,
        textPreview: text.slice(0, 80),
      })

      ws.send(JSON.stringify({ action: "highlight", text }))
      return { success: true, text }
    },
  })

import { stepCountIs, type ModelMessage } from "ai"
import type { Highlight, Message } from "../services/sessionService.js"
import { getModel } from "./model.js"
import { parseNoteProvider } from "./noteProvider.js"
import { renderSystemPrompt } from "./prompts.js"
import { getTools } from "./tools/index.js"

type ChatStreamInput = {
  sessionId: string
  messages: Message[]
  article: string
  highlights: Highlight[]
}

const toModelMessages = (messages: Message[]): ModelMessage[] => {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

export async function chatStream(input: ChatStreamInput): Promise<{
  model: ReturnType<typeof getModel>
  system: string
  messages: ModelMessage[]
  tools: Record<string, any>
  maxSteps: number
  stopWhen: ReturnType<typeof stepCountIs>
  cleanup: () => Promise<void>
}> {
  const { tools, cleanup } = await getTools(input.sessionId)
  const noteProvider = parseNoteProvider(process.env.NOTE_PROVIDER)

  return {
    model: getModel(),
    system: renderSystemPrompt(input.article, input.highlights, noteProvider),
    messages: toModelMessages(input.messages),
    tools,
    maxSteps: 10,
    stopWhen: stepCountIs(5),
    cleanup,
  }
}

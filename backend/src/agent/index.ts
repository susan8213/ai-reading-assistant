import type { ModelMessage } from "ai"
import type { Highlight, Message } from "../services/sessionService.js"
import { getModel } from "./model.js"
import { renderSystemPrompt } from "./prompts.js"

type ChatStreamInput = {
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

export async function chatStream(input: ChatStreamInput) {
  return {
    model: getModel(),
    system: renderSystemPrompt(input.article, input.highlights),
    messages: toModelMessages(input.messages),
    maxSteps: 10,
  }
}

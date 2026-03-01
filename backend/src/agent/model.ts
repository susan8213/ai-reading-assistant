import { google } from "@ai-sdk/google"
import type { LanguageModel } from "ai"

export function getModel(): LanguageModel {
  return google(process.env.AI_MODEL ?? "gemini-2.5-flash")
}

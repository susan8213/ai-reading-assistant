import type { Highlight } from "../services/sessionService.js"

export function renderSystemPrompt(article: string, highlights: Highlight[]): string {
  const highlightText = highlights.map((highlight) => `- ${highlight.text}`).join("\n") || "(none)"

  return [
    "You are a reading assistant.",
    "Use Traditional Chinese by default unless the user explicitly asks another language.",
    "The user is reading this article:",
    `<article>${article.slice(0, 8000)}</article>`,
    "Current highlights:",
    `<highlights>${highlightText}</highlights>`,
  ].join("\n")
}

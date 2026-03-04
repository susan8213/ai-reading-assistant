import type { Highlight } from "../services/sessionService.js"
import type { NoteProvider } from "./noteProvider.js"

export function renderSystemPrompt(
  article: string,
  highlights: Highlight[],
  noteProvider: NoteProvider | "",
): string {
  const highlightText = highlights.map((highlight) => `- ${highlight.text}`).join("\n") || "(none)"
  const providerIntentMapping = noteProvider
    ? `"save", "note", "remember" → use ${noteProvider} MCP tools.`
    : null

  return [
    "You are a reading assistant.",
    "Use Traditional Chinese by default unless the user explicitly asks another language.",
    "The user is reading this article:",
    `<article>${article.slice(0, 8000)}</article>`,
    "Current highlights:",
    `<highlights>${highlightText}</highlights>`,
    "",
    "Call tools when you detect intent:",
    ...(providerIntentMapping
      ? [
          "If note intent is present (save/note/remember), prefer note MCP tools first.",
          "Do not call highlight_text for note intent unless the user explicitly asks to visually highlight text.",
        ]
      : []),
    ...(providerIntentMapping ? [providerIntentMapping] : []),
    '- "highlight", "mark", "underline" → highlight_text',
    "For highlights, use highlight_text and quote exact article text only.",
  ].join("\n")
}

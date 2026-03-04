import { describe, expect, it } from "vitest"
import { renderSystemPrompt } from "../agent/prompts.js"

describe("renderSystemPrompt", () => {
  it("includes article and highlights", () => {
    const prompt = renderSystemPrompt(
      "Article body.",
      [{ id: "h1", text: "key passage", created_at: "" }],
      "file",
    )

    expect(prompt).toContain("Article body.")
    expect(prompt).toContain("key passage")
    expect(prompt).toContain("Call tools when you detect intent:")
  })

  it("renders file NOTE_PROVIDER guidance", () => {
    const prompt = renderSystemPrompt("Article", [], "file")

    expect(prompt).toContain('"save", "note", "remember" → use file MCP tools.')
  })

  it("renders obsidian NOTE_PROVIDER guidance", () => {
    const prompt = renderSystemPrompt("Article", [], "obsidian")

    expect(prompt).toContain('"save", "note", "remember" → use obsidian MCP tools.')
  })

  it("omits note provider section when NOTE_PROVIDER is not set", () => {
    const prompt = renderSystemPrompt("Article", [], "")

    expect(prompt).not.toContain('"save", "note", "remember"')
  })
})

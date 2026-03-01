import { describe, expect, it, vi } from "vitest"

vi.mock("../agent/model.js", () => ({
  getModel: vi.fn(() => "mock-model"),
}))

vi.mock("../agent/prompts.js", () => ({
  renderSystemPrompt: vi.fn(() => "mock-system-prompt"),
}))

describe("agent chatStream", () => {
  it("returns stream config with model, system prompt, mapped messages and maxSteps", async () => {
    const { chatStream } = await import("../agent/index.js")

    const result = await chatStream({
      article: "article body",
      highlights: [{ id: "h1", text: "important", created_at: new Date().toISOString() }],
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
      ],
    })

    expect(result.model).toBe("mock-model")
    expect(result.system).toBe("mock-system-prompt")
    expect(result.maxSteps).toBe(10)
    expect(result.messages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ])
  })
})

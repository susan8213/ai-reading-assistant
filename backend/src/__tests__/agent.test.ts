import { describe, expect, it, vi } from "vitest"

const mockCleanup = vi.fn()
const mockHighlightTool = { description: "highlight", parameters: {}, execute: vi.fn() }

vi.mock("../agent/model.js", () => ({
  getModel: vi.fn(() => "mock-model"),
}))

vi.mock("../agent/prompts.js", () => ({
  renderSystemPrompt: vi.fn(() => "mock-system-prompt"),
}))

vi.mock("../agent/tools/index.js", () => ({
  getTools: vi.fn(async (_sessionId: string) => ({
    tools: { highlight_text: mockHighlightTool },
    cleanup: mockCleanup,
  })),
}))

describe("agent chatStream", () => {
  it("returns stream config with model, system prompt, mapped messages and maxSteps", async () => {
    const { chatStream } = await import("../agent/index.js")

    const result = await chatStream({
      sessionId: "test-session",
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

  it("includes highlight_text tool and cleanup from getTools", async () => {
    const { chatStream } = await import("../agent/index.js")
    const { getTools } = await import("../agent/tools/index.js")

    const result = await chatStream({
      sessionId: "session-abc",
      article: "text",
      highlights: [],
      messages: [],
    })

    expect(getTools).toHaveBeenCalledWith("session-abc")
    expect(result.tools).toHaveProperty("highlight_text")
    expect(typeof result.cleanup).toBe("function")
  })
})

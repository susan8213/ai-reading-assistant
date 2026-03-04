import { createMCPClient } from "@ai-sdk/mcp"
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio"
import { highlightTool } from "./highlight.js"
import { parseNoteProvider, type NoteProvider } from "../noteProvider.js"
import { isAbsolute, relative, resolve } from "node:path"

type ToolInput = Record<string, unknown>
type ToolExecutor = (input: ToolInput) => Promise<unknown>
type ToolLike = {
  execute?: ToolExecutor
}
type ToolCollection = Record<string, unknown>

type ToolsResult = {
  tools: ToolCollection
  cleanup: () => Promise<void>
}

const FILE_SCOPED_TOOL_NAMES = ["write_file", "edit_file", "read_file", "read_text_file"] as const
const noopCleanup = async () => {}

const ensureEnv = (key: string): string => {
  const value = process.env[key]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env: ${key}`)
  }
  return value
}

const normalizeFileToolPath = (pathInput: string, notesPath: string): string => {
  const normalizedPath = isAbsolute(pathInput) ? pathInput : resolve(notesPath, pathInput)
  const rel = relative(notesPath, normalizedPath)

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path must stay under FILE_NOTES_PATH: ${pathInput}`)
  }

  return normalizedPath
}

const withResolvedPathTool = <T>(tool: T, notesPath: string): T => {
  const candidate = tool as ToolLike
  if (typeof candidate.execute !== "function") {
    return tool
  }

  const originalExecute = candidate.execute.bind(candidate)

  return {
    ...tool,
    execute: async (input: ToolInput) => {
      const pathInput = typeof input.path === "string" ? input.path : undefined
      if (!pathInput) {
        return originalExecute(input)
      }

      const resolvedPath = normalizeFileToolPath(pathInput, notesPath)
      return originalExecute({ ...input, path: resolvedPath })
    },
  }
}

async function createNotionClient() {
  const transport = new Experimental_StdioMCPTransport({
    command: "npx",
    args: ["-y", "@notionhq/notion-mcp-server"],
    env: { NOTION_API_KEY: process.env.NOTION_API_KEY! },
  })

  return createMCPClient({
    transport,
  })
}

async function createObsidianClient() {
  const vaultPath = ensureEnv("OBSIDIAN_VAULT_PATH")
  const transport = new Experimental_StdioMCPTransport({
    command: "npx",
    args: ["-y", "obsidian-mcp-server"],
    env: {
      VAULT_PATH: vaultPath,
      OBSIDIAN_VAULT_PATH: vaultPath,
    },
  })

  return createMCPClient({
    transport,
  })
}

async function createFilesystemClient() {
  const notesPath = ensureEnv("FILE_NOTES_PATH")
  const transport = new Experimental_StdioMCPTransport({
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", notesPath],
    env: { NOTES_PATH: notesPath },
  })

  return createMCPClient({
    transport,
  })
}

const NOTE_CLIENTS: Record<NoteProvider, () => Promise<Awaited<ReturnType<typeof createMCPClient>>>> = {
  notion: createNotionClient,
  obsidian: createObsidianClient,
  file: createFilesystemClient,
}

const withScopedFileTools = (tools: ToolCollection, notesPath: string): ToolCollection => {
  const patchedTools = { ...tools }

  for (const name of FILE_SCOPED_TOOL_NAMES) {
    const tool = tools[name]
    if (tool) {
      patchedTools[name] = withResolvedPathTool(tool, notesPath)
    }
  }

  return patchedTools
}

const createNoteTools = async (provider: NoteProvider): Promise<ToolsResult> => {
  const client = await NOTE_CLIENTS[provider]()
  const mcpTools = (await client.tools()) as ToolCollection
  const scopedTools =
    provider === "file"
      ? withScopedFileTools(mcpTools, ensureEnv("FILE_NOTES_PATH"))
      : mcpTools

  return {
    tools: scopedTools,
    cleanup: () => client.close(),
  }
}

export async function getTools(sessionId: string): Promise<ToolsResult> {
  const provider = parseNoteProvider(process.env.NOTE_PROVIDER)

  // No NOTE_PROVIDER set — skip MCP entirely (MVP dev without note app)
  if (!provider) {
    return {
      tools: { highlight_text: highlightTool(sessionId) },
      cleanup: noopCleanup,
    }
  }

  const noteTools = await createNoteTools(provider)

  return {
    tools: {
      ...noteTools.tools,
      highlight_text: highlightTool(sessionId),
    },
    cleanup: noteTools.cleanup,
  }
}

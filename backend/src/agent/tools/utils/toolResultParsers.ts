type UnknownRecord = Record<string, unknown>

export type ToolResultDetail = {
  toolName: unknown
  isError: boolean
  writePath: string | null
}

const extractTextFromUnknown = (value: unknown): string => {
  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => extractTextFromUnknown(item)).filter(Boolean).join("\n")
  }

  if (!value || typeof value !== "object") {
    return ""
  }

  const record = value as UnknownRecord

  if (typeof record.text === "string") {
    return record.text
  }

  if (record.content) {
    return extractTextFromUnknown(record.content)
  }

  return ""
}

const extractWritePath = (message: string): string | null => {
  const match = message.match(/Successfully wrote to\s+(.+)$/m)
  return match?.[1]?.trim() ?? null
}

const resolveToolOutput = (resultRecord: UnknownRecord): unknown => {
  return resultRecord.output ?? resultRecord.result ?? resultRecord
}

const detectToolError = (resultRecord: UnknownRecord, output: unknown): boolean => {
  const text = extractTextFromUnknown(output)
  return (
    resultRecord.isError === true
    || (Boolean(output) && typeof output === "object" && (output as { isError?: unknown }).isError === true)
    || /access denied|error/i.test(text)
  )
}

export const toToolResultDetail = (result: unknown): ToolResultDetail => {
  const resultRecord = result as UnknownRecord
  const output = resolveToolOutput(resultRecord)
  const text = extractTextFromUnknown(output)

  return {
    toolName: resultRecord.toolName,
    isError: detectToolError(resultRecord, output),
    writePath: resultRecord.toolName === "write_file" ? extractWritePath(text) : null,
  }
}

export const listToolNames = (tools: unknown): string[] => {
  if (!tools || typeof tools !== "object") {
    return []
  }

  return Object.keys(tools as UnknownRecord)
}

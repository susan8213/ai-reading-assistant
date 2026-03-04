export const NOTE_PROVIDERS = ["notion", "obsidian", "file"] as const

export type NoteProvider = (typeof NOTE_PROVIDERS)[number]

export function parseNoteProvider(value: string | undefined): NoteProvider | "" {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    return ""
  }

  return (NOTE_PROVIDERS as readonly string[]).includes(normalized)
    ? (normalized as NoteProvider)
    : ""
}

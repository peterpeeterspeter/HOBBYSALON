const MAX_PROJECT_NOTE_LENGTH = 500;

type ProjectNoteEvent = {
  eventName: string;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
};

export function readProjectNote(value: unknown): string {
  const note = typeof value === "string" ? value.trim() : "";
  if (!note) throw new Error("Schrijf een korte notitie voordat je opslaat.");
  if (note.length > MAX_PROJECT_NOTE_LENGTH) {
    throw new Error("Je notitie mag maximaal 500 tekens bevatten.");
  }
  return note;
}

export function getLatestProjectNote(events: ProjectNoteEvent[]): string {
  for (const event of [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))) {
    if (event.eventName !== "project_note_updated") continue;
    try {
      return readProjectNote(event.metadata?.note);
    } catch {
      continue;
    }
  }
  return "";
}

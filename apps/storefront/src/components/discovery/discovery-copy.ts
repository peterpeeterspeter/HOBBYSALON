export type DiscoveryResultNoun = "material" | "workshop" | "event";

const LABELS: Record<DiscoveryResultNoun, { singular: string; plural: string }> = {
  material: { singular: "materiaal", plural: "materialen" },
  workshop: { singular: "workshop", plural: "workshops" },
  event: { singular: "evenement", plural: "evenementen" },
};

export function getDiscoveryResultLabel(count: number, noun: DiscoveryResultNoun): string {
  if (count === 0) return `Geen ${LABELS[noun].plural} gevonden`;
  return `${count} ${count === 1 ? LABELS[noun].singular : LABELS[noun].plural} gevonden`;
}

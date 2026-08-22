export type ProjectRequirementKind =
  | "step"
  | "material"
  | "offer"
  | "workshop"
  | "event";

export type ProjectRequirementItem = {
  key: string;
  title: string;
  kind: ProjectRequirementKind;
};

export function groupProjectRequirements<T extends ProjectRequirementItem>(items: T[]) {
  return {
    materials: items.filter((item) => item.kind === "material"),
    offers: items.filter((item) => item.kind === "offer"),
    workshops: items.filter((item) => item.kind === "workshop"),
    events: items.filter((item) => item.kind === "event"),
    steps: items.filter((item) => item.kind === "step"),
  };
}

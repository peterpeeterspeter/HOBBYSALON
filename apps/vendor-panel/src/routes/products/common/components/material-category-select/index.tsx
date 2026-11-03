import { Label, Select, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"

import { fetchQuery } from "../../../../../lib/client"

type MaterialCategory = {
  id: string
  name: string
  parent_id: string | null
}

type MaterialGroup = MaterialCategory & { children: MaterialCategory[] }

/** Metadata key that carries the material category to the storefront. */
export const MATERIAL_CATEGORY_KEY = "platform_category_id"

export const useMaterialCategories = () =>
  useQuery({
    queryKey: ["platform_material_categories"],
    queryFn: () =>
      fetchQuery("/vendor/platform/material-categories", { method: "GET" }),
    select: (data: { groups?: MaterialGroup[] }) => data.groups ?? [],
    staleTime: 5 * 60 * 1000,
  })

const NONE = "__none__"

type MaterialCategorySelectProps = {
  /** Selected material category id: a subcategory, or a group. */
  value: string | null | undefined
  onChange: (value: string | null) => void
}

/**
 * Picks the /materials category of a shop product: first a group, then a
 * subcategory. The id is saved in product metadata (platform_category_id).
 */
export const MaterialCategorySelect = ({
  value,
  onChange,
}: MaterialCategorySelectProps) => {
  const { data: groups = [], isLoading } = useMaterialCategories()

  const group = groups.find(
    (g) => g.id === value || g.children.some((c) => c.id === value)
  )
  const subId = group && group.id !== value ? value : undefined

  return (
    <div className="flex flex-col gap-y-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-y-2">
          <Label size="small" weight="plus">
            Materiaalgroep
          </Label>
          <Select
            value={group?.id ?? NONE}
            onValueChange={(next) => onChange(next === NONE ? null : next)}
            disabled={isLoading}
          >
            <Select.Trigger>
              <Select.Value placeholder="Kies een groep" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={NONE}>Geen groep</Select.Item>
              {groups.map((g) => (
                <Select.Item key={g.id} value={g.id}>
                  {g.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-col gap-y-2">
          <Label size="small" weight="plus">
            Subcategorie
          </Label>
          <Select
            value={subId ?? NONE}
            onValueChange={(next) =>
              onChange(next === NONE ? group?.id ?? null : next)
            }
            disabled={!group?.children.length}
          >
            <Select.Trigger>
              <Select.Value placeholder="Kies een subcategorie" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={NONE}>Hele groep</Select.Item>
              {group?.children.map((c) => (
                <Select.Item key={c.id} value={c.id}>
                  {c.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        Bepaalt onder welke categorie het product op hobbysalon.be/materials
        staat.
      </Text>
    </div>
  )
}

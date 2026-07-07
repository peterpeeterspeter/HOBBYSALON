import { Heading, Text } from "@medusajs/ui"
import { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { Form } from "../../../../../../../components/common/form"
import { SwitchBox } from "../../../../../../../components/common/switch-box"
import { Combobox } from "../../../../../../../components/inputs/combobox"
import { useComboboxData } from "../../../../../../../hooks/use-combobox-data"
import { fetchQuery } from "../../../../../../../lib/client"
import { ProductCreateSchemaType } from "../../../../types"
import { CategoryCombobox } from "../../../../../common/components/category-combobox"

type ProductCreateOrganizationSectionProps = {
  form: UseFormReturn<ProductCreateSchemaType>
}

export const ProductCreateOrganizationSection = ({
  form,
}: ProductCreateOrganizationSectionProps) => {
  const { t } = useTranslation()

  const collections = useComboboxData({
    queryKey: ["product_collections"],
    queryFn: (params) =>
      fetchQuery("/vendor/product-collections", {
        method: "GET",
        query: params,
      }),
    getOptions: (data) =>
      data.product_collections.map((collection: any) => ({
        label: collection.title!,
        value: collection.id!,
      })),
  })

  const types = useComboboxData({
    queryKey: ["product_types", "creating"],
    queryFn: (params) =>
      fetchQuery("/vendor/product-types", {
        method: "GET",
        query: params,
      }),
    getOptions: (data) =>
      data.product_types.map((type: any) => ({
        label: type.value,
        value: type.id,
      })),
  })

  const tags = useComboboxData({
    queryKey: ["product_tags", "creating"],
    queryFn: (params) =>
      fetchQuery("/vendor/product-tags", {
        method: "GET",
        query: params,
      }),
    getOptions: (data) =>
      data.product_tags.map((tag: any) => ({
        label: tag.value,
        value: tag.id,
      })),
  })

  return (
    <div id="organize" className="flex flex-col gap-y-8">
      <Heading>{t("products.organization.header")}</Heading>
      <SwitchBox
        control={form.control}
        name="discountable"
        label={t("products.fields.discountable.label")}
        description={t("products.fields.discountable.hint")}
        optional
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Form.Field
          control={form.control}
          name="type_id"
          render={({ field }) => {
            return (
              <Form.Item>
                <Form.Label optional>
                  {t("products.fields.type.label")}
                </Form.Label>
                <Form.Control>
                  <Combobox
                    {...field}
                    options={types.options}
                    searchValue={types.searchValue}
                    onSearchValueChange={types.onSearchValueChange}
                    fetchNextPage={types.fetchNextPage}
                    allowClear
                    disabled={types.disabled}
                  />
                </Form.Control>
                {types.disabled && (
                  <Text size="small" className="text-ui-fg-subtle">
                    Geen types gevonden.{" "}
                    <Link className="text-ui-fg-interactive underline" to="/product-types/create">
                      Maak een type aan
                    </Link>
                    .
                  </Text>
                )}
                <Form.ErrorMessage />
              </Form.Item>
            )
          }}
        />
        <Form.Field
          control={form.control}
          name="collection_id"
          render={({ field }) => {
            return (
              <Form.Item>
                <Form.Label optional>
                  {t("products.fields.collection.label")}
                </Form.Label>
                <Form.Control>
                  <Combobox
                    {...field}
                    options={collections.options}
                    searchValue={collections.searchValue}
                    onSearchValueChange={collections.onSearchValueChange}
                    fetchNextPage={collections.fetchNextPage}
                    allowClear
                    disabled={collections.disabled}
                  />
                </Form.Control>
                {collections.disabled && (
                  <Text size="small" className="text-ui-fg-subtle">
                    Geen collecties gevonden.{" "}
                    <Link className="text-ui-fg-interactive underline" to="/collections/create">
                      Maak een collectie aan
                    </Link>
                    .
                  </Text>
                )}
                <Form.ErrorMessage />
              </Form.Item>
            )
          }}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Form.Field
          control={form.control}
          name="categories"
          render={({ field }) => {
            return (
              <Form.Item>
                <Form.Label optional>
                  {t("products.fields.categories.label")}
                </Form.Label>
                <Form.Control>
                  <CategoryCombobox {...field} />
                  {/* <CategorySelect  /> */}
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            )
          }}
        />
        <Form.Field
          control={form.control}
          name="tags"
          render={({ field }) => {
            return (
              <Form.Item>
                <Form.Label optional>
                  {t("products.fields.tags.label")}
                </Form.Label>
                <Form.Control>
                  <Combobox
                    {...field}
                    options={tags.options}
                    searchValue={tags.searchValue}
                    onSearchValueChange={tags.onSearchValueChange}
                    fetchNextPage={tags.fetchNextPage}
                    disabled={tags.disabled}
                  />
                </Form.Control>
                {tags.disabled && (
                  <Text size="small" className="text-ui-fg-subtle">
                    Geen tags gevonden.{" "}
                    <Link className="text-ui-fg-interactive underline" to="/product-tags/create">
                      Maak een tag aan
                    </Link>
                    .
                  </Text>
                )}
                <Form.ErrorMessage />
              </Form.Item>
            )
          }}
        />
      </div>
    </div>
  )
}

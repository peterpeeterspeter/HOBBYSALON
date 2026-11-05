import { SingleColumnPage } from "../../../components/layout/pages"
import { useDashboardExtension } from "../../../extensions"
import { ShippingProfilesHint } from "../../locations/common/components/shipping-guide"
import { ShippingProfileListTable } from "./components/shipping-profile-list-table"

export const ShippingProfileList = () => {
  const { getWidgets } = useDashboardExtension()

  return (
    <SingleColumnPage
      widgets={{
        before: getWidgets("shipping_profile.list.before"),
        after: getWidgets("shipping_profile.list.after"),
      }}
    >
      <ShippingProfilesHint />
      <ShippingProfileListTable />
    </SingleColumnPage>
  )
}

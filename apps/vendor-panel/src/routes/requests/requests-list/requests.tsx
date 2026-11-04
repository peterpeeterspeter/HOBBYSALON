import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { SingleColumnPage } from "../../../components/layout/pages"
import { useDashboardExtension } from "../../../extensions"
import { useOrderReturnRequests, useRequests } from "../../../hooks/api"
import { TriangleRightMini } from "@medusajs/icons"
import { Link } from "react-router-dom"

export const Requests = () => {
  const { getWidgets } = useDashboardExtension()

  const { requests, isError, error } = useRequests()
  const { count } = useOrderReturnRequests()

  const categoryRequests =
    requests?.filter(
      ({ type }: { type: string }) => type === "product_category"
    ) ?? []
  const collectionRequests =
    requests?.filter(
      ({ type }: { type: string }) => type === "product_collection"
    ) ?? []
  const reviewRequests =
    requests?.filter(
      ({ type }: { type: string }) => type === "review_remove"
    ) ?? []

  const categoryRequestCount = categoryRequests.length
  const collectionRequestCount = collectionRequests.length
  const reviewRequestCount = reviewRequests.length
  const ordersRequestsCount = count

  if (isError) {
    throw error
  }

  return (
    <SingleColumnPage
      widgets={{
        after: getWidgets("customer.list.after"),
        before: getWidgets("customer.list.before"),
      }}
    >
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading>Aanvragen</Heading>
            <Text className="text-ui-fg-subtle" size="small">
              Volg je aanvragen op of doe een nieuwe aanvraag
            </Text>
          </div>
        </div>
        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/requests/collections">
            <Button variant="secondary" className="w-full justify-between py-4">
              <div className="flex gap-4 items-center">
                <Badge>{collectionRequestCount}</Badge>
                Collectie-aanvragen
              </div>
              <TriangleRightMini color="grey" />
            </Button>
          </Link>
          <Link to="/requests/categories">
            <Button variant="secondary" className="w-full justify-between py-4">
              <div className="flex gap-4 items-center">
                <Badge>{categoryRequestCount}</Badge>
                Categorie-aanvragen
              </div>
              <TriangleRightMini color="grey" />
            </Button>
          </Link>
          <Link to="/requests/reviews">
            <Button variant="secondary" className="w-full justify-between py-4">
              <div className="flex gap-4 items-center">
                <Badge>{reviewRequestCount}</Badge>
                Beoordelingsaanvragen
              </div>
              <TriangleRightMini color="grey" />
            </Button>
          </Link>
          <Link to="/requests/orders">
            <Button variant="secondary" className="w-full justify-between py-4">
              <div className="flex gap-4 items-center">
                <Badge>{ordersRequestsCount}</Badge>
                Retouraanvragen
              </div>
              <TriangleRightMini color="grey" />
            </Button>
          </Link>
        </div>
      </Container>
    </SingleColumnPage>
  )
}

import { useParams } from "react-router-dom"
import { RouteFocusModal } from "../../../components/modals"
import {
  usePriceList,
  usePriceListProducts,
} from "../../../hooks/api/price-lists"
import { usePriceListCurrencyData } from "../common/hooks/use-price-list-currency-data"
import { PriceListPricesEditForm } from "./components/price-list-prices-edit-form"

export const PriceListPricesEdit = () => {
  const { id } = useParams()
  const { price_list, isLoading, isError, error } = usePriceList(id!)

  const {
    products,
    isLoading: isProductsLoading,
    isError: isProductsError,
    error: productError,
  } = usePriceListProducts(id!)

  const priceListCurrencyData =
    usePriceListCurrencyData()

  const ready =
    !isLoading && !!price_list && !isProductsLoading && !!products && priceListCurrencyData.isReady

  if (isError) {
    throw error
  }

  if (isProductsError) {
    throw productError
  }

  return (
    <RouteFocusModal>
      <RouteFocusModal.Title asChild>
        <span className="sr-only">Prijzen bewerken voor {price_list?.title}</span>
      </RouteFocusModal.Title>
      <RouteFocusModal.Description className="sr-only">
        Pas de prijzen in deze prijslijst aan
      </RouteFocusModal.Description>
      {ready && (
        <PriceListPricesEditForm
          priceList={price_list}
          products={products}
          {...priceListCurrencyData}
        />
      )}
    </RouteFocusModal>
  )
}

import { Container, Heading, Text } from "@medusajs/ui"
import { OnboardingRow } from "./onboarding-row"
import { useUpdateOnboarding } from "../../../hooks/api"
import { useEffect } from "react"

type DashboardProps = {
  products: boolean
  locations_shipping: boolean
  store_information: boolean
  stripe_connect: boolean
}

export const DashboardOnboarding = ({
  products,
  locations_shipping,
  store_information,
  // stripe_connect,
}: DashboardProps) => {
  const { mutateAsync } = useUpdateOnboarding()

  useEffect(() => {
    mutateAsync()
  }, [])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Welkom bij Hobbysalon</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Doe deze stappen en je kan beginnen verkopen op Hobbysalon.
          </Text>
        </div>
      </div>
      <div className="px-6 py-4">
        <OnboardingRow
          label="Vul je winkelgegevens in"
          state={store_information}
          link="/settings/store"
          buttonLabel="Invullen"
        />
        {/* <OnboardingRow
          label='Setup Stripe Connect account'
          state={stripe_connect}
          link='/stripe-connect'
          buttonLabel='Setup'
        /> */}
        <OnboardingRow
          label="Stel je verzending in"
          state={locations_shipping}
          link="/settings/locations"
          buttonLabel="Instellen"
        />
        <OnboardingRow
          label="Zet je eerste product online"
          state={products}
          link="/products/create"
          buttonLabel="Toevoegen"
        />
      </div>
    </Container>
  )
}

import { useState } from "react"
import { ExclamationCircle } from "@medusajs/icons"
import { Button, Heading, Select, Text } from "@medusajs/ui"
import {
  useCreateStripeAccount,
  useCreateStripeOnboarding,
} from "../../../hooks/api"

const PAYOUT_COUNTRIES = [
  { value: "BE", label: "België" },
  { value: "NL", label: "Nederland" },
] as const

export const NotConnected = () => {
  const { mutateAsync: createAccount, isPending: isCreating } =
    useCreateStripeAccount()
  const { mutateAsync: createOnboarding, isPending: isOnboarding } =
    useCreateStripeOnboarding()
  const [country, setCountry] = useState<(typeof PAYOUT_COUNTRIES)[number]["value"]>("BE")
  const [error, setError] = useState<string | null>(null)

  const isPending = isCreating || isOnboarding

  const handleConnect = async () => {
    setError(null)
    try {
      await createAccount({
        context: {
          country,
        },
      })

      const origin = window.location.origin
      const { payout_account } = await createOnboarding({
        context: {
          refresh_url: `${origin}/stripe-connect`,
          return_url: `${origin}/stripe-connect?onboarding=return`,
        },
      })

      const url = payout_account.onboarding?.data?.url
      if (url) {
        window.location.assign(url)
        return
      }

      setError("Stripe onboarding-link ontbreekt. Probeer opnieuw.")
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" &&
              err &&
              "message" in err &&
              typeof (err as { message: unknown }).message === "string"
            ? (err as { message: string }).message
            : "Koppelen met Stripe mislukt. Probeer opnieuw."
      setError(message)
    }
  }

  return (
    <div className="flex items-center justify-center text-center my-32 flex-col">
      <ExclamationCircle />
      <Heading level="h2" className="mt-4">
        Not connected
      </Heading>
      <Text className="text-ui-fg-subtle max-w-md" size="small">
        Voeg uitbetalingsgegevens toe zodat Hobbysalon je kan betalen. Kies je
        land en rond Stripe&apos;s Express-onboarding af (identiteit + bankrekening).
      </Text>
      <div className="mt-4 w-56 text-left">
        <Text size="small" className="mb-1.5 block font-medium">
          Country
        </Text>
        <Select
          value={country}
          onValueChange={(value) =>
            setCountry(value as (typeof PAYOUT_COUNTRIES)[number]["value"])
          }
        >
          <Select.Trigger>
            <Select.Value placeholder="Select country" />
          </Select.Trigger>
          <Select.Content>
            {PAYOUT_COUNTRIES.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
      {error ? (
        <Text className="text-ui-fg-error mt-3 max-w-md" size="small">
          {error}
        </Text>
      ) : null}
      <Button
        isLoading={isPending}
        className="mt-4"
        onClick={() => void handleConnect()}
      >
        Connect Stripe
      </Button>
    </div>
  )
}

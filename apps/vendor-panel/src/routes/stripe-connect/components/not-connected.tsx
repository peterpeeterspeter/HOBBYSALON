import { useState } from "react"
import { ExclamationCircle } from "@medusajs/icons"
import { Button, Heading, Select, Text } from "@medusajs/ui"
import { useCreateStripeAccount } from "../../../hooks/api"

const PAYOUT_COUNTRIES = [
  { value: "BE", label: "België" },
  { value: "NL", label: "Nederland" },
] as const

export const NotConnected = () => {
  const { mutateAsync, isPending } = useCreateStripeAccount()
  const [country, setCountry] = useState<(typeof PAYOUT_COUNTRIES)[number]["value"]>("BE")

  return (
    <div className="flex items-center justify-center text-center my-32 flex-col">
      <ExclamationCircle />
      <Heading level="h2" className="mt-4">
        Not connected
      </Heading>
      <Text className="text-ui-fg-subtle max-w-md" size="small">
        Add payout details so Hobbysalon can pay you. Choose your country, then
        complete Stripe&apos;s short payout onboarding (identity + bank account).
        You do not need a full Stripe merchant account.
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
      <Button
        isLoading={isPending}
        className="mt-4"
        onClick={() =>
          mutateAsync({
            context: {
              country,
            },
          })
        }
      >
        Connect Stripe
      </Button>
    </div>
  )
}

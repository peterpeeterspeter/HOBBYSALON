import { ExclamationCircle } from "@medusajs/icons"
import { Button, Heading, Text, toast } from "@medusajs/ui"
import { useState } from "react"
import { useCreateStripeOnboarding } from "../../../hooks/api"

export const Connected = ({
  status,
}: {
  status: "connected" | "pending" | "not connected"
}) => {
  const { mutateAsync, isPending } = useCreateStripeOnboarding()
  const [error, setError] = useState<string | null>(null)

  const handleOnboarding = async () => {
    setError(null)
    try {
      const origin = window.location.origin
      const { payout_account } = await mutateAsync({
        context: {
          // Stable paths (no query hash) so Stripe refresh/return land cleanly.
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
      toast.error("Stripe onboarding-link ontbreekt. Probeer opnieuw.")
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" &&
              err &&
              "message" in err &&
              typeof (err as { message: unknown }).message === "string"
            ? (err as { message: string }).message
            : "Stripe onboarding mislukt. Probeer opnieuw."
      setError(message)
      toast.error(message)
    }
  }

  return status === "connected" ? (
    <div className="flex items-center justify-center text-center my-32 flex-col">
      <Heading level="h2" className="mt-4">
        Your payout account is ready
      </Heading>
      <Text className="text-ui-fg-subtle max-w-sm mt-2" size="small">
        Payouts can run once Stripe marks the account active. If Stripe asks for
        extra details later, reopen onboarding below.
      </Text>
      <Button
        isLoading={isPending}
        className="mt-4"
        onClick={() => void handleOnboarding()}
      >
        Open Stripe payouts
      </Button>
    </div>
  ) : (
    <div className="flex items-center justify-center text-center my-32 flex-col">
      <ExclamationCircle />
      <Heading level="h2" className="mt-4">
        Not onboarded
      </Heading>
      <Text className="text-ui-fg-subtle max-w-sm" size="small">
        Rond de Stripe Express-setup af (identiteit + bankrekening voor BE/NL).
        Elke klik opent een nieuwe Stripe-link (vorige links verlopen na ~5 min).
      </Text>
      {error ? (
        <Text className="text-ui-fg-error mt-3 max-w-md" size="small">
          {error}
        </Text>
      ) : null}
      <Button
        isLoading={isPending}
        className="mt-4"
        onClick={() => void handleOnboarding()}
      >
        Stripe Onboarding
      </Button>
    </div>
  )
}

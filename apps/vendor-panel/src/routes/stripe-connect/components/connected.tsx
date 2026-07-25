import { ExclamationCircle } from "@medusajs/icons"
import { Button, Heading, Text } from "@medusajs/ui"
import { useCreateStripeOnboarding } from "../../../hooks/api"

export const Connected = ({
  status,
}: {
  status: "connected" | "pending" | "not connected"
}) => {
  const { mutateAsync, isPending } = useCreateStripeOnboarding()

  const hostname = window.location.href

  const handleOnboarding = async () => {
    try {
      const { payout_account } = await mutateAsync({
        context: {
          refresh_url: hostname,
          return_url: hostname,
        },
      })
      const url = payout_account.onboarding?.data?.url
      if (url) {
        window.location.replace(url)
      }
    } catch {
      // toast.error('Connection error!');
      window.location.reload()
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
        onClick={() => handleOnboarding()}
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
        Finish the short payout setup (identity + bank account for BE/NL).
      </Text>
      <Button
        isLoading={isPending}
        className="mt-4"
        onClick={() => handleOnboarding()}
      >
        Stripe Onboarding
      </Button>
    </div>
  )
}

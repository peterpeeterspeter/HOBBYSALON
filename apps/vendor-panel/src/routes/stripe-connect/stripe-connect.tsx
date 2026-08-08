import { Container, Heading, Text } from "@medusajs/ui"
import { NotConnected } from "./components/not-connected"
import { useStripeAccount } from "../../hooks/api"
import { Status } from "./components/status"
import { Connected } from "./components/connected"
import {
  VendorPayoutAccount,
  VendorPayoutAccountStatus,
} from "../../types/payout"

const getStatus = (payout_account: VendorPayoutAccount | undefined) => {
  if (!payout_account) return "not connected"

  // Only treat as connected once Stripe marks the Express account active
  // (details_submitted + charges/payouts enabled). Creating a payout account
  // or Account Link alone must stay "pending".
  if (payout_account.status === VendorPayoutAccountStatus.ACTIVE) {
    return "connected"
  }

  return "pending"
}

export const StripeConnect = () => {
  const { payout_account } = useStripeAccount()

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Stripe Connect</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Koppel Stripe Express voor uitbetalingen (BE/NL)
          </Text>
        </div>
        <div>
          <Status status={getStatus(payout_account)} />
        </div>
      </div>
      <div className="px-6 py-4">
        {!payout_account ? (
          <NotConnected />
        ) : (
          <Connected status={getStatus(payout_account)} />
        )}
      </div>
    </Container>
  )
}

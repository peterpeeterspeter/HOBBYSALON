import { AudienceLanding } from "./audience-landing";
import { WORKSHOP_LANDING } from "@/lib/marketing/audience-landings";

function WorkshopHostLanding() {
  return <AudienceLanding config={WORKSHOP_LANDING} />;
}

export { WorkshopHostLanding };

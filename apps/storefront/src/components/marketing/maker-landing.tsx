import { AudienceLanding } from "./audience-landing";
import { MAKER_LANDING } from "@/lib/marketing/audience-landings";

function MakerLanding() {
  return <AudienceLanding config={MAKER_LANDING} />;
}

export { MakerLanding };

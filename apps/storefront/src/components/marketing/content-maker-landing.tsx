import { AudienceLanding } from "./audience-landing";
import { CONTENT_LANDING } from "@/lib/marketing/audience-landings";

function ContentMakerLanding() {
  return <AudienceLanding config={CONTENT_LANDING} />;
}

export { ContentMakerLanding };

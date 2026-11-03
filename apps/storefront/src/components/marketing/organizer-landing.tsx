import { AudienceLanding } from "./audience-landing";
import { ORGANIZER_LANDING } from "@/lib/marketing/audience-landings";

function OrganizerLanding() {
  return <AudienceLanding config={ORGANIZER_LANDING} />;
}

export { OrganizerLanding };

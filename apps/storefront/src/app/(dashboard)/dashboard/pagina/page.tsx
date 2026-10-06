import { getDashboardContext } from "@/lib/dashboard/load";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { loadCreatorMakerData } from "@/lib/profile/load-creator-maker-data";
import { CreatorMakerSection } from "@/components/profile/CreatorMakerSection";

type Props = {
  searchParams: Promise<{ success?: string; error?: string; tab?: string }>;
};

/** "Mijn pagina": public maker page, artikels and portfolio. */
export default async function MyPagePage({ searchParams }: Props) {
  const { success, error, tab } = await searchParams;
  const { user, caps } = await getDashboardContext("/dashboard/pagina");
  requireDashboardCapability(caps.canEditCreatorPage);

  const data = await loadCreatorMakerData(user, tab);
  return <CreatorMakerSection data={data} success={success} error={error} embedded />;
}

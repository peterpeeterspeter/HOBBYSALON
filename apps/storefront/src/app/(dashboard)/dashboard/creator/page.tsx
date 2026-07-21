import { redirect } from "next/navigation";
import { creatorMakerProfileUrl } from "@/lib/profile/creator-maker-path";
import { resolveCreatorTab } from "@/components/dashboard/creator/types";

type Props = {
  searchParams: Promise<{ success?: string; error?: string; tab?: string }>;
};

export default async function DashboardCreatorPage({ searchParams }: Props) {
  const { success, error, tab: tabParam } = await searchParams;
  const tab = resolveCreatorTab(tabParam);

  redirect(
    creatorMakerProfileUrl({
      tab,
      success,
      error,
      withHash: true,
    })
  );
}

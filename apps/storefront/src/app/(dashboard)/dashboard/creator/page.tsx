import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ success?: string; error?: string; tab?: string }>;
};

/** Old maker-page route; the maker page now lives at /dashboard/pagina. */
export default async function DashboardCreatorPage({ searchParams }: Props) {
  const { success, error, tab } = await searchParams;
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (success) params.set("success", success);
  if (error) params.set("error", error);
  const query = params.toString();
  redirect(`/dashboard/pagina${query ? `?${query}` : ""}`);
}

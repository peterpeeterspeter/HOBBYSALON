import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

/** Account lives on the dashboard overview; keep this route for old links. */
export default async function DashboardAccountRedirectPage({
  searchParams,
}: Props) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.success) query.set("success", params.success);
  if (params.error) query.set("error", params.error);
  const serialized = query.toString();
  redirect(serialized ? `/dashboard?${serialized}#account` : "/dashboard#account");
}

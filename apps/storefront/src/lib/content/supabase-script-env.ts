export function resolveSupabaseUrl(
  environment: Record<string, string | undefined>
): string | undefined {
  return environment.NEXT_PUBLIC_SUPABASE_URL ?? environment.SUPABASE_URL;
}

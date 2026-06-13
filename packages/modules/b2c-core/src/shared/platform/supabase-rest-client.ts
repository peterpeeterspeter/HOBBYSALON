const escapePostgrestValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/\)/g, "\\)");

export class SupabaseRestClient {
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string
  ) {}

  private async request(
    method: "GET" | "POST" | "PATCH",
    table: string,
    options?: {
      query?: Record<string, string>;
      body?: unknown;
      prefer?: string;
    }
  ) {
    const endpoint = new URL(`/rest/v1/${table}`, this.url);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        endpoint.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    if (options?.prefer) {
      headers.Prefer = options.prefer;
    }

    const response = await fetch(endpoint, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Supabase ${method} ${table} failed (${response.status}): ${body}`
      );
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async get<T = Record<string, unknown>>(
    table: string,
    query: Record<string, string>
  ): Promise<T[]> {
    const result = await this.request("GET", table, { query });
    return (result ?? []) as T[];
  }

  async post<T = Record<string, unknown>>(
    table: string,
    body: unknown,
    prefer?: string
  ): Promise<T | T[] | null> {
    return (await this.request("POST", table, { body, prefer })) as
      | T
      | T[]
      | null;
  }
}

export function getPlatformSupabaseConfig() {
  const url =
    process.env.PLATFORM_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

export function createPlatformSupabaseClient() {
  const config = getPlatformSupabaseConfig();
  if (!config) {
    return null;
  }

  return new SupabaseRestClient(config.url, config.serviceRoleKey);
}

export { escapePostgrestValue };

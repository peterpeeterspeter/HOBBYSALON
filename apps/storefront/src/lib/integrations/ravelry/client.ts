export type RavelrySearchParams = {
  query?: string;
  craft?: string;
  language?: string;
  availability?: "free" | "all";
  page?: number;
  pageSize?: number;
};

export type RavelrySearchPattern = {
  id: number;
  name: string;
  permalink: string | null;
  free: boolean;
  firstPhotoUrl: string | null;
  designerName: string | null;
};

export type RavelryPatternDetail = {
  id: number;
  name: string;
  permalink: string | null;
  free: boolean;
  url: string | null;
  pdfUrl: string | null;
  notes: string | null;
  languageCodes: string[];
  categoryNames: string[];
  patternTypeName: string | null;
  published: string | null;
  updatedAt: string | null;
  firstPhotoUrl: string | null;
  designerName: string | null;
};

type RavelrySearchResponse = {
  paginator?: {
    page: number;
    page_count: number;
    page_size: number;
    results: number;
  };
  patterns?: Array<Record<string, unknown>>;
};

type RavelryPatternResponse = {
  pattern?: Record<string, unknown>;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord).filter((row): row is Record<string, unknown> => row !== null) : [];
}

function mapSearchPattern(raw: Record<string, unknown>): RavelrySearchPattern | null {
  const id = asNumber(raw.id);
  const name = asString(raw.name);
  if (id === null || name === null) return null;

  const firstPhoto = asRecord(raw.first_photo);
  const designer = asRecord(raw.designer) ?? asRecord(raw.pattern_author);

  return {
    id,
    name,
    permalink: asString(raw.permalink),
    free: asBoolean(raw.free),
    firstPhotoUrl:
      asString(firstPhoto?.medium_url) ?? asString(firstPhoto?.small_url) ?? asString(firstPhoto?.square_url),
    designerName: asString(designer?.name),
  };
}

function mapPatternDetail(raw: Record<string, unknown>): RavelryPatternDetail {
  const firstPhoto = asRecord(raw.first_photo) ?? asRecord(asRecordArray(raw.photos)[0]);
  const designer = asRecord(raw.designer) ?? asRecord(raw.pattern_author);

  const languageCodes = asRecordArray(raw.languages)
    .map((language) => asString(language.code))
    .filter((value): value is string => value !== null);

  const categoryNames = asRecordArray(raw.pattern_categories)
    .map((category) => asString(category.name))
    .filter((value): value is string => value !== null);

  const patternType = asRecord(raw.pattern_type);

  return {
    id: asNumber(raw.id) ?? 0,
    name: asString(raw.name) ?? `Pattern ${String(asNumber(raw.id) ?? "unknown")}`,
    permalink: asString(raw.permalink),
    free: asBoolean(raw.free),
    url: asString(raw.url),
    pdfUrl: asString(raw.pdf_url),
    notes: asString(raw.notes),
    languageCodes,
    categoryNames,
    patternTypeName: asString(patternType?.name),
    published: asString(raw.published),
    updatedAt: asString(raw.updated_at),
    firstPhotoUrl:
      asString(firstPhoto?.medium_url) ?? asString(firstPhoto?.small_url) ?? asString(firstPhoto?.square_url),
    designerName: asString(designer?.name),
  };
}

function buildUrl(path: string, query: Record<string, string | number | undefined>): URL {
  const url = new URL(path, "https://api.ravelry.com/");
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

export class RavelryClient {
  private readonly authHeader: string;
  private readonly username: string;
  private readonly password: string;
  private readonly fetchImpl: typeof fetch;

  constructor(username: string, password: string, fetchImpl: typeof fetch = fetch) {
    this.username = username;
    this.password = password;
    this.fetchImpl = fetchImpl;
    this.authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  }

  static fromEnv(fetchImpl: typeof fetch = fetch): RavelryClient {
    const username = process.env.RAVELRY_API_USERNAME;
    const password = process.env.RAVELRY_API_PASSWORD;

    if (!username || !password) {
      throw new Error("Missing RAVELRY_API_USERNAME or RAVELRY_API_PASSWORD");
    }

    return new RavelryClient(username, password, fetchImpl);
  }

  async searchPatterns(params: RavelrySearchParams = {}): Promise<{
    paginator: RavelrySearchResponse["paginator"];
    patterns: RavelrySearchPattern[];
  }> {
    const url = buildUrl("patterns/search.json", {
      query: params.query,
      craft: params.craft,
      language: params.language,
      availability: params.availability,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
    });

    const payload = await this.request<RavelrySearchResponse>(url);
    const patterns = (payload.patterns ?? []).map(mapSearchPattern).filter((row): row is RavelrySearchPattern => row !== null);

    return {
      paginator: payload.paginator,
      patterns,
    };
  }

  async getPattern(patternId: number): Promise<RavelryPatternDetail> {
    const url = buildUrl(`patterns/${patternId}.json`, {});
    const payload = await this.request<RavelryPatternResponse>(url);
    const rawPattern = asRecord(payload.pattern);

    if (!rawPattern) {
      throw new Error(`Unexpected pattern payload for id=${patternId}`);
    }

    return mapPatternDetail(rawPattern);
  }

  private async request<T>(url: URL): Promise<T> {
    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ravelry API ${response.status} ${response.statusText}: ${body.slice(0, 200)}`);
    }

    return (await response.json()) as T;
  }
}

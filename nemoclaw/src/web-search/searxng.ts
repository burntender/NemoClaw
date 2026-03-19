import type {
  OpenClawConfig,
  WebSearchProviderPlugin,
  WebSearchProviderToolDefinition,
} from "../plugin-sdk-types.js";

const DEFAULT_SEARXNG_BASE_URL = "http://host.openshell.internal:8081/search";
const DEFAULT_SEARCH_COUNT = 5;
const MAX_SEARCH_COUNT = 10;
const DEFAULT_TIMEOUT_SECONDS = 12;
const DEFAULT_CACHE_TTL_MINUTES = 10;
const SEARXNG_DOCS_URL = "https://docs.searxng.org/dev/search_api.html";
const SEARXNG_CACHE = new Map<
  string,
  { value: Record<string, unknown>; insertedAt: number; expiresAt: number }
>();

type SearchConfigRecord = Record<string, unknown>;

type SearxngConfig = {
  baseUrl?: string;
  language?: string;
  safeSearch?: number;
  categories?: string[];
  engines?: string[];
  timeRange?: string;
  maxResults?: number;
  timeoutSeconds?: number;
  cacheTtlMinutes?: number;
};

type SearxngResult = {
  title?: string;
  url?: string;
  content?: string;
  category?: string;
  publishedDate?: string;
  engine?: string;
  engines?: string[];
};

type SearxngResponse = {
  answers?: string[];
  results?: SearxngResult[];
  suggestions?: string[];
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const next = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return next.length > 0 ? next : undefined;
}

function ensureObjectProperty(
  target: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const existing = asRecord(target[key]);
  if (existing) {
    return existing;
  }
  const created: Record<string, unknown> = {};
  target[key] = created;
  return created;
}

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function resolveSiteName(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, "");
    return hostname || undefined;
  } catch {
    return undefined;
  }
}

function resolveSearxngConfig(searchConfig?: SearchConfigRecord): SearxngConfig {
  const searxng = searchConfig?.searxng;
  return searxng && typeof searxng === "object" && !Array.isArray(searxng)
    ? {
        baseUrl: sanitizeText((searxng as Record<string, unknown>).baseUrl) || undefined,
        language: sanitizeText((searxng as Record<string, unknown>).language) || undefined,
        safeSearch:
          typeof (searxng as Record<string, unknown>).safeSearch === "number"
            ? ((searxng as Record<string, unknown>).safeSearch as number)
            : undefined,
        categories: asStringArray((searxng as Record<string, unknown>).categories),
        engines: asStringArray((searxng as Record<string, unknown>).engines),
        timeRange: sanitizeText((searxng as Record<string, unknown>).timeRange) || undefined,
        maxResults:
          typeof (searxng as Record<string, unknown>).maxResults === "number"
            ? ((searxng as Record<string, unknown>).maxResults as number)
            : undefined,
        timeoutSeconds:
          typeof (searxng as Record<string, unknown>).timeoutSeconds === "number"
            ? ((searxng as Record<string, unknown>).timeoutSeconds as number)
            : undefined,
        cacheTtlMinutes:
          typeof (searxng as Record<string, unknown>).cacheTtlMinutes === "number"
            ? ((searxng as Record<string, unknown>).cacheTtlMinutes as number)
            : undefined,
      }
    : {};
}

function resolveConfiguredSearxngConfig(config?: OpenClawConfig): SearxngConfig {
  const webSearch = asRecord(
    asRecord(asRecord(asRecord(config?.plugins)?.entries)?.nemoclaw)?.config,
  )?.webSearch;
  const record = asRecord(webSearch);
  if (!record) {
    return {};
  }
  return {
    baseUrl: sanitizeText(record.baseUrl) || undefined,
    language: sanitizeText(record.language) || undefined,
    safeSearch: typeof record.safeSearch === "number" ? record.safeSearch : undefined,
    categories: asStringArray(record.categories),
    engines: asStringArray(record.engines),
    timeRange: sanitizeText(record.timeRange) || undefined,
    maxResults: typeof record.maxResults === "number" ? record.maxResults : undefined,
    timeoutSeconds: typeof record.timeoutSeconds === "number" ? record.timeoutSeconds : undefined,
    cacheTtlMinutes:
      typeof record.cacheTtlMinutes === "number" ? record.cacheTtlMinutes : undefined,
  };
}

function setConfiguredSearxngConfigValue(
  configTarget: OpenClawConfig,
  key: keyof SearxngConfig,
  value: unknown,
): void {
  const root = (configTarget.plugins ??= {}) as Record<string, unknown>;
  const entries = ensureObjectProperty(root, "entries");
  const nemoclaw = ensureObjectProperty(entries, "nemoclaw");
  const config = ensureObjectProperty(nemoclaw, "config");
  const webSearch = ensureObjectProperty(config, "webSearch");
  webSearch[key] = value;
}

function resolveBaseUrl(config: SearxngConfig): string {
  const candidate =
    config.baseUrl ||
    sanitizeText(process.env.NEMOCLAW_SEARXNG_BASE_URL) ||
    sanitizeText(process.env.SEARXNG_BASE_URL) ||
    DEFAULT_SEARXNG_BASE_URL;
  if (!candidate) {
    return "";
  }
  try {
    const url = new URL(candidate);
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/search";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function resolveTimeRange(args: Record<string, unknown>, config: SearxngConfig): string | undefined {
  const requested = sanitizeText(args.time_range) || sanitizeText(args.freshness) || config.timeRange;
  if (!requested) {
    return undefined;
  }
  if (requested === "day" || requested === "month" || requested === "year") {
    return requested;
  }
  return "__invalid__";
}

function readQuery(args: Record<string, unknown>): string {
  return sanitizeText(args.query);
}

function readStringArray(args: Record<string, unknown>, key: string): string[] | undefined {
  return asStringArray(args[key]);
}

function buildCacheKey(parts: unknown[]): string {
  return JSON.stringify(parts);
}

function readCache(cacheKey: string): Record<string, unknown> | undefined {
  const hit = SEARXNG_CACHE.get(cacheKey);
  if (!hit) {
    return undefined;
  }
  if (Date.now() > hit.expiresAt) {
    SEARXNG_CACHE.delete(cacheKey);
    return undefined;
  }
  return { ...hit.value, cached: true };
}

function writeCache(cacheKey: string, value: Record<string, unknown>, ttlMinutes: number): void {
  SEARXNG_CACHE.set(cacheKey, {
    value,
    insertedAt: Date.now(),
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  });
}

function createToolDefinition(
  searchConfig?: SearchConfigRecord,
  configuredConfig?: SearxngConfig,
): WebSearchProviderToolDefinition {
  const mergedConfig = {
    ...resolveSearxngConfig(searchConfig),
    ...(configuredConfig ?? {}),
  };

  return {
    description:
      "Search the web using a local or self-hosted SearXNG instance. Returns structured search results from the configured metasearch endpoint.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "Search query.",
        },
        count: {
          type: "number",
          description: "Maximum number of results to return.",
          minimum: 1,
          maximum: MAX_SEARCH_COUNT,
        },
        language: {
          type: "string",
          description: "Language/locale hint, for example ja-JP or en-US.",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "Optional SearXNG categories such as general or news.",
        },
        engines: {
          type: "array",
          items: { type: "string" },
          description: "Optional engine allowlist passed through to SearXNG.",
        },
        time_range: {
          type: "string",
          enum: ["day", "month", "year"],
          description: "Optional SearXNG time filter.",
        },
        safeSearch: {
          type: "number",
          enum: [0, 1, 2],
          description: "SearXNG safesearch level: 0 off, 1 moderate, 2 strict.",
        },
      },
      required: ["query"],
    },
    execute: async (args) => {
      const query = readQuery(args);
      if (!query) {
        return {
          error: "missing_query",
          message: "web_search (searxng) needs a non-empty query.",
          docs: SEARXNG_DOCS_URL,
        };
      }

      const baseUrl = resolveBaseUrl(mergedConfig);
      if (!baseUrl) {
        return {
          error: "invalid_searxng_base_url",
          message:
            "web_search (searxng) needs a valid base URL. Set tools.web.search.searxng.baseUrl, plugins.entries.nemoclaw.config.webSearch.baseUrl, or SEARXNG_BASE_URL.",
          docs: SEARXNG_DOCS_URL,
        };
      }

      const count = clampInteger(
        args.count ?? mergedConfig.maxResults,
        DEFAULT_SEARCH_COUNT,
        1,
        MAX_SEARCH_COUNT,
      );
      const timeoutSeconds = clampInteger(
        mergedConfig.timeoutSeconds,
        DEFAULT_TIMEOUT_SECONDS,
        1,
        60,
      );
      const cacheTtlMinutes = clampInteger(
        mergedConfig.cacheTtlMinutes,
        DEFAULT_CACHE_TTL_MINUTES,
        0,
        24 * 60,
      );
      const language = sanitizeText(args.language) || mergedConfig.language;
      const categories = readStringArray(args, "categories") ?? mergedConfig.categories;
      const engines = readStringArray(args, "engines") ?? mergedConfig.engines;
      const safeSearch = clampInteger(args.safeSearch ?? mergedConfig.safeSearch, 0, 0, 2);
      const timeRange = resolveTimeRange(args, mergedConfig);
      if (timeRange === "__invalid__") {
        return {
          error: "invalid_time_range",
          message: "time_range must be one of day, month, or year.",
          docs: SEARXNG_DOCS_URL,
        };
      }

      const cacheKey = buildCacheKey([
        "searxng",
        baseUrl,
        query,
        count,
        language,
        categories,
        engines,
        safeSearch,
        timeRange,
      ]);
      const cached = cacheTtlMinutes > 0 ? readCache(cacheKey) : undefined;
      if (cached) {
        return cached;
      }

      const requestUrl = new URL(baseUrl);
      requestUrl.searchParams.set("q", query);
      requestUrl.searchParams.set("format", "json");
      requestUrl.searchParams.set("safesearch", String(safeSearch));
      if (language) {
        requestUrl.searchParams.set("language", language);
      }
      if (categories?.length) {
        requestUrl.searchParams.set("categories", categories.join(","));
      }
      if (engines?.length) {
        requestUrl.searchParams.set("engines", engines.join(","));
      }
      if (timeRange) {
        requestUrl.searchParams.set("time_range", timeRange);
      }

      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, timeoutSeconds * 1000);

      try {
        const response = await fetch(requestUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = sanitizeText(await response.text());
          return {
            error: "searxng_request_failed",
            message: `SearXNG returned ${String(response.status)}${detail ? `: ${detail}` : ""}`,
            docs: SEARXNG_DOCS_URL,
          };
        }

        const data = (await response.json()) as SearxngResponse;
        const results = Array.isArray(data.results) ? data.results.slice(0, count) : [];
        const payload: Record<string, unknown> = {
          query,
          provider: "searxng",
          count: results.length,
          tookMs: Date.now() - startedAt,
          externalContent: {
            untrusted: true,
            source: "web_search",
            provider: "searxng",
            wrapped: false,
          },
          results: results.map((entry) => ({
            title: sanitizeText(entry.title),
            url: sanitizeText(entry.url),
            description: sanitizeText(entry.content),
            siteName: entry.url ? resolveSiteName(entry.url) : undefined,
            category: sanitizeText(entry.category),
            engines: Array.isArray(entry.engines)
              ? entry.engines.map((engine) => sanitizeText(engine)).filter(Boolean)
              : sanitizeText(entry.engine)
                ? [sanitizeText(entry.engine)]
                : [],
            publishedDate: sanitizeText(entry.publishedDate),
          })),
        };

        const answer = Array.isArray(data.answers)
          ? data.answers.map((entry) => sanitizeText(entry)).filter(Boolean)[0]
          : "";
        if (answer) {
          payload["content"] = answer;
        }
        const suggestions = Array.isArray(data.suggestions)
          ? data.suggestions.map((entry) => sanitizeText(entry)).filter(Boolean)
          : [];
        if (suggestions.length > 0) {
          payload["suggestions"] = suggestions;
        }

        if (cacheTtlMinutes > 0) {
          writeCache(cacheKey, payload, cacheTtlMinutes);
        }

        return payload;
      } catch (error) {
        const message =
          error instanceof Error && error.name === "AbortError"
            ? `SearXNG request timed out after ${String(timeoutSeconds)}s`
            : error instanceof Error
              ? error.message
              : "unknown error";
        return {
          error: "searxng_request_failed",
          message,
          docs: SEARXNG_DOCS_URL,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function createSearxngWebSearchProvider(): WebSearchProviderPlugin {
  return {
    id: "searxng",
    label: "SearXNG Search",
    hint: "Self-hosted metasearch · local-first web search",
    envVars: ["NEMOCLAW_SEARXNG_BASE_URL", "SEARXNG_BASE_URL"],
    placeholder: DEFAULT_SEARXNG_BASE_URL,
    signupUrl: "https://docs.searxng.org/",
    docsUrl: SEARXNG_DOCS_URL,
    autoDetectOrder: 5,
    credentialPath: "plugins.entries.nemoclaw.config.webSearch.baseUrl",
    getCredentialValue: (searchConfig) => resolveSearxngConfig(searchConfig).baseUrl,
    setCredentialValue: (searchConfigTarget, value) => {
      const scoped = asRecord(searchConfigTarget.searxng);
      if (!scoped) {
        searchConfigTarget.searxng = { baseUrl: value };
        return;
      }
      scoped.baseUrl = value;
    },
    getConfiguredCredentialValue: (config) => resolveConfiguredSearxngConfig(config).baseUrl,
    setConfiguredCredentialValue: (configTarget, value) => {
      setConfiguredSearxngConfigValue(configTarget, "baseUrl", value);
    },
    applySelectionConfig: (config) => {
      const tools = ensureObjectProperty(config, "tools");
      const web = ensureObjectProperty(tools, "web");
      const search = ensureObjectProperty(web, "search");
      search.enabled = true;
      search.provider = "searxng";
      return config;
    },
    createTool: (ctx) =>
      createToolDefinition(
        ctx.searchConfig,
        resolveConfiguredSearxngConfig(ctx.config),
      ),
  };
}

export const __testing = {
  DEFAULT_SEARXNG_BASE_URL,
  resolveBaseUrl,
  resolveConfiguredSearxngConfig,
  resolveSearxngConfig,
  resolveTimeRange,
} as const;

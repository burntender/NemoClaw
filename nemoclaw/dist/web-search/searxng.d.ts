import type { OpenClawConfig, WebSearchProviderPlugin } from "../plugin-sdk-types.js";
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
declare function resolveSearxngConfig(searchConfig?: SearchConfigRecord): SearxngConfig;
declare function resolveConfiguredSearxngConfig(config?: OpenClawConfig): SearxngConfig;
declare function resolveBaseUrl(config: SearxngConfig): string;
declare function resolveTimeRange(args: Record<string, unknown>, config: SearxngConfig): string | undefined;
export declare function createSearxngWebSearchProvider(): WebSearchProviderPlugin;
export declare const __testing: {
    readonly DEFAULT_SEARXNG_BASE_URL: "http://host.openshell.internal:8081/search";
    readonly resolveBaseUrl: typeof resolveBaseUrl;
    readonly resolveConfiguredSearxngConfig: typeof resolveConfiguredSearxngConfig;
    readonly resolveSearxngConfig: typeof resolveSearxngConfig;
    readonly resolveTimeRange: typeof resolveTimeRange;
};
export {};
//# sourceMappingURL=searxng.d.ts.map
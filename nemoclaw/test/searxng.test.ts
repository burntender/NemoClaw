import { describe, expect, it } from "vitest";
import { createSearxngWebSearchProvider, __testing } from "../src/web-search/searxng.js";

describe("searxng web search config", () => {
  it("uses the local host default when config is empty", () => {
    expect(__testing.resolveBaseUrl({})).toBe("http://host.openshell.internal:8081/search");
  });

  it("normalizes bare instance URLs to /search", () => {
    expect(__testing.resolveBaseUrl({ baseUrl: "http://host.openshell.internal:8090" })).toBe(
      "http://host.openshell.internal:8090/search",
    );
  });

  it("reads plugin config under plugins.entries.nemoclaw.config.webSearch", () => {
    expect(
      __testing.resolveConfiguredSearxngConfig({
        plugins: {
          entries: {
            nemoclaw: {
              config: {
                webSearch: {
                  baseUrl: "http://host.openshell.internal:8081/search",
                  language: "ja-JP",
                  safeSearch: 0,
                  categories: ["general"],
                },
              },
            },
          },
        },
      }),
    ).toEqual({
      baseUrl: "http://host.openshell.internal:8081/search",
      language: "ja-JP",
      safeSearch: 0,
      categories: ["general"],
      engines: undefined,
      timeRange: undefined,
      maxResults: undefined,
      timeoutSeconds: undefined,
      cacheTtlMinutes: undefined,
    });
  });
});

describe("searxng web search provider", () => {
  it("writes selected provider config into tools.web.search", () => {
    const provider = createSearxngWebSearchProvider();
    const result = provider.applySelectionConfig?.({});
    expect(result).toEqual({
      tools: {
        web: {
          search: {
            enabled: true,
            provider: "searxng",
          },
        },
      },
    });
  });
});

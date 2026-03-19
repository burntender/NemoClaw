# SearXNG Web Search

`NemoClaw` now registers a `searxng` web-search provider through its plugin.

## Default assumption

- SearXNG is reachable from the sandbox at `http://host.openshell.internal:8081/search`
- This matches the existing local compose setup in this workspace

## Minimal config

Inside the sandbox, set:

```bash
openclaw config set tools.web.search.enabled true
openclaw config set tools.web.search.provider searxng
```

If you want to override the endpoint:

```bash
openclaw config set plugins.entries.nemoclaw.config.webSearch.baseUrl http://host.openshell.internal:8081/search
```

Optional tuning:

```bash
openclaw config set plugins.entries.nemoclaw.config.webSearch.language ja-JP
openclaw config set plugins.entries.nemoclaw.config.webSearch.safeSearch 0
```

## Notes

- The bundled blueprint policy now allows `host.openshell.internal:8081/search`
- If you run SearXNG on a different host or port, you will need a matching policy update
- The provider also accepts `NEMOCLAW_SEARXNG_BASE_URL` or `SEARXNG_BASE_URL`

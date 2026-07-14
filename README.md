<p align="center">
  <img src="icon.png" alt="UF Schedule of Courses MCP logo" width="96" height="96">
</p>

<h1 align="center">UF Schedule of Courses — MCP Server</h1>

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant search the
**University of Florida Schedule of Courses** through structured tool calls. It wraps the
public API behind [one.uf.edu/soc](https://one.uf.edu/soc/) and accepts human-friendly
inputs (term names, department names, day letters) instead of UF's internal codes.

> Public data only — it exercises the same public search form a normal visitor would.
> No login, no scraping of protected pages, no rate-limit evasion.

## Tools

| Tool | Description |
|---|---|
| `search_courses` | Full-filter course search with optional auto-pagination. |
| `get_filter_options` | Live option lists (terms, categories, program levels, departments), with a substring `query`. |
| `get_course` | Convenience lookup of one course + all its sections by (prefix) code in a term. |

`search_courses` accepts, among others: `term` (`"Fall 2026"` or `"2268"`), `department`
(`"Mathematics"` / partial / 8-digit code), `program_level`, `category`, `course_code`
(prefix match), `course_title`, `instructor`, `credits` + `credits_operator`
(`equal`/`at most`/`at least`), `level_min`/`level_max`, `days` (`M T W R F S`),
`period_begin`/`period_end` (`1`–`11` or `E1`–`E3`), `online_types`, `gen_ed` (`B C D H M N P S`),
`writing` (`2000/4000/6000`), `quest` (`1`–`4`), and flags `ai_course`, `eep_eligible`,
`affordable_uf`, `experiential_learning`, `honors`, `no_open_seats`, `special_program`.
Set `fetch_all: true` to auto-paginate up to `max_results`.

---

## Install

### Claude Code — one command

Straight from GitHub (no npm account needed — `npx` builds it on the fly):

```bash
claude mcp add uf-schedule -- npx -y github:Lewin-Shen/uf-schedule-mcp
```

Or, once you've published to npm:

```bash
claude mcp add uf-schedule -- npx -y uf-schedule-mcp
```

Add `--scope user` to make it available in every project. Verify with `claude mcp list`.

### Claude Desktop — drag and drop

1. Download `uf-schedule-mcp.mcpb` from this repo's [Releases](https://github.com/Lewin-Shen/uf-schedule-mcp/releases).
2. In Claude Desktop: **Settings → Extensions**.
3. Drag the `.mcpb` file onto the Extensions page and click **Install**.

Because Claude Desktop ships its own Node runtime, the bundle runs with no extra setup.

<details>
<summary>Alternative: Claude Desktop via config file (for local dev)</summary>

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config) and add:

```json
{
  "mcpServers": {
    "uf-schedule": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/uf-schedule-mcp/dist/index.js"]
    }
  }
}
```

Run `npm install && npm run build` first so `dist/` exists, then fully quit and reopen Claude Desktop.
</details>

---

## Local development

```bash
git clone https://github.com/Lewin-Shen/uf-schedule-mcp.git
cd uf-schedule-mcp
npm install          # runs the TypeScript build via the "prepare" script
npm test             # unit tests for the query builder + resolvers (no network)
npm start            # run the server on stdio
npm run bundle       # build uf-schedule-mcp.mcpb (Claude Desktop extension)
```

- **Node 18+** required (uses the built-in `fetch`).
- Source is TypeScript in `src/`; `npm run build` emits `dist/`.
- `npm run bundle` stages `dist/` + production `node_modules` + `manifest.json` and packs
  them with the [`@anthropic-ai/mcpb`](https://github.com/modelcontextprotocol/mcpb) CLI.

## Example call

```json
{
  "name": "search_courses",
  "arguments": {
    "term": "Fall 2026",
    "department": "Computer & Information Science",
    "program_level": "Undergraduate",
    "days": ["M", "W", "F"],
    "credits": 3,
    "credits_operator": "at least",
    "fetch_all": true
  }
}
```

Returns `{ query, total_matching, returned, courses: [...] , next_control_number? }`, where
each course has simplified sections (class number, credits, instructors, meeting times,
delivery type, wait-list, etc.).

## Publishing (maintainer notes)

- **npm:** `npm publish --access public` (the `prepublishOnly` script builds first).
- **GitHub release + `.mcpb`:** create a Release; the included GitHub Action
  (`.github/workflows/release.yml`) runs the tests, builds `uf-schedule-mcp.mcpb`, and
  attaches it to the release automatically.

## How it works

The server is a thin, typed wrapper over `GET https://one.uf.edu/apix/soc/schedule` plus
`/apix/soc/filters` for option lists. The full reverse-engineered parameter map — every
query parameter, the enumerations, pagination, and the response schema — is in
[`docs/API-REFERENCE.md`](docs/API-REFERENCE.md).

## Caveats

- Seat counts and meeting times are often unpublished for future terms; the tools pass
  through whatever the API returns.
- Special-topics numbers (e.g. `CIS 6930`) reuse one code for many rotating topics.
- `no_open_seats` filter direction and the legacy `var-cred` / `ge` params are passed
  through as documented in the reference.

## License

MIT — see [LICENSE](LICENSE). Built by [Lewin](https://github.com/Lewin-Shen).
Not affiliated with or endorsed by the University of Florida.

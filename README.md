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

## Beyond linear search

The point isn't the single lookup — [one.uf.edu](https://one.uf.edu/soc/) already does that. The point
is that structured, chainable tools let an agent run **multi-step, branching investigations** that a
linear search can't: dozens of dependent queries, cross-referenced against an outside source,
reconciled where they disagree, and synthesized into an answer the underlying data never states
directly. Every tool returns typed JSON and resolves human inputs to UF's internal codes, so the
model can plan a query, read the result, and decide the next one — no human in the loop per hop.

### Example: auditing a graduate certificate

UF's [Institute for Computational Engineering (ICE)](https://www.eng.ufl.edu/ice/program-curriculum/)
publishes a *Graduate Certificate in Scientific Computing*: 2 core courses plus ~30 approved
electives. An obvious question — *"which of these are actually still offered, and when?"* — is not
answerable by any single search, and the curriculum page itself can't tell you. An agent using this
server:

1. **Read the certificate's course list** from the ICE page — 29 unique course numbers spanning
   seven departments.
2. **Fanned out ~260 dependent lookups** — every course number × 9 terms (Fall 2023 → Fall 2026) —
   parallelized across sub-agents.
3. **Classified each course** as actively offered, dormant, or long-discontinued, and inferred its
   typical term and cadence (*every Fall*, *every Spring*, *~biennial*) plus the term last taught.
4. **Caught what the list couldn't say**: numbers whose live title no longer matches the certificate
   (`CES 6165` now runs as *Concrete Structural Rehabilitation*; `EEL 6533` as *Data Analytics and
   Decision Sciences*), and special-topics umbrellas (`CIS 6930`, `EGM 6934`, `EEL 6935`) where the
   number is active but the *specific* certificate topic may not be.
5. **Synthesized the finding**: 16 of 29 still active, 2 dormant, 11 not taught in 3+ years — and,
   most usefully for an advisor, that **both core courses are shaky** (the VVUU core hasn't run
   since Spring 2024).

That's the pattern this server is built for: the model plans the queries, reacts to what comes back,
and produces a conclusion rather than a result list.

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

Two filters worth knowing:

- **`name_contains`** — a client-side filter over the *full* course name. `course_title` is
  passed upstream and only matches the **base catalog title**, so it misses special-topics
  suffixes (`course_title: "GPU"` finds nothing; `name_contains: "GPU"` finds *Special Topics
  in Electrical Engineering: GPU Computing*). Pair it with `department` or `course_code` to
  keep the fetch small.
- **`compact`** (default `true`) — trims bulky per-section fields. Set `compact: false` for
  seats, wait-list, fees, deadlines, `acadCareer`, and gen-ed/quest attributes. Compact keeps
  the decisive small ones (`classNumber`, `credits`, `instructors`, `delivery`, `gradBasis`,
  `meet`). Default responses are ~2.8× smaller than full.

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
npm test             # unit tests: query builder, resolvers, dedupe, meet mapping (no network)
npm run smoke        # live known-answer checks against the real API (network required)
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

## Data limits (verified, not guesses)

- **Meeting times and locations are login-gated.** `meet` always comes back as `"TBA"`. This
  is UF's doing, not a gap in this server: the SOC UI itself says *"Log in to view additional
  details like locations, dates, times, and final exams."* The public API returns
  `meetTimes: []` for **every** section — confirmed across hundreds of sections in multiple
  departments and terms (Fall 2025 and Fall 2026). The mapping is implemented, so the data
  appears the moment an authenticated session supplies it.
- **`openSeats` is always `null`** for the same reason.
- **No syllabi.** SOC carries none; Simple Syllabus (GatorLink-gated) is the source.
- **`credits` filtering is loose upstream.** `credits=2, credits_operator="equal"` also
  matches *variable*-credit courses whose range merely includes 2 (e.g. `VAR 1–15`). Check
  `credits` in the response if you need a fixed-credit course.
- **`total_matching` counts upstream rows (course codes), not course objects.** One
  special-topics row expands into one entry per topic — `EEL5934` is `TOTALROWS: 1` but six
  courses. Pagination therefore tracks `RETRIEVEDROWS`, not entry count.
- **Special-topics codes reuse one `courseId`** across every topic (all six `EEL5934` topics
  share `011774`), so de-duplication keys on `courseId + name`.
- `no_open_seats` direction and the legacy `var-cred` / `ge` params are passed through as
  documented in the reference.

## License

MIT — see [LICENSE](LICENSE). Built by [Lewin](https://github.com/Lewin-Shen).
Not affiliated with or endorsed by the University of Florida.

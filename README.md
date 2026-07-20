<p align="center">
  <img src="icon.png" alt="UF Schedule of Courses MCP logo" width="96" height="96">
</p>

<h1 align="center">UF Schedule of Courses — MCP Server</h1>

> **This is a tool for your AI assistant, not an app you operate yourself.** As a user you never
> call these functions or learn any parameters — you just ask your assistant in plain English (e.g.
> *"find Fall 2026 graduate statistics courses that meet on Tuesdays and summarize how each one is
> graded"*) and it decides which tools to call and how to combine them. Everything below — function
> names, inputs, return shapes — is reference material **for the assistant and for developers**, not
> steps a person needs to follow. Install it (below), then talk to your assistant normally.

An [MCP](https://modelcontextprotocol.io) server that gives an AI assistant structured access to
**University of Florida course data**: search the Schedule of Courses and pull published course
**syllabi**, using human-friendly inputs (term names, department names, day letters) instead of UF's
internal codes. Because every result is typed JSON, an assistant can chain calls, cross-reference,
and assemble the exact slice of data a person asks for — then present it however they want (a table,
a shortlist, a comparison, a plan).

It reads two public UF systems:

- **[one.uf.edu Schedule of Courses](https://one.uf.edu/soc/)** — course & section listings, filters.
- **[UF Simple Syllabus](https://ufl.simplesyllabus.com/)** — published syllabus content.

> Public data only — it exercises the same public pages a normal visitor would. No login, no
> scraping of protected pages, no rate-limit evasion.

## Install

### Claude Desktop — drag and drop (recommended)

1. Download `uf-schedule-mcp.mcpb` from this repo's
   [Releases](https://github.com/Lewin-Shen/uf-schedule-mcp/releases) (or build it — see below).
2. In Claude Desktop: **Settings → Extensions**.
3. Drag the `.mcpb` onto the Extensions page and click **Install**.

Claude Desktop ships its own Node runtime, so the bundle runs with no extra setup.

### Claude Code — one command

Runs straight from GitHub; `npx` builds it on the fly (no separate install, no npm account):

```bash
claude mcp add uf-schedule -- npx -y github:Lewin-Shen/uf-schedule-mcp
```

Add `--scope user` to make it available in every project. Verify with `claude mcp list`.

<details>
<summary>Alternative: Claude Desktop via config file (for local dev)</summary>

Run `npm install && npm run build` first so `dist/` exists, then edit `claude_desktop_config.json`
(Settings → Developer → Edit Config):

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

Fully quit and reopen Claude Desktop.
</details>

### Codex — CLI, IDE extension, or ChatGPT desktop app

Codex has no bundle format; it runs the same stdio server, and its CLI, IDE extension, and the ChatGPT
desktop app **share one MCP config** — so you add it once, any way you like:

- **CLI:** `codex mcp add uf-schedule -- npx -y github:Lewin-Shen/uf-schedule-mcp`
- **GUI (IDE extension / desktop app):** Settings (gear) → **MCP servers** → **Add server** → type
  **STDIO**, name `uf-schedule`, command `npx`, args `-y github:Lewin-Shen/uf-schedule-mcp`; Save, then
  restart.
- **Or `~/.codex/config.toml`:**

  ```toml
  [mcp_servers.uf-schedule]
  command = "npx"
  args = ["-y", "github:Lewin-Shen/uf-schedule-mcp"]
  ```

It's a local (stdio) server, so add it as a **local MCP server**, not a remote "connector."

### Any other MCP client

It's plain MCP over stdio — run it with `npx -y github:Lewin-Shen/uf-schedule-mcp` (or `node dist/index.js`
from a local build) and point any MCP-compatible client at that command.

---

## What you get — and what you don't

Read this before building anything on the output; some of the most-wanted fields are gated by UF.

- **Meeting times and rooms are gated on the schedule system, but recoverable from the syllabus.**
  `search_courses` / `get_course` return `meet: "TBA"` — one.uf.edu shows times and rooms only to
  logged-in users. But when a section has a **public syllabus**, `get_syllabus` returns its meeting
  time **and room** in `metadata` (from Simple Syllabus's registrar feed). So the data *is* available
  through this server — it just comes from the syllabus tool, not the schedule tools.
- **Open seats are login-only, everywhere.** `openSeats` is always `null`; live enrollment counts are
  in neither the public schedule API nor a syllabus, so this server genuinely can't provide them.
- **`get_syllabus` returns JSON, not the PDF.** It gives you the structured content Simple Syllabus
  uses to render its page. You **cannot** produce, attach, or reproduce the official syllabus PDF —
  work from the extracted text/fields instead. Within the result:
  - `sections` = the **authored syllabus body** — the content that appears in the PDF.
  - `metadata` = **extra scheduling data** (credits, meeting time + room, exam date, term dates) that
    is registrar-sourced and **not printed in the syllabus PDF**.
- **Only public syllabi** (`visibility: general_public`) are retrievable; restricted ones return a
  clean not-found.

**Verification:** the server instructs the assistant to end every deliverable with a one-line note
urging you to confirm details against the **authenticated** one.uf.edu Schedule of Courses and Simple
Syllabus — because gated/registrar-sourced fields can change and aren't independently checkable here.
Treat this tool's output as a fast first pass, not the system of record.

## Tools

| Tool | What it does | Key inputs | Returns |
|---|---|---|---|
| **`search_courses`** | Search the Schedule of Courses across every documented filter, with optional auto-pagination. | `term` (required), `department`, `program_level`, `category`, `course_code` (prefix), `course_title`, `name_contains`, `instructor`, `credits`+`credits_operator`, `level_min/max`, `days`, `period_begin/end`, `online_types`, `gen_ed`, `writing`, `quest`, flags (`ai_course`, `honors`, `eep_eligible`, `affordable_uf`, `experiential_learning`, `no_open_seats`), `special_program`, `compact`, `fetch_all`, `max_results` | `{ query, total_matching, returned, courses[] }`. Each course: `code`, `name`, `courseId`, `sections[]` (`classNumber`, `credits`, `instructors`, `delivery`, `gradBasis`, `meet` = `"TBA"`; more when `compact:false`). |
| **`get_course`** | Look up one course + all its sections by (prefix) code in a term. Returns a special-topics code as one entry **per topic**. | `term`, `course_code`, `category`, `include_description`, `compact` | `{ found, count, courses[], prefix_matches? }` — every topic identifiable (shared `courseId`, distinct `name`). |
| **`get_filter_options`** | Live, valid option codes for the dropdowns — terms, categories, program levels, departments. | `kind` (`all`/`terms`/`categories`/`program_levels`/`departments`), `query` (substring), `limit` | `{ <kind>: [{ code, name }] }`. Terms are newest-first. |
| **`get_syllabus`** | Fetch a section's published syllabus **content** (JSON, not PDF) from Simple Syllabus, for reading/analysis. | `course_code` (or `handle`), `class_number`, `term`, `include_full_text`, `max_candidates` | `{ found, metadata, sections[] }` for one match; `{ ambiguous, candidates[] }` if several; clean not-found otherwise. See [provenance](#what-you-get--and-what-you-dont). |

A few behaviors worth knowing:

- **`name_contains`** filters over the *full* course name, client-side. `course_title` is passed
  upstream and matches only the **base catalog title**, so it misses special-topics suffixes
  (`course_title: "GPU"` → nothing; `name_contains: "GPU"` → *…: GPU Computing*). Pair it with
  `department` or `course_code` to keep the fetch small.
- **`compact`** (default `true`) trims bulky per-section fields; `compact: false` adds seats,
  wait-list, fees, deadlines, `acadCareer`, gen-ed/quest attributes. Compact keeps the decisive small
  ones (`classNumber`, `credits`, `instructors`, `delivery`, `gradBasis`, `meet`) and is ~2.8× smaller.
- **`get_syllabus` join key is the class number** — the schedule `classNumber` (e.g. `11718`) appears
  in the Simple Syllabus record. Pass it (plus `term`) to pin one section; without it you get
  `candidates` to choose from — the tool never guesses.

## Beyond linear search

The point isn't the single lookup — one.uf.edu already does that. The point is that structured,
chainable tools let an assistant run **multi-step, branching investigations** and then hand you
**whatever combination of data you asked for, in whatever shape you want** — a table, a ranked
shortlist, a side-by-side, a schedule. You describe the question; the model plans the queries, reacts
to what comes back, reconciles sources, and returns a conclusion rather than a result dump.

**Example — auditing a graduate certificate.** UF's
[Institute for Computational Engineering (ICE)](https://www.eng.ufl.edu/ice/program-curriculum/)
lists a *Graduate Certificate in Scientific Computing* (2 core + ~30 electives). *"Which of these are
still actually offered, and when?"* isn't answerable by any single search. The assistant read the
certificate's 29 course numbers, fanned out ~260 lookups (each course × 9 terms, Fall 2023 → Fall
2026), classified each as active / dormant / discontinued with its typical term and cadence, caught
numbers whose live title had drifted from the certificate (`CES 6165`, `EEL 6533`) and special-topics
umbrellas, and concluded: 16 of 29 active, 2 dormant, 11 untaught in 3+ years — and that **both core
courses are shaky**.

**Example — filter by grading, then read every syllabus.** *"Pull all Fall 2026 graduate ENU courses
that aren't S/U, and for each summarize what it's about, its attendance and exam policy, and its
meeting time."* The assistant searched the department, dropped the `gradBasis: "SUS"` sections
(research, thesis, seminar, co-op), then called `get_syllabus` on each remaining course to pull the
description, the *Methods of Evaluation* and *Attendance Policy* sections, and the registrar meeting
time/room — folding it all into one comparison table. Two of the query's dimensions (grading basis
and meeting time) live in different systems; neither one.uf.edu nor a syllabus answers it alone.

That's the pattern this server is built for: arbitrary questions across course + syllabus data,
answered in the format that's useful to *you*.

## How it works

The server is a thin, typed wrapper over **two** public UF APIs:

1. **Schedule of Courses** — `GET https://one.uf.edu/apix/soc/schedule` (+ `/apix/soc/filters` for
   option lists). Powers `search_courses`, `get_course`, `get_filter_options`.
2. **Simple Syllabus** — a two-hop flow (`/api2/doc-library-search` → `/api2/doc-full-page-get`)
   joined to the schedule data by **class number**. Powers `get_syllabus`.

The full reverse-engineered map of both — every query parameter, the enumerations, pagination,
response schemas, the Simple Syllabus two-hop model, and the verified data limits — is in
[`docs/API-REFERENCE.md`](docs/API-REFERENCE.md).

## Local development

```bash
git clone https://github.com/Lewin-Shen/uf-schedule-mcp.git
cd uf-schedule-mcp
npm install          # runs the TypeScript build via the "prepare" script
npm test             # unit tests: query builder, resolvers, dedupe, meet mapping, HTML→text (no network)
npm run smoke        # live known-answer checks against both real APIs (network required)
npm start            # run the server on stdio
npm run bundle       # build uf-schedule-mcp.mcpb (Claude Desktop extension)
```

- **Node 18+** required (uses the built-in `fetch`).
- Source is TypeScript in `src/`; `npm run build` emits `dist/`.
- `npm run bundle` stages `dist/` + production `node_modules` + `manifest.json` + `icon.png` and packs
  them with the [`@anthropic-ai/mcpb`](https://github.com/modelcontextprotocol/mcpb) CLI.
- **Releases:** the included GitHub Action (`.github/workflows/release.yml`) runs the tests, builds the
  `.mcpb`, and attaches it to each GitHub Release. (Not published to npm — installs run from source.)

## Notes & gotchas (verified, not guesses)

Beyond the gated fields covered [above](#what-you-get--and-what-you-dont):

- **`credits` filtering is loose upstream.** `credits=2, credits_operator="equal"` also matches
  *variable*-credit courses whose range merely includes 2 (e.g. `VAR 1–15`). Check `credits` in the
  response if you need a genuinely fixed-credit course.
- **`total_matching` counts upstream rows (course codes), not course objects.** One special-topics
  row expands into one entry per topic — `EEL5934` is `TOTALROWS: 1` but six courses. Pagination
  tracks `RETRIEVEDROWS`, not entry count.
- **Special-topics codes reuse one `courseId`** across every topic (all six `EEL5934` topics share
  `011774`), so de-duplication keys on `courseId + name`.
- **`gradBasis: "SUS"`** cleanly marks S/U credit-holders (research, thesis, dissertation, individual
  work, supervised teaching); `"GRD"` = graded coursework.
- **Simple Syllabus needs a browser User-Agent** (the edge 403s others); the server sends one.
- `no_open_seats` direction and the legacy `var-cred` / `ge` params are passed through as documented.

## License

MIT — see [LICENSE](LICENSE). Built by [Lewin](https://github.com/Lewin-Shen).
Not affiliated with or endorsed by the University of Florida.

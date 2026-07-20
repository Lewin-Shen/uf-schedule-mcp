import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getCourse, getFilterOptions, searchCourses, type SearchArgs } from "./uf.js";
import { getSyllabus, type SyllabusArgs } from "./syllabus.js";

// Emit minified JSON: 2-space indentation inflates these payloads by ~40% for
// zero benefit to a model reading them (P3 — responses were overflowing).
function ok(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
}
function fail(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
}

const SERVER_INSTRUCTIONS = `UF Schedule of Courses + syllabus retrieval. Draws on TWO public University of Florida systems:
- one.uf.edu Schedule of Courses (search_courses, get_course, get_filter_options) — course/section listings.
- UF Simple Syllabus (get_syllabus) — published syllabus content.

WHAT YOU GET, AND WHAT YOU DON'T:
- Meeting times, room locations, and open-seat counts are GATED behind UF login on the schedule system. search_courses/get_course therefore return meet:"TBA" and openSeats:null. Do not report these as unavailable-in-general — they exist, they are just login-only.
- get_syllabus returns the STRUCTURED JSON that Simple Syllabus uses to render its syllabus page. You CANNOT produce, attach, or reproduce the official syllabus PDF — provide the extracted text and fields instead. Within its result: "sections" is the authored syllabus body (what the PDF shows); "metadata" (credits, meeting time, room, exam date, term dates) is additional scheduling data that is NOT printed in the syllabus PDF. When one exists, a public syllabus is the only unauthenticated place the meeting time/room surfaces.
- Only public (visibility=general_public) syllabi are retrievable; restricted ones return a clean not-found.

REQUIRED — verification notice: End EVERY deliverable built from this data (tables, summaries, comparisons, recommendations) with a brief note telling the user to verify the details against the AUTHENTICATED sources — the logged-in one.uf.edu Schedule of Courses and Simple Syllabus — because some fields are login-gated or registrar-sourced metadata and can change. Keep it to one sentence; do not omit it.`;

export function createServer(): McpServer {
  const server = new McpServer({ name: "uf-schedule", version: "1.0.0" }, { instructions: SERVER_INSTRUCTIONS });

  server.registerTool(
    "search_courses",
    {
      title: "Search UF courses",
      description:
        "Search the UF Schedule of Courses.\n" +
        "term is required: a code ('2268') or description ('Fall 2026').\n" +
        "department accepts a name ('Mathematics', partial ok) or 8-digit code.\n" +
        "program_level: Undergraduate/Graduate/Law/Medical School/Pharmacy/Physician Assistant/Professional/Veterinary Medicine.\n" +
        "category: CWSP (default), UFOL (UF Online), IA. course_code is prefix-matched (spaces ignored).\n" +
        "credits + credits_operator ('equal'|'at most'|'at least'). level_min/level_max: 1000..8000 / 1999..8999.\n" +
        "days: M T W R F S. period_begin/period_end: 1-11 or E1-E3. online_types: online/primarily_online/hybrid/classroom.\n" +
        "gen_ed: B C D H M N P S. writing: 2000/4000/6000. quest: 1-4. special_program: all|special|general.\n" +
        "Set fetch_all=true to auto-paginate (up to max_results); otherwise one page (<=50) plus next_control_number.\n" +
        "TITLE SEARCH: course_title is sent upstream and only matches the BASE catalog title, so it misses " +
        "special-topics suffixes (e.g. 'GPU'). Use name_contains for a client-side filter over the full course " +
        "name incl. the topic suffix; pair it with department or course_code to keep the fetch small.\n" +
        "compact (default true) trims bulky per-section fields; set compact=false for seats, wait-list, " +
        "acadCareer, fees, deadlines, gen-ed/quest attributes.\n" +
        "DATA LIMITS: openSeats is always null and meeting times/locations come back as \"TBA\" — UF gates both " +
        "behind GatorLink login, so the public API never returns them (get_syllabus can recover meeting time/room " +
        "for a section that has a public syllabus). SOC carries no syllabi (Simple Syllabus is the source).\n" +
        "End any deliverable built from this with a one-line note to verify against the authenticated one.uf.edu.",
      inputSchema: {
        term: z.string().describe("Term code or description, e.g. '2268' or 'Fall 2026'"),
        category: z.string().optional().describe("CWSP (default), UFOL, or IA"),
        program_level: z.string().optional(),
        department: z.string().optional().describe("Department name (partial ok) or 8-digit code"),
        course_code: z.string().optional().describe("Prefix match, e.g. 'COP3502' or 'COP'"),
        course_title: z.string().optional(),
        instructor: z.string().optional().describe("Instructor last name"),
        class_number: z.string().optional(),
        credits: z.number().int().optional(),
        credits_operator: z.string().optional().describe("'equal' | 'at most' | 'at least'"),
        level_min: z.string().optional(),
        level_max: z.string().optional(),
        days: z.array(z.string()).optional().describe("Any of M T W R F S"),
        period_begin: z.string().optional().describe("1-11 or E1-E3"),
        period_end: z.string().optional().describe("1-11 or E1-E3"),
        online_types: z.array(z.string()).optional(),
        gen_ed: z.array(z.string()).optional(),
        writing: z.array(z.string()).optional(),
        quest: z.array(z.string()).optional(),
        ai_course: z.boolean().optional(),
        eep_eligible: z.boolean().optional(),
        affordable_uf: z.boolean().optional(),
        experiential_learning: z.boolean().optional(),
        honors: z.boolean().optional(),
        no_open_seats: z.boolean().optional(),
        special_program: z.string().optional().describe("all | special | general"),
        name_contains: z
          .string()
          .optional()
          .describe(
            "Client-side filter over the full course name incl. special-topics suffix (e.g. 'GPU'). " +
              "Catches what course_title misses.",
          ),
        compact: z
          .boolean()
          .optional()
          .describe("Default true. false = full detail (seats, wait-list, fees, deadlines, attributes)."),
        max_results: z.number().int().optional().describe("Cap on courses returned (default 100)"),
        fetch_all: z.boolean().optional().describe("Auto-paginate up to max_results"),
        last_control_number: z.number().int().optional().describe("Pagination cursor (0 = first page)"),
        include_description: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        return ok(await searchCourses(args as SearchArgs));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_filter_options",
    {
      title: "List UF filter option codes",
      description:
        "List valid dropdown option codes from the live /apix/soc/filters endpoint. " +
        "kind: 'all' | 'terms' | 'categories' | 'program_levels' | 'departments'. " +
        "query: optional case-insensitive substring filter (useful for departments, e.g. 'engineering'). " +
        "limit: cap entries per list; terms are newest-first, so limit=6 gives the 6 most recent terms.",
      inputSchema: {
        kind: z.string().optional().describe("all | terms | categories | program_levels | departments"),
        query: z.string().optional().describe("Substring filter (esp. for departments)"),
        limit: z.number().int().optional().describe("Max entries per list (0/omitted = all). Terms are newest-first."),
      },
    },
    async (args) => {
      try {
        return ok(await getFilterOptions(args.kind ?? "all", args.query ?? "", args.limit ?? 0));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_course",
    {
      title: "Look up a UF course and all its sections",
      description:
        "Look up a course and all its sections by exact/prefix code in a term. " +
        "course_code is prefix-matched (e.g. 'COP3502' matches 'COP3502C'). term accepts a code or description.\n" +
        "Returns a `courses` ARRAY: a special-topics code yields one entry per topic (e.g. EEL5934 → 6 topics, " +
        "all sharing courseId but with distinct names), so every topic is identifiable — not just the first.\n" +
        "openSeats is always null and meet is \"TBA\": UF gates seats and meeting times behind GatorLink login.",
      inputSchema: {
        term: z.string().describe("Term code or description"),
        course_code: z.string().describe("Course code, prefix-matched"),
        category: z.string().optional(),
        include_description: z.boolean().optional(),
        compact: z.boolean().optional().describe("Default true; false = full per-section detail."),
      },
    },
    async (args) => {
      try {
        return ok(
          await getCourse(
            args.term,
            args.course_code,
            args.category ?? "CWSP",
            args.include_description ?? true,
            args.compact ?? true,
          ),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_syllabus",
    {
      title: "Get a UF course syllabus (content JSON, for analysis — not the PDF)",
      description:
        "Fetch a section's published syllabus from UF Simple Syllabus as structured text, for an agent to read and " +
        "act on (assess fit, compare courses, write a short description, extract topics/prerequisites/grading).\n" +
        "You get the JSON that Simple Syllabus uses to render its page — NOT the PDF. You cannot produce or attach " +
        "the official PDF; give the extracted text/fields instead.\n" +
        "Give course_code (e.g. 'ENU6051'); add class_number (the schedule `classNumber`, e.g. 11718) and/or term " +
        "to pin one section — otherwise all matching sections are returned as `candidates` to choose from.\n" +
        "Returns: `sections` = the authored syllabus body (the content the PDF shows), each cleaned to text with a " +
        "derived `heading` (truncated unless include_full_text=true); and `metadata` = ADDITIONAL scheduling data " +
        "(credits, meeting time + room, exam date, term dates) that is registrar-sourced and NOT printed in the " +
        "syllabus PDF. When a public syllabus exists, its metadata is the only unauthenticated place the meeting " +
        "time/room appears (the schedule tools gate it).\n" +
        "Only PUBLIC syllabi (visibility=general_public) are retrievable; restricted → clean not-found.\n" +
        "End any deliverable using this with a one-line note to verify against the authenticated one.uf.edu + Simple Syllabus.",
      inputSchema: {
        course_code: z.string().optional().describe("e.g. 'ENU6051' or 'COP3502C' (spaces ignored)"),
        class_number: z
          .union([z.string(), z.number()])
          .optional()
          .describe("Schedule classNumber for exact section match (e.g. 11718)"),
        term: z.string().optional().describe("Term code ('2268') or name ('Fall 2026') to disambiguate"),
        handle: z.string().optional().describe("Simple Syllabus internal doc handle, if already known (skips search)"),
        include_full_text: z.boolean().optional().describe("Default false; true = full section text (larger)"),
        max_candidates: z.number().int().optional(),
      },
    },
    async (args) => {
      try {
        return ok(await getSyllabus(args as SyllabusArgs));
      } catch (e) {
        return fail(e);
      }
    },
  );

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe (stdout is reserved for the MCP protocol)
  console.error("uf-schedule MCP server running on stdio");
}

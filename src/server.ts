import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getCourse, getFilterOptions, searchCourses, type SearchArgs } from "./uf.js";

function ok(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
}
function fail(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "uf-schedule", version: "1.0.0" });

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
        "Set fetch_all=true to auto-paginate (up to max_results); otherwise one page (<=50) plus next_control_number.",
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
        "query: optional case-insensitive substring filter (useful for departments, e.g. 'engineering').",
      inputSchema: {
        kind: z.string().optional().describe("all | terms | categories | program_levels | departments"),
        query: z.string().optional().describe("Substring filter (esp. for departments)"),
      },
    },
    async (args) => {
      try {
        return ok(await getFilterOptions(args.kind ?? "all", args.query ?? ""));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_course",
    {
      title: "Look up one UF course",
      description:
        "Look up one course and all its sections by exact/prefix code in a term. " +
        "course_code is prefix-matched (e.g. 'COP3502' matches 'COP3502C'). term accepts a code or description.",
      inputSchema: {
        term: z.string().describe("Term code or description"),
        course_code: z.string().describe("Course code, prefix-matched"),
        category: z.string().optional(),
        include_description: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        return ok(
          await getCourse(args.term, args.course_code, args.category ?? "CWSP", args.include_description ?? true),
        );
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

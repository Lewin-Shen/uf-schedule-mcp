// UF Simple Syllabus retrieval (public "general_public" syllabi only).
//
// Two-hop model (there is no "syllabus for course X" endpoint):
//   1. doc-library-search?search=<code>  → items[] each with a `code` HANDLE,
//      a `title` ("SUBJ NUM[suffix] <classNumber>"), `sub_title` (course name),
//      and `term_name`.  The join key to the schedule system is the CLASS NUMBER
//      embedded in `title` (matches schedule `classNumber` exactly). The `code`
//      handle is internal to Simple Syllabus and cannot be guessed.
//   2. doc-full-page-get?code=<handle>    → doc_data.{properties, components[]}.
//
// Scope: this returns syllabus *content* for an agent to read/summarize (e.g.
// find relevant courses, write a short course description) — not a rendered
// document for display. See README.
//
// All verified live 2026-07-15 against ufl.simplesyllabus.com.

import { SS_DOC_URL, SS_HARD_PAGE_CAP, SS_PAGE_SIZE, SS_PROPERTY_MAP, SS_SEARCH_URL, SS_USER_AGENT } from "./constants.js";
import { loadFilters } from "./uf.js";

// --- HTTP -------------------------------------------------------------------
async function ssFetch(url: string): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": SS_USER_AGENT, // browser UA required — see constants
          Accept: "application/json, text/plain, */*",
          Referer: "https://ufl.simplesyllabus.com/",
        },
      });
      if (resp.status >= 500) throw new Error(`HTTP ${resp.status}`); // transient — retry
      if (resp.status === 403) {
        throw new Error(
          "Simple Syllabus returned 403 (blocked). The document may be restricted (not general_public), " +
            "or the endpoint is rejecting this request.",
        );
      }
      if (!resp.ok) throw new Error(`Simple Syllabus request failed: HTTP ${resp.status}`);
      return await resp.json();
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// --- HTML → text (zero-dependency) ------------------------------------------
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  mdash: "—", ndash: "–", hellip: "…", deg: "°",
};

export function htmlToText(html: unknown): string {
  if (!html) return "";
  let s = String(html);
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/\s*(p|div|li|tr|h[1-6]|ul|ol|table)\s*>/gi, "\n");
  s = s.replace(/<\s*li[^>]*>/gi, "• ");
  s = s.replace(/<[^>]+>/g, ""); // strip remaining tags
  s = s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isNaN(n) ? m : String.fromCodePoint(n);
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
  return s
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// --- title parsing / matching -----------------------------------------------
export interface ParsedTitle {
  code: string; // normalized, spaceless, uppercase — e.g. "COP3502C"
  classNum: string; // e.g. "11565" (matches schedule classNumber), "" if none
}

export function parseTitle(title: unknown): ParsedTitle {
  const toks = String(title ?? "").trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return { code: "", classNum: "" };
  // Real section titles are "SUBJ NUMBER[suffix] CLASSNUMBER" (>=3 tokens); the
  // trailing number is the class number only then. A 2-token "IDS 2935" is just
  // a course code, so its trailing number must NOT be read as a class number.
  const last = toks[toks.length - 1];
  const hasClass = toks.length >= 3 && /^\d+$/.test(last);
  const classNum = hasClass ? last : "";
  const codeToks = hasClass ? toks.slice(0, -1) : toks;
  return { code: codeToks.join("").toUpperCase(), classNum };
}

const normCode = (c: string) => String(c ?? "").replace(/\s+/g, "").toUpperCase();

/** Resolve a schedule term code ('2268') or description ('Fall 2026') to the
 *  human term_name Simple Syllabus uses ('Fall 2026'). Empty ⇒ any term. */
export async function resolveTermName(term?: string): Promise<string> {
  if (!term) return "";
  const t = String(term).trim();
  if (/\s/.test(t) || /[a-z]/i.test(t.replace(/^\d+$/, ""))) {
    // looks like a description already (e.g. "Fall 2026")
    if (!/^\d+$/.test(t)) return t;
  }
  try {
    const { terms } = await loadFilters();
    const hit = terms.find((x) => String(x.CODE) === t);
    if (hit) return String(hit.DESC);
  } catch {
    /* offline / filters unavailable — fall through */
  }
  return t;
}

// --- Step 1: search ---------------------------------------------------------
export interface SyllabusItem {
  handle: string; // the internal `code`
  courseCode: string; // parsed from title, e.g. "ENU6051"
  classNumber: string; // parsed from title, e.g. "11718"
  courseName: string; // sub_title
  termName: string;
  instructors: string[];
  visibility: string;
  hasUploads: boolean;
  raw: any;
}

function toItem(raw: any): SyllabusItem {
  const { code, classNum } = parseTitle(raw?.title);
  return {
    handle: raw?.code,
    courseCode: code,
    classNumber: classNum,
    courseName: raw?.sub_title ?? "",
    termName: raw?.term_name ?? "",
    instructors: (raw?.editors ?? []).map((e: any) => e?.full_name).filter(Boolean),
    visibility: raw?.visibility ?? "",
    hasUploads: !!raw?.has_published_uploads,
    raw,
  };
}

/** Search Simple Syllabus and return parsed items (paginated up to the cap). */
export async function searchSyllabi(query: string): Promise<SyllabusItem[]> {
  const items: SyllabusItem[] = [];
  for (let page = 0; page < SS_HARD_PAGE_CAP; page++) {
    const url = `${SS_SEARCH_URL}?search=${encodeURIComponent(query)}&page=${page}&page_size=${SS_PAGE_SIZE}`;
    const data = await ssFetch(url);
    const batch: any[] = data?.items ?? [];
    for (const it of batch) items.push(toItem(it));
    const total = data?.pagination?.total ?? items.length;
    if (items.length >= total || batch.length < SS_PAGE_SIZE) break;
  }
  return items;
}

// --- Step 2: fetch + extract full doc ---------------------------------------
export interface SyllabusSection {
  heading: string; // derived — components carry no title field
  type: string; // content | instructor | material
  wordCount: number;
  text: string;
}

/** Derive a section heading: first <h1-6>, else first bold, else first line. */
export function firstHeading(html: unknown, text: string): string {
  const src = String(html ?? "");
  const h = src.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (h) {
    const t = htmlToText(h[1]);
    if (t) return t.slice(0, 100);
  }
  const b = src.match(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/i);
  if (b) {
    const t = htmlToText(b[1]);
    if (t && t.length <= 80) return t;
  }
  return (text.split("\n")[0] || "").slice(0, 80);
}

export async function fetchSyllabusDoc(handle: string): Promise<{ metadata: Record<string, string>; sections: SyllabusSection[]; raw: any }> {
  const data = await ssFetch(`${SS_DOC_URL}?code=${encodeURIComponent(handle)}`);
  // doc-full-page-get wraps the doc in the same {items:[...]} envelope as search.
  const doc = data?.items?.[0]?.doc_data ?? data?.doc_data ?? data ?? {};
  const props = doc?.properties ?? {};

  const metadata: Record<string, string> = {};
  for (const [srcKey, outKey] of Object.entries(SS_PROPERTY_MAP)) {
    const v = props[srcKey];
    if (v === undefined || v === null || v === "") continue;
    // meetingTimes/description may carry HTML; clean everything to text
    metadata[outKey] = htmlToText(v);
  }

  const sections: SyllabusSection[] = (doc?.components ?? [])
    .filter((c: any) => c?.is_public !== false)
    .slice()
    .sort((a: any, b: any) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
    .map((c: any) => {
      const text = htmlToText(c?.html);
      return {
        heading: firstHeading(c?.html, text),
        type: c?.component_type ?? "content",
        wordCount: c?.word_count ?? 0,
        text,
      };
    })
    .filter((s: SyllabusSection) => s.text);

  return { metadata, sections, raw: doc };
}

// --- public tool ------------------------------------------------------------
export interface SyllabusArgs {
  course_code?: string;
  class_number?: string | number;
  term?: string;
  handle?: string;
  include_full_text?: boolean;
  max_candidates?: number;
}

const SNIPPET = 600; // per-section chars in summary mode

function packDoc(
  chosen: SyllabusItem | null,
  doc: { metadata: Record<string, string>; sections: SyllabusSection[] },
  full: boolean,
): Record<string, any> {
  let truncated = false;
  const sections = doc.sections.map((s) => {
    if (full || s.text.length <= SNIPPET) return { heading: s.heading, type: s.type, wordCount: s.wordCount, text: s.text };
    truncated = true;
    return { heading: s.heading, type: s.type, wordCount: s.wordCount, text: `${s.text.slice(0, SNIPPET).trimEnd()}…` };
  });
  const out: Record<string, any> = {
    found: true,
    course_code: chosen?.courseCode,
    class_number: chosen?.classNumber,
    term: chosen?.termName,
    instructors: chosen?.instructors,
    handle: chosen?.handle,
    source_url: chosen ? `https://ufl.simplesyllabus.com/doc/${chosen.handle}` : undefined,
    metadata: doc.metadata,
    sections,
  };
  if (truncated) {
    out.text_truncated = true;
    out.note = `Section text trimmed to ${SNIPPET} chars each — call again with include_full_text=true for the complete syllabus.`;
  }
  return out;
}

export async function getSyllabus(args: SyllabusArgs): Promise<Record<string, any>> {
  const full = args.include_full_text ?? false;

  // Direct handle path (skip search).
  if (args.handle) {
    const doc = await fetchSyllabusDoc(args.handle);
    return packDoc(null, doc, full);
  }

  if (!args.course_code) {
    throw new Error("Provide course_code (e.g. 'ENU6051') or a Simple Syllabus handle.");
  }
  const reqCode = normCode(args.course_code);
  const reqClass = args.class_number !== undefined && args.class_number !== null ? String(args.class_number).trim() : "";
  const termName = await resolveTermName(args.term);

  // Step 1 — search (space-insensitive). Fall back to a spaced code if the exact
  // code yields nothing (relevance search occasionally needs the subject split).
  let items = (await searchSyllabi(reqCode)).filter((i) => i.handle);
  let matches = items.filter((i) => i.courseCode === reqCode);
  if (!matches.length) {
    const spaced = String(args.course_code).replace(/^([A-Za-z]+)\s*([0-9].*)$/, "$1 $2");
    if (spaced !== args.course_code) {
      items = (await searchSyllabi(spaced)).filter((i) => i.handle);
      matches = items.filter((i) => i.courseCode === reqCode);
    }
  }
  if (reqClass) matches = matches.filter((i) => i.classNumber === reqClass);
  if (termName) matches = matches.filter((i) => i.termName === termName);

  if (!matches.length) {
    return {
      found: false,
      course_code: args.course_code,
      class_number: reqClass || undefined,
      term: termName || undefined,
      note:
        "No public syllabus found for that course/section/term. Simple Syllabus only exposes documents with " +
        "visibility='general_public'; restricted syllabi are login-gated and won't appear. Try without class_number/term to widen.",
    };
  }

  if (matches.length > 1) {
    const cap = Math.max(1, Math.trunc(args.max_candidates ?? 15));
    return {
      found: true,
      ambiguous: true,
      count: matches.length,
      note: "Multiple sections match. Pass class_number (and term) to select one. Candidates:",
      candidates: matches.slice(0, cap).map((i) => ({
        course_code: i.courseCode,
        class_number: i.classNumber,
        course_name: i.courseName,
        term: i.termName,
        instructors: i.instructors,
        handle: i.handle,
      })),
    };
  }

  const chosen = matches[0];
  const doc = await fetchSyllabusDoc(chosen.handle);
  return packDoc(chosen, doc, full);
}

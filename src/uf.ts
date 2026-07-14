// Core logic for the UF Schedule of Courses API — framework-agnostic so it can
// be unit-tested without the MCP SDK. See docs/API-REFERENCE.md.

import {
  CATEGORY_ALIASES,
  CRED_SRCH_ALIASES,
  DAY_LETTERS,
  FILTERS_URL,
  GENED_LETTERS,
  HARD_PAGE_CAP,
  HONORS_DEPT_CODE,
  ONLINE_ALIASES,
  PAGE_SIZE,
  PROG_LEVEL_ALIASES,
  QUEST_VALUES,
  SCHEDULE_URL,
  SECTWEB_LABELS,
  SPGM_ALIASES,
  USER_AGENT,
  WRITING_VALUES,
} from "./constants.js";

// --- types ------------------------------------------------------------------
export interface CodeDesc {
  CODE: string | number;
  DESC: string;
  SORT_TERM?: number;
}
export interface FiltersData {
  terms: CodeDesc[];
  categories: CodeDesc[];
  progLevels: CodeDesc[];
  departments: CodeDesc[];
}

export interface BuildQueryInput {
  termCode: string;
  categoryCode?: string;
  progLevelCode?: string;
  deptCode?: string;
  courseCode?: string;
  courseTitle?: string;
  instructor?: string;
  classNum?: string;
  credits?: number | null;
  credSrch?: string;
  levelMin?: string;
  levelMax?: string;
  days?: string[];
  periodBegin?: string | null;
  periodEnd?: string | null;
  online?: string[];
  genEd?: string[];
  writing?: string[];
  quest?: (string | number)[];
  ai?: boolean;
  eep?: boolean;
  auf?: boolean;
  elal?: boolean;
  honors?: boolean;
  noOpenSeats?: boolean;
  spgm?: string;
  lastControlNumber?: number;
}

// --- filter option cache (/apix/soc/filters) --------------------------------
let filtersCache: { data: FiltersData | null; ts: number } = { data: null, ts: 0 };
const FILTERS_TTL_MS = 60 * 60 * 1000;

export async function loadFilters(force = false): Promise<FiltersData> {
  const now = Date.now();
  if (!force && filtersCache.data && now - filtersCache.ts < FILTERS_TTL_MS) {
    return filtersCache.data;
  }
  const resp = await fetch(FILTERS_URL, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`filters request failed: HTTP ${resp.status}`);
  const data = (await resp.json()) as FiltersData;
  filtersCache = { data, ts: now };
  return data;
}

/** For tests: seed or clear the filters cache without a network call. */
export function _setFiltersCache(data: FiltersData | null): void {
  filtersCache = { data, ts: data ? Date.now() : 0 };
}

// --- resolvers (human input -> API code) ------------------------------------
export async function resolveTerm(term: string): Promise<string> {
  const t = String(term).trim();
  const { terms } = await loadFilters();
  for (const x of terms) if (String(x.CODE).toLowerCase() === t.toLowerCase()) return String(x.CODE);
  const norm = t.toLowerCase().replace(/\s+/g, "");
  for (const x of terms) if (String(x.DESC).toLowerCase().replace(/\s+/g, "") === norm) return String(x.CODE);
  const sample = terms.slice(0, 6).map((x) => `${x.DESC} (${x.CODE})`).join(", ");
  throw new Error(
    `Unknown term "${term}". Use a code or description like: ${sample} ... (call get_filter_options for the full list).`,
  );
}

export function resolveCategory(category?: string): string {
  if (!category) return "CWSP";
  const key = String(category).trim().toLowerCase();
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  const up = String(category).trim().toUpperCase();
  if (up === "CWSP" || up === "UFOL" || up === "IA") return up;
  throw new Error(
    `Unknown category "${category}". Options: CWSP (Campus/Web/Special Program), UFOL (UF Online), IA (Innovation Academy).`,
  );
}

export function resolveProgLevel(progLevel?: string): string {
  if (!progLevel) return "";
  const key = String(progLevel).trim().toLowerCase();
  if (PROG_LEVEL_ALIASES[key]) return PROG_LEVEL_ALIASES[key];
  const up = String(progLevel).trim().toUpperCase();
  if (Object.values(PROG_LEVEL_ALIASES).includes(up)) return up;
  throw new Error(
    `Unknown program level "${progLevel}". Options: Undergraduate, Graduate, Law, Medical School, Pharmacy, Physician Assistant, Professional, Veterinary Medicine.`,
  );
}

export async function resolveDept(dept?: string): Promise<string> {
  if (!dept) return "";
  const d = String(dept).trim();
  const { departments } = await loadFilters();
  for (const x of departments) if (String(x.CODE) === d) return String(x.CODE);
  const q = d.toLowerCase();
  for (const x of departments) if (String(x.DESC).toLowerCase() === q) return String(x.CODE);
  const matches = departments.filter((x) => String(x.DESC).toLowerCase().includes(q));
  if (matches.length === 1) return String(matches[0].CODE);
  if (matches.length > 1) {
    const listed = matches.slice(0, 12).map((x) => `${x.DESC} (${x.CODE})`).join("; ");
    throw new Error(
      `Department "${dept}" is ambiguous (${matches.length} matches): ${listed}${matches.length > 12 ? " ..." : ""} - pass a more specific name or the 8-digit code.`,
    );
  }
  throw new Error(
    `No department matches "${dept}". Call get_filter_options(kind="departments", query=...) to search the list.`,
  );
}

export function resolveCredSrch(op: string): string {
  const key = String(op).trim().toLowerCase();
  if (CRED_SRCH_ALIASES[key]) return CRED_SRCH_ALIASES[key];
  throw new Error(`Unknown credit operator "${op}". Use "equal" (EQ), "at most" (LE), or "at least" (GE).`);
}

// --- period slider mapping --------------------------------------------------
export function periodToPosition(value: string): number {
  const s = String(value).trim().toUpperCase();
  if (s.startsWith("E")) {
    const n = parseInt(s.slice(1), 10);
    if (![1, 2, 3].includes(n)) throw new Error(`Evening period must be E1, E2 or E3 (got "${value}").`);
    return 11 + n; // E1->12, E2->13, E3->14
  }
  const n = parseInt(s, 10);
  if (!(n >= 1 && n <= 11)) throw new Error(`Period must be 1-11 or E1-E3 (got "${value}").`);
  return n;
}

function periodParam(position: number, isBegin: boolean): string | null {
  if (isBegin && position <= 1) return null; // open-ended lower bound
  if (!isBegin && position >= 14) return null; // open-ended upper bound
  return position < 10 ? `0${position}` : String(position);
}

function asList<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// --- query builder (pure) ---------------------------------------------------
export function buildQuery(input: BuildQueryInput): Record<string, string> {
  const {
    termCode,
    categoryCode = "CWSP",
    progLevelCode = "",
    courseCode = "",
    courseTitle = "",
    instructor = "",
    classNum = "",
    credits = null,
    credSrch = "",
    levelMin = "",
    levelMax = "",
    days,
    periodBegin,
    periodEnd,
    online,
    genEd,
    writing,
    quest,
    ai = false,
    eep = false,
    auf = false,
    elal = false,
    noOpenSeats = false,
    spgm = "",
    lastControlNumber = 0,
  } = input;

  let deptCode = input.deptCode ?? "";
  let honors = input.honors ?? false;

  const params: Record<string, string> = {
    category: categoryCode,
    term: termCode,
    "last-control-number": String(Math.trunc(lastControlNumber)),
  };

  if (progLevelCode) params["prog-level"] = progLevelCode;

  // Honors-Program dept => hons flag, dept cleared (mirrors UF's UI)
  if (deptCode === HONORS_DEPT_CODE) {
    honors = true;
    deptCode = "";
  }
  if (deptCode) params["dept"] = deptCode;

  if (courseCode) params["course-code"] = String(courseCode).replace(/\s+/g, ""); // strip all ws
  if (courseTitle) params["course-title"] = String(courseTitle).trim();
  if (instructor) params["instructor"] = String(instructor).trim();
  if (classNum) params["class-num"] = String(classNum).trim();

  if (credits !== null && credits !== undefined && String(credits) !== "") {
    params["credits"] = String(credits);
  }
  if (credSrch) params["cred-srch"] = credSrch;
  if (levelMin) params["level-min"] = String(levelMin);
  if (levelMax) params["level-max"] = String(levelMax);

  for (const letter of asList(days)) {
    const key = DAY_LETTERS[String(letter).trim().toUpperCase()];
    if (!key) throw new Error(`Invalid day "${letter}"; use M T W R F S.`);
    params[key] = "true";
  }

  if (periodBegin !== undefined && periodBegin !== null && String(periodBegin) !== "") {
    const val = periodParam(periodToPosition(periodBegin), true);
    if (val !== null) params["period-b"] = val;
  }
  if (periodEnd !== undefined && periodEnd !== null && String(periodEnd) !== "") {
    const val = periodParam(periodToPosition(periodEnd), false);
    if (val !== null) params["period-e"] = val;
  }

  for (const o of asList(online)) {
    const key = ONLINE_ALIASES[String(o).trim().toLowerCase()];
    if (!key) throw new Error(`Invalid online type "${o}"; use online / primarily_online / hybrid / classroom (or a/p/h/c).`);
    params[key] = "true";
  }

  for (const g of asList(genEd)) {
    const letter = String(g).trim().toUpperCase();
    if (!GENED_LETTERS.has(letter)) throw new Error(`Invalid gen-ed "${g}"; use one of B C D H M N P S.`);
    params[`ge-${letter.toLowerCase()}`] = "true";
  }

  const wr = asList(writing);
  for (const w of wr) {
    const wv = String(w).trim();
    if (!WRITING_VALUES.has(wv)) throw new Error(`Invalid writing value "${w}"; use 2000/4000/6000.`);
    params[`wr-${wv}`] = "true";
  }
  if (wr.length) params["writing"] = "true";

  const qs = asList(quest);
  for (const q of qs) {
    const qv = String(q).trim();
    if (!QUEST_VALUES.has(qv)) throw new Error(`Invalid Quest value "${q}"; use 1/2/3/4.`);
    params[`qst-${qv}`] = "true";
  }
  if (qs.length) params["quest"] = "true";

  if (ai) params["ai"] = "true";
  if (eep) params["eep"] = "true";
  if (auf) params["auf"] = "true";
  if (elal) params["elal"] = "true";
  if (honors) params["hons"] = "true";
  if (noOpenSeats) params["no-open-seats"] = "true";
  if (spgm) params["spgm"] = spgm;

  return params;
}

export function queryToUrl(params: Record<string, string>): string {
  const u = new URL(SCHEDULE_URL);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

// --- response simplification ------------------------------------------------
function formatMeetTimes(meetTimes: any[]): any[] {
  const out: any[] = [];
  for (const m of meetTimes ?? []) {
    let days = m.meetDays ?? m.meetDay ?? m.days;
    if (Array.isArray(days)) days = days.join("");
    const entry: Record<string, any> = {
      days: days || "",
      begin: m.meetTimeBegin ?? m.beginTime ?? "",
      end: m.meetTimeEnd ?? m.endTime ?? "",
      periodBegin: m.meetPeriodBegin ?? "",
      periodEnd: m.meetPeriodEnd ?? "",
      building: m.meetBuilding ?? m.meetBldgCode ?? "",
      room: m.meetRoom ?? "",
    };
    for (const k of Object.keys(entry)) if (entry[k] === "") delete entry[k];
    out.push(entry);
  }
  return out;
}

function simplifySection(s: any): Record<string, any> {
  const credits =
    s.credits === "VAR"
      ? { variable: true, min: s.credits_min, max: s.credits_max }
      : s.credits;
  const sectWeb = s.sectWeb ?? "";
  const out: Record<string, any> = {
    classNumber: s.classNumber,
    section: s.number,
    credits,
    instructors: (s.instructors ?? []).map((i: any) => i?.name).filter(Boolean),
    meetTimes: formatMeetTimes(s.meetTimes ?? []),
    delivery: SECTWEB_LABELS[sectWeb] ?? sectWeb,
    deliveryCode: sectWeb,
    openSeats: s.openSeats,
    department: s.deptName,
    gradBasis: s.gradBasis,
    acadCareer: s.acadCareer,
    genEd: s.genEd ?? [],
    quest: s.quest ?? [],
    grWriting: s.grWriting,
    note: s.note ?? "",
    dropAddDeadline: s.dropaddDeadline,
  };
  const wl = s.waitList ?? {};
  if (wl && Object.keys(wl).length) {
    out.waitList = { eligible: wl.isEligible, cap: wl.cap, total: wl.total };
  }
  if (s.isAICourse) out.aiCourse = true;
  if (s.isElal) out.experientialLearning = s.elalAttr || true;
  if (s.courseFee) out.courseFee = s.courseFee;
  // drop empty-ish keys for compactness
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (v === null || v === undefined || v === "" ||
        (Array.isArray(v) && v.length === 0) ||
        (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)) {
      delete out[k];
    }
  }
  return out;
}

function simplifyCourse(c: any, includeDescription: boolean): Record<string, any> {
  const out: Record<string, any> = {
    code: c.code,
    name: c.name,
    courseId: c.courseId,
    sections: (c.sections ?? []).map(simplifySection),
  };
  if (c.prerequisites) out.prerequisites = c.prerequisites;
  if (includeDescription && c.description) out.description = c.description;
  return out;
}

// --- fetch one page ---------------------------------------------------------
async function fetchPage(params: Record<string, string>): Promise<any> {
  const url = queryToUrl(params);
  const resp = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`schedule request failed: HTTP ${resp.status}`);
  const data = await resp.json();
  if (Array.isArray(data)) {
    return data[0] ?? { COURSES: [], TOTALROWS: 0, RETRIEVEDROWS: 0, LASTCONTROLNUMBER: 0 };
  }
  return data;
}

// --- tool implementations ---------------------------------------------------
export interface SearchArgs {
  term: string;
  category?: string;
  program_level?: string;
  department?: string;
  course_code?: string;
  course_title?: string;
  instructor?: string;
  class_number?: string;
  credits?: number | null;
  credits_operator?: string;
  level_min?: string;
  level_max?: string;
  days?: string[];
  period_begin?: string;
  period_end?: string;
  online_types?: string[];
  gen_ed?: string[];
  writing?: string[];
  quest?: (string | number)[];
  ai_course?: boolean;
  eep_eligible?: boolean;
  affordable_uf?: boolean;
  experiential_learning?: boolean;
  honors?: boolean;
  no_open_seats?: boolean;
  special_program?: string;
  max_results?: number;
  fetch_all?: boolean;
  last_control_number?: number;
  include_description?: boolean;
}

export async function searchCourses(args: SearchArgs): Promise<Record<string, any>> {
  const termCode = await resolveTerm(args.term);
  const categoryCode = resolveCategory(args.category);
  const progLevelCode = resolveProgLevel(args.program_level);
  const deptCode = await resolveDept(args.department);
  const credSrch =
    args.credits !== null && args.credits !== undefined
      ? resolveCredSrch(args.credits_operator ?? "at least")
      : "";
  const spgm = SPGM_ALIASES[String(args.special_program ?? "all").trim().toLowerCase()];
  if (spgm === undefined) {
    throw new Error(`Invalid special_program "${args.special_program}"; use all/special/general.`);
  }

  const base: Omit<BuildQueryInput, "lastControlNumber"> = {
    termCode,
    categoryCode,
    progLevelCode,
    deptCode,
    courseCode: args.course_code ?? "",
    courseTitle: args.course_title ?? "",
    instructor: args.instructor ?? "",
    classNum: args.class_number ?? "",
    credits: args.credits ?? null,
    credSrch,
    levelMin: args.level_min ?? "",
    levelMax: args.level_max ?? "",
    days: args.days,
    periodBegin: args.period_begin || null,
    periodEnd: args.period_end || null,
    online: args.online_types,
    genEd: args.gen_ed,
    writing: args.writing,
    quest: args.quest,
    ai: args.ai_course ?? false,
    eep: args.eep_eligible ?? false,
    auf: args.affordable_uf ?? false,
    elal: args.experiential_learning ?? false,
    honors: args.honors ?? false,
    noOpenSeats: args.no_open_seats ?? false,
    spgm,
  };

  const maxResults = Math.max(1, Math.trunc(args.max_results ?? 100));
  const includeDescription = args.include_description ?? false;
  const fetchAll = args.fetch_all ?? false;

  const courses: any[] = [];
  let lcn = Math.trunc(args.last_control_number ?? 0);
  let total = 0;
  let pages = 0;
  let nextLcn: number | null = null;
  let lastParams: Record<string, string> = {};

  while (true) {
    lastParams = buildQuery({ ...base, lastControlNumber: lcn });
    const page = await fetchPage(lastParams);
    total = page.TOTALROWS ?? 0;
    const batch: any[] = page.COURSES ?? [];
    for (const c of batch) courses.push(simplifyCourse(c, includeDescription));
    lcn = page.LASTCONTROLNUMBER ?? 0;
    pages += 1;

    if (courses.length >= maxResults) {
      courses.length = maxResults;
      if (courses.length < total) nextLcn = lcn;
      break;
    }
    if (!fetchAll) {
      if (courses.length < total) nextLcn = lcn;
      break;
    }
    if (batch.length < PAGE_SIZE || courses.length >= total || pages >= HARD_PAGE_CAP) break;
  }

  const result: Record<string, any> = {
    query: { term: termCode, category: categoryCode, url: queryToUrl(lastParams) },
    total_matching: total,
    returned: courses.length,
    courses,
  };
  if (nextLcn !== null) {
    result.next_control_number = nextLcn;
    result.note = `More results available - call again with last_control_number=${nextLcn} (or set fetch_all=true).`;
  }
  return result;
}

const FILTER_KEY_MAP: Record<string, [keyof FiltersData, string]> = {
  terms: ["terms", "terms"],
  categories: ["categories", "categories"],
  program_levels: ["progLevels", "program_levels"],
  departments: ["departments", "departments"],
};

export async function getFilterOptions(kind = "all", query = ""): Promise<Record<string, any>> {
  const data = await loadFilters();
  const q = query.toLowerCase();
  const rows = (srcKey: keyof FiltersData) =>
    (data[srcKey] as CodeDesc[])
      .filter((it) =>
        !q ||
        String(it.DESC).toLowerCase().includes(q) ||
        String(it.CODE).toLowerCase().includes(q),
      )
      .map((it) => ({ code: String(it.CODE), name: String(it.DESC) }));

  if (kind === "all") {
    const out: Record<string, any> = {};
    for (const [src, outKey] of Object.values(FILTER_KEY_MAP)) out[outKey] = rows(src);
    return out;
  }
  const entry = FILTER_KEY_MAP[kind];
  if (!entry) {
    throw new Error(`Invalid kind "${kind}". Use all/terms/categories/program_levels/departments.`);
  }
  return { [entry[1]]: rows(entry[0]) };
}

export async function getCourse(
  term: string,
  courseCode: string,
  category = "CWSP",
  includeDescription = true,
): Promise<Record<string, any>> {
  const res = await searchCourses({
    term,
    category,
    course_code: courseCode,
    include_description: includeDescription,
    max_results: 25,
    fetch_all: true,
  });
  const courses: any[] = res.courses ?? [];
  if (!courses.length) {
    return { found: false, term: res.query.term, course_code: courseCode };
  }
  const wanted = courseCode.trim().toUpperCase();
  const exact = courses.filter((c) => String(c.code ?? "").toUpperCase() === wanted);
  const course = exact.length ? exact[0] : courses[0];
  return {
    found: true,
    term: res.query.term,
    course,
    other_matches: courses.filter((c) => c !== course).map((c) => c.code),
  };
}

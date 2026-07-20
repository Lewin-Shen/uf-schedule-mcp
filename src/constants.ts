// Endpoints & tuning ---------------------------------------------------------
export const BASE = "https://one.uf.edu/apix/soc";
export const SCHEDULE_URL = `${BASE}/schedule`;
export const FILTERS_URL = `${BASE}/filters`;
export const PAGE_SIZE = 50; // server returns up to ~50 courses per page
export const HARD_PAGE_CAP = 40; // safety cap on auto-pagination
export const USER_AGENT =
  "uf-schedule-mcp/1.0 (+https://one.uf.edu/soc/ public search wrapper)";

// Simple Syllabus (UF) — public syllabus retrieval ---------------------------
// The Simple Syllabus edge (Cloudflare) 403s non-browser User-Agents, so these
// requests send a browser UA — matching what the public SPA sends. (Verified:
// custom UA → 403, browser UA → 200.)
export const SS_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
export const SS_BASE = "https://ufl.simplesyllabus.com/api2";
export const SS_SEARCH_URL = `${SS_BASE}/doc-library-search`;
export const SS_DOC_URL = `${SS_BASE}/doc-full-page-get`;
export const SS_PAGE_SIZE = 50; // doc-library-search page size
export const SS_HARD_PAGE_CAP = 6;

/**
 * Simple Syllabus `doc_data.properties` keys are opaque (`ca_*`), observed not
 * documented — mapped defensively (missing keys are skipped). Values are flat
 * strings (some contain HTML, e.g. meetingTimes uses <br/>).
 */
export const SS_PROPERTY_MAP: Record<string, string> = {
  full_name: "fullName",
  course_number: "courseNumber",
  ca_2: "description",
  ca_10: "termDates",
  ca_11: "examDate",
  ca_16: "credits",
  ca_21: "meetingTimes", // location + periods — the schedule API gates these!
};

// Selecting this department is rewritten by UF to hons=true with dept cleared.
export const HONORS_DEPT_CODE = "02030000";

// Enumerations (see docs/API-REFERENCE.md) -----------------------------------
export const CATEGORY_ALIASES: Record<string, string> = {
  cwsp: "CWSP",
  campus: "CWSP",
  web: "CWSP",
  "campus/web/special program": "CWSP",
  ufol: "UFOL",
  "uf online": "UFOL",
  "online program": "UFOL",
  ia: "IA",
  "innovation academy": "IA",
};

export const PROG_LEVEL_ALIASES: Record<string, string> = {
  ugrd: "UGRD",
  undergraduate: "UGRD",
  ug: "UGRD",
  grad: "GRAD",
  graduate: "GRAD",
  law: "LAW",
  med: "MED",
  medical: "MED",
  "medical school": "MED",
  phm: "PHM",
  pharmacy: "PHM",
  pa: "PA",
  "physician assistant": "PA",
  prof: "PROF",
  professional: "PROF",
  vem: "VEM",
  veterinary: "VEM",
  "veterinary medicine": "VEM",
};

export const CRED_SRCH_ALIASES: Record<string, string> = {
  eq: "EQ",
  equal: "EQ",
  "equal to": "EQ",
  "=": "EQ",
  "==": "EQ",
  le: "LE",
  "at most": "LE",
  "no more than": "LE",
  "<=": "LE",
  max: "LE",
  ge: "GE",
  "at least": "GE",
  ">=": "GE",
  min: "GE",
};

// online delivery type -> query param
export const ONLINE_ALIASES: Record<string, string> = {
  a: "online-a",
  online: "online-a",
  online100: "online-a",
  "online (100%)": "online-a",
  "100": "online-a",
  "fully online": "online-a",
  p: "online-p",
  "primarily online": "online-p",
  online80: "online-p",
  "online (80-99%)": "online-p",
  "80-99": "online-p",
  h: "online-h",
  hybrid: "online-h",
  c: "online-c",
  classroom: "online-c",
  "primarily classroom": "online-c",
  traditional: "online-c",
  "primarily classroom/traditional": "online-c",
};

export const DAY_LETTERS: Record<string, string> = {
  M: "day-m",
  T: "day-t",
  W: "day-w",
  R: "day-r",
  F: "day-f",
  S: "day-s",
};

export const GENED_LETTERS = new Set(["B", "C", "D", "H", "M", "N", "P", "S"]);
export const WRITING_VALUES = new Set(["2000", "4000", "6000"]);
export const QUEST_VALUES = new Set(["1", "2", "3", "4"]);

export const SPGM_ALIASES: Record<string, string> = {
  all: "",
  "": "",
  "all sections": "",
  special: "special",
  "special program": "special",
  "special program sections only": "special",
  general: "general",
  "general sections only": "general",
};

// response section delivery code -> human label
export const SECTWEB_LABELS: Record<string, string> = {
  AD: "Online (100%)",
  PD: "Online (80-99%)",
  HB: "Hybrid",
  P: "Primarily Classroom",
  PC: "Primarily Classroom",
};

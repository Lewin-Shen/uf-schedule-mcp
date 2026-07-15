// Live smoke test against the real UF API — known-answer assertions.
// Run:  npm run build && npm run smoke      (network required; hits term 2268)
//
// Unit tests (npm test) cover pure logic offline. This covers the surfaces that
// only a live call can prove: filters that were never field-tested, and the
// special-topics / pagination behaviour.
import { getCourse, getFilterOptions, searchCourses } from "../dist/uf.js";

let pass = 0;
let fail = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
    pass++;
  } catch (e) {
    console.log(`FAIL  ${name}\n      ${e.message}`);
    fail++;
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const codes = (r) => (r.courses ?? []).map((c) => c.code);

// --- core resolution + search ------------------------------------------------
await check("term/dept/level name resolution → 12 grad ENU courses", async () => {
  const r = await searchCourses({
    term: "Fall 2026",
    department: "Nuclear and Radiological Engineering",
    program_level: "Graduate",
    fetch_all: true,
  });
  assert(r.query.term === "2268", `term resolved to ${r.query.term}`);
  assert(r.total_matching === 12, `expected 12 rows, got ${r.total_matching}`);
  assert(codes(r).includes("ENU5005"), "ENU5005 missing");
});

await check("course_code prefix match: COP3502 → COP3502C", async () => {
  const r = await searchCourses({ term: "2268", course_code: "COP3502" });
  assert(codes(r).includes("COP3502C"), `got ${codes(r)}`);
});

await check("instructor filter: Shea → EEE5544", async () => {
  const r = await searchCourses({ term: "2268", instructor: "Shea", fetch_all: true });
  assert(codes(r).includes("EEE5544"), `EEE5544 not in ${codes(r).slice(0, 8)}`);
});

// --- P2 special topics -------------------------------------------------------
await check("get_course returns ALL EEL5934 topics (not just the first)", async () => {
  const r = await getCourse("2268", "EEL5934");
  assert(r.found, "not found");
  assert(r.count >= 5, `expected ~6 topics, got ${r.count}`);
  const named = r.courses.filter((c) => /:/.test(c.name ?? ""));
  assert(named.length === r.count, "some topics have no distinguishing name");
  assert(new Set(r.courses.map((c) => c.courseId)).size === 1, "expected one shared courseId");
});

await check("name_contains finds a special-topics suffix course_title misses", async () => {
  const r = await searchCourses({
    term: "2268",
    department: "Electrical and Computer Engineering",
    name_contains: "GPU",
    fetch_all: true,
  });
  assert(r.returned >= 1, "name_contains found nothing for 'GPU'");
  assert(r.courses.every((c) => /gpu/i.test(c.name)), "a non-matching course slipped through");
});

// --- P3 compact --------------------------------------------------------------
await check("compact trims sections; compact:false restores detail", async () => {
  const c = await searchCourses({ term: "2268", course_code: "COP3502", compact: true });
  const f = await searchCourses({ term: "2268", course_code: "COP3502", compact: false });
  const cs = c.courses[0].sections[0];
  const fs = f.courses[0].sections[0];
  assert(cs.waitList === undefined, "compact leaked waitList");
  assert(fs.waitList !== undefined, "compact:false missing waitList");
  assert(JSON.stringify(f).length > JSON.stringify(c).length, "compact was not smaller");
});

// --- P1 meet -----------------------------------------------------------------
await check('meet is present as "TBA" (UF gates times behind login)', async () => {
  const r = await searchCourses({ term: "2268", course_code: "EEE5544", compact: true });
  const s = r.courses[0].sections[0];
  assert(s.meet !== undefined, "meet field missing entirely");
  assert(s.meet === "TBA" || Array.isArray(s.meet), `unexpected meet: ${JSON.stringify(s.meet)}`);
});

// --- P4 dedupe ---------------------------------------------------------------
await check("fetch_all yields no duplicate courseId+name pairs", async () => {
  const r = await searchCourses({
    term: "2268",
    program_level: "Graduate",
    ai_course: true,
    fetch_all: true,
    max_results: 500,
  });
  const keys = r.courses.map((c) => `${c.courseId}|${c.name}`);
  assert(new Set(keys).size === keys.length, "duplicate course entries present");
  assert(r.returned > 0, "ai_course=true returned nothing");
});

// --- previously untested filter surfaces -------------------------------------
await check("days + period filters return a sane shape", async () => {
  const r = await searchCourses({
    term: "2268",
    department: "Mathematics",
    days: ["M", "W", "F"],
    period_begin: "3",
    period_end: "8",
  });
  assert(Array.isArray(r.courses), "no courses array");
  assert(/day-m=true/.test(r.query.url) && /period-b=03/.test(r.query.url), `params wrong: ${r.query.url}`);
});

await check("credits + operator filter is applied upstream", async () => {
  const r = await searchCourses({ term: "2268", department: "English", credits: 2, credits_operator: "equal" });
  assert(/credits=2/.test(r.query.url) && /cred-srch=EQ/.test(r.query.url), `params wrong: ${r.query.url}`);
});

await check("category=UFOL works", async () => {
  const r = await searchCourses({ term: "2268", category: "UFOL", program_level: "Undergraduate" });
  assert(r.query.category === "UFOL", "category not UFOL");
  assert(r.total_matching > 0, "UF Online returned nothing");
});

await check("gen_ed + writing + quest params serialize", async () => {
  const r = await searchCourses({ term: "2268", gen_ed: ["H"], writing: ["2000"], quest: ["1"] });
  const u = r.query.url;
  assert(/ge-h=true/.test(u) && /wr-2000=true/.test(u) && /writing=true/.test(u), `params wrong: ${u}`);
  assert(/qst-1=true/.test(u) && /quest=true/.test(u), `quest auto-flag missing: ${u}`);
});

// --- filters -----------------------------------------------------------------
await check("get_filter_options(departments, 'nuclear') → 19080000", async () => {
  const r = await getFilterOptions("departments", "nuclear");
  assert(r.departments.some((d) => d.code === "19080000"), "nuclear dept code missing");
});

await check("get_filter_options(terms, limit=5) returns 5 newest terms", async () => {
  const r = await getFilterOptions("terms", "", 5);
  assert(r.terms.length === 5, `got ${r.terms.length}`);
  assert(r.terms[0].code === "2268", `newest term is ${r.terms[0].code}`);
});

console.log(`\n${pass}/${pass + fail} smoke checks passed`);
process.exit(fail ? 1 : 0);

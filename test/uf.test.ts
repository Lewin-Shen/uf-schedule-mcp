import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildQuery,
  dedupeCourses,
  formatMeet,
  periodToPosition,
  resolveCategory,
  resolveCredSrch,
  resolveDept,
  resolveProgLevel,
  resolveTerm,
  _setFiltersCache,
} from "../src/uf.js";
import { htmlToText, parseTitle } from "../src/syllabus.js";

// Seed the /filters cache so resolvers work with no network.
_setFiltersCache({
  terms: [
    { CODE: "2268", DESC: "Fall 2026", SORT_TERM: 2268 },
    { CODE: "2261", DESC: "Spring 2026", SORT_TERM: 2261 },
    { CODE: "22656W1", DESC: "Summer A 2026", SORT_TERM: 2265 },
  ],
  categories: [
    { CODE: "CWSP", DESC: "Campus / Web / Special Program" },
    { CODE: "UFOL", DESC: "UF Online Program" },
  ],
  progLevels: [
    { CODE: "UGRD", DESC: "Undergraduate" },
    { CODE: "GRAD", DESC: "Graduate" },
  ],
  departments: [
    { CODE: "16320000", DESC: "Mathematics" },
    { CODE: "19140000", DESC: "Computer & Information Science & Engineering" },
    { CODE: "19080000", DESC: "Nuclear and Radiological Engineering" },
    { CODE: "02030000", DESC: "Honors Program" },
  ],
});

test("minimal query", () => {
  assert.deepEqual(buildQuery({ termCode: "2268" }), {
    category: "CWSP",
    term: "2268",
    "last-control-number": "0",
  });
});

test("honors dept translation clears dept, sets hons", () => {
  const q = buildQuery({ termCode: "2268", deptCode: "02030000" });
  assert.equal(q["hons"], "true");
  assert.equal(q["dept"], undefined);
});

test("course-code whitespace stripped", () => {
  assert.equal(buildQuery({ termCode: "2268", courseCode: "COP 35 02" })["course-code"], "COP3502");
});

test("days serialize as =true", () => {
  const q = buildQuery({ termCode: "2268", days: ["M", "w", "R"] });
  assert.equal(q["day-m"], "true");
  assert.equal(q["day-w"], "true");
  assert.equal(q["day-r"], "true");
  assert.equal(q["day-t"], undefined);
});

test("gen-ed and writing auto-flag", () => {
  const q = buildQuery({ termCode: "2268", genEd: ["B", "m"], writing: ["2000"] });
  assert.equal(q["ge-b"], "true");
  assert.equal(q["ge-m"], "true");
  assert.equal(q["wr-2000"], "true");
  assert.equal(q["writing"], "true");
});

test("quest auto-flag with qst-4", () => {
  const q = buildQuery({ termCode: "2268", quest: [1, 4] });
  assert.equal(q["qst-1"], "true");
  assert.equal(q["qst-4"], "true");
  assert.equal(q["quest"], "true");
});

test("online aliases map to online-*", () => {
  const q = buildQuery({ termCode: "2268", online: ["online", "hybrid"] });
  assert.equal(q["online-a"], "true");
  assert.equal(q["online-h"], "true");
});

test("period sentinels and padding", () => {
  const q = buildQuery({ termCode: "2268", periodBegin: "1", periodEnd: "E3" });
  assert.equal(q["period-b"], undefined);
  assert.equal(q["period-e"], undefined);
  const q2 = buildQuery({ termCode: "2268", periodBegin: "3", periodEnd: "E2" });
  assert.equal(q2["period-b"], "03");
  assert.equal(q2["period-e"], "13");
  assert.equal(buildQuery({ termCode: "2268", periodBegin: "E1" })["period-b"], "12");
});

test("credits, levels, and boolean flags", () => {
  const q = buildQuery({
    termCode: "2268", credits: 3, credSrch: "GE", levelMin: "2000", levelMax: "4999",
    ai: true, eep: true, auf: true, elal: true, noOpenSeats: true, spgm: "special",
  });
  assert.equal(q["credits"], "3");
  assert.equal(q["cred-srch"], "GE");
  assert.equal(q["level-min"], "2000");
  assert.equal(q["level-max"], "4999");
  assert.equal(q["ai"], "true");
  assert.equal(q["eep"], "true");
  assert.equal(q["auf"], "true");
  assert.equal(q["elal"], "true");
  assert.equal(q["no-open-seats"], "true");
  assert.equal(q["spgm"], "special");
});

test("flags absent when unset", () => {
  const q = buildQuery({ termCode: "2268" });
  for (const k of ["ai", "eep", "auf", "elal", "no-open-seats", "hons", "spgm", "writing", "quest"]) {
    assert.equal(q[k], undefined);
  }
});

test("invalid day throws", () => {
  assert.throws(() => buildQuery({ termCode: "2268", days: ["X"] }), /Invalid day/);
});

test("periodToPosition mapping", () => {
  assert.equal(periodToPosition("5"), 5);
  assert.equal(periodToPosition("E1"), 12);
  assert.equal(periodToPosition("E3"), 14);
  assert.throws(() => periodToPosition("12"), /Period must be/);
});

test("resolveTerm accepts code and description", async () => {
  assert.equal(await resolveTerm("2268"), "2268");
  assert.equal(await resolveTerm("Fall 2026"), "2268");
  assert.equal(await resolveTerm("fall2026"), "2268");
});

test("resolveTerm rejects unknown", async () => {
  await assert.rejects(() => resolveTerm("Fall 3000"), /Unknown term/);
});

test("resolveCategory / progLevel", () => {
  assert.equal(resolveCategory(undefined), "CWSP");
  assert.equal(resolveCategory("UF Online"), "UFOL");
  assert.equal(resolveCategory("ia"), "IA");
  assert.equal(resolveProgLevel("Undergraduate"), "UGRD");
  assert.equal(resolveProgLevel("grad"), "GRAD");
  assert.equal(resolveProgLevel(""), "");
});

test("resolveDept exact, substring, ambiguous", async () => {
  assert.equal(await resolveDept("16320000"), "16320000");
  assert.equal(await resolveDept("Mathematics"), "16320000");
  assert.equal(await resolveDept("nuclear"), "19080000");
  await assert.rejects(() => resolveDept("engineering"), /ambiguous/i);
});

test("resolveCredSrch aliases", () => {
  assert.equal(resolveCredSrch("at least"), "GE");
  assert.equal(resolveCredSrch("at most"), "LE");
  assert.equal(resolveCredSrch("equal"), "EQ");
});

// --- Simple Syllabus: title parsing + HTML→text -----------------------------

test("parseTitle splits course code from class number", () => {
  assert.deepEqual(parseTitle("ENU 6051 11718"), { code: "ENU6051", classNum: "11718" });
  assert.deepEqual(parseTitle("COP 3502C 11565"), { code: "COP3502C", classNum: "11565" });
});

test("parseTitle handles a missing/invalid class number", () => {
  assert.deepEqual(parseTitle("IDS 2935"), { code: "IDS2935", classNum: "" });
  assert.deepEqual(parseTitle(""), { code: "", classNum: "" });
});

test("htmlToText strips tags, converts <br>, decodes entities", () => {
  assert.equal(
    htmlToText("TH | Period 9<br />T | Period 8-9 &amp; lab"),
    "TH | Period 9\nT | Period 8-9 & lab",
  );
  assert.equal(htmlToText("<p>Hello <b>world</b></p>"), "Hello world");
  assert.equal(htmlToText("caf&#233; &#x2014; test"), "café — test");
  assert.equal(htmlToText(""), "");
  assert.equal(htmlToText(null), "");
});

test("htmlToText turns list items into bullets", () => {
  const out = htmlToText("<ul><li>alpha</li><li>beta</li></ul>");
  assert.ok(out.includes("• alpha"), out);
  assert.ok(out.includes("• beta"), out);
});

// --- P4 dedupe --------------------------------------------------------------

test("dedupe merges page-boundary duplicates (same courseId AND name)", () => {
  const out = dedupeCourses([
    { code: "ISM6413", courseId: "111", name: "Systems Analysis", sections: [{ classNumber: 1 }] },
    { code: "ISM6413", courseId: "111", name: "Systems Analysis", sections: [{ classNumber: 2 }] },
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].sections.map((s: any) => s.classNumber), [1, 2]);
});

test("dedupe PRESERVES special topics that share a courseId but differ by name", () => {
  // All 6 real EEL5934 topics share courseId 011774 — merging on courseId alone
  // (as a naive fix would) collapses them into one and destroys topic search.
  const topics = ["GPU Computing", "Applied Machine Learning", "Formal Methods Robotics & AI"];
  const out = dedupeCourses(
    topics.map((t, i) => ({
      code: "EEL5934",
      courseId: "011774",
      name: `Special Topics in Electrical Engineering: ${t}`,
      sections: [{ classNumber: 900 + i }],
    })),
  );
  assert.equal(out.length, 3);
  assert.equal(new Set(out.map((c: any) => c.courseId)).size, 1);
});

test("dedupe does not duplicate an identical section seen twice", () => {
  const out = dedupeCourses([
    { code: "X", courseId: "1", name: "N", sections: [{ classNumber: 5 }] },
    { code: "X", courseId: "1", name: "N", sections: [{ classNumber: 5 }] },
  ]);
  assert.equal(out[0].sections.length, 1);
});

// --- P1 meet mapping --------------------------------------------------------

test("formatMeet returns TBA when upstream gives none (login-gated)", () => {
  assert.equal(formatMeet([]), "TBA");
  assert.equal(formatMeet(undefined as any), "TBA");
});

test("formatMeet maps days/periods/bldg/room compactly", () => {
  const out = formatMeet([
    { meetDays: ["M", "W", "F"], meetPeriodBegin: "3", meetPeriodEnd: "3", meetBldgCode: "NEB", meetRoom: "201" },
  ]) as any[];
  assert.deepEqual(out, [{ days: "MWF", periods: "3", bldg: "NEB", room: "201" }]);
});

test("formatMeet renders a period range and clock time", () => {
  const out = formatMeet([
    { meetDays: ["R"], meetPeriodBegin: "7", meetPeriodEnd: "8", meetTimeBegin: "1:55 PM", meetTimeEnd: "3:50 PM" },
  ]) as any[];
  assert.equal(out[0].periods, "7-8");
  assert.equal(out[0].days, "R");
  assert.equal(out[0].time, "1:55 PM-3:50 PM");
});

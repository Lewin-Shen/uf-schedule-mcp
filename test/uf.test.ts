import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildQuery,
  periodToPosition,
  resolveCategory,
  resolveCredSrch,
  resolveDept,
  resolveProgLevel,
  resolveTerm,
  _setFiltersCache,
} from "../src/uf.js";

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

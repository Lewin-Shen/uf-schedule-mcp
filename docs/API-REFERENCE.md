# UF Schedule of Courses API — Parameter Reference

**Endpoint:** `GET https://one.uf.edu/apix/soc/schedule`
**Driven by UI:** https://one.uf.edu/soc/ (the "Course Search" panel)
**Auth:** none (public). **Response:** JSON.
**Verified:** 2026-07-14, from the JS source (default-state object + query-builder transforms in bundle `2624`), the live DOM controls, the `/apix/soc/filters` endpoint, and one confirming search whose captured request pinned every serialized value.

**Legend:** ✅ verified · ⚠️ inferred (high confidence) · ❓ open

**General behavior (verified):**
- The UI emits *every* parameter on each search. Unused params are empty strings (`&course-code=`) except seven true booleans which are always sent as `false` (see below). Empty params may be omitted when calling the API directly — a minimal `?category=CWSP&term=2268&last-control-number=0` works. ✅
- Parameter names are case-sensitive kebab-case, except `fitsSchedule` (camelCase).
- **Two value conventions:**
  - **Boolean flags** — always present, `true` or `false`: `ai`, `auf`, `fitsSchedule`, `no-open-seats`, `quest`, `writing`, `hons`.
  - **Empty-default fields** — empty string when unset; when set take a code/text/`true`: everything else. Checkboxes and day buttons serialize as literally `=true` when checked (verified), empty when not.
- **`quest` and `writing` are auto-derived:** checking any `qst-1..4` forces `quest=true`; checking any `wr-2000/4000/6000` forces `writing=true`. ✅ (source transform + confirmed in capture)
- **`hons` has no checkbox:** it is set to `true` (and `dept` is cleared) when the user picks the **Honors Program** department (`dept=02030000`) — a hard-coded translation in the query builder. ✅

---

## 1. Query parameters

### Required / core

| Parameter | UI control | Type / format | Default | Example (set) | Status |
|---|---|---|---|---|---|
| `term` | Term dropdown (Required) | string code | current term | `2268` (Fall 2026) | ✅ |
| `category` | Program dropdown (Required) | string code | `CWSP` | `UFOL` | ✅ |
| `prog-level` | Program Level dropdown | string code | empty (any) | `UGRD` | ✅ |
| `dept` | Departments dropdown | 8-digit string | empty (all) | `19080000` | ✅ |
| `last-control-number` | *(none — pagination cursor)* | integer | `0` | `4384` | ✅ |

### General (free-text — copied from in-panel helper text)

| Parameter | UI label | In-panel example/hint | Type | Match behavior | Status |
|---|---|---|---|---|---|
| `course-code` | **Course #** | "Example: ACG3101" | string; all whitespace stripped by client | prefix match (`COP3502` → `COP3502C`) | ✅ |
| `class-num` | **Class #** | "Example: 15110" | string (5-digit class number); trimmed | exact class number | ✅ label / ⚠️ exact-match |
| `course-title` | **Course Title** | "Part or all of Title or Keyword" | string; trimmed | partial/keyword substring | ✅ label / ⚠️ substring |
| `instructor` | **Instructor** | "Instructor Last Name" | string; trimmed | instructor last-name | ✅ label |

### Credits & course level

| Parameter | UI control | Type / values | Default | Example | Status |
|---|---|---|---|---|---|
| `credits` | "# of Credits" text field | integer | empty | `3` | ✅ |
| `cred-srch` | "Options" dropdown (credit comparator) | enum: `EQ`, `LE`, `GE` | empty | `GE` | ✅ (see §2.5) |
| `level-min` | "Minimum" (Course Level) dropdown | enum `1000`–`8000` | empty | `2000` | ✅ (see §2.6) |
| `level-max` | "Maximum" (Course Level) dropdown | enum `1999`–`8999` | empty | `4999` | ✅ (see §2.6) |
| `var-cred` | *(no control in current UI — vestigial)* | — | empty | — | ⚠️ no UI control |

### Meeting day & time

| Parameter | UI control | Type / value when set | Default | Status |
|---|---|---|---|---|
| `day-m` | "M" toggle button | `true` | empty | ✅ |
| `day-t` | "T" toggle button | `true` | empty | ✅ |
| `day-w` | "W" toggle button | `true` (captured) | empty | ✅ |
| `day-r` | "R" toggle button (Thursday) | `true` | empty | ✅ |
| `day-f` | "F" toggle button | `true` | empty | ✅ |
| `day-s` | "S" toggle button (Saturday; no Sunday) | `true` | empty | ✅ |
| `period-b` | Period slider — **lower** handle | 2-digit string `02`–`13`; empty if handle at 1 | empty | ✅ (see §2.7) |
| `period-e` | Period slider — **upper** handle | 2-digit string `02`–`13`; empty if handle at 14 (E3) | empty | ✅ (see §2.7) |

### Online / campus (labels verified from checkboxes)

| Parameter | UI label | Value when set | Default | Status |
|---|---|---|---|---|
| `online-a` | **Online (100%)** | `true` | empty | ✅ |
| `online-p` | **Online (80-99%)** | `true` | empty | ✅ |
| `online-h` | **Hybrid** | `true` | empty | ✅ |
| `online-c` | **Primarily Classroom/Traditional** | `true` | empty | ✅ |

*(These map to the response `sectWeb` codes `AD`/`PD`/`HB`/`PC` — see §4.)*

### General Education (checkbox per category)

| Parameter | UI label | Value when set | Default | Status |
|---|---|---|---|---|
| `ge-b` | **Biological Sciences (B)** | `true` | empty | ✅ |
| `ge-c` | **Composition (C)** | `true` | empty | ✅ |
| `ge-h` | **Humanities (H)** | `true` | empty | ✅ |
| `ge-m` | **Mathematics (M)** | `true` | empty | ✅ |
| `ge-n` | **International (N)** | `true` | empty | ✅ |
| `ge-p` | **Physical Sciences (P)** | `true` | empty | ✅ |
| `ge-s` | **Social and Behavioral (S)** | `true` | empty | ✅ |
| `ge-d` | *(no checkbox — Diversity, vestigial)* | — | empty | ⚠️ param exists, no UI control |
| `ge` | *(master; unused/legacy)* | — | empty | ❓ no observed use |

### Writing requirement (checking any forces `writing=true`)

| Parameter | UI label | Value when set | Default | Status |
|---|---|---|---|---|
| `wr-2000` | **2000 words** | `true` | empty | ✅ |
| `wr-4000` | **4000 words** | `true` | empty | ✅ |
| `wr-6000` | **6000 words** | `true` | empty | ✅ |
| `writing` | *(master, auto-set)* | `true`/`false` | `false` | ✅ |

### Quest (checking any forces `quest=true`)

| Parameter | UI label | Value when set | Default | Status |
|---|---|---|---|---|
| `qst-1` | **Quest 1** | `true` | empty | ✅ |
| `qst-2` | **Quest 2** | `true` | empty | ✅ |
| `qst-3` | **Quest 3** | `true` | empty | ✅ |
| `qst-4` | **Quest 4** | `true` | empty | ✅ (absent from the older example URL) |
| `quest` | *(master, auto-set)* | `true`/`false` | `false` | ✅ |

### Flags & other attributes

| Parameter | UI control | Value | Default | Meaning | Status |
|---|---|---|---|---|---|
| `ai` | "AI Course" checkbox (AI Courses) | `true`/`false` | `false` | Artificial-Intelligence course designation (response: `isAICourse`/`aiAttr`) | ✅ |
| `eep` | "EEP Eligible" checkbox | `true` when set / empty | empty | Employee Education Program eligible (response: `EEP`) | ✅ |
| `auf` | "Affordable UF" checkbox (Additional Attributes) | `true` when set / empty | `false`* | Affordable UF — low/no-cost course materials | ✅ |
| `elal` | "Experiential Learning" checkbox (Additional Attributes) | `true` when set / empty | *(appended by current build)* | Experiential-learning attribute (response: `isElal`/`elalAttr`) | ✅ **new — not in the older example URL** |
| `spgm` | "Special Programs" radio group | `` (All), `special`, `general` | `` (All Sections) | All / Special-Program-only / General-only sections | ✅ **new — not in the older example URL** |
| `hons` | *(set via Honors Program dept)* | `true`/`false` | `false` | Honors; auto-set when `dept=02030000`, which also clears `dept` | ✅ |
| `no-open-seats` | *(no control in current panel)* | `true`/`false` | `false` | Open-seat filter; direction (include vs only full sections) unconfirmed | ⚠️ no UI control / ❓ direction |
| `fitsSchedule` | *(login-gated; not rendered logged-out)* | `true`/`false` | `false` | "Fits my schedule" — needs the signed-in student's schedule | ⚠️ login-gated |

\* `auf` is stored as an empty-default field internally but behaves as a boolean flag; captured as `auf=true` when checked.

---

## 2. Enumerations

### 2.1 `term` (from `/apix/soc/filters` and the DOM `<select>` — ✅)

Pattern: `2` + 2-digit year + semester digit (`1`=Spring, `5`=Summer, `8`=Fall). Summer sub-terms append `6W1` (A), `6W2` (B); `…51` = Summer C.

| Code | Term | | Code | Term |
|---|---|---|---|---|
| `2268` | Fall 2026 | | `2238` | Fall 2023 |
| `2265` | Summer 2026 | | `2235` | Summer 2023 |
| `22656W1` | Summer A 2026 | | `22356W1` | Summer A 2023 |
| `22656W2` | Summer B 2026 | | `22356W2` | Summer B 2023 |
| `22651` | Summer C 2026 | | `22351` | Summer C 2023 |
| `2261` | Spring 2026 | | `2231` | Spring 2023 |
| `2258` | Fall 2025 | | `2228` | Fall 2022 |
| `2255` | Summer 2025 | | `2225` | Summer 2022 |
| `22556W1` | Summer A 2025 | | `22256W1` | Summer A 2022 |
| `22556W2` | Summer B 2025 | | `22256W2` | Summer B 2022 |
| `22551` | Summer C 2025 | | `22251` | Summer C 2022 |
| `2251` | Spring 2025 | | `2221` | Spring 2022 |
| `2248` | Fall 2024 | | `2218` | Fall 2021 |
| `2245` | Summer 2024 | | `2215` | Summer 2021 |
| `22456W1` | Summer A 2024 | | `22156W1` | Summer A 2021 |
| `22456W2` | Summer B 2024 | | `22156W2` | Summer B 2021 |
| `22451` | Summer C 2024 | | `22151` | Summer C 2021 |
| `2241` | Spring 2024 | | `2211` | Spring 2021 |

Older terms also present: `2208` Fall 2020, `2205` Summer 2020, `22056W1` Summer A 2020, `22056W2` Summer B 2020, `22051` Summer C 2020, `2201` Spring 2020, `2198` Fall 2019, `2195` Summer 2019, `21956W1` Summer A 2019, `21956W2` Summer B 2019, `21951` Summer C 2019, `2191` Spring 2019, `2188` Fall 2018.

### 2.2 `category` ✅

| Code | Label |
|---|---|
| `CWSP` | Campus / Web / Special Program |
| `UFOL` | UF Online Program |
| `IA` | Innovation Academy |

### 2.3 `prog-level` ✅

| Code | Label | | Code | Label |
|---|---|---|---|---|
| *(empty)* | *(any)* | | `PHM` | Pharmacy |
| `UGRD` | Undergraduate | | `PA` | Physician Assistant |
| `GRAD` | Graduate | | `PROF` | Professional |
| `LAW` | Law | | `VEM` | Veterinary Medicine |
| `MED` | Medical School | | | |

### 2.4 `dept` (8-digit codes → department name) ✅

The department "wording → number" translation the search uses. Codes are UF department IDs (leading zeros significant). Full list from `/apix/soc/filters` (identical to the DOM `<select>`):

| Code | Department |
|---|---|
| `17030000` | Accounting, Fisher School of |
| `23020000` | Advertising |
| `16620000` | African American Studies |
| `16600000` | African Studies |
| `60030000` | Agricultural & Life Sciences General |
| `60260000` | Agricultural Education and Communication |
| `60079998` | Agricultural Operations Management |
| `60070000` | Agricultural and Biological Engineering |
| `60080000` | Agronomy |
| `60090000` | Animal Sciences |
| `16040000` | Anthropology |
| `26030000` | Applied Physiology & Kinesiology |
| `15020000` | Architecture, School of |
| `13020000` | Art and Art History |
| `13010000` | Arts General |
| `16060000` | Astronomy |
| `33040000` | Behavioral Science & Community Health |
| `16900300` | Biological Sciences |
| `19340000` | Biomedical Engineering |
| `36010000` | Biostatistics |
| `16900500` | Botany |
| `17010000` | Business Admin General |
| `57140000` | Center for Latin American Studies |
| `19030000` | Chemical Engineering |
| `16120000` | Chemistry |
| `19040000` | Civil and Coastal Engineering |
| `16140000` | Classics |
| `16140300` | Classics Greek Studies |
| `16140500` | Classics Latin |
| `33070000` | Clinical/Health Psychology |
| `16000000` | College of Liberal Arts and Sciences |
| `33000000` | College of Public Health & Health Professions |
| `28060000` | Comparative, Diagnostic & Population Medicine |
| `19140000` | Computer & Information Science & Engineering |
| `15030000` | Construction Management, Rinker School of |
| `16920300` | Criminology |
| `34110000` | Dentistry: Endodontics |
| `34010000` | Dentistry: General |
| `34160000` | Dentistry: Oral & Maxillofacial Diagnostic Sci |
| `34030000` | Dentistry: Oral Biology |
| `34070000` | Dentistry: Orthodontics |
| `34130000` | Dentistry: Periodontics |
| `34140000` | Dentistry: Prosthodontics |
| `29110500` | Department of Physiology and Aging |
| `15010000` | Design, Construction & Planning General |
| `13050000` | Digital Worlds Institute |
| `17050000` | Economics (Warrington) |
| `16030000` | Economics (CLAS) |
| `18070000` | Education: Human Devel and Org Studies in Ed |
| `18080000` | Education: Spec Ed/Schl Psych/Early Child Stu |
| `18050000` | Education: Teaching and Learning |
| `19050000` | Electrical and Computer Engineering |
| `19400100` | Engineering Education |
| `19400000` | Engineering General |
| `16200000` | English |
| `60140000` | Entomology and Nematology |
| `19100000` | Environmental Engineering Science |
| `60180000` | Environmental Horticulture |
| `33160000` | Environmental and Global Health |
| `36020000` | Epidemiology |
| `16660000` | European Studies |
| `60320000` | Family, Youth, and Community Sciences |
| `17060000` | Finance |
| `16010000` | First Year Florida |
| `60469000` | Fisheries & Aquatic Science FFGS |
| `52033000` | Flexible Learning |
| `60150000` | Food Science and Human Nutrition |
| `60060000` | Food and Resource Economics |
| `60460000` | Forest Resources and Conservation FFGS |
| `16800000` | Gender, Sexuality and Women's Studies |
| `16220000` | Geography |
| `16240000` | Geology |
| `60466000` | Geomatics Sciences FFGS |
| `12010000` | Graduate School |
| `16840000` | Graham Center |
| `02200000` | Hamilton School for Classical & Civic Education |
| `26050000` | Health Education and Behavior |
| `33080000` | Health Services Administration |
| `16280000` | History |
| `02030000` | Honors Program *(selecting this sets `hons=true` and clears `dept`)* |
| `60230000` | Horticultural Sciences |
| `19060000` | Industrial and Systems Engineering |
| `28100800` | Infectious Diseases & Immunology |
| `17070000` | Info Systems and Operations Management |
| `02070400` | Innovation Academy |
| `16010100` | Interdisciplinary Studies |
| `15050000` | Interior Design |
| `16740000` | Jewish Studies |
| `23040000` | Journalism |
| `15040000` | Landscape Architecture |
| `16860000` | Languages, Literatures & Cultures |
| `16860300` | Languages, Literatures & Cultures Akan |
| `16860400` | Languages, Literatures & Cultures Amharic |
| `16860500` | Languages, Literatures & Cultures Arabic |
| `16860600` | Languages, Literatures & Cultures Chinese |
| `16860700` | Languages, Literatures & Cultures Czech |
| `16860900` | Languages, Literatures & Cultures French |
| `16861000` | Languages, Literatures & Cultures German |
| `16861100` | Languages, Literatures & Cultures Haitian/Creo |
| `16861200` | Languages, Literatures & Cultures Hebrew |
| `16861400` | Languages, Literatures & Cultures Italian |
| `16861500` | Languages, Literatures & Cultures Japanese |
| `16861600` | Languages, Literatures & Cultures Korean |
| `16861700` | Languages, Literatures & Cultures Polish |
| `16861800` | Languages, Literatures & Cultures Russian |
| `16862000` | Languages, Literatures & Cultures Swahili |
| `16862200` | Languages, Literatures & Cultures Vietnamese |
| `16862300` | Languages, Literatures & Cultures Wolof |
| `16862500` | Languages, Literatures & Cultures Yoruba |
| `28040000` | Large Animal Clinical Science |
| `24010000` | Law |
| `24050000` | Law: Taxation |
| `16300000` | Linguistics |
| `17020000` | Management |
| `17080000` | Marketing |
| `23200000` | Mass Communication |
| `19090000` | Materials Science and Engineering |
| `16320000` | Mathematics |
| `19020000` | Mechanical/Aerospace Engineering |
| `23030000` | Media Production, Management, and Technology |
| `29260000` | Medicine-Anatomy |
| `29310000` | Medicine: Aging/Geriatric Research |
| `29040000` | Medicine: Anesthesiology |
| `29030000` | Medicine: Biochemistry/Molecular Biology |
| `29160000` | Medicine: Community Health and Family Medicine |
| `29290200` | Medicine: Emergency Medicine |
| `29010000` | Medicine: General |
| `29240100` | Medicine: Health Outcomes & Biomedical Informat |
| `29050000` | Medicine: Medicine |
| `29060000` | Medicine: Molecular Genetics & Microbiology |
| `29190000` | Medicine: Neurological Surgery |
| `29180000` | Medicine: Neurology |
| `29020000` | Medicine: Neuroscience |
| `29070000` | Medicine: Obstetrics & Gynecology |
| `29150000` | Medicine: Ophthalmology |
| `29210000` | Medicine: Otolaryngology Head & Neck Surgery |
| `29080000` | Medicine: Pathology |
| `29090000` | Medicine: Pediatrics |
| `29100000` | Medicine: Pharmacology & Therapeutics |
| `29110000` | Medicine: Physiology |
| `29120000` | Medicine: Psychiatry |
| `29200000` | Medicine: Radiation Oncology |
| `29130000` | Medicine: Radiology |
| `29710000` | Medicine: School of Physician Assistant Studies |
| `29140000` | Medicine: Surgery |
| `29340000` | Medicine: Urology |
| `16820000` | Medieval & Early Modern Studies |
| `60100000` | Microbiology and Cell Science |
| `25020000` | Military Science Air Force |
| `25010000` | Military Science Army |
| `25050000` | Military Science Navy |
| `13030000` | Music |
| `60170000` | Natural Resources and Environment, School of |
| `13100500` | New World School of the Arts: Dance |
| `13100300` | New World School of the Arts: Music |
| `13100400` | New World School of the Arts: Theatre |
| `13100200` | New World School of the Arts: Visual Arts |
| `19080000` | Nuclear and Radiological Engineering |
| `31010000` | Nursing |
| `33030000` | Occupational Therapy |
| `29170000` | Orthopaedics Surgery and Sports Medicine |
| `60079999` | Packaging Sciences |
| `28100000` | Pathobiology |
| `32040000` | Pharmacy: Cellular and Systems Pharmacology |
| `32030000` | Pharmacy: Medicinal Chemistry |
| `32050000` | Pharmacy: Pharmaceutical Outcomes and Policy |
| `32020000` | Pharmacy: Pharmaceutics |
| `32060000` | Pharmacy: Pharmacotherapy & Translational Research |
| `32100000` | Pharmacy: Pharmacy Education & Practice |
| `16340000` | Philosophy |
| `29360000` | Physical Medicine & Rehabilitation |
| `33050000` | Physical Therapy |
| `16360000` | Physics |
| `28050000` | Physiological Science |
| `60190000` | Plant Pathology |
| `16380000` | Political Science |
| `16880500` | Portuguese |
| `16400000` | Psychology |
| `33010000` | Public Health & Health Professions Undergrad |
| `23060000` | Public Relations |
| `33120000` | Rehabilitation Science Doctoral Program |
| `16420000` | Religion |
| `19120000` | Research and Engineering Education Facility |
| `28090000` | Small Animal Clinic Science |
| `16920500` | Sociology |
| `60210000` | Soil, Water, and Ecosystems Sciences |
| `16880300` | Spanish |
| `16580100` | Speech and Communication Studies, Dial Center |
| `33060000` | Speech, Language, and Hearing Sciences |
| `26040000` | Sport Management |
| `16480000` | Statistics |
| `13040000` | Theatre and Dance |
| `26020000` | Tourism Recreation and Sport Management |
| `26090000` | Tourism, Hospitality & Event Management |
| `19400400` | Undergraduate Computer Engineering |
| `02070000` | Undergraduate Studies SFCC |
| `15060000` | Urban and Regional Planning |
| `28011100` | Veterinary Medical Sciences |
| `28010000` | Veterinary Medicine Dean's Office |
| `60470000` | Wildlife Ecology and Conservation |
| `16940000` | Writing Program (CLAS) |
| `02060000` | Writing Program |
| `16900700` | Zoology |

*(Two "Economics" and two "Writing Program" entries exist with different codes, as returned by the API.)*

### 2.5 `cred-srch` (credit comparator) ✅

| Code | Label | Meaning |
|---|---|---|
| *(empty)* | — | no credit filter |
| `EQ` | Equal To | credits == value |
| `LE` | No More Than | credits ≤ value |
| `GE` | At Least | credits ≥ value |

Pairs with `credits` (a number). Selecting an operator makes `credits` required in the UI.

### 2.6 `level-min` / `level-max` (Course Level dropdowns) ✅

| `level-min` | | `level-max` |
|---|---|---|
| `1000` | | `1999` |
| `2000` | | `2999` |
| `3000` | | `3999` |
| `4000` | | `4999` |
| `5000` | | `5999` |
| `6000` | | `6999` |
| `7000` | | `7999` |
| `8000` | | `8999` |

Both default to empty (no bound). Values are the catalog course-number bands.

### 2.7 `period-b` / `period-e` (Period slider) ✅

Single dual-handle range slider, internal positions **1–14**:

| Position | Meaning | Sent as |
|---|---|---|
| 1 | Period 1 / no lower bound | `period-b` empty when lower handle = 1 |
| 2–11 | Periods 2–11 | `02`…`11` (zero-padded) |
| 12 | Evening **E1** | `12` |
| 13 | Evening **E2** | `13` |
| 14 | Evening **E3** / no upper bound | `period-e` empty when upper handle = 14 |

Client formatting (from source): `period-b = (pos==1 ? "" : zeropad(pos))`, `period-e = (pos==14 ? "" : zeropad(pos))`. So a fully-open slider `[1,14]` sends both empty; e.g. lower handle at Period 3 → `period-b=03`; upper handle at E2 → `period-e=13`.

### 2.8 `spgm` (Special Programs radio) ✅

| Value | Label |
|---|---|
| *(empty)* | All Sections |
| `special` | Special Program Sections Only |
| `general` | General Sections Only |

---

## 3. Pagination ✅ (mechanism) / ⚠️ (page size)

- Page with `last-control-number`; `0` = first page. Pass the response's `LASTCONTROLNUMBER` back to fetch the next page.
- Response trailer fields: `LASTCONTROLNUMBER` (int), `RETRIEVEDROWS` (int, courses in this page), `TOTALROWS` (int, total matches).
- `LASTCONTROLNUMBER` is an **opaque internal cursor, not a row index** — observed `4384` for a 12-row result, `2320` for a 1-row result. ✅
- Page size believed ≤ 50 courses; multi-page round-trip not yet walked. ⚠️

| Query | LASTCONTROLNUMBER | RETRIEVEDROWS | TOTALROWS |
|---|---|---|---|
| `dept=19080000&prog-level=GRAD&term=2268&category=CWSP` | 4384 | 12 | 12 |
| `course-code=COP3502&term=2268&category=CWSP` | 2320 | 1 | 1 |

---

## 4. Response structure ✅ (fields) / ⚠️ (meetTimes)

Top level: **array with one object** `{ COURSES:[…], LASTCONTROLNUMBER:int, RETRIEVEDROWS:int, TOTALROWS:int }`.

**Course object:** `code`, `courseId` (6-digit), `name`, `openSeats` (int|null — `null` for future terms), `termInd`, `description`, `prerequisites`, `sections[]`.

**Section object (key fields):** `number`, `classNumber` (int), `display`, `credits` (int **or** `"VAR"`), `credits_min`, `credits_max`, `gradBasis` (`GRD`/`SUS`/…), `acadCareer` (`UGRD`/`GRAD`/…), `deptCode` (int), `deptName`, `sectWeb` (delivery code — see below), `note`, `dNote`, `genEd[]`, `quest[]`, `courseFee` (float), `EEP` (`Y`/`N`), `grWriting` (`Y`/`N`), `addEligible` (`Y`/`N`), `lateFlag`, `dropaddDeadline` (MM/DD/YYYY), `pastDeadline` (bool), `startDate`, `endDate`, `instructors[]` (`{name}`), `meetTimes[]`, `waitList` (`{isEligible:Y/N, cap:int, total:int}`), `simpleSyllabusParams`, `isStartDate45DaysOut` (bool). Optional flags: `isElal`+`elalAttr` (e.g. "Independent Study", "Internship"), `isAICourse`+`aiAttr`.

**`sectWeb` codes (from the results decoder in source):** `AD` = Online (100%), `PD` = Online (80-99%), `HB` = Hybrid, `P`/`PC` = Primarily Classroom. ✅

**`meetTimes[]`** was empty in all sampled Fall 2026 sections; element schema (expected `meetNo`, `meetDays`, `meetTimeBegin/End`, `meetPeriodBegin/End`, `meetBuilding`, `meetBldgCode`, `meetRoom`) still to confirm on a term with published times. ⚠️

---

## 5. Supporting endpoints

| Endpoint | Method | Role | Status |
|---|---|---|---|
| `/apix/soc/filters` | GET | All dropdown option lists: `categories[]`, `progLevels[]`, `terms[]` (`{CODE,DESC,SORT_TERM}`), `departments[]` (`{CODE,DESC}`) | ✅ |
| `/apix/soc/getsyllabusconfig` | GET | Syllabus-link config (Simple Syllabus); pairs with `simpleSyllabusParams` | ⚠️ referenced, not captured |

---

## 6. Example requests

1. **Grad Nuclear & Radiological Engineering, Fall 2026** ✅
   `…/apix/soc/schedule?category=CWSP&term=2268&dept=19080000&prog-level=GRAD&last-control-number=0`
2. **Course-code prefix search (COP3502…), Fall 2026** ✅
   `…/apix/soc/schedule?category=CWSP&term=2268&course-code=COP3502&last-control-number=0`
3. **Multi-filter (captured live):** UGRD, AI + Affordable UF + Experiential-Learning + EEP, Gen-Ed Biological, 2000-word writing, Quest 1, Online-100%, Wednesday, ≥3 credits, level 2000–4999, special-program sections. Note `quest`/`writing` auto-set and `elal`/`spgm` appended:
   `…/apix/soc/schedule?ai=true&auf=true&category=CWSP&cred-srch=GE&credits=3&day-w=true&eep=true&fitsSchedule=false&ge-b=true&last-control-number=0&level-max=4999&level-min=2000&no-open-seats=false&online-a=true&prog-level=UGRD&qst-1=true&quest=true&term=2268&wr-2000=true&writing=true&hons=false&elal=true&spgm=special`

---

## 7. Remaining open items

1. `no-open-seats` filter **direction** (include vs restrict-to full sections) — no UI control in the current panel to observe; needs a data-populated term.
2. `meetTimes[]` element schema — sample a term with published meeting times (e.g. `term=2261`).
3. Multi-page pagination walk (confirm ≤50 page size and cursor round-trip).
4. `fitsSchedule=true` behavior when logged in (login-gated).
5. `var-cred`, `ge`, `ge-d` — present in the request but have no control in the current UI (treated as vestigial/legacy).
6. `/apix/soc/getsyllabusconfig` exact payload.

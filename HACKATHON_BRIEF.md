# FortyGuard × NVIDIA Hackathon '26 — Strategy Brief

**Prepared:** 22 August 2026 · **Submission deadline:** 30 August 2026, 11:59 PM GST
**Days remaining:** 8

---

## 1. Executive summary

**Recommendation: build an AI-factory (data centre) thermal siting and cooling-headroom tool.** Track 03 (Industrial & Enterprise) combined with Track 05 (Model Designing).

Four independent lines of evidence converge on this:

1. **A judge's specialism.** Konstantin Cvetanov judges for NVIDIA, and his role is *AI Factories* — data centres.
2. **The sponsor's own commercial thesis.** FortyGuard's flagship case study is **DATS**, a thermal screen of 36 US AI data centres.
3. **An uncrowded lane.** Of ~81 public GitHub repos referencing FortyGuard, roughly one is in this space. The worker-safety and cool-routing lanes have dozens.
4. **Real input data exists.** PNNL's IM3 Data Center Atlas publishes actual US facility locations with transmission, water and fibre layers — which removes the usual "we had no real asset data" weakness.

The single most important strategic fact: **judging is 40% Impact & Relevance and 35% Technical Execution.** Innovation is only 15% and Communication only 10%. This is a "would a real client adopt this" contest with a heavy engineering-depth component — not a novelty contest and not a design contest.

---

## 2. Hackathon logistics

| Item | Detail |
|---|---|
| Event | Hackathon'26 — "Building the World's Temperature AI" |
| Dates | Build sprint 18–30 August 2026; fully online |
| **Deadline** | **30 August, 11:59 PM GST — hard close, no late submissions** |
| Judging | 1–15 September · Winners announced 16 September |
| Teams | Solo, or 2–3 people |
| Registration | fortyguard.com/hackathon-registration (FortyGuard's own form — **not** Devpost) |
| IP | You keep ownership; FortyGuard gets a licence to showcase |

### Prizes
- **1st — $3,000** + internship pathway + partner promotion
- **2nd — $2,000** · **3rd — $1,000**
- **Every winning team also receives an NVIDIA Jetson AI Developer Kit** (up to 67 TOPS, 1,024 CUDA cores, 32 Tensor cores, 8 GB LPDDR5)
- Certificate of completion for every valid submission; separate certificate for winners
- Internship and incubation opportunities are available to strong non-winning projects

### Judging criteria — published weights
| Criterion | Weight |
|---|---|
| **Impact & Relevance** | **40%** |
| **Technical Execution** | **35%** |
| Innovation | 15% |
| Communication | 10% |

FortyGuard's FAQ states the bar explicitly: *"We're looking for solutions with genuine, real-world value: the kind an actual client would adopt and rely on."*

### Submission requirements — sources conflict, so satisfy the union
The FAQ, the deadline panel, and the live webinar each state this differently. Safest target:

- **Live demo URL** — must open in incognito with no login, and stay up through judging (judging runs to 15 September, so keep it live for three weeks after submission)
- **Public GitHub repo** — add `fortyguard` / `Hackathon-FG` (hackathon@fortyguard.com) as a collaborator. *Note: the FAQ says public; the webinar said private-with-collaborator is acceptable. Public is the safer reading.*
- **Video, 2–5 minutes** (webinar said 3) — must show the product actually working. Slides do not count
- **Written project summary** — solution and impact
- **Documentation of FortyGuard API usage**

**On the video:** organisers explicitly want it *raw* — you presenting your own product in your own voice. AI-generated commercial-style video is discouraged. No professional setup expected. Pick whichever team member speaks best: *"there is no hero in the team, the hero is the application."*

### Rules
**Required:** FortyGuard temperature data must be *central* to the project. Other datasets are allowed if licences are respected. Disclose any AI tools used — never penalised, but must be declared. Keep API keys server-side.

**Disqualifying:** committing a visible API key.

**Also avoid:** off-topic work that ignores the data; DMing organisers instead of using help channels; missing the deadline.

---

## 3. The judges — and what they signal

Only four people are tagged **Mentor + Judge**. This is the clearest available signal about what will score.

| Judge | Affiliation | Their session title |
|---|---|---|
| **Ahmed Abdelkhalek** | Google Cloud — Digital Natives, Startups & VCs | *"The Builder's Trap: Escaping the Hype to Build What Matters for Your First Paying Customer"* |
| **Vikram Venkat** | Principal, Cota Capital (early-stage enterprise / deep tech) | *"Inside the VC Decision"* |
| **Prof. Jonathan Reichental** | Founder, Human Future; author *Smart Cities for Dummies*; ex-CIO City of Palo Alto | *"The Moment To Help Reinvent Our Cities With Physical AI Is Here"* |
| **Konstantin Cvetanov** | **NVIDIA — AI Factories** | *"AI4Science: Supercharging AI Applications with CUDA-X"* |

**Read:** two of four judge explicitly through a *first paying customer / venture* lens. One is a smart-cities practitioner who has actually run a city's IT. One works on data-centre infrastructure at NVIDIA.

A project with a named commercial buyer and a quantified decision will land with three of these four. A city-wide awareness map will land with none.

### Mentors worth attending
- **Aamir Ali & Mudethir Elhassan** (FortyGuard) — *"From Heat Data to Real Signal: Data Correlation Analysis,"* including "confounders, and the traps judges will look for." **This is the organisers telling you how they will scrutinise your analysis. Attend or watch the recording.**
- **Tamir Kessel** (Cultivators) — validated commercial hypotheses at BreezoMeter pre-Google acquisition. Directly relevant precedent: an environmental-data API company that got acquired.
- **Jordana Rosa** (Autodesk Forma) — connecting Forma Site Design APIs to external data
- **Aashan Javed** (FortyGuard) — live demo of Heat Intelligence Cloud, their own product suite

---

## 4. Competitive landscape — what NOT to build

### The saturation problem
There is no public Devpost, but **GitHub is public and readable**. There are ~81 repos referencing FortyGuard, nearly all created 16–22 August. The distribution is severely lopsided.

**Heavily saturated — avoid:**
- **Outdoor-worker heat-risk dashboards.** At least four separate "HeatShield"/"HeatGuard" projects, plus a dozen similar.
- **Agentic "sentinel" monitors (Track 06).** One competitor already ships an 11-tool MCP server deployed on Vercel.
- **Cool-route planners.** Many, including several near-identical implementations.

### Why this happened — and the lesson
**"Cool Route Planner" and "Worker Safety Dashboard" are printed as Build Examples on the tracks page.** Everyone built the printed examples. *The printed examples are the commodity submissions.* This is the single most useful competitive insight available.

### Independently saturated by real products
Beyond the hackathon field, these lanes are occupied by well-funded free tools:

| Lane | Occupied by |
|---|---|
| Heat-island mapping | Google Heat Resilience (50+ cities), WRI Cool Cities Lab, American Forests Tree Equity Score |
| Shade mapping | UCLA / American Forests National Shade Map (360+ US cities) |
| Cool routing | ASU *Cool Routes* (June 2026, hourly forecast, MRT physics), *CoolWalks* (Nature Sci Rep 2025), Barcelona Cool Walks, HeiGIT's ORS Shaded Edition |
| Long-horizon climate risk | Jupiter Intelligence (HeatScore), First Street (Heat Factor), UrbanFootprint |
| Microclimate simulation | ENVI-met (hours-to-days per scenario, licensed desktop) |
| City heat campaigns | NOAA/CAPA Strategies Heat Watch (~$15k, one day, one year, 60+ cities) |

**If you pitch coolest-route navigation, you are competing against peer-reviewed work that does it with better physics.**

### The two structural advantages FortyGuard's data actually gives you

**1. Air temperature, not surface temperature.** Essentially every incumbent and every hackathon project uses **land surface temperature (LST)** from Landsat/ECOSTRESS. FortyGuard provides **2m air temperature**. These are materially different numbers — LST is roof and asphalt skin temperature; 2m air is what people, workers and equipment experience.

> **Every US heat regulation, OSHA threshold, and habitability ordinance is written in air temperature, heat index, or WBGT. None are written in LST.** The incumbents can map heat but cannot speak to compliance.

**2. Forward-looking, not retrospective.** Nearly every incumbent is a static planning atlas. The **12-hour forecast** converts this from a planning map into an operational dispatch signal. That is the unoccupied space.

### The meta-rule
> Avoid *a map that informs a person about heat*. Build *a system that changes a scheduled operational decision for an organisation*.

---

## 5. Recommended direction

### Option A — AI-factory thermal siting & cooling-headroom copilot ★ RECOMMENDED
**Tracks:** 03 Industrial & Enterprise + 05 Model Designing

**Buyer:** Data-centre siting team, colocation operator, or hyperscaler infrastructure planning.

**Decision changed:** Which candidate site to select, and how much cooling headroom an existing facility loses on a given afternoon.

**Technical spine — this is what earns the 35%:**
- Evaporative and adiabatic cooling are physically limited by **wet-bulb temperature**, and `env_params` returns `wet_bulb_temperature_celsius` directly
- Use `analytic_type: exceedance` and `persistence` to compute **hours per season above a site's cooling design wet-bulb**, and the longest continuous run — which is what actually determines whether backup chillers engage
- Satellite segmentation gives the surrounding surface mix (building / road / grass) that drives local ambient elevation
- The 12-hour forecast produces a **forward operational signal**: tomorrow afternoon's derating

**Why it wins:**
- Hits the NVIDIA judge's exact domain
- Matches FortyGuard's own commercial bet (DATS), so the organisers already believe the market is real
- Roughly one competing repo versus dozens elsewhere
- Deep enough to score on Technical Execution, which most teams will neglect while polishing maps

**Risks and mitigations:**
- *"You rebuilt DATS."* → DATS is a retrospective 2025 baseline screen. Make yours **forward-looking and operational**. State the difference explicitly.
- *No facility telemetry.* → Use PNNL IM3 Data Center Atlas for real locations; model the thermal response rather than claiming measured internals. Be explicit about which is which.

**Killer pitch line for the NVIDIA judge:** NVIDIA's own Earth-2 / CorrDiff downscales 25 km → 3 km. FortyGuard operates at 60–100 m. *"Earth-2 solves km-scale. We solve the street-scale gap underneath it."* Demonstrating you understand the resolution hierarchy scores better than bolting on a dependency.

---

### Option B — Heat-habitability triage for multifamily portfolios
**Tracks:** 02 Future Buildings & Energy + 04 Government & Environment

**Buyer:** Multifamily owner-operator; secondarily their liability insurer, or tenant-side legal aid.

**Decision changed:** Which buildings in a portfolio receive AC/retrofit capital before enforcement, and which are current litigation exposure.

**Regulatory catalyst:** LA County caps rental indoor temperature at **82°F with enforcement from 1 January 2027**; LA City moved to match; **California SB 655** adds excessive indoor heat to the habitability warranty with tenant remedies from 2026. Arizona's AG has sued landlords over inadequate AC; DC's AG sued in June.

**Strength:** This is the option that best exploits the **satellite + street-view segmentation** endpoints — roof albedo, canopy, facade exposure per building. Almost nobody else will use those endpoints properly. Highest Innovation score, lowest crowding.

**Weakness:** Willingness-to-pay is *inferred, not observed* — no vendor was found selling this, which cuts both ways. **Verify the regulatory dates independently before putting them in a pitch.**

---

### Option C — Worker heat-compliance as a system of record
**Tracks:** 03 + 06

The sharpened version of the crowded idea: not another alerting dashboard, but **auto-generated, legally-formatted per-worker exposure logs and work/rest schedules**.

**Strength:** Strongest regulatory hooks and clearest human impact. Perry Weather's entire business model is selling a physical WBGT station per site on the argument that off-site estimates are wrong by several degrees — a 60–100 m grid structurally undercuts that. The CDC publicly warns that its own free OSHA-NIOSH app's station data *"may not accurately reflect worksite conditions"* — an official admission of the gap.

**Weakness:** You would be roughly the fifteenth entry in this lane. Judges pattern-match before they read your differentiator.

**Take this only if** someone on the team has genuine industry credibility others lack.

---

## 6. Architecture constraint that applies to every option

**Pre-compute and cache. Do not call the API on page load.**

The API is asynchronous — heatmaps poll for seconds, Heat Intelligence PDFs take 2–3 minutes. A judge who opens your URL and sees a spinner will leave. Therefore:

> Ship a cached dataset for one city with the app. Make live API calls an optional "run it fresh" path.

This solves demo latency, credit burn, and judging-window reliability in one move. It is also what FortyGuard's engineering lead advised for credits, and **two notebooks in the official quickstart already ship cached API responses that run with no API key** — the pattern is pre-built.

**Official quickstart:** `github.com/FortyGuard-Tech/temperature-api-quickstart` — Jupyter/Python, template-enabled, 67 forks. Wraps all six endpoints, handles submit-and-poll, ships five use-case notebooks (real-estate portfolio heat risk, bus-stop cooling prioritisation, public-parks resilience audit, single-parcel due diligence, multi-parcel screening).

---

## 7. FortyGuard API — technical reference

**Base URL:** `https://api.fortyguard.com` · **Auth:** `api-key: YOUR_KEY` header. No OAuth.

### Endpoints
| Endpoint | Method | Plan | Purpose |
|---|---|---|---|
| `/v1/heatmap` | POST | Both | GeoJSON thermal tiles over a polygon AOI |
| `/v1/satellite` | POST | Premium | Tile-based satellite segmentation |
| `/v1/streetview` | POST | Premium | Ground-level street view segmentation |
| `/v1/heat_intelligence` | POST | Premium | ~25-page PDF report via temporary signed link |
| `/v1/env_params` | POST | Both | Heat index, wet bulb, AQI, solar irradiance |
| `/v1/status/{activity_id}` | GET | Both | Status + results for any submission |
| `/v1/system/fetch-api-key-usage` | POST | Both | Credit usage, current cycle |
| `/v1/system/fetch-api-key-custom-usage` | POST | Both | Credit usage, custom range |

### Core pattern
All analysis endpoints are async. POST returns `data.activity_id` → poll `GET /v1/status/{activity_id}` every **3–5 seconds** until `Completed` or `Failed`. **Credits deduct only on `Completed`; failed tasks are free.**

### Analytic types on `/v1/heatmap`
| Type | Answers |
|---|---|
| `tcm` | Temperature snapshot (°C) |
| `time_of_measure` | Hour of day (0–23 UTC) at which each cell peaks |
| `exceedance` | **How many hours** past `threshold` |
| `persistence` | **Longest continuous run** past `threshold` |

`threshold` defaults to 30 °C; `direction` is `above` or `below`. Both are ignored by `tcm` and `time_of_measure`.

`exceedance` and `persistence` are the two most under-used and most commercially meaningful analytics in the whole API. Most competitors will only use `tcm`.

### Filter types
| Value | Meaning | Requires |
|---|---|---|
| 1 | Single hour | `start_date`, `start_time` |
| 2 | Range of hours (same day, ≤23h) | + `end_time` |
| 3 | Single day | `start_date` only |
| 4 | Range of days (≤1 month) | + `end_date` — **heatmap only** |

### Credits
**2,000,000 per key — the most premium tier FortyGuard issues, double their normal allocation.** Every team member should generate their own key rather than sharing one.

Observed cost from FortyGuard's own demo session: ~187,420 credits total, of which ~72,000 on tile segmentation alone. **Segmentation is the expensive endpoint.**

### ⚠️ Documented conflicts — resolve before building

| Point | Docs site | Webinars / FAQ | Verdict |
|---|---|---|---|
| **Historical start** | `2019-01-01` | **1 Jan 2021** — stated by the site FAQ *and* both webinar speakers independently | **Use 2021.** The API docs page appears stale. |
| **Resolution** | 60 / 80 / 100 m granularity | FAQ separately says "~20-metre resolution" | Unreconciled — verify empirically |
| **Heatmap max area** | Premium = 50 mi² | Engineering lead said "about fifteen mile square"; site says "10 mi² hyperlocal" | Unreconciled — verify empirically |
| **Invalid / non-US requests** | Return `400`, **not charged** | Engineering lead: non-US "will spend your credit" | **Do not assume invalid calls are free** |

### Hard constraints
- **United States only.** Non-US coordinates return no data.
- **Dates:** 2021-01-01 → now + 12 hours. `/v1/heatmap` alone forecasts forward.
- **Everything is Celsius, including thresholds you pass in.**
- GeoJSON is **longitude, latitude** order. Polygons must be closed.
- Segmentation images are raw Base64 — prepend `data:image/png;base64,` to render.
- Satellite response field is misspelled `orignal_image`; street view uses the correct `original_image`.
- `env_params` values are **arrays aligned to `metadata.timestamps`**. Missing values are `null` (legacy `-999`) — **never treat as zero**.

---

## 8. Complementary datasets — verified

All items below were confirmed with live HTTP requests on 22 August 2026 unless marked otherwise.

### Integrate in under two hours each
| Dataset | Value | Auth | Time |
|---|---|---|---|
| **NWS api.weather.gov** | Live heat alerts with geometry; `/gridpoints` gives official heat index at ~2.5 km | None (User-Agent header **mandatory**) | 20 min |
| **CDC/ATSDR SVI 2022** | Tract-level social vulnerability, 16 factors, percentile ranks | None | 30 min |
| **CDC Heat & Health Index** | ZIP-level heat-health composite, purpose-built for this | None | 30 min |
| **Overpass / OpenStreetMap** | Buildings, parks, trees, bus stops, shelters, surfaces | None (ODbL — attribution required) | 45 min |
| **Overture Maps buildings** | 2.5B buildings with height and floors, bbox-queryable via DuckDB | None | 15–30 min |
| **NLCD WMS (MRLC)** | 30 m land cover, impervious surface, tree canopy | None | 30 min |
| **Planetary Computer STAC** | NAIP 0.6 m aerial; Landsat ST_B10 surface temp band | None to search | 1 hr |
| **GBFS** | 177 US bike-share systems, live station status | None | 30 min |

### For Option A specifically
**★ PNNL IM3 Open Source Data Center Atlas** — `immm.pnnl.gov/datacenter-atlas`. Real US data-centre locations and facility footprints derived from OSM and enriched, shipping **transmission lines, public water service areas, and ≥1 Gbps fibre coverage** as complementary layers. Open, DOE-funded, credible provenance. **This removes Option A's main weakness.** Integration ~1–2 hours.

Also: **IM3 Projected US Data Center Locations** (OSTI 2571680) models *future* siting through 2035 under four demand scenarios — a strong forward-looking layer.

**gridstatus** (`pip install gridstatus`) gives one consistent API across CAISO, ERCOT, PJM, MISO, SPP, NYISO, ISONE and EIA — fresher and cleaner than EIA-930 directly, and no key for most ISOs.

### Gotchas that will cost you a day if discovered late
1. **US Census now hard-requires an API key.** Confirmed — keyless calls 302 to a "Missing Key" page. Older "under 500 calls/day works keyless" guidance is stale. Register on day 1.
2. **NWS renamed "Excessive Heat Warning" to "Extreme Heat Warning"** in 2024. Hardcode the old string and you get silent zeros.
3. **EPA EJScreen was pulled from public access on 5 February 2025.** Use the Public Environmental Data Partners reconstruction or Harvard Dataverse bulk download. SVI + HHI cover ~90% of the same ground in an eighth of the time.
4. **Nationwide parcel data is not hackathon-tractable.** Regrid's API is paid-tier only. Use a single county assessor's open portal, or use building footprints as the unit of analysis.
5. **EIA is regional (balancing authority), not spatial.** It supports a correlation story, not a neighbourhood-level one. Be honest about that.
6. **ACS does not contain air-conditioning presence** — a common false assumption. That comes from RECS (regional) or AHS (metro only).

### OSHA thresholds — verified from the Federal Register text
Docket OSHA-2021-0009, published 30 August 2024.

> **"Initial heat trigger means a heat index of 80 °F or a WBGT equal to the NIOSH Recommended Alert Limit (RAL)."**

> **"High heat trigger means a heat index of 90 °F or a wet bulb globe temperature (WBGT) equal to the NIOSH Recommended Exposure Limit."**

At the high trigger, the proposed rule requires *"a minimum 15-minute paid rest break at least every two hours."*

**⚠️ Status matters for credibility: the rule is still PROPOSED and has not been finalised.** Comment period closed January 2025; hearings closed July 2025; post-hearing comments closed October 2025; OSHA publishes no target date. However, the Heat **National Emphasis Program** was renewed in April 2026 and runs through **April 2031**, so enforcement activity continues.

**Say "OSHA's proposed 80°F / 90°F heat-index triggers" — never "OSHA requires."** An EHS-literate judge will catch the difference, and getting it right is a credibility win.

Enforceable **today** at state level: California (§§3395/3396), Oregon (OAR 437-002-0156), Washington (WAC 296-62-095), Nevada (April 2025), Maryland (COMAR 09.12.32), Colorado (agriculture only, January 2026).

---

## 9. NVIDIA integration — realistic vs. vapourware

Ranked by demonstrable value per hour invested.

### ★★★ RAPIDS cuDF / cuSpatial — do this, it is nearly free
`%load_ext cudf.pandas` accelerates existing pandas code with **zero changes** and automatic CPU fallback. Pre-installed on Google Colab.

**cuSpatial is the genuine win:** point-in-polygon and spatial joins over millions of temperature grid cells × census tracts × building footprints. A 60–100 m grid over a metro is millions of cells; joining that to polygons on CPU with GeoPandas is genuinely slow. **This is not a contrived GPU use case — it is the actual bottleneck in the pipeline.**

**Deliverable: a benchmark table.** *"GeoPandas sjoin: 94 s → cuSpatial: 1.2 s, 78×."* Measured numbers land far better with NVIDIA mentors than architecture diagrams. **Difficulty: easy, hours.**

### ★★★ NIM microservices — highest wow-per-hour
Free NVIDIA Developer account → API key → inference credits. **OpenAI-compatible API**, so point any OpenAI SDK at NVIDIA's base URL with no other code changes.

Two strong uses: a **natural-language query layer** over your data via function-calling (3-hour build, demos beautifully), or a **VLM for street-view attribution** — shade, surface material, awnings. **Sign up on day 1** so approval latency doesn't bite on day 7.

### ★★ cuOpt — the smartest fit if you have slack
**Apache 2.0 open source.** The key insight: **cuOpt consumes an arbitrary cost matrix.** So: build a heat-weighted graph → all-pairs shortest path over your points of interest → hand the heat-weighted OD matrix to cuOpt as VRP cost input → get a multi-stop route that **minimises cumulative heat exposure rather than distance**.

Concrete framing: *"route a utility crew through 40 stops minimising worker heat exposure subject to time windows."* A real optimisation problem that needs a real solver. **Difficulty: medium, ~1 day. Attempt only after the core demo works.**

### ★★ TensorRT for segmentation inference
Export SegFormer / Mask2Former / DeepLabv3 → ONNX → TensorRT. Gives quotable throughput and latency numbers. **Medium; an afternoon if the model exports cleanly, a lost day if you hit unsupported ops. Keep a plain-PyTorch fallback.**

### ✗ Earth-2 / CorrDiff — do not depend on it
Three problems: the NIM endpoint appears **deprecated**; self-hosting needs A100/H100-class hardware; and **it would not even help you** — CorrDiff downscales 25 km → 3 km, which is **30–50× coarser than FortyGuard's 60–100 m**. Integrating it is a downgrade dressed as an upgrade, and the NVIDIA judge will notice.

**Better play:** mention `earth2studio` on an "evaluated and consciously scoped out" slide and explain in one sentence why your product operates *below* CorrDiff's scale. Turn it into the pitch.

### ✗ Omniverse / OpenUSD — vapourware for 8 days
A 3D city heat digital twin in Omniverse is a multi-week project. **Get 80% of the visual impact in 3 hours** with deck.gl or MapLibre GL: 3D building extrusions from Overture footprint heights, coloured by your temperature field, with a time slider over the 12-hour forecast. Runs in a browser on the judges' laptops.

### Recommended stack
**cuSpatial** (real bottleneck, measurable) + **NIM** (query layer, high demo value) + **cuOpt** only if the core is solid by day 5. Mention Earth-2 as evaluated-and-scoped-out. Skip Omniverse.

---

## 10. Suggested build order — 8 days remaining

**Day 1 — Unblock and de-risk.** Register all keys immediately: Census, NVIDIA Developer, EIA, ORS. Clone the FortyGuard quickstart. `git init` with `.env` ignored. Run the three verification probes (historical floor, area cap, non-US charging behaviour). Confirm the city and the specific asset set.

**Day 2–3 — Core data pipeline.** Pull the PNNL Data Center Atlas. Build the heat-weighted analysis over your chosen assets using `exceedance` and `persistence`, not just `tcm`. **Pre-rasterise the temperature field and vectorise your sampling — do not loop HTTP calls.** Cache everything to disk.

**Day 4–5 — The product surface.** Deployed web app with the cached dataset. Asset ranking, cooling-headroom calculation, 12-hour forward signal. This is the centrepiece — protect it.

**Day 6 — The differentiating feature.** The NWS comparison: *"the official grid says 87°F for this whole area; here is the 6°F spread across it, and this facility is on the wrong side of the line."* Add segmentation-derived site context.

**Day 7 — NVIDIA layer + hardening.** cuSpatial benchmark table. NIM query interface if time permits. Verify the demo URL works from a clean incognito session on someone else's machine.

**Day 8 — Freeze and ship.** No new features. Record the video, write the summary, document API usage, add the collaborator, submit early. Resubmission is allowed before the deadline, so **submit a working version on day 7 and improve it** rather than racing the clock.

### Three things that will bite you
1. **Temperature sampling is the real bottleneck**, not computation. Pre-rasterise and vectorise.
2. **The demo must survive three weeks** — judging runs to 15 September. Use static hosting with cached data, not a laptop or a free-tier service that sleeps.
3. **Segmentation costs ~72k credits per meaningful batch.** Budget it deliberately.

---

## 11. Open questions to resolve

1. **Which city and which asset set?** Phoenix, Dallas and Northern Virginia are the obvious data-centre candidates — Northern Virginia has the highest facility density in the US.
2. **The three API probes** — historical floor (2019 vs 2021), true area cap, and whether invalid calls actually charge.
3. **Verify the regulatory dates independently** before any of them appear in a pitch.
4. **Public or private repo?** Sources conflict; public is the safer reading.
5. **Team composition** — who presents, and who owns the deployed surface.

---

## 12. Immediate housekeeping

**The API key is currently in a plaintext `.env` in a folder that is not a git repository.** A visible key is a stated disqualification. `git init` with `.env` gitignored, before there is any code to accidentally commit, removes the failure mode. FortyGuard's engineering lead gave the same instruction unprompted in the technical session.

Also note: **`API_REFERENCE.md` in this project states the historical floor as 2019-01-01.** Three independent sources now say 2021. That file needs correcting.

---

## Appendix — key sources

**Hackathon:** fortyguard.com/hackathon26 · fortyguard.com/hackathon-registration · docs-api.fortyguard.com
**Quickstart:** github.com/FortyGuard-Tech/temperature-api-quickstart
**FortyGuard case studies:** DATS data-centre thermal screen · Greater Tripoli Thermal Assessment · Toyota "Temperature GPS" partnership
**Data:** immm.pnnl.gov/datacenter-atlas · weather.gov/documentation/services-web-api · atsdr.cdc.gov/place-health/php/svi · docs.overturemaps.org/getting-data/duckdb · planetarycomputer.microsoft.com/docs/reference/stac · mrlc.gov/data-services-page
**Regulatory:** federalregister.gov/documents/2024/08/30/2024-14824 · osha.gov/heat-exposure/rulemaking
**NVIDIA:** rapids.ai/cudf-pandas · github.com/NVIDIA/cuopt · github.com/NVIDIA/earth2studio
**Support:** support@fortyguard.com (technical) · hackathon@fortyguard.com (logistics) · Snehil Ahuja, Product Lead

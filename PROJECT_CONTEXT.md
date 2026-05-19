# PROJECT_CONTEXT.md
## Growth Asset Strategist — Persistent Source of Truth

> **Instructions for all future Claude Code sessions:**
> Read this file first. Treat it as the authoritative source of truth for this project.
> Do not make architectural or product decisions that contradict what is documented here.
> Update this file after any major architecture or product change.

---

## 1. Project Overview

**Product name:** Growth Asset Strategist

**Core purpose:**
A single-page AI application that analyses a keyword and decides what marketing asset a company should build to win visibility, traffic, and conversions — then produces a format-specific, strategic brief for that asset.

**Current positioning:**
AI marketing strategy engine. Not an SEO tool, not a content brief generator. A strategic decision engine.

**Main problem being solved:**
Most companies default to writing a blog article for every keyword. This is wrong. Some keywords call for a landing page, some for a comparison page, some for a lead magnet, some for an AI-optimised factual asset. The app solves the *format decision* problem before the content problem — and then adapts the brief to the chosen format.

**UI tagline:** `AI marketing strategy engine`

---

## 2. Product Vision

The product started as an SEO content brief generator. It evolved through several deliberate upgrades:

1. **Phase 1:** Basic multi-step agent — SERP → keywords → brief
2. **Phase 2:** Added JSON robustness (`extractJSON`), top competitor surfacing, score bar animation
3. **Phase 3:** Rate limit mitigation — reduced tokens, removed web search from steps 2–6, added 3-second delays
4. **Phase 4:** Improved intelligence — SERP pattern extraction, keyword intent grouping, forced unique angle, concrete competitive gaps
5. **Phase 5:** Content Type Decision step — agent now decides the right asset format before writing the brief
6. **Phase 6:** Full strategic reposition — 8 asset types, Strategic Recommendation output, format-specific brief prompting, banned generic fallbacks
7. **Phases 7–16:** Heuristic pre-classification, Opportunity Scoring, Competitive Moat, Executive Summary, Execution Asset Generation, Interactive Operator Workspace (per-block regen, inline editing, floating nav, collapsible sections, Build Mode), Visual Execution Preview (deterministic wireframe scaffolds for all 8 types)
8. **Phase 17:** Stabilization & hardening sprint — `esc()` XSS helper, `ensureShape()` schema validator (with array type-enforcement), `loadStoredHistory()` / `saveHistory()` crash-safe localStorage handlers, null + type guards on `r.brief` / `r.quality` / `r.keywords` / `r.brief.outline` (null items) / `r.keywords.by_intent.*` / `r.contentType.strategic_recommendation.execution_steps` / `r.competitor.differentiation_tactics` / `r.serp.serp_features` in `renderResult`, `execRows` / `execChips` / `execList` array-safety guards, `content_type` null fallback in Step 5 system prompt, exec parse-failure recovery, SERP URL/title escaping, `api/claude.js` request hardening, execution data now persisted to localStorage via `saveHistory()` after generation and per-block regen
9. **Phase 18:** UX redesign for external testability + Dark Cockpit visual polish — empty state replaced with "Know what to build before you start writing" hero headline + 3-step workflow diagram + 8 format chips + 3 example keyword buttons (`tryExample(kw)`); logo tagline updated to "Find the right format, then build it"; sidebar label changed to "Your keyword"; goal dropdown options rewritten in buyer language; run button text changed to "Find the Right Format"; all 7 STEPS renamed to buyer-friendly language ("Reading the search landscape", "Mapping competitor gaps", etc.); Fast Test Mode hidden in `<details class="dev-options">` collapsible for cleaner external-facing UI; layer dividers added between result sections (replacing plain `<hr>` separators) with `data-layer` attributes for correct Build Mode hide/show behaviour; "Strategy Report" eyebrow labels added to both `renderResult` and `renderFastResult`; Dark Cockpit CSS: entire sidebar styled dark (`#15120e` bg, cream `#ede9e0` run button, dark `#1c1914` inputs) — all scoped to `.sidebar` descendant selectors, zero impact on main content area; main content elevation via box shadows on `.research-card`, `.exec-summary`, `.score-card`, inset shadow on `.main`

**The North Star:**
The app should feel like hiring a senior marketing strategist for 60 seconds. It should tell you *what to build* and *why it will win*, not just *what to write*.

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS — single file (`index.html`) |
| Backend | Node.js HTTP server (`server.js`) — acts as a proxy to Anthropic API |
| API | Anthropic Claude API (`/v1/messages`) — model `claude-sonnet-4-6` |
| Fonts | Google Fonts: `Instrument Serif` + `DM Mono` |
| Dependencies | `dotenv` (npm), `nodemon` (dev runner) |
| Storage | `localStorage` — stores last 20 results as history |

**Why a proxy server?**
The frontend cannot call the Anthropic API directly (CORS + key exposure). `local-server.js` runs on `localhost:3000`, adds the API key and required headers, and forwards requests. Start it with `npm run start:local`.

**Environment variable setup:**
```
# .env (project root — never commit this file)
ANTHROPIC_API_KEY=sk-ant-...
```
`server.js` uses `require('dotenv').config()` and will `process.exit(1)` if the key is missing.

**npm workflow:**
```bash
npm install          # installs dotenv (nodemon should be installed globally or added as devDependency)
npm start            # runs: nodemon server.js
```
`nodemon` restarts `server.js` automatically on file changes.

---

## 4. Current Workflow

**To run the app:**
```bash
cd /Users/garcia/Desktop/SEO-Agent/files
npm start
# Then open index.html directly in the browser (file://)
# OR serve it locally — no build step required
```

**Where `.env` lives:** `/Users/garcia/Desktop/SEO-Agent/files/.env`

**How the app is tested:**
- Manually, in the browser
- Open `index.html` directly (no dev server needed for the frontend)
- The backend proxy must be running (`npm start`) for API calls to work
- Check the terminal running `nodemon` for API errors — it logs every request, model, token count, and full error bodies on non-200 responses

**Key debug signals in the terminal:**
```
[timestamp] POST /api/claude
  → model: claude-sonnet-4-6  max_tokens: 800  web_search: true
  ✓ 200 OK (1842 bytes)
```
Non-200 responses log the full Anthropic error body.

---

## 5. Current AI Pipeline

All API calls go through `callClaude()` in `index.html`. Each step runs sequentially with a 3-second sleep between them to stay within the 30,000 input tokens/minute rate limit.

Web search is used **only in Step 1**. All subsequent steps work purely from previous step output.

---

### Step 1 — Market Signal Analysis
**Function:** `callClaude` with `useWebSearch: true`, `maxTokens: 800`

**What it does:** Searches the live web for the keyword. Analyses top-ranking pages.

**Output schema:**
```json
{
  "top_results": [{ "position", "title", "url", "content_type", "estimated_word_count" }],
  "search_intent": "informational|commercial|transactional|navigational",
  "dominant_content_type": "...",
  "serp_features": ["featured snippet", "people also ask"],
  "difficulty_signal": "low|medium|high",
  "patterns": {
    "common_headings": [],
    "avg_section_count": 7,
    "recurring_angles": [],
    "what_is_missing": []
  }
}
```

**Flows into:** Steps 2, 3, 4 (all receive `serp` data)

---

### Step 2 — Competitive Intelligence
**Function:** `callClaude`, no web search, `maxTokens: 600`

**What it does:** Analyses SERP patterns and top results to find concrete gaps, not generic "add more value" insights.

**Input:** `serp.top_results`, `serp.patterns`

**Output schema:**
```json
{
  "common_headings": [],
  "content_gaps": [],
  "winning_angle": "...",
  "unique_opportunity": "...",
  "avg_depth": "shallow|moderate|deep",
  "differentiation_tactics": []
}
```

**Flows into:** Steps 4, 5 (brief generation receives competitor data)

---

### Step 3 — Keyword Opportunity Map
**Function:** `callClaude`, no web search, `maxTokens: 500`

**What it does:** Maps search demand by intent across the funnel.

**Input:** keyword, niche, `serp.search_intent`

**Output schema:**
```json
{
  "primary_keyword": "...",
  "by_intent": {
    "informational": [],
    "commercial": []
  },
  "secondary_keywords": [],
  "lsi_keywords": [],
  "question_keywords": [],
  "priority_order": [],
  "keyword_difficulty": "low|medium|high",
  "recommended_density": "1.5%"
}
```

**Flows into:** Step 5 (brief generation uses primary + secondary keywords)

---

### Step 4 — Asset Type Decision
**Function:** `callClaude`, no web search, `maxTokens: 350`

**What it does:** Decides the highest-ROI marketing asset format. The core strategic decision of the entire pipeline.

**Input:** keyword, business goal, `serp.search_intent`, `serp.dominant_content_type`, top result type distribution, `competitor.winning_angle`, `serp.patterns.what_is_missing`

**Output schema:**
```json
{
  "content_type": "blog_article|landing_page|...",
  "reasoning": "...",
  "user_intent": "informational|commercial|transactional",
  "funnel_stage": "awareness|consideration|conversion",
  "strategic_recommendation": {
    "what_to_build": "...",
    "why_it_fits": "...",
    "growth_impact": "...",
    "first_action": "..."
  }
}
```

**Flows into:** Step 5 — the chosen `content_type` determines the entire brief structure

---

### Step 5 — Asset Brief
**Function:** `callClaude`, no web search, `maxTokens: 1200`

**What it does:** Writes a format-specific brief for the chosen asset type. Uses two mechanisms to force type-specific output:
1. `structureGuide` — a lookup table injected into the user message explaining the exact section structure for this asset type
2. `typeSpecificInstruction` — a `CRITICAL:` block injected into the system prompt with hard rules (e.g. "comparison_page: title must name what is being compared, do NOT write a how-to title")

**Input:** All previous step outputs + keyword, audience, business goal, context

**Output schema:**
```json
{
  "recommended_title": "...",
  "alt_titles": [],
  "meta_description": "...",
  "recommended_word_count": 2200,
  "tone_of_voice": "...",
  "unique_angle": "...",
  "hook": "...",
  "outline": [{ "level": "h2|h3", "heading": "...", "notes": "..." }],
  "must_include": [],
  "avoid": [],
  "internal_linking_suggestions": [],
  "cta": "..."
}
```

**Flows into:** Step 6 (quality scoring)

---

### Step 6 — Strategy Quality Score
**Function:** `callClaude`, no web search, `maxTokens: 400`

**What it does:** Scores the brief 0–100. Penalises vague unique angles, hooks written as descriptions rather than actual copy, and generic must_include items. Score < 65 if any of these are detected.

**Input:** keyword, full brief JSON, `competitor.content_gaps`, `serp.search_intent`

**Output schema:**
```json
{
  "score": 82,
  "grade": "B+",
  "strengths": [],
  "improvements": [],
  "competitive_advantage": "..."
}
```

---

### Token budget summary

| Step | Web search | maxTokens |
|------|-----------|-----------|
| 1 — Market Signal Analysis | Yes (max_uses: 2) | 800 |
| 2 — Competitive Intelligence | No | 600 |
| 3 — Keyword Opportunity Map | No | 500 |
| 4 — Asset Type Decision | No | 350 |
| 5 — Asset Brief | No | 1200 |
| 6 — Strategy Quality Score | No | 400 |

3-second sleep before each of steps 2–6 to stay within 30,000 input tokens/minute.

---

## 6. Asset Types

All 8 currently supported asset types and what they mean:

| Type | When to use | Brief structure |
|------|-------------|----------------|
| `blog_article` | Informational intent, awareness stage, educational content | h2/h3 outline with specific arguments per section |
| `landing_page` | Conversion intent, specific offer, paid or organic traffic | Hero, Benefits, Social proof, Objection handling, CTA |
| `product_page` | Transactional intent, specific product or product category | Hero, Features, Benefits, Specs, Reviews, CTA |
| `category_page` | Browse/navigational intent, product category | Category overview, Subcategories, Featured items, FAQ |
| `comparison_page` | Commercial intent, user comparing options | Comparison table, per-option sections, Recommendation |
| `tool_or_calculator` | Problem-solving intent, user needs an answer/calculation | Tool description, Inputs, Output interpretation, Supporting content |
| `lead_magnet` | Resource-seeking intent, not-yet-buying user | Offer headline, Value exchange, Form fields, Delivery, Follow-up sequence |
| `ai_visibility_asset` | Definition/concept queries likely answered by ChatGPT or Perplexity | Entity definition, Numbered facts, Q&A blocks, Stats with sources, Schema notes |

---

## 7. UI / UX Direction

**Design system:**
- Main content background: `#f5f2eb` (warm parchment) — never change this
- Surface: `#faf8f3`
- Ink: `#1a1814` (near-black warm)
- Fonts: `Instrument Serif` (headings, display) + `DM Mono` (body, labels, UI)
- Accent: black-on-parchment — no bright colours except semantic green/gold/red for scores
- Borders: subtle warm grey (`#ddd8cc`, `#c8c3b5`)

**Sidebar (Dark Cockpit — Phase 18):**
- Sidebar background: `#15120e` (near-black warm) — all dark styles scoped to `.sidebar` descendants
- Run button: cream `#ede9e0` bg / `#15120e` text — reverses the main palette for contrast
- Inputs/selects: `#1c1914` bg, `#ede9e0` text, `#2e2a23` border
- Labels: `#8a8480` (muted warm grey)
- Section labels: `#504b46` (dim)
- History items, error box, dividers, dev-options all scoped with matching dark values
- Logo text: `#ede9e0` / logo sub: `#504b46`
- Constraint: all dark sidebar CSS must remain scoped to `.sidebar` — never write unscoped rules that affect main content

**Design philosophy:** Feels like a premium strategy document, not a SaaS dashboard. Monospace gives it a technical credibility. Serif gives it editorial weight.

**UX philosophy:**
- Sidebar for inputs, main area for output — never break this layout
- Progress steps animate in real time as each agent step completes
- Results render as a scrollable strategy document
- History stores last 20 analyses in localStorage — no login required
- No modals, no tabs, no navigation — single-page, linear flow

**What must stay consistent:**
- The warm parchment colour palette
- Instrument Serif + DM Mono font pairing
- The 6-step progress indicator
- The score card with animated fill bar
- The section structure (4 layers): ① Decision (exec summary → strategic rec → why this wins) → ② Reasoning (asset type decision → opportunity → moat) → ③ Execution (brief: title, hook, outline, keywords, must include, CTA) → ④ Research & Quality (score → quality review → competitors → SERP → heuristic signal)

**Result page helper functions (shared by both render modes):**
- `renderExecutiveSummary(r)` — dark card at top: verdict sentence, asset chip, opportunity score pill, moat level pill, verdict label. Has `data-section="summary" data-label="Summary"`.
- `renderWhyThisWins(ct, moat)` — green-bordered 3-bullet section: beats competitor formats (moat.attack_angle), right format for intent (why_it_fits), business case (business_impact)
- `renderOpportunityAnalysis(opp)` — collapsible `sec-collapsible sec-closed` with `data-section="opportunity" data-label="Opportunity" data-layer="reasoning"`
- `renderCompetitiveMoat(moat)` — collapsible `sec-collapsible sec-closed` with `data-section="moat" data-label="Moat" data-layer="reasoning"`

**Operator Workspace — Phase 15 (nav + collapse + build mode):**

*Result navigation (`#resultNav`):*
- Fixed `<div id="resultNav">` placed outside `#resultSection` in the HTML body — survives `innerHTML` re-renders
- `initResultNav()` called at end of `renderResult`, `renderFastResult`, and inside `toggleResultMode()` — rebuilds nav from current visible `[data-section]` elements
- `navScrollListener` module-level ref removes old scroll listener before adding new one (prevents accumulation)
- `showSection()` clears nav when leaving the result screen
- Nav hides on viewports ≤ 1100px; labels only visible on hover; active dot scales up on scroll

*Section collapse:*
- `toggleSection(el)` — toggles `.sec-closed` on a `.sec-collapsible` element
- CSS: `grid-template-rows: 1fr → 0fr` on `.sec-body`; requires inner `<div class="sec-body-inner">` with `overflow:hidden; min-height:0`
- Sections collapsed by default: Opportunity, Moat, Research & Quality
- Chevron `▾` rotates to `▸` when closed via `.sec-collapsible.sec-closed .sec-chevron { transform: rotate(-90deg) }`

*Build mode:*
- `resultMode` module variable: `'strategist' | 'build'`
- `toggleResultMode()` flips `resultMode`, applies/removes `.mode-build` from `#resultSection`, updates button text/state, re-runs `initResultNav()`
- CSS: `.result-section.mode-build [data-layer="reasoning"], [data-layer="research"], [data-layer="debug"] { display: none }`
- Mode persists across re-renders — both `renderResult` and `renderFastResult` apply `.mode-build` if `resultMode === 'build'` when they run

*Data attribute convention:*
- `data-section="<key>"` — nav anchor; must be unique per result page
- `data-label="<label>"` — human-readable nav label
- `data-layer="reasoning"` — hidden in build mode (Opportunity, Moat, Asset type decision, Keyword signal in fast test)
- `data-layer="research"` — hidden in build mode (Research & Quality wrapper in full mode)
- `data-layer="debug"` — hidden in build mode (Asset Logic panel in fast test mode only)

**Visual Execution Preview — Phase 16:**

Deterministic, template-driven wireframe scaffold rendered immediately after execution generation. No API calls. Reads from the already-parsed `exec` object.

*Architecture:*
- `renderVisualPreview(exec, ct)` — switches on `ct`, returns HTML string with outer `data-section="preview" data-label="Preview"` wrapper (no `data-layer` — always visible including in Build Mode)
- Rendered into `<div id="previewAnchor">` which is a sibling of `<div id="execContainer">` inside the `data-section="execution"` wrapper
- `renderExecutionPlaceholder(r)` now returns both `#execContainer` and `#previewAnchor` divs
- `triggerExecutionGeneration()` populates `#previewAnchor` after `#execContainer` and calls `initResultNav()` so "Preview" appears as the 5th nav dot
- `regenExecBlock()` re-renders `#previewAnchor` when `previewAnchor.innerHTML` is non-empty, keeping preview in sync with patched fields

*Template field mappings (exact keys from `EXECUTION_SCHEMAS`):*
| Asset type | Zones rendered |
|---|---|
| `tool_or_calculator` | Tool headline (`above_fold_headline`) → Inputs (`inputs[].label`) → Output (`output.primary_label`, dark box) → Lead gate (`lead_gate.offer` + `lead_gate.cta`, gold bg) |
| `blog_article` | Intro (`intro`) → Article sections (`section_leads[].heading`, numbered list) → CTA (`cta_placements[0].copy`) |
| `landing_page` | Hero (`hero.h1` + `hero.subheadline`) → Benefits (`benefits[].label` chips) → Social proof → CTA (`hero.cta_primary`) |
| `product_page` | Product headline (`hero_headline`) → Differentiators (numbered list) → Social proof → CTA (`cta.copy` + `cta.trust_element`) |
| `category_page` | Category headline (`h1`) → Subcategories (`subcategories[].name`, numbered) → Filters (chips) → Featured format |
| `comparison_page` | Criteria chips (`table_columns`) → Table (columns + `decision_guide[].profile` rows) → CTA (`cta.copy`) |
| `lead_magnet` | Cover (dark — `titles[0]` + `opt_in.subheadline`) → Contents (`content_sections[]`, numbered) → Download gate (`opt_in.headline` + `opt_in.button`, gold bg) |
| `ai_visibility_asset` | Entity definition → Q&A pairs (`qa_pairs[].q`, 3 items) → Key facts (chips) → Citation hooks (chips) |

*CSS primitives (`.vp-` prefix):*
`.vp-outer`, `.vp-header`, `.vp-title`, `.vp-type-badge`, `.vp-frame`, `.vp-zone`, `.vp-zone--hero`, `.vp-zone--cta`, `.vp-zone--gate`, `.vp-zone-label`, `.vp-zone-headline`, `.vp-zone-body`, `.vp-cta-btn`, `.vp-output-box`, `.vp-placeholder`, `.vp-chip-row`, `.vp-chip`, `.vp-row`, `.vp-row-key`, `.vp-row-val`, `.vp-table`, `.vp-section-list`, `.vp-section-item`, `.vp-section-num`, `.vp-cover`, `.vp-cover-title`, `.vp-calc-inputs`, `.vp-calc-input-row`, `.vp-calc-label`, `.vp-calc-field`

---

## 8. Current Constraints

| Constraint | Reason |
|-----------|--------|
| Web search only on Step 1 | Rate limiting — 30,000 input tokens/minute on this account |
| 3-second sleep between all steps | Same rate limit mitigation |
| Token budgets per step (see table above) | Controlling API cost during development |
| Model: `claude-sonnet-4-6` | Haiku models not available on this API account (confirmed 404 error in earlier session) |
| Single-file frontend (`index.html`) | No build tooling — intentional for simplicity and portability |
| No database | localStorage only — fine for the current single-user prototype stage |
| No authentication | Local-only prototype, not deployed |
| `extractJSON()` required | Claude sometimes returns JSON with prose before/after or in markdown fences. Parser has three layers: (1) direct `JSON.parse`, (2) markdown-fence regex (case-insensitive, catches `json`/`JSON`), (3) `extractFirstJSONObject()` — brace-counting with string-literal awareness, stops at the first balanced `}` so postamble text containing `{field}` notation doesn't overshoot the real closing brace |

---

## 9. Known Problems / Improvement Areas

**Output quality:**
- Outputs can still feel generic, especially for less common asset types (`tool_or_calculator`, `category_page`)
- The `unique_angle` field in briefs sometimes defaults to describing a benefit rather than naming a concrete differentiator
- `must_include` items can be vague topic labels rather than specific named resources

**Asset structure:**
- `lead_magnet` and `ai_visibility_asset` are new types with less battle-tested prompting — they may need prompt iteration
- The `outline` schema uses h2/h3 for all types, which maps awkwardly to landing pages and tool pages — a type-specific schema would be more accurate but would require renderResult changes

**Strategic reasoning:**
- The `strategic_recommendation` fields sometimes reflect the keyword rather than the business context (goal, audience)
- `growth_impact` can be too abstract — should name specific metrics (CAC, MQL volume, citation rate)

**SERP intelligence:**
- Step 1 infers word counts from snippets rather than actual crawling — estimates are approximate
- SERP patterns (`common_headings`, `recurring_angles`) are inferred from titles and snippets, not full page content

**Token budget — execution generation:**
- `lead_magnet` execution JSON (titles × 3 + opt_in + 7 content_sections + email_sequence) reliably exceeds the 900-token execution budget, causing `extractJSON` to fail on the truncated response. The UI now recovers gracefully (button resets, retry shown), but the type itself needs either a higher token budget or a slimmed schema. Do not increase `maxTokens` beyond 2000 without checking the `MAX_TOKENS_HARD_CAP` in `api/claude.js`.

**Future expansion areas:**
- AI visibility strategy is an emerging area — `ai_visibility_asset` type could be expanded with structured data schema templates
- Lead magnet follow-up sequence could become its own output section
- A "distribution strategy" output section (where to promote the asset once built) would add significant strategic value

---

## 10. Important Development Rules

1. **Never hardcode the API key.** It lives in `.env` only. `server.js` reads it via `dotenv`. The frontend never sees it.

2. **Never increase web search calls without deliberate reason.** Currently only Step 1 uses web search. Adding it to other steps will immediately trigger rate limit errors (30k input tokens/minute).

3. **Do not rebuild the architecture.** The single-file frontend + Node.js proxy pattern is intentional and should be preserved. Do not introduce a build system, framework, or bundler unless explicitly requested.

4. **Preserve the design system.** Parchment palette + Instrument Serif/DM Mono is a deliberate aesthetic choice. Do not change fonts, background colours, or layout structure.

5. **Do not add new CSS classes without checking if an existing one fits.** The stylesheet is clean — use `.bs-tag`, `.rc-label`, `.research-card`, `.kw-tag`, `.outline-item` etc. before inventing new classes.

6. **Keep the JSON schema consistent.** Both the agent prompts and `renderResult` depend on the same field names. Changing a field name in a prompt without updating `renderResult` (and vice versa) will silently break the display.

7. **Always use `extractJSON()` when parsing API responses.** Never use raw `JSON.parse()` on Claude output — the model sometimes wraps responses in markdown code fences.

8. **Fallback objects must never use banned phrases:**
   - "The Complete Guide to..."
   - "Start with a compelling statistic or question"
   - "Subscribe or contact us"
   - "provide value"
   - "be comprehensive"
   - "add more examples"
   All fallbacks are now asset-type-aware and use format-specific placeholder language.

9. **Token budgets are load-bearing.** Do not increase `maxTokens` for any step without considering the cumulative input token cost per full pipeline run. The pipeline currently costs approximately 3,500–5,000 output tokens per run and significant input tokens due to inter-step context passing.

10. **`setStep()` numbering must match the `STEPS` array.** The pipeline calls `setStep(0)` through `setStep(6)` — 0–5 for active steps, 6 to mark all done. If steps are added or removed, both the `STEPS` array and all `setStep()` calls must be updated together.

---

## 11. Session Continuity Instructions

**For all future Claude Code sessions working on this project:**

1. **Read this file first** before making any code changes, suggestions, or plans. It contains decisions made across multiple sessions that are not visible in the current chat context.

2. **Treat this as the source of truth.** If something in the codebase contradicts this document, flag it — do not silently resolve it in favour of one or the other.

3. **Update this file after major changes.** If you change the pipeline, add a new asset type, modify the schema, change the model, alter the token budget, or reposition the product — update the relevant section of this file before ending the session.

4. **Respect the product vision.** This is a marketing strategy engine, not an SEO article generator. Every improvement should move it further toward feeling like a senior strategist decision, not a content production tool.

5. **Do not propose rebuilds.** The architecture is intentional. Improvements should be evolutionary — better prompts, sharper outputs, new asset types, stronger UI sections — not framework migrations or backend rewrites.

6. **Check the constraints section before adding features.** Rate limits, token budgets, and the single-file architecture are real constraints, not suggestions.

7. **Reference the asset types table** when working on brief generation or content type decision logic. New asset types must be added to: the content type decision prompt, the `structureGuide` lookup, the `typeSpecificInstruction` lookup, the brief fallback object, and the asset types table in this file.

8. **Test with diverse keywords.** The three recommended test keywords for validating asset type diversity:
   - `"project management software comparison"` → should produce `comparison_page`
   - `"what is cost per acquisition"` → should produce `ai_visibility_asset`
   - `"b2b saas lead generation checklist"` → should produce `lead_magnet`

---

## 12. Claude Code Working Style

Persistent principles for all development work on this project.

**Product direction**
- This product is an AI Growth Asset Strategist. Treat it as a strategic decision engine, not an SEO tool or content generator. Every feature, output, and prompt should reinforce that identity.
- If a requested change weakens the product direction — adding generic features, dumbing down outputs, reverting to blog-first thinking — flag it and suggest a better alternative that serves the actual goal.
- Prioritise strategic product intelligence over feature accumulation. One sharper output is worth more than three shallow ones.

**Code approach**
- Always read `PROJECT_CONTEXT.md` before making any changes. It contains architectural decisions, constraints, and product context that are not visible in the current session.
- Preserve and evolve the existing architecture. Do not propose framework migrations, build tool introductions, or structural rewrites unless explicitly requested and clearly necessary.
- Reuse existing components, CSS classes, helper functions, and patterns before creating new ones. The codebase is intentionally lean — keep it that way.
- Read files before editing them. Never modify code you haven't read.
- Make the minimum change that solves the problem correctly. Do not refactor surrounding code, add comments, or clean up unrelated areas as a side effect.

**Output quality**
- Avoid generic AI outputs at every layer: in prompts, in fallback strings, in UI copy, and in this documentation. Vague is a defect.
- Banned fallback phrases: "The Complete Guide to...", "Start with a compelling statistic", "Subscribe or contact us", "provide more value", "be comprehensive". These must never appear in prompts or fallback objects.
- When improving prompts, the standard is: would a senior marketing strategist be satisfied with this output, or would they rewrite it?

**Efficiency**
- Keep token usage and API costs efficient. The 30,000 input tokens/minute rate limit is a real constraint. Web search runs on Step 1 only — do not add it to other steps without an explicit reason and a plan to stay within rate limits.
- Do not increase `maxTokens` for any step without checking the cumulative cost across a full pipeline run.
- The 3-second sleep between steps is load-bearing. Do not remove it.

**UX standards**
- Keep the interface polished, focused, and SaaS-quality. The parchment palette and Instrument Serif/DM Mono pairing are non-negotiable.
- Every new output section should feel like it belongs in a strategy deck, not a content checklist.
- Think like a product engineer: does this section help the user make a better decision, or does it just add information?

**Documentation**
- Update `PROJECT_CONTEXT.md` after any major change: new asset types, pipeline modifications, schema changes, model or token budget changes, product repositioning.
- Keep `MEMORY.md` in sync with the key facts in `PROJECT_CONTEXT.md`.
- Treat this file as a living document, not a historical record. If a section is out of date, update it.

---

## Deployment Workflow

**When to use:** Any time changes are ready to ship to production.

**Rules:**

1. Before deploying, always run `git status` and review what is staged.
2. Never commit or push if `.env`, API keys, `node_modules`, or any secrets are staged. Stop and remove them first.
3. Run a quick local sanity check when possible — confirm the server starts and `/api/claude` responds.
4. Stage all safe changes with `git add -A`.
5. Write a concise, accurate commit message based on the actual changes — not generic filler.
6. Push to GitHub.
7. Remind the user that Vercel will auto-deploy after the push — no manual trigger needed.
8. If deployment fails, inspect Vercel logs rather than guessing at the cause.

**Command sequence:**

```bash
git status
git add -A
git commit -m "short clear message"
git push
```

**Trigger phrase:** When the user says "deploy this" or "push this", Claude Code may execute this workflow — but it must first confirm that no secrets, `.env` files, or `node_modules` are staged before proceeding.

---

---

## Browser Testing Workflow

**When to use:** After any UI or pipeline change, to verify the affected flow works correctly in a live browser before considering the task complete.

**Setup:** `http://localhost:3000` requires `npm run start:local` to be running. The Claude in Chrome MCP extension provides screenshot, click, JS execution, and console-reading capabilities.

**Rules:**

1. Before making UI changes, inspect the current app state in Chrome when it helps confirm structure or current behaviour.
2. After UI changes, test the affected flow in Chrome.
3. Use `http://localhost:3000` for local testing.
4. Prefer Fast Test Mode for rapid validation — completes in seconds vs ~40s for a full pipeline run.
5. Check browser console errors after changes.
6. Test core flows as relevant to the change:
   - Homepage loads
   - Fast Test Mode runs and renders a result
   - Full pipeline result renders
   - Execution Assets generate
   - Per-block regen works
   - Inline editing works
   - Build Mode works (reasoning/debug sections hidden, nav updates)
   - Copy / export controls work
7. Do not make extra UI improvements beyond the requested task scope. Report unrelated issues found — do not fix them silently.
8. Report all issues found before fixing anything out of scope.

**Scope boundary:** Browser access is a verification tool, not a directive to self-improve the UI autonomously without direction.

---

---

## Codex Review Workflow

Codex is a secondary reviewer and debugging agent. Claude Code remains the primary implementation agent and product architect.

**When to invoke Codex:**
- After implementing a large feature
- When a bug is hard to isolate
- When a deployment fails and the root cause is unclear
- Before pushing a risky change, for a second opinion
- When adversarial review of a completed implementation is warranted

**What Codex should check:**
- Syntax issues and broken function signatures
- Duplicate logic or conflicting declarations
- Fragile field accesses or assumptions about model response shape
- Export, build, or routing problems
- Obvious UX regressions
- Security risks — secrets, exposed keys, unvalidated inputs

**Deployment gate for major changes:**
1. Claude Code implements
2. Browser testing validates (see Browser Testing Workflow)
3. Codex reviews if the change is large or going to production
4. Then deploy

**Constraint:** Codex and Claude Code must not edit the same files simultaneously unless on separate branches or worktrees. Codex output is advisory — Claude Code evaluates it before acting.

---

*Last updated: May 2026 — Phase 18: UX redesign for external testability + Dark Cockpit visual polish. Phase 17 (extended): Post-stabilization adversarial review + fixes. Additional guards added after Codex adversarial review: `Array.isArray()` enforcement at all nested `.map()`/`.join()` sites that bypassed `ensureShape` (`execution_steps`, `differentiation_tactics`, `serp_features`, `by_intent.informational/commercial`), `filter(Boolean)` on `r.brief.outline` to strip null items, `execRows/execChips/execList` upgraded from `?.length` to `Array.isArray()` guard, `content_type || 'blog_article'` fallback in Step 5 system prompt to prevent pipeline abort on partial Step 4 response, `saveHistory()` called after execution generation and per-block regen so execution data survives page reload for full-pipeline results. Full browser validation passed: Fast Test Mode (3/4 canonical keywords correct — `ai_visibility_asset` miss is pre-existing), full pipeline, execution generation, regen, visual preview, Build Mode, nav, export, history restore. Zero console errors. Phase 17: Stabilization & Hardening Sprint. Five areas hardened: (1) XSS prevention — `esc()` HTML entity escaper applied to all user-controlled and web-sourced content rendered into innerHTML; SERP `top_results` URLs validated against `javascript:` URIs, titles escaped; (2) localStorage crash protection — `loadStoredHistory()` catches `JSON.parse` errors, removes corrupted key, returns `[]`; `saveHistory()` handles `QuotaExceededError` by trimming to 10 entries; (3) `currentResult` race condition — snapshot guards (`const targetResult = currentResult` before async, `if (currentResult !== targetResult) return` after await) in `triggerExecutionGeneration` and `regenExecBlock`; (4) API proxy hardening in `api/claude.js` — `MAX_TOKENS_HARD_CAP = 2000`, model prefix whitelist (`claude-`), message count cap (10), string length cap (60 000 chars), field whitelist (only `model/max_tokens/messages/system/tools` forwarded), tool type filter (only `web_search*`); (5) Runtime schema validation — `ensureShape()` null-merges `r.brief`, `r.quality`, `r.keywords` at the top of `renderResult` to prevent crash on corrupted history entries; exec parse-failure path now resets button state + shows inline Retry instead of freezing. Key deferred issues: AI output fields (`r.brief.hook`, `r.contentType.reasoning`, etc.) rendered unescaped — risk is low (Anthropic API source) but not eliminated; `lead_magnet` execution JSON reliably exceeds 900-token budget (see Known Problems). Phase 16: Visual Execution Preview (deterministic wireframe scaffold, 8 asset types, no API calls, renders after execution generation, stays in sync with per-block regen, visible in Build Mode). Phase 15: Operator Workspace (nav + collapse + build mode). Fixed `data-layer` on Asset type decision sections (both render modes) and on Keyword signal section in renderFastResult — they were missing the reasoning layer attribute and would not hide in build mode. Phase 14 complete: `buildBlockRegenCall(r, key)` + `regenExecBlock(btn)` per-block regen. Export controls restore: `renderFastResult` never had an export bar — added `<div class="export-bar">` with Copy full brief + Download .txt buttons after `renderExecutionPlaceholder(r)`. `renderResult` had the export bar at the very bottom of the page (after all Research & Quality sections) with `position: sticky; bottom: 0` — moved it to immediately after `renderExecutionPlaceholder(r)` and before the Research & Quality `<hr>` separator. `.export-bar` CSS updated: removed `position: sticky; bottom: 0` and `background: var(--surface)` (no longer a viewport-pinned footer); now uses `border-top` + `padding: 18px 0 6px` + `margin-top: 32px` as a natural content separator. Export bar is now in the same position in both modes: ③ Execution layer → export bar → Research & Quality. `buildPlainText` already handles sparse fast-test results gracefully via optional chaining. Phase 14: Interactive operator workspace — per-block regeneration and inline editing. `execBlock(label, inner, variant, key)` now takes a 4th `key` param rendered as `data-exec-key` attribute on each `.exec-block`; `renderExecutionSection` `add()` helper signature changed to `add(key, label, inner, variant)` — all 34+ calls updated with JSON field keys. Inline editing: `contenteditable="true" spellcheck="false"` on all `.exec-row-val`, `.exec-chip`, `.exec-headline`, `.exec-quote`, `.exec-text` elements — edits persist in per-block copy via `copyExecBlock` DOM traversal. Per-block regen: `buildBlockRegenCall(r, key)` builds a focused single-field API call (maxTokens: 500) — system prompt instructs Claude to return `{"key": <new value>}` only, using full `EXECUTION_SCHEMAS[ct]` as structural context; `regenExecBlock(btn)` async handler reads `block.dataset.execKey`, shows inline loading state (btn disabled + content opacity), calls `callClaude`, merges `patch[key]` into `currentResult.execution[key]`, re-renders `#execContainer` via `renderExecutionSection`, finds updated block and adds `.just-updated` for 400ms flash animation, handles errors with 3-second self-removing inline error message. New CSS: `.exec-block-actions` (flex container for regen + copy buttons), `.exec-regen-btn` (↺ icon button, matches copy btn style), `@keyframes exec-block-flash` + `.exec-block.just-updated .exec-block-content` (opacity flash on regen). Regen fails gracefully without full re-render — button restores to ↺ and block content opacity clears; Phase 13: Execution layer UX refine — two-tier block system: `execBlock(label, inner, variant)` accepts `'copy'` variant → `.exec-block--copy` (3px left border) + `.exec-block-variant` paste badge; collapsible blocks: header `onclick="toggleExecBlock(this)"` toggles `.is-collapsed`, `▾`/`▸` chevron via `.exec-block-toggle`, content wrapped in `.exec-block-content`; plan overview chip strip: `renderExecutionSection` accumulates labels via `add(label, inner, variant)` helper, renders `.exec-plan-overview` / `.exec-plan-chip` / `.exec-plan-chip--copy` before first block; `.exec-quote` replaces inline prose styles for blog intro and entity definition blocks; density tightened: exec-block padding 16/18 → 14/16, exec-row-key width 130px → 100px, exec-copy-btn opacity 0.65 → 0.85; copy-ready blocks across all 8 asset types explicitly tagged with variant='copy'; Phase 12b: Execution parse reliability fix — root causes: (1) `maxTokens: 700` caused truncation on verbose schemas (lead_magnet, ai_visibility_asset) making all three extractJSON attempts fail; (2) system prompt placed "Return ONLY JSON" after the schema with "Rules:" following it, giving Claude opportunity to add post-JSON prose; fixes: bumped `maxTokens` to 900, rewrote system prompt with JSON-only constraint as the first explicit instruction ("first char must be {, last must be }") before the schema, removed ambiguous "no markdown" phrasing in favour of explicit "no backticks, no fences"; added `console.log/warn` debug logging in `generateExecutionAssets` (raw response preview + full dump on failure); error state now shows inline Retry button instead of dead error + re-enabled generate button; Phase 12a: Execution Export — execution assets are now durable and exportable: `triggerExecutionGeneration()` persists `exec` to `currentResult.execution` on success; `buildExecutionText(exec, ct)` serialises execution JSON to plain text (type-specific, all 8 asset types); `buildPlainText(r)` appends execution section when `r.execution` exists — making Copy and Download automatically include it; per-block copy buttons added inside each `execBlock()` card (`.exec-block-header` flex layout, `.exec-copy-btn` style, `copyExecBlock(btn)` DOM-traversal function); Phase 11: Execution Asset Generation — on-demand API call (700 tokens) triggered by "⚡ Generate" button in result; `EXECUTION_SCHEMAS` per-type JSON schema constants; `buildExecutionCall(r)` constructs type-specific prompt; `renderExecutionSection(exec, ct)` renders 5–7 execution blocks per asset type (inputs, copy, structure, CTAs); `renderExecutionPlaceholder(r)` + `triggerExecutionGeneration()` handle button UX; placed between ③ Execution and ④ Research & Quality layers in both renderResult and renderFastResult; Phase 10: Executive Summary card (dark, verdict sentence + asset chip + opportunity score + moat level pills), Why This Wins section (green-bordered 3-bullet: beats competitor formats / right format for intent / business case), 4-layer result hierarchy (① Decision → ② Reasoning → ③ Execution → ④ Research & Quality), heuristic signal moved to bottom*
*Project location: `/Users/garcia/Desktop/SEO-Agent/files/`*

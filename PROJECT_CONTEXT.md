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

**Key module-level constants (index.html):**
- `STEP4_SYSTEM_BASE` — shared Step 4 system prompt (used by both full pipeline and fast test mode)
- `HEURISTIC_ASSET_MAP` — maps problem_type to mandatory content_type for high-confidence heuristic matches
- `ASSET_BEHAVIOR_MAP` — per-type behavioral profile: `strategic_role`, `user_value`, `interaction_model`, `conversion_mechanism`, `differentiation_strategy`, `reasoning_vocabulary`, `banned_vocabulary` for all 8 asset types

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
7. **Phase 7:** Deterministic heuristic pre-classification layer — `classifyKeywordHeuristic()` runs before Step 4 and enforces format decisions for high-confidence keyword patterns; `ASSET_BEHAVIOR_MAP` makes the pipeline asset-aware end-to-end; `validateContentTypeAlignment()` catches and corrects vocabulary drift post-Step 4; Fast Test Mode (classification + Step 4 only) added for rapid iteration
8. **Phase 8:** Opportunity Scoring Intelligence — `computeFastOpportunityScore()` (fast test heuristic) and full-mode API step scoring 7 dimensions (acquisition_potential, commercial_intent, competitive_saturation, differentiation_potential, conversion_leverage, speed_to_value, strategic_roi); 4 verdicts including "asymmetric opportunity"; rendered before Strategic Recommendation in both modes
9. **Phase 9:** Competitive Moat Intelligence — `computeCompetitiveMoat()` pure client-side computation (no additional API calls); 4 scored dimensions (incumbent_strength, format_defensibility, brand_trust_barrier, execution_difficulty) + realistic_entry_strategy + attack_angle; 4 moat levels; uses real SERP difficulty and top_results in full mode; rendered after Opportunity Analysis, before Strategic Recommendation

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
The frontend cannot call the Anthropic API directly (CORS + key exposure). `server.js` runs on `localhost:3000`, adds the API key and required headers, and forwards requests.

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

**Pre-Step 4: Heuristic pre-classification**
`classifyKeywordHeuristic(keyword)` runs before Step 4 in both full pipeline and fast test mode. It uses 7 regex rules to assign a `problem_type` and `confidence` level (`high` or `medium`). High-confidence matches produce a `heuristicEnforcementBlock` that is prepended to the Step 4 system prompt, explicitly forbidding `blog_article` as output and stating SERP signals cannot override the classification.

`HEURISTIC_ASSET_MAP` provides deterministic content_type assignments for high-confidence problem types:
- `calculation` → `tool_or_calculator`
- `implementation` → `lead_magnet`
- `comparison` → `comparison_page`
- `product_discovery` → `comparison_page`

After Step 4 JSON is parsed, `decision_source` is computed: `heuristic-driven | ai-overridden | hybrid | ai-driven`.

**Post-Step 4: Validation**
`validateContentTypeAlignment(contentType)` checks `reasoning`, `what_to_build`, `why_it_fits`, `business_impact` for banned vocabulary from `ASSET_BEHAVIOR_MAP[content_type].banned_vocabulary`. On detection: logs a `console.warn` and auto-patches `reasoning` with `[Asset mode: ...]` annotation.

**Fast Test Mode**
A checkbox in the UI skips Steps 1–3 and 5–6, running only `classifyKeywordHeuristic()` + Step 4 with lightweight mock SERP/competitor data. After Step 4: computes `computeFastOpportunityScore()` (heuristic, no API) and `computeCompetitiveMoat()` using mock SERP/competitor data. Renders: Keyword signal + Opportunity Analysis + Competitive Moat + Asset type decision + Strategic recommendation + Asset Logic debug panel. Full mode is unaffected.

**setStep() numbering (full mode):** 0→1→2→3→4(Opportunity Analysis)→5(Asset Brief)→6(Quality Score)→7(done). Fast test mode: runs to setStep(7) directly after heuristic + Step 4.

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
**Function:** `callClaude`, no web search, `maxTokens: 500`

**What it does:** Decides the highest-ROI marketing asset format. The core strategic decision of the entire pipeline. Preceded by `classifyKeywordHeuristic()` and (for high-confidence matches) a mandatory enforcement block prepended to the system prompt.

**Input:** keyword, business goal, `serp.search_intent`, `serp.dominant_content_type`, top result type distribution, `competitor.winning_angle`, `serp.patterns.what_is_missing`, heuristic pre-classification (if matched)

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

### Step 4b — Opportunity Analysis (full mode only)
**Function:** `callClaude`, no web search, `maxTokens: 500`

**What it does:** Scores the strategic attractiveness of the keyword opportunity across 7 dimensions. Falls back to `computeFastOpportunityScore()` if JSON extraction fails.

**Input:** keyword, recommended asset type, business goal, SERP search intent, difficulty signal, competitor weakness, market gap

**Output schema:**
```json
{
  "dimensions": {
    "acquisition_potential":    { "score": 0-100, "reasoning": "..." },
    "commercial_intent":        { "score": 0-100, "reasoning": "..." },
    "competitive_saturation":   { "score": 0-100, "reasoning": "..." },
    "differentiation_potential":{ "score": 0-100, "reasoning": "..." },
    "conversion_leverage":      { "score": 0-100, "reasoning": "..." },
    "speed_to_value":           { "score": 0-100, "reasoning": "..." },
    "strategic_roi":            { "score": 0-100, "reasoning": "..." }
  },
  "overall_score": 0-100,
  "verdict": "low opportunity|moderate opportunity|strong opportunity|asymmetric opportunity",
  "verdict_reasoning": "..."
}
```

**Verdict logic:** "asymmetric opportunity" requires high heuristic confidence + non-blog_article type + differentiation_potential ≥ 82. Score colours: ≥75 green, ≥55 gold, <55 red.

**Competitive Moat (client-side, no API call):**
`computeCompetitiveMoat(keyword, contentType, opportunity, serp, competitor)` runs immediately after the opportunity step in both modes. Pure computation — no additional API call.

4 scored dimensions:
- `incumbent_strength` — derived from `serp.difficulty_signal` (high=78, medium=55, low=38) ± saturation modifier
- `format_defensibility` — per-type base (tool_or_calculator=88…) ± SERP top_results format match count
- `brand_trust_barrier` — per-type base ± difficulty modifier
- `execution_difficulty` — per-type constant

Plus `realistic_entry_strategy` (text) and `attack_angle` (text).

Weighted moat score: `moatScore = incumbentStrength×0.45 + brandTrustBarrier×0.30 + executionDifficulty×0.25`. Format bonus: −12 if formatDefensibility≥80, −6 if ≥65, else 0. `effectiveMoat = moatScore − formatBonus`.

Moat levels: ≥72 = "very hard to beat" (red), ≥55 = "strong moat" (orange #b04000), ≥38 = "moderate moat" (gold), <38 = "weak moat" (green). Color semantics: format_defensibility higher=green (advantage); other dims higher=red (threat).

**Flows into:** renderOpportunityAnalysis + renderCompetitiveMoat (both rendered before Strategic Recommendation)

---

### Step 5 — Asset Brief
**Function:** `callClaude`, no web search, `maxTokens: 1200`

**What it does:** Writes a format-specific brief for the chosen asset type. Uses three mechanisms to force type-specific output:
1. `structureGuide` — a lookup table injected into the user message explaining the exact section structure for this asset type
2. `typeSpecificInstruction` — a `CRITICAL:` block injected into the system prompt with hard rules (e.g. "comparison_page: title must name what is being compared, do NOT write a how-to title")
3. `ASSET_BEHAVIOR_MAP` context — `strategic_role`, `interaction_model`, `conversion_mechanism`, `differentiation_strategy` for the chosen type are injected into the user message to anchor brief generation in the asset's behavioral profile

**Input:** All previous step outputs + keyword, audience, business goal, context, asset behavior context from `ASSET_BEHAVIOR_MAP`

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
| 4 — Asset Type Decision | No | 500 |
| 4b — Opportunity Analysis | No | 500 |
| 5 — Asset Brief | No | 1200 |
| 6 — Strategy Quality Score | No | 400 |

Competitive Moat (client-side): 0 API tokens.
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

**`ASSET_BEHAVIOR_MAP`** provides a full behavioral profile for each type: `strategic_role`, `user_value`, `interaction_model`, `conversion_mechanism`, `differentiation_strategy`, `reasoning_vocabulary` (terms to use), and `banned_vocabulary` (terms that indicate article-mode drift). This profile is used to:
- Validate Step 4 output (`validateContentTypeAlignment()`) and warn/patch when banned vocabulary appears
- Inject behavioral context into Step 5 user message to anchor brief generation
- Render `strategic_role` under the asset type chip in both renderResult and renderFastResult
- Show a full "Asset Logic" debug panel in Fast Test Mode (strategic role, interaction model, conversion mechanism)

---

## 7. UI / UX Direction

**Design system:**
- Background: `#f5f2eb` (warm parchment)
- Surface: `#faf8f3`
- Ink: `#1a1814` (near-black warm)
- Fonts: `Instrument Serif` (headings, display) + `DM Mono` (body, labels, UI)
- Accent: black-on-parchment — no bright colours except semantic green/gold/red for scores
- Borders: subtle warm grey (`#ddd8cc`, `#c8c3b5`)

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
- The section structure: Asset Type → Strategic Recommendation → Score → Competitors → SERP signals → Keywords → Brief → Quality review

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
| `extractJSON()` required | Claude sometimes returns JSON wrapped in markdown fences — parser handles plain JSON, fenced JSON, and embedded JSON |

---

## 9. Known Problems / Improvement Areas

**Output quality:**
- The `unique_angle` field in briefs sometimes defaults to describing a benefit rather than naming a concrete differentiator
- `must_include` items can be vague topic labels rather than specific named resources
- Fallback objects (Step 4 and Step 5) contain real, asset-type-specific copy — no bracket placeholders

**Asset structure:**
- The `outline` schema uses h2/h3 for all types, which maps awkwardly to landing pages and tool pages — a type-specific schema would be more accurate but would require renderResult changes
- `category_page` has less battle-tested prompting and may need prompt iteration

**Strategic reasoning:**
- The `strategic_recommendation` fields sometimes reflect the keyword rather than the business context (goal, audience)
- `growth_impact` can be too abstract — should name specific metrics (CAC, MQL volume, citation rate)

**Heuristic system:**
- Medium-confidence heuristic matches still allow AI override — this is intentional but means some keywords with genuinely ambiguous intent may get inconsistent decisions
- `validateContentTypeAlignment()` patches `reasoning` text but cannot retroactively rewrite the full `strategic_recommendation` object — deep drift in `what_to_build` or `why_it_fits` requires the Step 4 prompt to do better

**SERP intelligence:**
- Step 1 infers word counts from snippets rather than actual crawling — estimates are approximate
- SERP patterns (`common_headings`, `recurring_angles`) are inferred from titles and snippets, not full page content

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

8. **Fallback objects must never use banned phrases or bracket placeholders:**
   - "The Complete Guide to..."
   - "Start with a compelling statistic or question"
   - "Subscribe or contact us"
   - "provide value" / "be comprehensive" / "add more examples"
   - "featured snippet" / "topical authority" / "drive traffic" / "increase visibility"
   - "builds authority" / "aligns with intent" / "create engaging content"
   - Bracket placeholders like `[Opening observation]`, `[Your Value Proposition]`, `[Insert keyword]`
   All fallbacks are asset-type-aware and contain real copy. Each hook is a publishable sentence. Each outline section names a real content device.

9. **Token budgets are load-bearing.** Do not increase `maxTokens` for any step without considering the cumulative input token cost per full pipeline run. The pipeline currently costs approximately 3,500–5,000 output tokens per run and significant input tokens due to inter-step context passing.

10. **`setStep()` numbering must match the `STEPS` array.** The STEPS array has 7 entries (indices 0–6). The pipeline calls `setStep(0)` through `setStep(7)` — 0–6 for active steps, 7 to mark all done. Full mode sequence: setStep(0)→1→2→3→4(opportunity)→5(brief)→6(quality)→7(done). Fast test: setStep(3)→7. If steps are added or removed, both the `STEPS` array and all `setStep()` calls must be updated together.

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

*Last updated: May 2026 — Phase 9: Competitive Moat Intelligence (computeCompetitiveMoat, renderCompetitiveMoat — pure client-side, no API tokens, uses real SERP signals in full mode); Phase 8: Opportunity Scoring Intelligence (computeFastOpportunityScore heuristic + full-mode API step, 7 dimensions, 4 verdicts, renderOpportunityAnalysis); Phase 7: deterministic heuristic pre-classification (classifyKeywordHeuristic + HEURISTIC_ASSET_MAP), ASSET_BEHAVIOR_MAP end-to-end asset awareness, validateContentTypeAlignment, asset behavior context in Step 5, strategic_role under asset chip, Asset Logic debug panel*
*Project location: `/Users/garcia/Desktop/SEO-Agent/files/`*

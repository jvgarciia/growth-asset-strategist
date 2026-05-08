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

*Last updated: May 2026*
*Project location: `/Users/garcia/Desktop/SEO-Agent/files/`*

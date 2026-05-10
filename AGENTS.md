# AGENTS.md
## Growth Asset Strategist — AI Session Operating Manual

> This file is loaded automatically by Codex at the start of every session.
> It is not documentation. It is the operating protocol for all AI-assisted development on this project.
> Follow it in full before writing a single line of code.

---

## 0. First Actions — Every Session, No Exceptions

Before doing anything else:

1. **Read `/Users/garcia/Desktop/SEO-Agent/files/PROJECT_CONTEXT.md` in full.**
   It is the authoritative source of truth for pipeline architecture, asset types, token budgets, schema contracts, and product decisions made across multiple sessions. It contains context that is not in this file and is not recoverable from the codebase alone.

2. **Read the relevant sections of `index.html` before touching them.**
   This is a 2,400+ line single-file application. Never edit code you have not read. Never assume a function signature, variable name, or section structure — verify it.

3. **Check what the user actually needs.**
   Understand the request strategically, not just literally. Ask: what problem is this solving at the product level? Is there a smarter path than what was asked?

4. **After any major change, update `PROJECT_CONTEXT.md`.**
   If you change the pipeline, add a step, modify a schema, alter a token budget, add an asset type, reposition the product, or make any architectural decision — record it before ending the session. The next session's Codex has no memory of this one.

---

## 1. Product Identity

**Name:** Growth Asset Strategist

**What it is:**
An AI marketing strategy engine. Given a keyword and business context, it decides the highest-ROI marketing asset format to build — then produces a format-specific, actionable brief for that asset.

**What it is not:**
- Not an SEO tool
- Not a content brief generator
- Not a blog article factory
- Not a keyword research tool

**The one-sentence strategic brief:**
> The app solves the *format decision* problem before the content problem.

**North Star:**
Every output should feel like it came from a senior marketing strategist who spent 60 seconds on your exact situation — not from a content template that got filled in. It tells you *what to build and why it will win*, not just *what to write*.

**UI tagline:** `AI marketing strategy engine`

---

## 2. Product Philosophy

**Strategic lens — apply this to every decision:**
- One sharper output is worth more than three shallow ones
- Vague is a defect. Specificity is the product
- Generic AI behaviour is the enemy of this product's credibility
- If a feature doesn't help the user make a better strategic decision, it is noise

**When the user asks for a change:**
Ask yourself whether the change moves the product *toward* or *away from* the North Star. If away, flag it. Suggest a version of the change that serves the actual goal.

**Product phases so far (summary — full history in PROJECT_CONTEXT.md):**
- Phase 1–4: Basic pipeline → JSON robustness → rate limit mitigation → SERP intelligence
- Phase 5–6: Asset type decision layer → 8 asset types → strategic recommendation output
- Phase 7: Heuristic pre-classification (`classifyKeywordHeuristic`) + `ASSET_BEHAVIOR_MAP` + `validateContentTypeAlignment` + Fast Test Mode
- Phase 8: Opportunity Scoring Intelligence (7-dimension scoring, 4 verdicts)
- Phase 9: Competitive Moat Intelligence (client-side, no extra API calls)
- Phase 10: Executive Summary card + Why This Wins section + 4-layer result hierarchy
- Phase 11–13: Execution Asset Generation (on-demand, per-type JSON schemas, collapsible blocks, inline copy)
- Phase 14: Interactive Operator Workspace — per-block regen (`buildBlockRegenCall`, `regenExecBlock`), inline editing (`contenteditable`)
- Phase 15: Operator UX — floating result nav, collapsible sections, Build Mode toggle

---

## 3. Architecture — Non-Negotiable

**Stack:**
| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Vanilla HTML/CSS/JS — single file (`index.html`) | No build tooling. Portable. Intentional. |
| API proxy | `api/Codex.js` (Vercel serverless function) | CORS + API key protection |
| Local proxy | `local-server.js` (Node.js HTTP server) | Used only for local dev without Vercel |
| API | Anthropic `Codex-sonnet-4-6` via `/v1/messages` | Haiku is unavailable on this account |
| Storage | `localStorage` — last 20 results | No database, no login |
| Fonts | Instrument Serif + DM Mono (Google Fonts) | Non-negotiable |

**The single-file constraint is intentional.**
Do not introduce a build system, bundler, framework, or multi-file split unless explicitly and deliberately requested. The value of the single-file architecture is portability, simplicity, and zero toolchain overhead.

**The proxy pattern is required.**
The frontend cannot call the Anthropic API directly (CORS + key exposure). In production: `api/Codex.js` (Vercel serverless). Locally: `local-server.js` on port 3000.

**Key module-level constants in `index.html`:**
- `STEPS` — array of 7 pipeline step objects; `setStep()` index must always match this array
- `ASSET_BEHAVIOR_MAP` — per-type behavioral profile for all 8 asset types
- `HEURISTIC_ASSET_MAP` — maps heuristic `problem_type` to forced `content_type`
- `STEP4_SYSTEM_BASE` — shared Step 4 system prompt used by both full mode and fast test mode
- `EXECUTION_SCHEMAS` — per-type JSON schema strings (8 types) injected into execution generation prompt
- `resultMode` — module-level `'strategist' | 'build'`; consulted at render time to persist mode across re-renders
- `navScrollListener` — stored reference to the result nav scroll listener; removed and replaced by `initResultNav()` on each call to prevent listener accumulation

---

## 4. The AI Pipeline

**7 steps in full mode. All API calls go through `callClaude()`. 3-second sleep between every step.**

| Step | Name | Web Search | maxTokens | Key output |
|------|------|-----------|-----------|------------|
| 0 | Market Signal Analysis | ✅ Yes | 800 | `serp` object with top results, intent, difficulty |
| 1 | Competitive Intelligence | No | 600 | `competitor` object with gaps, weakness, angle |
| 2 | Keyword Opportunity Map | No | 500 | `keywords` object with intent grouping |
| 3 | Asset Type Decision | No | 500 | `contentType` with `content_type` + `strategic_recommendation` |
| 4 | Opportunity Analysis | No | 500 | `opportunity` with 7 dimensions + verdict |
| 5 | Asset Brief | No | 1200 | `brief` object with title, outline, hook, CTA |
| 6 | Strategy Quality Score | No | 400 | `quality` with score, grade, strengths, improvements |

**After Step 3, two client-side computations run with no API call:**
- `validateContentTypeAlignment(contentType)` — checks for vocabulary drift, auto-patches if detected
- `computeCompetitiveMoat(keyword, contentType, opportunity, serp, competitor)` — scores 4 moat dimensions

**Rate limit hard rule:** Web search on Step 0 only. Adding it to any other step risks hitting the 30,000 input tokens/minute ceiling.

**`setStep()` sequence:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7(done). Fast test mode: jumps to setStep(7) after heuristic + Step 3.

**Always use `extractJSON()` on all Codex API responses.** Never `JSON.parse()` raw output — Codex sometimes wraps JSON in markdown fences.

---

## 5. Asset Types — Know These Cold

8 types are supported. Every new feature that touches Step 4, Step 5, fallbacks, or renderResult must consider all 8.

| Type | When to use |
|------|------------|
| `blog_article` | Informational intent, awareness stage |
| `landing_page` | Conversion intent, specific offer |
| `product_page` | Transactional, specific product or category |
| `category_page` | Browse/navigational, product category |
| `comparison_page` | Commercial intent, user comparing options |
| `tool_or_calculator` | Problem-solving intent, needs an answer/calculation |
| `lead_magnet` | Resource-seeking, not-yet-buying user |
| `ai_visibility_asset` | Definition queries likely answered by ChatGPT/Perplexity |

**`ASSET_BEHAVIOR_MAP` fields per type:**
`strategic_role`, `user_value`, `interaction_model`, `conversion_mechanism`, `differentiation_strategy`, `reasoning_vocabulary`, `banned_vocabulary`

**When adding a new asset type**, it must be registered in:
1. The Step 4 system prompt (decision logic)
2. `structureGuide` lookup (Step 5)
3. `typeSpecificInstruction` lookup (Step 5)
4. `ASSET_BEHAVIOR_MAP`
5. `HEURISTIC_ASSET_MAP` (if it has a deterministic trigger pattern)
6. Fallback objects in `runFastTest()`
7. The asset types table in `PROJECT_CONTEXT.md`

---

## 6. Development Rules — Hard Constraints

**Read before edit.** Never modify a function or section you have not read. `index.html` is 3,800+ lines.

**Minimum viable change.** Make the smallest correct change. Do not refactor adjacent code, clean up unrelated sections, or add comments as a side effect of a focused edit.

**No rebuilds.** If you find yourself proposing a framework migration, a multi-file split, or a structural rewrite — stop. Ask whether the actual problem can be solved within the existing architecture first.

**Token budgets are load-bearing.** Do not increase `maxTokens` for any step without calculating the cumulative effect across a full pipeline run (~3,500–5,000 output tokens total currently). Rate limit is 30,000 input tokens/minute.

**`setStep()` must match `STEPS` array length.** If you add or remove a pipeline step, update both the `STEPS` array and every `setStep()` call in `runAgent()` and `runFastTest()`. A mismatch shows wrong step states in the UI.

**JSON schema contracts are shared between prompts and render functions.** If you change a field name in a prompt, update the render function that reads it. Silent breakage is the failure mode.

**Duplicate `const` declarations crash the script silently.** The entire `<script>` block fails to load — not just the function. Always check whether a variable is already declared before adding it. Run `node --check` after edits to the script.

**No generic fallbacks.** See the banned phrases list in Section 9.

---

## 7. Rendering Philosophy

**4-layer result hierarchy — always maintain this order:**

| Layer | Sections | `data-layer` | Purpose |
|-------|---------|------------|---------|
| ① Decision | Executive Summary → Strategic Recommendation → Why This Wins | *(none — always visible)* | Immediate answer: what to build and why |
| ② Reasoning | Asset Type Decision → Opportunity Analysis → Competitive Moat | `reasoning` | Supporting intelligence: why this is the right call |
| ③ Execution | Title → Hook → Unique Angle → Keywords → Outline → Must Include/Avoid → CTA → ⚡ Generate | *(none — always visible)* | The actual brief deliverable |
| ④ Research & Quality | Score → Quality Review → Competing Pages → Competitive Opportunity → SERP → Keyword Signal | `research` | Evidence and quality gate |

**`data-layer` attribute is load-bearing.** Build Mode hides every element with `data-layer="reasoning"`, `data-layer="research"`, or `data-layer="debug"`. If you add a new section, assign the correct layer or it will be visible in Build Mode when it shouldn't be.

**`data-section` + `data-label` attributes drive the result nav.** Every major section that should appear in the floating nav must have both. The nav is rebuilt by `initResultNav()` — it queries all visible `[data-section]` elements in `#resultSection`. Keep keys unique within a result page.

**Operator workspace (Phase 15):**
- `#resultNav` — fixed positioned `<div>` placed outside `#resultSection` in the HTML body; never overwritten by `innerHTML` re-renders
- `initResultNav()` — rebuilds nav from current DOM; must be called at end of `renderResult`, `renderFastResult`, and `toggleResultMode()`
- `navScrollListener` — stored reference; always remove old listener before adding new one (accumulation bug prevention)
- `toggleSection(el)` — toggles `.sec-closed` on any `.sec-collapsible` element; CSS grid trick handles animation
- `toggleResultMode()` — flips `resultMode`, applies/removes `.mode-build` on `#resultSection`, updates button state, re-runs `initResultNav()`
- `resultMode` — `'strategist' | 'build'`; always checked at render time so mode persists if user re-runs a query

**Collapse pattern — required wrapper structure:**
```html
<div class="sec-collapsible sec-closed" data-section="..." data-label="..." data-layer="...">
  <div class="... sec-toggle" onclick="toggleSection(this.parentElement)">
    <span class="bs-title">Section name</span>
    <span class="sec-chevron">▾</span>
  </div>
  <div class="sec-body"><div class="sec-body-inner">
    <!-- content here -->
  </div></div>
</div>
```
`sec-body-inner` MUST have `overflow: hidden; min-height: 0` (set in CSS). Without this, the `grid-template-rows: 0fr` trick doesn't work and the section never actually collapses.

**Execution Asset system:**
- `EXECUTION_SCHEMAS` — per-type JSON schema strings (8 types); injected directly into system prompt
- `buildExecutionCall(r)` — builds `callClaude` args from result context; maxTokens: 900
- `generateExecutionAssets(r)` — makes API call, returns parsed exec JSON
- `renderExecutionSection(exec, ct)` — renders 5–7 exec blocks per asset type using `execBlock(key, label, inner, variant)`, `execRows()`, `execChips()`, `execList()` helpers. `key` param renders as `data-exec-key` attribute for per-block regen
- `renderExecutionPlaceholder(r)` — renders dashed-border button card + empty `#execContainer`
- `triggerExecutionGeneration()` — only patches `#execContainer` innerHTML; the outer section wrapper, export bar, and nav survive
- `buildBlockRegenCall(r, key)` — per-block API call (maxTokens: 500); returns `{"<key>": <new value>}`
- `regenExecBlock(btn)` — finds `data-exec-key`, calls API, merges patch into `currentResult.execution[key]`, re-renders `#execContainer`, flashes updated block

**Shared render helpers (used by both `renderResult` and `renderFastResult`):**
- `renderExecutiveSummary(r)` — dark ink card: verdict sentence + asset chip + opportunity score pill + moat level pill. Has `data-section="summary"`.
- `renderOpportunityAnalysis(opp)` — collapsible sec with `data-section="opportunity" data-layer="reasoning"`
- `renderCompetitiveMoat(moat)` — collapsible sec with `data-section="moat" data-layer="reasoning"`
- `renderWhyThisWins(ct, moat)` — green-bordered 3-bullet section

**CSS reuse rule:** Before adding a new class, check whether `.brief-section`, `.bs-header`, `.bs-title`, `.bs-tag`, `.bs-body`, `.research-card`, `.rc-label`, `.rc-value`, `.outline-item`, `.kw-tag`, `.comp-*`, `.sec-collapsible`, `.sec-body`, `.sec-body-inner`, `.sec-chevron` already do what you need. The stylesheet is intentionally lean.

**CSS variables — always use these, never hardcode:**
`--bg`, `--surface`, `--surface2`, `--ink`, `--ink-mid`, `--ink-muted`, `--border`, `--border-dark`, `--green`, `--green-bg`, `--gold`, `--gold-bg`, `--red`, `--red-bg`, `--serif`, `--mono`

**Colour semantics for scores:**
- Score ≥ 75 → `var(--green)` / `var(--green-bg)` (favourable)
- Score 55–74 → `var(--gold)` / `var(--gold-bg)` (moderate)
- Score < 55 → `var(--red)` / `var(--red-bg)` (unfavourable)
- Competitive moat: `format_defensibility` (higher = green = advantage); `incumbent_strength`, `brand_trust_barrier`, `execution_difficulty` (higher = red = threat)

---

## 8. UI / UX Principles — Non-Negotiable

**Design system:**
- Background: `#f5f2eb` (warm parchment) — never change this
- Fonts: `Instrument Serif` (headers, display) + `DM Mono` (body, labels) — never change these
- No bright accent colours except semantic green/gold/red
- Borders: warm grey (`#ddd8cc`, `#c8c3b5`)

**Design philosophy:**
The interface should feel like a premium strategy document handed to you by a consultant — not a SaaS dashboard, not a content tool. Monospace gives it technical credibility. Serif gives it editorial weight. Every section should feel like it belongs in a strategy deck.

**Layout rules:**
- Sidebar: inputs only. Main area: output only. Never break this split.
- No modals, tabs, or navigation. Single-page, linear flow.
- Progress steps animate in real time during pipeline execution.
- Results are a scrollable document, not a set of cards.
- `#resultNav` is a fixed overlay element placed outside `#resultSection` — never move it inside the result container.

**Interaction patterns (Phase 15):**
- Result header always has a mode toggle button (`.mode-toggle-btn`) — Build mode / Strategist toggle
- Reasoning and research sections are collapsible by default (`.sec-closed`) — users expand what they need
- Build Mode collapses the entire UX to decision + execution: hiding `[data-layer="reasoning"]`, `[data-layer="research"]`, `[data-layer="debug"]` via CSS `.result-section.mode-build`
- The floating nav (`.result-nav`) shows on hover, hiding labels when not hovered. Only visible on viewports > 1100px.

**Quality test for new UI sections:**
Ask: does this help the user make a better strategic decision, or does it just add information? If the latter, cut it.

---

## 9. Fast Test Mode Philosophy

Fast Test Mode exists to iterate on classification and decision quality without burning API tokens on the full 7-step pipeline.

**What it runs:**
1. `classifyKeywordHeuristic(keyword)` — deterministic pre-classification
2. Step 4 (Asset Type Decision) with mock SERP/competitor data
3. `computeFastOpportunityScore()` — heuristic scoring, no API call
4. `computeCompetitiveMoat()` — client-side, using mock SERP data

**What it skips:** Steps 0, 1, 2 (SERP, competitive, keyword) and Steps 5, 6 (brief, quality score)

**What it renders:** Executive Summary + Strategic Recommendation + Why This Wins + Opportunity Analysis + Competitive Moat + Asset Type Decision + Asset Logic debug panel

**The Asset Logic debug panel (gold border) is fast test only.** It shows `strategic_role`, `interaction_model`, and `conversion_mechanism` from `ASSET_BEHAVIOR_MAP`. It is not rendered in full mode.

**Fallback behaviour in fast test mode:**
When Step 4 parsing fails, the fallback uses `fallbackRec` — an asset-type-specific lookup keyed by `fallbackCt` (from the heuristic match). Every type has specific `what_to_build`, `why_it_fits`, `business_impact`, and 3 `execution_steps`. Generic fallbacks are banned.

**Test the fast test mode first** when iterating on classification or asset type decision logic — it gives the same Step 4 result in a few seconds instead of ~40 seconds.

---

## 10. Context Management

**`PROJECT_CONTEXT.md` is the source of truth.** This file (`AGENTS.md`) is the operating protocol. They serve different purposes:

| File | Purpose |
|------|---------|
| `AGENTS.md` | Session startup protocol. How Codex should think and behave. |
| `PROJECT_CONTEXT.md` | Product and architecture reference. What the system does and how it works. |

**Update `PROJECT_CONTEXT.md` when you:**
- Add or remove a pipeline step
- Add a new asset type
- Change a JSON schema (prompt output or render input)
- Change `maxTokens` for any step
- Change the model
- Change the `setStep()` sequence
- Add a new module-level constant or helper function
- Reposition the product or add a new phase

**Do not update `PROJECT_CONTEXT.md` for:**
- Minor bug fixes
- Styling tweaks within existing CSS classes
- Copy improvements that don't change the schema
- Refactoring that preserves the exact same behaviour

**The update format in PROJECT_CONTEXT.md:**
Add to the phase history list, update the relevant section, update the last-updated timestamp line at the bottom.

---

## 11. Deployment Workflow

**Production URL:** `https://growth-asset-strategist.vercel.app`

**How deployment works:**
GitHub → Vercel auto-deploys on every push to `main`. No manual trigger.

**Deployment architecture:**
- `index.html` is served as a static file by Vercel
- `api/Codex.js` is the Vercel serverless function at `/api/Codex`
- `local-server.js` is NOT deployed — it is local dev only. Its presence was causing Vercel to treat the project as a Node.js server app until it was renamed from `server.js`
- `vercel.json` has `"framework": null` to prevent Vercel's auto-detection from mis-classifying the project

**Critical: never have a file named `server.js` in the repo root.** Vercel detects it and overrides all other config, treating the project as a Node.js HTTP server. The local proxy is `local-server.js` for this reason.

**Before every deploy:**
```bash
git status
# Verify: .env is NOT staged. node_modules is NOT staged.
git add -A
git commit -m "concise accurate message"
git push
```

**Environment variables:**
`ANTHROPIC_API_KEY` is set in Vercel dashboard → Project Settings → Environment Variables. It is never in the repo. `.env` is in `.gitignore`.

**Local dev:**
```bash
npm run start:local  # node local-server.js — direct proxy on port 3000
open http://localhost:3000
```
`npm run dev` (`vercel dev`) requires Vercel CLI authentication and is not part of the standard workflow. Use `start:local` instead.

**If the deploy fails:**
Read the Vercel build logs. Do not guess. The most common failure modes are:
1. `server.js` present at root (Vercel detects it as entrypoint — delete or rename)
2. Missing `ANTHROPIC_API_KEY` env var in Vercel dashboard
3. Syntax error in `api/Codex.js` (node function crash = "Serverless Function crashed")
4. Wrong routing config in `vercel.json`

---

## 12. Communication Style

When working in this project, Codex should behave like a senior SaaS product engineer who also thinks like a marketing strategist.

**Explain strategic reasoning, not just implementation steps.**
Don't just say "I added X". Say "I added X because Y is the failure mode we were solving for, and this is the minimal intervention that addresses it without touching Z."

**Call out trade-offs.**
If a change has a cost (tokens, rate limits, complexity, fragility), name it before implementing it.

**Flag product-direction risks.**
If a requested feature would weaken the strategic clarity of the product, say so. Propose an alternative that serves the real goal.

**Be precise about what changed.**
After any edit, state: what file, what function, what changed, what it does differently now. The user should not have to read the diff to understand the effect.

**Don't narrate tool use.**
Don't describe what you're about to do step by step as running commentary. Do the work, then explain what you did.

---

## 13. Code Quality Standards

**The quality bar for this codebase:**

- Every function should be readable without needing its context explained
- CSS classes should be reused, not reinvented — the stylesheet is deliberately lean
- Fallback objects must be specific, not generic — if a fallback could apply to any keyword, it is wrong
- Prompt text must be specific enough that a senior marketer would not rewrite it
- JSON field names must be consistent between the prompt that generates them and the render function that consumes them
- No bracket placeholders: `[Opening observation]`, `[Your Value Proposition]`, `[keyword]` are banned in any output string
- No console.log noise left in production code
- No TODO comments committed

**Banned phrases — anywhere in the codebase (prompts, fallbacks, UI copy):**
- "The Complete Guide to..."
- "Start with a compelling statistic or question"
- "Subscribe or contact us"
- "provide value" / "add more value"
- "be comprehensive" / "cover the topic thoroughly"
- "compelling hook" (describe the actual hook instead)
- "featured snippet" / "topical authority" / "drive traffic" / "increase visibility"
- "builds authority" / "aligns with intent" / "create engaging content"
- Any bracket placeholder like `[insert here]` or `[your CTA]`

---

## 14. Validation Checklist

Run this mentally before completing any session:

- [ ] Did I read `PROJECT_CONTEXT.md` before making changes?
- [ ] Did I read the relevant functions in `index.html` before editing them?
- [ ] Did the `STEPS` array and `setStep()` calls stay in sync?
- [ ] Did I run `node --check` or equivalent to verify there are no JS syntax errors?
- [ ] Did I use `extractJSON()` (not raw `JSON.parse()`) for any new Codex API response handling?
- [ ] Did I check for duplicate `const` declarations in the same scope?
- [ ] Did any new fallback strings contain banned phrases?
- [ ] Did any new UI section reuse existing CSS classes rather than invent new ones?
- [ ] Did I update `PROJECT_CONTEXT.md` for any major change?
- [ ] Is `.env` absent from any staged git files?
- [ ] Does the fetch URL in `index.html` use `/api/Codex` (not `localhost:3000`)?
- [ ] If I added a new result section, does it have the correct `data-section`, `data-label`, and `data-layer` attributes?
- [ ] If I added content that belongs to the reasoning layer, does it have `data-layer="reasoning"`?
- [ ] Does any new collapsible section follow the `sec-collapsible / sec-body / sec-body-inner` wrapper pattern?

**Test keywords for validating asset type selection:**
- `"project management software comparison"` → should produce `comparison_page`
- `"what is cost per acquisition"` → should produce `ai_visibility_asset`
- `"b2b saas lead generation checklist"` → should produce `lead_magnet`
- `"customer acquisition cost formula"` → should produce `tool_or_calculator`

---

## 15. Browser Testing Workflow

Codex can use the Chrome extension / browser control tools to inspect and test the live app directly. Use this capability to verify UI changes and catch issues before reporting them.

**Rules:**

1. Before making UI changes, inspect the current app state in Chrome when it helps confirm structure or current behaviour.
2. After UI changes, test the affected flow in Chrome.
3. Use `http://localhost:3000` for local testing (requires `npm run start:local` to be running).
4. Prefer **Fast Test Mode** for rapid validation — completes in seconds vs ~40 seconds for a full pipeline run.
5. Check browser console errors after any change (`read_console_messages` with `onlyErrors: true`).
6. Test these core flows when relevant to the change:
   - Homepage loads correctly
   - Fast Test Mode runs and renders a result
   - Full pipeline runs and renders a result
   - Execution Assets generate successfully
   - Per-block regen works
   - Inline editing works
   - Build Mode correctly hides/shows sections
   - Copy and export controls work
7. Do not make extra UI improvements beyond the requested task. If you find unrelated issues, report them — do not fix them silently.
8. Report all issues found before fixing anything unrelated to the current task.

**Scope boundary:** Browser testing is a verification tool, not a directive to self-improve the product without direction. Do not use browser access to autonomously iterate on the UI beyond the current task scope.

---

*This file is auto-loaded by Codex at session start. It is the operating protocol, not documentation. Update it when the workflow changes, not when the product changes — product changes go in `PROJECT_CONTEXT.md`.*

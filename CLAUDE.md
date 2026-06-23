# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Mat Plan** — a private, offline-first PWA for planning high-school wrestling duals (lineups,
weigh-ins, scoring). Built from `mat-plan-build-spec.md` (the authoritative product spec) and four
HTML mockups (`home-`, `roster-`, `plan-dual-`, `confirm-weights-mockup.html`) that define the visual
language. Plain HTML/CSS/JS — **no build step, no framework, no package manager, no tests.**

## Environment & commands

This machine has **no Node, npm, or Python** (Windows + PowerShell only). Do not reach for them.

- **Run the app:** `powershell -ExecutionPolicy Bypass -File tools/serve.ps1` then open
  `http://localhost:8181/`. (`tools/serve.ps1` is a dependency-free PowerShell static server; it also
  handles `POST /publish`. Port 8181 because 8123 is OS-reserved on this box.) The user normally
  launches via `Start Mat Plan.cmd` / the "Mat Plan" desktop shortcut.
- **A server must serve it** — service workers + IndexedDB don't work from a `file://` page.
- **Regenerate seed rosters** (after the source workbook changes):
  `powershell -ExecutionPolicy Bypass -File tools/build-seed.ps1` → rewrites `js/seed.js` from the
  ROSTERS sheet of `C:\Users\david\OneDrive\Documents\Wrestling Scouting.xlsx`.
- Verify changes with the `Claude_Preview` MCP tools against the running server. The screenshot tool
  often times out once the service worker controls the page; prefer `preview_eval` (DOM/state reads)
  to verify behavior — it's reliable.

## ⚠️ Bump the service worker cache on EVERY file change

`service-worker.js` precaches the app shell (`CACHE = 'matplan-vN'`). If you edit any HTML/CSS/JS and
**do not** increment that version string, returning devices keep serving the old cached files — this
looks like "my change isn't showing up" or "mobile is broken but desktop works." Always bump `vN`
when you change shipped files.

## Architecture

Classic (non-module) scripts attach to a single global `window.MP`. **Load order matters** and is
fixed in `index.html`: `util → db → seed → store → sync → views/* → router → app`.

- `js/util.js` — constants (`WEIGHTS`, `RATINGS`, `OUTCOMES`) and **all pure domain logic**:
  `computeOrder` (wrestling order + who-reports-first), `isEligible` (bump-up rule), `weightResult` /
  `scoreScenario` (scoring + auto-forfeit), `tierForRating`, helpers. Domain rule changes usually start here.
- `js/db.js` — persistence. The **entire app state is one IndexedDB record** (localStorage fallback).
  Data is **per-device, per-origin** — there is no shared server DB.
- `js/store.js` — in-memory state + all mutations + the change log. Mutations call a debounced
  `persist()`. Also owns `applySeed`, `importSnapshot`/`markPublished` (sync), and selectors.
- `js/seed.js` — auto-generated baseline rosters (see build-seed.ps1). Applied **first-run only**
  (empty device, no `seedTag`) and is **non-destructive** — never wipes an in-use device.
- `js/sync.js` — lightweight one-way publish/pull (no backend); see "Sync model" below.
- `js/router.js` — hash router (`#/home`, `#/roster/:id`, `#/dual/:id`, `#/dual/:id/confirm`).
  `MP.rerender()` repaints the current route. Plan Dual and Confirm Weights repaint **in place**
  (their own `paint()` fns) to avoid scroll jumps; other views use full `MP.rerender()`.
- `js/views/{home,roster,planDual,confirmWeights}.js` — each exports `MP.views.X.render(root, params)`,
  builds `innerHTML`, then wires listeners (no inline handlers).

### Data model (the persisted blob)
`{ teams[], wrestlers[], duals[], settings:{ourTeamId}, changeLog[], seedTag, lastPulledAt }`
- A **wrestler's weight** is either `{type:'range', min, max}` or `{type:'confirmed', class}`; plus an
  `out` flag (roster-level scratch). Seeded wrestlers come in as point ranges (`min===max`).
- A **Dual** holds `ourTeamId/oppTeamId`, `startWeight`, `coinCall`, `weighedIn`, per-dual `scratched[]`,
  and multiple **scenarios** (`{name, picks:{ [weight]: {our, their, outcome, key} }}`). Score is
  **always derived**, never stored.

## Domain rules that aren't obvious (verify against `mat-plan-build-spec.md`)

- **Eligibility / bump-up** (`isEligible`): a wrestler is selectable at their weight **or one class
  above** — for both confirmed weights and ranges (one class above the range max).
- **Scoring** (`weightResult`): the outcome dropdown is always selectable. An explicit prediction wins;
  if it's left "No prediction" and exactly one side has a wrestler, it **auto-forfeits 6 pts** to the
  present side (overridable by picking any outcome). Standard NFHS points: Dec 3 / Major 4 / Tech 5 / Pin 6.
- **Confirm Weights screen** operates on the **opponent** (`d.oppTeamId`), not our team. Our team's
  weights/scratches are managed on its **roster** screen (lock / reopen / scratch buttons).
- **Coin toss**: by *position* in the wrestling order, not raw weight class. "odds" → we report first
  on odd positions.

## Sync model (desktop → phone, one-way, no backend)

Desktop is the master. **Publish** (`MP.sync.publish`) snapshots state and `POST`s it to the local
server's `/publish`, which `serve.ps1` writes to `matplan-data.json` in the project folder (falls back
to a browser download if there's no such endpoint, e.g. on a static host). Deploy the folder to a host;
any device **Pulls** (`MP.sync.pull`) that file to replace its own copy. Pull is always explicit
(confirms first); a launch-time banner only *offers* to pull when the published `publishedAt` is newer
than this device's `lastPulledAt`. The service worker serves `matplan-data.json` **network-first** so
pulls are never stale. True two-way sync + auth is a deliberately deferred future phase.

## Notes

- `tools/*.ps1`, `.claude/launch.json`, `Start Mat Plan.cmd`, and the `*-mockup.html` files are dev/
  reference assets, not part of the shipped app. `matplan-data.json`, if present, is a published
  snapshot (regenerated by Publish) — not source.

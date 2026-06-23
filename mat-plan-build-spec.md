# Mat Plan — Build Spec

A private wrestling dual-planning and strategy tool. Owner (head coach) + 1–2 assistant coaches.
Not a public product — built for personal/team use, shared via a simple link, no app store distribution.

---

## 1. Purpose

Replace an Excel-based scouting/dual-planning workflow with a tool that:
- Works fully offline on mobile (poor signal at away meets/tournaments)
- Allows fast bulk roster entry on desktop
- Lets coaches build and compare multiple lineup "what-if" scenarios per dual
- Calculates dual score automatically from per-weight outcome predictions
- Handles wrestling-specific mechanics: weight ranges, weigh-ins, the bump-up rule, and coin-toss reporting order

**Explicitly out of scope:** season-long match history/win-loss records, year-over-year trend tracking, predictive/regression projections. This is a planning tool, not a stats-archive tool.

---

## 2. Data model

**Wrestler**
- `name`
- `grade` (9–12)
- `weightRange` — `{min, max}` while unconfirmed for a given dual, OR a single confirmed class once weighed in (see §4)
- `rating` — one of `1, 1.5, 2, ... 6` or the string `"?"`. Free-text entry/display, including informal tentative notation like `"4?"`. No separate confidence flag.
- `team` (reference to Team)
- `notes` (free text)

**Team**
- `name`
- roster = list of Wrestlers

**Dual**
- two Teams (ours + opponent)
- `date`
- `startingWeightClass` (one of the standard 14)
- `coinTossCall` — `"odds"` or `"evens"` (which positions in the wrestling order *our* team reports first)
- `status` — e.g. Planning / Weighed-in (for the Home screen status pill)
- list of attending Wrestlers for this dual + scratch status (see §5)
- one or more Lineup Scenarios

**Lineup Scenario** (multiple per Dual)
- `name`
- per weight class: `{ ourWrestler, theirWrestler, outcomeType, isKeyMatch }`
- `outcomeType` — one of: Decision (3 pts), Major Decision (4 pts), Tech Fall (5 pts), Pin/Forfeit/Default/DQ (6 pts) — plus which side won
- total score is **derived**, not stored — computed live from the per-weight outcomes

No "Match Result" entity — this app does not record what actually happened after the dual is wrestled.

---

## 3. Weight classes

Fixed standard set of 14, always: **106, 113, 120, 126, 132, 138, 144, 150, 157, 165, 175, 190, 215, 285**. Not configurable.

---

## 4. Rating system

- Scale: **1–6 in 0.5 increments**, or **`?`** meaning insufficient data.
- New wrestlers always default to `?`.
- Input UI: a dropdown listing `?, 1, 1.5, 2, ... 6` (preferred for speed/no typos on mobile) — a free validated text box is an acceptable alternative/addition on desktop.
- No separate "confidence" flag — informal uncertainty (e.g. "probably a 4") is just typed into the value or notes as free text, same as the old spreadsheet.
- Key reference (from the program's actual scouting key):

| Value | Meaning |
|---|---|
| `?` | Insufficient data |
| 1 | Low/mid level JV |
| 2 | Strong JV |
| 3 | Varsity level |
| 4 | State qualifier level |
| 5 | State placer level |
| 6 | State champ level |

- **Ratings are a single shared field on the Wrestler record.** Editing it from any screen (roster grid, lineup builder, anywhere) updates that one value everywhere it's referenced — no per-screen duplication.

---

## 5. Weight ranges, weigh-ins, and the bump-up rule

This is the most wrestling-specific piece of the data model:

1. **Default state:** each wrestler has a `weightRange {min, max}` (e.g. 138–150) on their roster record — not a single fixed weight class — because actual fight-week weight is hard to predict.
2. **Pre-weigh-in dual planning:** lineup scenarios can be built against this range as a best guess, before the actual weigh-in happens.
3. **Scratching:** for any given dual, a coach can mark a wrestler as **scratched** (not attending/not wrestling that dual) without removing them from the roster. Scratched wrestlers are excluded from weigh-in confirmation and from progress counts for that dual.
4. **Confirm Weights workflow (per dual, per wrestler):**
   - UI is a **dropdown of all 14 standard weight classes** (not limited to the wrestler's estimated range — the range itself can be wrong) — not a free-text/number entry.
   - Confirming **collapses the range into a single fixed class** for that wrestler going forward — it is no longer a range. ("Roster now set to 144, no longer a range.")
   - The coach/owner can manually reopen and re-widen it back into a range at any time before the next dual if more uncertainty is expected.
5. **Bump-up rule:** once a wrestler has a confirmed class for a dual, they are eligible to wrestle **at their confirmed class, or the one standard class above it** — never below, never further above.
6. **Lineup screen eligibility, concretely:**
   - **Before weigh-in:** any wrestler whose `weightRange` overlaps a given weight class is selectable for that slot.
   - **After weigh-in confirmation:** selectable options for a weight class narrow to wrestlers confirmed at that exact class, or confirmed one class below (i.e. eligible to bump up into this slot).
7. This entire flow (scratching, confirming, viewing/using confirmed weights in the lineup) must work **fully offline** — weigh-ins happen at the scale, not at a desk with signal.

---

## 6. Wrestling order & coin-toss reporting

1. **Starting weight class is per-dual, not fixed at 106.** In a tournament with multiple dual rounds, a starting weight is drawn once at the start of the tournament ("stick pull"), then advances by one weight class each subsequent round, wrapping after 285 back to 106.
2. **Wrestling order for a dual** = all 14 classes in sequence starting from that dual's `startingWeightClass`, wrapping around.
3. **Reporting order (who commits a wrestler first at each weight) is determined by a coin toss:** the winner calls "odds" or "evens." This determines, by *position number* in the wrestling order (1st, 2nd, 3rd weight wrestled, etc.) — not by raw weight class number — which team must commit/report their wrestler first.
4. **Strategic meaning:** whichever team reports *second* at a given weight sees the opponent's pick before committing their own — an information advantage. The app should make this visible per weight class (e.g. visually flag "we report first" vs "they report first / we see their pick first").
5. **Now-phase:** two dropdowns (starting weight class, odds/evens call) drive a live-calculated order + per-weight report-first flag.
6. **Future phase (not built now):** an algorithm/ML-assisted suggestion for which to call (odds vs. evens) based on both rosters. Leave a clearly disabled/placeholder control for this.

---

## 7. Scoring

Standard NFHS dual-meet scoring, confirmed correct for this team's league:

| Outcome | Points |
|---|---|
| Decision | 3 |
| Major Decision | 4 |
| Tech Fall | 5 |
| Pin / Forfeit / Injury Default / DQ | 6 |

A Lineup Scenario's total score for each side is the sum of points from whichever side won each weight class's predicted outcome. This must recalculate live as picks change.

---

## 8. Permissions

Two roles, but they now have **equal edit access** — both can fully edit rosters, ratings, and lineup scenarios. The only meaningful difference is administrative: the **Owner** (head coach) is the one who can invite/remove coaches from the app. **Coaches** (1–2 assistants) have full edit rights everywhere once invited.

Small trusted group — no need for enterprise-grade user management. A simple invite link with role assignment is sufficient; no formal sign-up flow required.

**Conflict handling:** last-write-wins is acceptable for this scale of use. Keep a lightweight change log so edits aren't silently lost without any trace, but a full merge-conflict UI is unnecessary.

---

## 9. Sync & offline architecture

- **Offline-first.** The app must be fully usable with zero network connectivity on mobile — roster viewing, weigh-in confirmation, lineup building, scoring, everything.
- Local persistent storage on-device; background sync to a shared store whenever connectivity is available.
- Desktop and mobile are the same underlying app/data, different UI density — not separate codebases with separate data.
- Recommended platform shape: a **Progressive Web App (PWA)** — installable on mobile home screens, runs in any desktop browser, no app-store distribution needed, shareable via a plain link to the 1–2 coaches who need it.

---

## 10. Desktop vs. mobile split

- **Desktop strengths:** bulk roster intake via paste-and-review (see §11), broader filtering/sorting, more comfortable data entry.
- **Mobile strengths:** at-the-meet workflows — confirming weigh-ins, scratching wrestlers, shuffling lineup scenarios, flagging key matches, live score tracking — all touch-friendly and offline-capable.
- Same data, same permissions, same screens conceptually — mobile is a denser/condensed layout, not a different feature set.

---

## 11. Roster intake (paste-and-review)

Reality check from the team's actual workflow: rosters are pulled from Trackwrestling and other sources, often messy (ineligible wrestlers mixed in, inconsistent formatting). **Do not build a fully automatic importer.** Instead:

1. Paste a block of text into a staging area.
2. The app makes a best-effort attempt to split it into rows (name + weight, where detectable).
3. Staged rows are fully editable/deletable *before* committing.
4. Nothing writes to the real roster until the coach explicitly commits.
5. Manual single-row add/edit must always remain available as the primary path — paste is a convenience, not the only way in.

---

## 12. Screens

Five core screens. Interactive HTML mockups already built and approved for the first four — use them as the literal reference for layout, color system, and component behavior (dark theme, Oswald/Inter/JetBrains Mono type system, amber accent, tier-colored rating badges, green/red "us/them" semantics). Files: `roster-mockup.html`, `plan-dual-mockup.html` (combined setup + lineup builder), `confirm-weights-mockup.html`, `home-mockup.html`.

### A. Home
- Two sections: **Duals** and **Rosters**, each with a "+ New" action that expands an inline form (no separate page/modal).
- Dual cards show matchup, date, and a status pill (Planning / Weighed-in). Tapping a dual opens screen C for that dual.
- Roster cards show team name + wrestler count. Tapping opens screen B for that team.

### B. Roster
- Team selector at top.
- Filter bar: grade, weight class, rating.
- Table (collapses to stacked cards on mobile): Name, Grade, Weight Range, Rating, Notes.
- Any cell editable inline — Owner and Coaches both have full edit access here.
- "Add wrestler" (blank row) and "Paste roster" (staging flow per §11) actions.

### C. Plan Dual (combined setup + lineup scenario builder)
- Scenario tabs/chips across the top (switch between saved scenarios; "+ New scenario").
- Starting weight class + coin-toss call dropdowns, always editable, recalculating order/report-first live even while shuffling lineups.
- One card per weight class (in calculated wrestling order, not always 106→285), each showing:
  - report-first tag (color-coded: we report first / they report first)
  - our wrestler dropdown + their wrestler dropdown, each showing **grade and a tier-colored rating chip** next to the selected name
  - outcome dropdown (combined winner + match-type, e.g. "We win — Tech Fall") with live point value
  - a ★ toggle to flag a key match
- Sticky bottom score bar (Us vs. Them), always visible, live-updating.
- Wrestler eligibility per slot follows §5.6 (range-based pre-weigh-in, confirmed-class-or-one-up post-weigh-in).

### D. Confirm Weights
- List of the dual's roster. Each unconfirmed wrestler shows their current range plus:
  - a **dropdown of all 14 standard weight classes** (not range-limited — see §5.4) + "Confirm" button
  - a "Scratch" button to mark them out for this dual (reversible)
- Confirmed wrestlers show a checkmark, their locked class, their bump-up-eligible class, and an "edit" link to reopen.
- Scratched wrestlers show muted/grayed with an "Undo" link; excluded from progress counts.
- Progress bar + bottom sticky button: **"Go to dual →"** — navigates into screen C for this same dual, now in final-analysis mode (confirmed classes + bump rule applied to eligibility).

### E. (Implicit) Permission-aware rendering
Not a separate screen, but a cross-cutting behavior: Owner and Coaches share full edit access everywhere per §8. The only role-gated action in the app is inviting/removing coaches, which stays Owner-only.

---

## 13. Open implementation questions (flag to resolve during/after first build)

- Exact UX for "edit" on a confirmed weigh-in: does it restore the previous range, or just let the coach re-pick a class from a blank state?
- Multi-team paste blocks (pasting several teams' worth of names at once) vs. always one team at a time — current assumption is one team at a time, manual cleanup expected either way.
- Any desktop-specific affordance for comparing scenarios side-by-side (mobile intentionally does not need this — scenario switching via tabs is sufficient there).

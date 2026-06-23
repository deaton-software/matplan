# Mat Plan

A private, offline-first wrestling **dual-planning and lineup-strategy** tool — built from
[`mat-plan-build-spec.md`](mat-plan-build-spec.md) and the approved HTML mockups. Plain
HTML/CSS/JS, no build step, installable as a PWA.

## Running it

Service workers and IndexedDB require the app to be **served over http (localhost)** — opening
`index.html` directly as a `file://` won't work. This machine has no Node or Python, so a tiny
dependency-free PowerShell server is included:

```powershell
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open **http://localhost:8181/**. (Pass `-Port 9000` to change the port.)

To install on a phone: serve it on your network / a static host (Netlify, GitHub Pages, etc.),
open in mobile Chrome/Safari, and "Add to Home Screen." Any static host works — it's just files.

## What's here

| Screen | File | Spec |
|---|---|---|
| Home (duals + rosters) | `js/views/home.js` | §12.A |
| Roster (table / paste intake) | `js/views/roster.js` | §12.B, §11 |
| Plan Dual (setup + lineup builder) | `js/views/planDual.js` | §12.C, §6, §7 |
| Confirm Weights | `js/views/confirmWeights.js` | §12.D, §5 |

Supporting code:

- `js/util.js` — weight classes, outcomes, rating tiers, wrestling-order + eligibility + scoring logic
- `js/store.js` — app state, mutations, lightweight change log (§8)
- `js/db.js` — IndexedDB persistence (single-blob; localStorage fallback)
- `js/router.js` — hash router (`#/home`, `#/roster/:id`, `#/dual/:id`, `#/dual/:id/confirm`)
- `css/styles.css` — design system unified from the mockups
- `manifest.webmanifest`, `service-worker.js`, `icons/` — PWA shell (offline + installable)

## Implemented (this phase)

- All four screens, fully wired and navigable; data **persists on-device** and works **offline**.
- Weight **ranges → confirmed class** at weigh-in (permanent collapse on the roster record),
  reopenable to the prior range. **Bump-up rule** (confirmed class or one up) and **scratching**
  drive lineup eligibility; the lineup flips to "final-analysis" eligibility once weighed in.
- Wrestling **order** from a per-dual starting class (wraps after 285) with live **report-first**
  flags from the coin-toss call (§6).
- **Scoring**: unset weight = 0; empty slot = auto 6-pt forfeit; standard NFHS points otherwise,
  recalculated live with a sticky Us/Them bar. Multiple **lineup scenarios** per dual.
- **Paste-and-review** roster intake (best-effort split, editable staging, explicit commit).
- Tier-colored rating badges; ratings are a single shared field reflected everywhere.

## Seeded rosters

On first run the app loads five rosters parsed from `Wrestling Scouting.xlsx` (the ROSTERS sheet):
**Wesleyan** (our team) plus opponents **Mt. Pisgah, Mount Vernon, Fellowship, St. Francis** — no
duals. This is a one-time seed gated by `MP.SEED.tag` in `js/seed.js`; bumping that tag re-applies
it (replacing rosters and clearing duals). Regenerate the seed from the workbook with:

```powershell
powershell -ExecutionPolicy Bypass -File tools/build-seed.ps1
```

Each wrestler's single listed weight becomes a point range (e.g. 138–138) you can widen on the
roster screen. Informal ratings from the sheet (e.g. `4?`) are preserved.

## Desktop → phone (Publish / Pull)

The desktop is the master copy; the phone (or any device) pulls from it. One-way, no backend.

1. **Edit on desktop** — add/change rosters *and* duals right in the app.
2. **Publish for phone** (Home screen button) — snapshots all data. If you're running via the local
   server it writes `matplan-data.json` into the project folder; otherwise it downloads that file
   (drop it into the project folder).
3. **Deploy** — re-upload the folder to your web host so `matplan-data.json` is live.
4. **Pull latest from desktop** (Home screen button on the phone) — fetches the snapshot and replaces
   that device's data with it. On launch, if a newer snapshot exists, a banner offers to pull.

Between pulls every device works and saves normally — nothing auto-resets. Pulling is the only thing
that overwrites local data (it asks first). A brand-new device auto-seeds the bundled rosters so it's
never blank before its first pull. Two-way sync (phone edits flowing back to desktop) would require
the cloud-backend phase.

## Deferred to a later phase (per spec §8–9)

- **Cloud sync + invite links + roles.** Today the app is local to one device. The data layer
  (single-blob store, change log) is shaped so a sync backend can drop in. Until then, the
  Owner/Coach role gating and multi-coach sharing are not active.
- Algorithm-assisted odds/evens suggestion (§6.6) — intentionally absent for now.
- Desktop side-by-side scenario comparison (§13) — scenario chips only, as specced.

## Notes

- The four `*-mockup.html` files are the visual reference. (`dual-setup-mockup.html` was antiquated
  and has been deleted — its controls live inside Plan Dual.)
- `tools/serve.ps1`, `tools/build-seed.ps1`, and `.claude/launch.json` are dev helpers, not part of
  the app itself.

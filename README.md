# Mat Plan

A private, offline-first **wrestling dual-planning** app for high-school coaches — build lineups,
handle weigh-ins, and score lineup scenarios before a dual. Install it once and it runs like an app
on your phone and computer, even offline.

**Open it here:** https://deaton-software.github.io/matplan/

---

## Install it (phone or desktop)
1. Open **https://deaton-software.github.io/matplan/** in Chrome or Safari.
2. **Add to Home Screen** (phone) or install from the address-bar icon (desktop).
3. It now runs like an app and works **offline** — all data is stored on that device.

## The screens
| Screen | What it does |
|---|---|
| **Home** | Your duals and rosters; create new ones; Publish / Pull. |
| **Roster** | A team's wrestlers — edit names, grades, weights, and ratings; paste a roster in bulk; sort, scratch, and confirm weigh-in weights. |
| **Plan Dual** | Pick the starting weight and coin call, build the lineup across all 14 classes, and watch the live Us/Them score. Save multiple **scenarios** per dual. |
| **Confirm Weights** | Lock wrestlers to their weighed-in class. |

Everything you type saves automatically and updates that wrestler everywhere they appear.

---

## Sharing data between devices (Publish / Pull)

Your phone and computer don't talk to each other directly — they share one published copy of the
data. Syncing is always a deliberate tap:

- **⤴ Publish** (Home) sends everything on this device up to the shared copy. One tap, instant.
- **⟳ Pull** (Home) replaces this device's rosters and duals with the latest published copy. It
  asks first, and a banner offers to pull on launch when a newer version exists.

Between syncs, each device works and saves on its own — nothing resets on you.

### One-time setup for publishing
**Pulling needs nothing.** Publishing needs a key, set once per device:

1. On a device that will Publish, open **⚙ Sync setup** on the Home screen.
2. Paste the shared access token (ask David for it) and **Save**.
3. The token stays on that device only. Publish is now enabled.

The same token works for everyone, so any coach can Publish from their own device.

> **One driver at a time:** there's no merging — if two people Publish, the later one wins and
> overwrites the earlier. Pull before you start editing so you're working from the latest.

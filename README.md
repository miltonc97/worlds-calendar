# Worlds spoiler-safe calendar

A League of Legends Worlds calendar (`.ics`) like [zlypher/lol-events](https://github.com/zlypher/lol-events), but with scores — and a spoiler block for late-night games.

**Rule:** a match that finishes at or after **23:00** (Europe/Stockholm) has its result hidden until **19:00** the next day. A 01:30 finish counts as the previous evening, so it also reveals at 19:00 that same day.

Hiding the score alone isn't enough at Worlds: Swiss pairings and bracket matchups give away who won. So any matchup that was published *after* a hidden result finished is shown as `🙈 vs 🙈` until that result is revealed. Hidden matches also keep their scheduled length, so the event duration can't tell you it was a 2-0.

The block only applies to matches finishing before `BLOCK_UNTIL_DATE` (default `2026-11-02`). After that, everything shows as normal.

| In your calendar | Meaning |
| --- | --- |
| `(Group Stage) Round 3: T1 2–1 GEN` | Finished, result shown |
| `(Group Stage) Round 3: DK vs MKOI 🙈` | Finished late, result hidden (description says until when) |
| `(Group Stage) Round 4: 🙈 vs 🙈` | Pairing would spoil a hidden result |
| `(Group Stage) Round 4: TBD vs TBD` | Not decided yet |

## Setup (≈10 minutes)

1. **Get a PandaScore token** (free): sign up at <https://app.pandascore.co> and copy your access token.
2. **Create a GitHub repo** (public, so Pages and Actions minutes are free) and push this folder to `main`.
3. **Add the token:** Settings → Secrets and variables → Actions → New repository secret → `PANDASCORE_TOKEN`.
4. **Allow the workflow to push:** Settings → Actions → General → Workflow permissions → *Read and write*.
5. **Run it once:** Actions → *Update Worlds calendar* → *Run workflow*. This creates `docs/worlds.ics`.
6. **Turn on Pages:** Settings → Pages → Deploy from a branch → `main` / `/docs`.
7. **Subscribe** to `https://<your-user>.github.io/<repo>/worlds.ics`.

The workflow then runs hourly (at :05), so the 18:05 UTC run is what reveals results at 19:00 CET.

### Which calendar app

Google Calendar only re-fetches subscribed calendars every 12–24 hours and ignores the refresh hint, so scores and reveals will lag a lot there. Apple Calendar lets you pick "Every hour" (or 15 min) per subscription, which suits this much better. Lag never leaks spoilers — an older copy always shows *less*, never more.

## Settings

Override via repository *Variables* (Settings → Secrets and variables → Actions → Variables):

| Variable | Default | |
| --- | --- | --- |
| `BLOCK_UNTIL_DATE` | `2026-11-02` | Stop blocking for matches finishing on/after this local date. Empty = always block. |
| `LATE_FINISH_HOUR` | `23` | Finishes from this hour until noon are "late". |
| `REVEAL_HOUR` | `19` | Local hour the next day when late results appear. |

Time zone defaults to `Europe/Stockholm` (`TIME_ZONE` env var in `src/config.ts`).

## Local development

Needs Node 24 (or 22.18+); no dependencies.

```sh
npm test
PANDASCORE_TOKEN=... npm run build      # writes docs/worlds.ics and state/known-matchups.json
FIXTURE=saved.json NOW=2026-10-26T09:00:00Z npm run build   # offline / time travel
```

`state/known-matchups.json` records when each pairing first appeared; it's committed by the workflow and is what lets the calendar tell "known before the late game" apart from "revealed by the late game".

Data from [PandaScore](https://pandascore.co/).

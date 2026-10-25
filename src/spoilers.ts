import type { Config } from "./config.ts";
import { addDays, toLocalParts, zonedToUtc } from "./time.ts";
import type { KnownMatchups, MatchView, PandaScoreMatch } from "./types.ts";

type SpoilerConfig = Pick<
    Config,
    "timeZone" | "lateFinishHour" | "revealHour" | "blockUntilDate"
>;

/**
 * If a match that finished at `endAt` is a "late" one, return when its result
 * may be shown. Otherwise null (show immediately).
 *
 * Late = finished between `lateFinishHour` (23:00) and noon local time.
 * The reveal is `revealHour` (19:00) on the day after the evening it belongs to,
 * so a 23:40 finish and a 02:10 finish on the same night both reveal at 19:00
 * on the next calendar day after that evening.
 */
export function revealTimeFor(endAt: Date, cfg: SpoilerConfig): Date | null {
    const local = toLocalParts(endAt, cfg.timeZone);

    if (cfg.blockUntilDate) {
        const [y, m, d] = cfg.blockUntilDate.split("-").map(Number);
        if (endAt >= zonedToUtc(y, m, d, 0, 0, cfg.timeZone)) return null;
    }

    const isLate = local.hour >= cfg.lateFinishHour || local.hour < 12;
    if (!isLate) return null;

    // The "evening" a post-midnight finish belongs to is the previous day.
    const evening =
        local.hour < 12
            ? addDays(local.year, local.month, local.day, -1)
            : { year: local.year, month: local.month, day: local.day };
    const next = addDays(evening.year, evening.month, evening.day, 1);
    return zonedToUtc(next.year, next.month, next.day, cfg.revealHour, 0, cfg.timeZone);
}

/** Stable key for "who plays in this match"; empty while it's still TBD. */
export function teamsKey(match: PandaScoreMatch): string {
    const ids = match.opponents.map((o) => o.opponent.id);
    return ids.length === 2 ? [...ids].sort((a, b) => a - b).join("-") : "";
}

function roundKey(match: PandaScoreMatch): string {
    const idx = match.name.indexOf(":");
    const round = idx > 0 ? match.name.slice(0, idx).trim() : `match-${match.id}`;
    return `${match.tournament?.name ?? ""}|${round}`;
}

/**
 * Record when each pairing first became known. A pairing that changes
 * (e.g. TBD -> teams, or a correction) gets a fresh timestamp.
 */
export function updateKnownMatchups(
    matches: PandaScoreMatch[],
    known: KnownMatchups,
    now: Date,
): KnownMatchups {
    // Pairings for a round ("Round 3", "Quarterfinal 1", ...) are public by the
    // time that round's first match starts. This matters on the very first run,
    // when there's no history and everything would otherwise look brand new.
    const roundStart = new Map<string, number>();
    for (const m of matches) {
        if (!m.begin_at || Date.parse(m.begin_at) >= now.getTime()) continue;
        const key = roundKey(m);
        const t = Date.parse(m.begin_at);
        roundStart.set(key, Math.min(t, roundStart.get(key) ?? t));
    }

    const next: KnownMatchups = { ...known };
    for (const m of matches) {
        const key = teamsKey(m);
        if (!key) {
            delete next[m.id];
            continue;
        }
        if (next[m.id]?.teams !== key) {
            const start = roundStart.get(roundKey(m));
            const knownAt = start !== undefined ? new Date(start) : now;
            next[m.id] = { teams: key, knownAt: knownAt.toISOString() };
        }
    }
    return next;
}

function endOf(match: PandaScoreMatch, now: Date): Date {
    // A finished match without end_at is treated as having just ended (safe side).
    return match.end_at ? new Date(match.end_at) : now;
}

/**
 * Decide what to hide for every match at time `now`.
 *
 * 1. A finished match whose end was "late" hides its result until its reveal time.
 * 2. Any match whose pairing was first published after a still-hidden match
 *    ended hides its teams (and result) too, because in Swiss and in the
 *    bracket the pairing itself tells you who won.
 */
export function applySpoilerRules(
    matches: PandaScoreMatch[],
    known: KnownMatchups,
    now: Date,
    cfg: SpoilerConfig,
): MatchView[] {
    const blocks: { id: number; endAt: Date; revealAt: Date }[] = [];
    for (const m of matches) {
        if (m.status !== "finished") continue;
        const endAt = endOf(m, now);
        const revealAt = revealTimeFor(endAt, cfg);
        if (revealAt && revealAt > now) blocks.push({ id: m.id, endAt, revealAt });
    }

    return matches.map((match) => {
        const ownBlock = blocks.find((b) => b.id === match.id);
        const knownAt = known[match.id]?.knownAt;

        let teamsReveal: Date | null = null;
        if (knownAt) {
            const known = new Date(knownAt);
            for (const b of blocks) {
                if (b.id !== match.id && b.endAt <= known) {
                    if (!teamsReveal || b.revealAt > teamsReveal) teamsReveal = b.revealAt;
                }
            }
        }

        const teamsHidden = teamsReveal !== null;
        const resultHidden =
            match.status === "finished" && (ownBlock !== undefined || teamsHidden);
        const candidates = [ownBlock?.revealAt, teamsReveal].filter(
            (d): d is Date => d instanceof Date,
        );
        const revealAt = candidates.length
            ? new Date(Math.max(...candidates.map((d) => d.getTime())))
            : null;

        return { match, resultHidden, teamsHidden, revealAt };
    });
}

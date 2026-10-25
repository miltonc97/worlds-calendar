import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCalendar } from "../src/ics.ts";
import {
    applySpoilerRules,
    revealTimeFor,
    updateKnownMatchups,
} from "../src/spoilers.ts";
import type { PandaScoreMatch } from "../src/types.ts";

const cfg = {
    timeZone: "Europe/Stockholm",
    lateFinishHour: 23,
    revealHour: 19,
    blockUntilDate: "2026-11-02",
};

const iso = (s: string) => new Date(s).toISOString();

function match(
    id: number,
    name: string,
    status: string,
    begin: string,
    end: string | null,
    teams: [number, string][] = [],
    scores: number[] = [],
): PandaScoreMatch {
    return {
        id,
        name,
        status,
        begin_at: iso(begin),
        end_at: end ? iso(end) : null,
        number_of_games: 1,
        opponents: teams.map(([tid, acr]) => ({
            type: "Team",
            opponent: { id: tid, name: acr, acronym: acr },
        })),
        results: teams.map(([tid], i) => ({ team_id: tid, score: scores[i] ?? 0 })),
        winner_id: scores.length ? teams[scores[0] > scores[1] ? 0 : 1][0] : null,
        tournament: { name: "Group Stage" },
    };
}

test("finish before 23:00 local is not blocked", () => {
    // 21:59 UTC = 22:59 CET
    assert.equal(revealTimeFor(new Date("2026-10-26T21:59:00Z"), cfg), null);
});

test("finish at 23:00 CET reveals 19:00 CET next day", () => {
    const r = revealTimeFor(new Date("2026-10-26T22:00:00Z"), cfg);
    assert.equal(r?.toISOString(), "2026-10-27T18:00:00.000Z");
});

test("after-midnight finish reveals 19:00 the same calendar day", () => {
    // 01:30 CET on Oct 27 belongs to the evening of Oct 26
    const r = revealTimeFor(new Date("2026-10-27T00:30:00Z"), cfg);
    assert.equal(r?.toISOString(), "2026-10-27T18:00:00.000Z");
});

test("handles the CEST->CET switch on 25 Oct", () => {
    // 00:21 UTC on Oct 25 = 02:21 CEST (before the switch); reveal 19:00 CET = 18:00 UTC
    const r = revealTimeFor(new Date("2026-10-25T00:21:00Z"), cfg);
    assert.equal(r?.toISOString(), "2026-10-25T18:00:00.000Z");
});

test("nothing is blocked from BLOCK_UNTIL_DATE onwards", () => {
    // QF on 3 Nov ending 02:00 CET
    assert.equal(revealTimeFor(new Date("2026-11-04T01:00:00Z"), cfg), null);
});

test("late result hidden, early result shown, then revealed at 19:00", () => {
    const early = match(1, "Round 3: TES vs G2", "finished",
        "2026-10-25T17:00:00Z", "2026-10-25T17:40:00Z", [[10, "TES"], [11, "G2"]], [1, 0]);
    const late = match(2, "Round 3: DK vs MKOI", "finished",
        "2026-10-25T22:00:00Z", "2026-10-25T22:45:00Z", [[12, "DK"], [13, "MKOI"]], [0, 1]);
    const known = updateKnownMatchups([early, late], {}, new Date("2026-10-24T12:00:00Z"));

    const at = (now: string) =>
        applySpoilerRules([early, late], known, new Date(now), cfg);

    const morning = at("2026-10-26T08:00:00Z");
    assert.equal(morning[0].resultHidden, false);
    assert.equal(morning[1].resultHidden, true);
    assert.equal(morning[1].teamsHidden, false); // pairing was known beforehand

    const evening = at("2026-10-26T18:00:00Z");
    assert.equal(evening[1].resultHidden, false);
});

test("pairings published after a hidden result are masked too", () => {
    const late = match(2, "Round 3: DK vs MKOI", "finished",
        "2026-10-25T22:00:00Z", "2026-10-25T22:45:00Z", [[12, "DK"], [13, "MKOI"]], [0, 1]);
    const r4 = match(3, "Round 4: MKOI vs T1", "not_started",
        "2026-10-28T20:00:00Z", null, [[13, "MKOI"], [14, "T1"]]);
    const r4Tbd = { ...r4, opponents: [] };

    // Pairing known on the 24th as TBD, then filled in at 02:00 UTC on the 26th
    let known = updateKnownMatchups([late, r4Tbd], {}, new Date("2026-10-24T12:00:00Z"));
    known = updateKnownMatchups([late, r4], known, new Date("2026-10-26T02:00:00Z"));

    const views = applySpoilerRules([late, r4], known, new Date("2026-10-26T09:00:00Z"), cfg);
    assert.equal(views[1].teamsHidden, true);
    assert.equal(views[1].revealAt?.toISOString(), "2026-10-26T18:00:00.000Z");

    const ics = buildCalendar(views, { name: "t", timeZone: cfg.timeZone });
    const text = ics
        .split("\r\n")
        .filter((l) => l.startsWith("SUMMARY") || l.startsWith("DESCRIPTION"))
        .join("\n");
    assert.ok(!text.includes("T1"), "masked matchup must not leak team names");
    assert.ok(!text.includes("0–1"), "hidden score must not leak");
    assert.ok(ics.includes("Round 4: 🙈 vs 🙈"));

    const later = applySpoilerRules([late, r4], known, new Date("2026-10-26T18:05:00Z"), cfg);
    assert.equal(later[1].teamsHidden, false);
    assert.equal(later[0].resultHidden, false);
});

test("hidden match keeps its scheduled length so duration can't leak", () => {
    const late = match(2, "Round 3: DK vs MKOI", "finished",
        "2026-10-25T22:00:00Z", "2026-10-25T22:25:00Z", [[12, "DK"], [13, "MKOI"]], [0, 1]);
    const known = updateKnownMatchups([late], {}, new Date("2026-10-24T12:00:00Z"));
    const views = applySpoilerRules([late], known, new Date("2026-10-26T08:00:00Z"), cfg);
    const ics = buildCalendar(views, { name: "t", timeZone: cfg.timeZone });
    assert.ok(ics.includes("DTEND:20261025T230000Z"));
    assert.ok(ics.includes("DK vs MKOI 🙈"));
});

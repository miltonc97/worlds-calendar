import fs from "node:fs";
import path from "node:path";
import { config } from "./config.ts";
import { buildCalendar } from "./ics.ts";
import { fetchLeagueMatches } from "./pandascore.ts";
import { applySpoilerRules, updateKnownMatchups } from "./spoilers.ts";
import { formatLocal } from "./time.ts";
import type { KnownMatchups, PandaScoreMatch } from "./types.ts";

function readJson<T>(file: string, fallback: T): T {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8")) as T;
    } catch {
        return fallback;
    }
}

function writeIfChanged(file: string, content: string): boolean {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return false;
    fs.writeFileSync(file, content);
    return true;
}

async function main() {
    const now = process.env.NOW ? new Date(process.env.NOW) : new Date();

    // FIXTURE lets you test offline with a saved API response.
    let matches: PandaScoreMatch[];
    if (process.env.FIXTURE) {
        matches = readJson<PandaScoreMatch[]>(process.env.FIXTURE, []);
    } else {
        const token = process.env.PANDASCORE_TOKEN;
        if (!token) throw new Error("PANDASCORE_TOKEN is not set");
        matches = await fetchLeagueMatches(config.leagueId, token, now);
    }

    const known = updateKnownMatchups(
        matches,
        readJson<KnownMatchups>(config.stateFile, {}),
        now,
    );
    const views = applySpoilerRules(matches, known, now, config);

    const ics = buildCalendar(views, {
        name: "Worlds (spoiler-safe)",
        timeZone: config.timeZone,
        url: config.calendarUrl || undefined,
    });

    const icsChanged = writeIfChanged(config.outputFile, ics);
    writeIfChanged(config.stateFile, JSON.stringify(known, null, 2) + "\n");

    const hidden = views.filter((v) => v.resultHidden || v.teamsHidden);
    console.log(
        `${matches.length} matches, ${hidden.length} hidden, calendar ${icsChanged ? "updated" : "unchanged"}`,
    );
    for (const v of hidden) {
        const what = v.teamsHidden ? "matchup" : "result";
        console.log(
            `  🙈 ${v.match.name} (${what}) until ${v.revealAt ? formatLocal(v.revealAt, config.timeZone) : "?"}`,
        );
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

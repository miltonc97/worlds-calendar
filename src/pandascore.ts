import type { PandaScoreMatch } from "./types.ts";

const BASE_URL = "https://api.pandascore.co";

/**
 * Fetch this season's matches for one league (past, running and upcoming in one list).
 * Sorted newest first, so the first page or two always cover the current event.
 */
export async function fetchLeagueMatches(
    leagueId: number,
    token: string,
    now: Date = new Date(),
): Promise<PandaScoreMatch[]> {
    const cutoff = now.getTime() - 90 * 24 * 60 * 60 * 1000;
    const all: PandaScoreMatch[] = [];

    for (let page = 1; page <= 3; page++) {
        const url = `${BASE_URL}/lol/matches?filter[league_id]=${leagueId}&sort=-begin_at&per_page=100&page=${page}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (!res.ok) {
            throw new Error(`PandaScore ${res.status}: ${await res.text()}`);
        }
        const batch = (await res.json()) as PandaScoreMatch[];
        all.push(...batch);

        const oldest = batch.at(-1)?.begin_at;
        if (batch.length < 100 || (oldest && Date.parse(oldest) < cutoff)) break;
    }

    return all.filter((m) => {
        const start = m.begin_at ?? m.scheduled_at;
        return start && Date.parse(start) >= cutoff && m.status !== "canceled";
    });
}

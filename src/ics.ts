import { formatLocal } from "./time.ts";
import type { MatchView, PandaScoreMatch } from "./types.ts";

const UID_DOMAIN = "worlds-spoiler-cal";

function icsDate(d: Date): string {
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
    return s
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");
}

/** RFC 5545: fold lines longer than 75 octets. */
function fold(line: string): string {
    const bytes = Buffer.from(line, "utf8");
    if (bytes.length <= 75) return line;
    const out: string[] = [];
    let current = "";
    let size = 0;
    for (const ch of line) {
        const len = Buffer.byteLength(ch, "utf8");
        const limit = out.length === 0 ? 75 : 74;
        if (size + len > limit) {
            out.push(current);
            current = "";
            size = 0;
        }
        current += ch;
        size += len;
    }
    out.push(current);
    return out.join("\r\n ");
}

function stagePrefix(match: PandaScoreMatch): string {
    const stage = match.tournament?.name?.trim();
    if (!stage || stage.toLowerCase() === "regular season") return "";
    return `(${stage}) `;
}

/** "Round 3: DK vs MKOI" -> "Round 3" */
function roundLabel(match: PandaScoreMatch): string {
    const idx = match.name.indexOf(":");
    return idx > 0 ? match.name.slice(0, idx).trim() : "Match";
}

function teamLabel(t: { name: string; acronym?: string | null }): string {
    return t.acronym || t.name;
}

function scoreLine(match: PandaScoreMatch): string | null {
    if (match.opponents.length !== 2 || !match.results?.length) return null;
    const [a, b] = match.opponents.map((o) => o.opponent);
    const score = (id: number) => match.results?.find((r) => r.team_id === id)?.score ?? 0;
    return `${teamLabel(a)} ${score(a.id)}–${score(b.id)} ${teamLabel(b)}`;
}

export function buildEvent(view: MatchView, timeZone: string): string[] | null {
    const { match, resultHidden, teamsHidden, revealAt } = view;
    const startIso = match.begin_at ?? match.scheduled_at;
    if (!startIso) return null;

    const start = new Date(startIso);
    const games = match.number_of_games > 0 ? match.number_of_games : 1;
    const scheduledEnd = new Date(start.getTime() + games * 60 * 60 * 1000);
    const prefix = stagePrefix(match);
    const until = revealAt ? formatLocal(revealAt, timeZone) : "";

    let summary: string;
    const description: string[] = [];
    let end = scheduledEnd;

    if (teamsHidden) {
        summary = `${prefix}${roundLabel(match)}: 🙈 vs 🙈`;
        description.push(
            `Matchup hidden – it would spoil a late result. Revealed ${until}.`,
        );
    } else if (resultHidden) {
        summary = `${prefix}${match.name} 🙈`;
        description.push(`Result hidden until ${until}.`);
    } else if (match.status === "finished") {
        const score = scoreLine(match);
        summary = score ? `${prefix}${roundLabel(match)}: ${score}` : `${prefix}${match.name}`;
        const winner = match.opponents.find((o) => o.opponent.id === match.winner_id);
        if (winner) description.push(`Winner: ${winner.opponent.name}`);
        // Real end time is only shown once the result is public (series length is a spoiler).
        if (match.end_at) end = new Date(match.end_at);
    } else {
        summary = `${prefix}${match.name}`;
    }

    description.push(`Best of ${games}`);

    // Hidden events always keep their scheduled length so duration can't give away a 2-0.
    if (end <= start) end = scheduledEnd;

    return [
        "BEGIN:VEVENT",
        `UID:${match.id}@${UID_DOMAIN}`,
        `DTSTAMP:${icsDate(start)}`,
        `DTSTART:${icsDate(start)}`,
        `DTEND:${icsDate(end)}`,
        fold(`SUMMARY:${escapeText(summary)}`),
        fold(`DESCRIPTION:${escapeText(description.join("\n"))}`),
        "END:VEVENT",
    ];
}

export function buildCalendar(
    views: MatchView[],
    opts: { name: string; timeZone: string; url?: string },
): string {
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//worlds-spoiler-cal//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        fold(`X-WR-CALNAME:${escapeText(opts.name)}`),
        fold(`NAME:${escapeText(opts.name)}`),
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
        "X-PUBLISHED-TTL:PT1H",
    ];
    if (opts.url) lines.push(fold(`URL:${opts.url}`));

    const sorted = [...views].sort((a, b) =>
        (a.match.begin_at ?? a.match.scheduled_at ?? "").localeCompare(
            b.match.begin_at ?? b.match.scheduled_at ?? "",
        ),
    );
    for (const v of sorted) {
        const ev = buildEvent(v, opts.timeZone);
        if (ev) lines.push(...ev);
    }
    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
}

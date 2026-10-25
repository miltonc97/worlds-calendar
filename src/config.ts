/**
 * All knobs in one place. Every value can be overridden with an env var
 * (set them as repository variables in GitHub Actions).
 */

const env = process.env;

export const config = {
    /** PandaScore league id for "Worlds" (League of Legends World Championship). */
    leagueId: Number(env.LEAGUE_ID ?? 297),

    /** Your local time zone. Europe/Stockholm is CET in winter, CEST in summer. */
    timeZone: env.TIME_ZONE ?? "Europe/Stockholm",

    /** A match that finishes at or after this local hour (until noon) is "late". */
    lateFinishHour: Number(env.LATE_FINISH_HOUR ?? 23),

    /** Late results stay hidden until this local hour on the following day. */
    revealHour: Number(env.REVEAL_HOUR ?? 19),

    /**
     * Only matches that finish before this local date get blocked.
     * After it, everything is shown as normal. Set to "" to block forever.
     */
    blockUntilDate: env.BLOCK_UNTIL_DATE ?? "2026-11-02",

    /** Public URL of the calendar (used in the ICS header only). */
    calendarUrl: env.CALENDAR_URL ?? "",

    outputFile: env.OUTPUT_FILE ?? "docs/worlds.ics",
    stateFile: env.STATE_FILE ?? "state/known-matchups.json",
};

export type Config = typeof config;

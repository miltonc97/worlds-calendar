export interface PandaScoreTeam {
    id: number;
    name: string;
    acronym?: string | null;
}

export interface PandaScoreMatch {
    id: number;
    name: string;
    status: "not_started" | "running" | "finished" | "canceled" | "postponed" | string;
    begin_at: string | null;
    scheduled_at?: string | null;
    end_at: string | null;
    number_of_games: number;
    opponents: { type: string; opponent: PandaScoreTeam }[];
    results?: { team_id: number; score: number }[];
    winner_id?: number | null;
    tournament?: { name?: string | null } | null;
}

/** What the spoiler logic decided for one match. */
export interface MatchView {
    match: PandaScoreMatch;
    /** The result of this match is hidden. */
    resultHidden: boolean;
    /** The teams in this match are hidden (pairing reveals a hidden result). */
    teamsHidden: boolean;
    /** When everything hidden about this match becomes visible again. */
    revealAt: Date | null;
}

/** Persisted between runs: when we first saw each match's pairing. */
export interface KnownMatchups {
    [matchId: string]: { teams: string; knownAt: string };
}

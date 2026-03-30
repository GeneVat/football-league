export class StatsCalculator {
    computeStats(teams, fixtures, upto, hasGroups) {
        const map = Object.fromEntries(
            teams.map(t => [
                t,
                {
                    name: t,
                    played: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    gf: 0,
                    ga: 0,
                    pts: 0,
                    group: hasGroups
                        ? fixtures.find(m => m.home === t || m.away === t)?.group
                        : undefined,
                }
            ])
        );

        const record = (team, gf, ga) => {
            team.played++;
            team.gf += gf;
            team.ga += ga;
            if (gf > ga) {
                team.wins++;
                team.pts += 3;
            } else if (gf < ga) {
                team.losses++;
            } else {
                team.draws++;
                team.pts++;
            }
        };

        for (const m of fixtures) {
            if (!m.round || m.round > upto || m.homeScore == null || m.awayScore == null) continue;
            record(map[m.home], m.homeScore, m.awayScore);
            record(map[m.away], m.awayScore, m.homeScore);
        }

        return Object.values(map).sort(
            (a, b) =>
                b.pts - a.pts ||
                b.gf - b.ga - (a.gf - a.ga) ||
                b.gf - a.gf ||
                a.name.localeCompare(b.name)
        );
    }

    getPositionStyle(position, competition) {
        if (!competition.positionStyles) return { bg: 'bg-gray-800/40', border: 'border-gray-700/60' };
        if ('all' in competition.positionStyles) return competition.positionStyles.all;
        for (const [key, style] of Object.entries(competition.positionStyles)) {
            if (key === position.toString()) return style;
            if (key.includes('-')) {
                const [start, end] = key.split('-').map(Number);
                if (position >= start && position <= end) return style;
            }
        }
        return { bg: 'bg-gray-800/40', border: 'border-gray-700/60' };
    }
}

export class FixtureGenerator {
    shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    makeLeagueFixtures(teams, repetitions = 1) {
        const sched = [...teams];
        if (sched.length % 2) sched.push('BYE');
        const n = sched.length;
        let id = 1;
        const fx = [];

        for (let r = 0; r < n - 1; r++) {
            for (let i = 0; i < n / 2; i++) {
                const h = sched[i], a = sched[n - 1 - i];
                if (h !== 'BYE' && a !== 'BYE') {
                    fx.push({
                        id: id++,
                        home: h,
                        away: a,
                        homeScore: null,
                        awayScore: null,
                        round: r + 1,
                    });
                }
            }
            sched.splice(1, 0, sched.pop());
        }

        if (repetitions > 1) {
            const firstHalf = [...fx];
            const roundsInFirstHalf = teams.length % 2 === 0 ? teams.length - 1 : teams.length;
            for (let rep = 1; rep < repetitions; rep++) {
                for (const m of firstHalf) {
                    fx.push({
                        id: id++,
                        home: rep % 2 === 0 ? m.home : m.away,
                        away: rep % 2 === 0 ? m.away : m.home,
                        homeScore: null,
                        awayScore: null,
                        round: m.round + roundsInFirstHalf * rep,
                    });
                }
            }
        }
        return fx;
    }

    makeGroupFixtures(teams, groupCount, repetitions = 1) {
        const shuffled = this.shuffleArray(teams);
        const teamsPerGroup = teams.length / groupCount;
        let id = 1;
        const fx = [];
        const groupLabels = Array.from({ length: groupCount }, (_, i) => String.fromCharCode(65 + i));

        groupLabels.forEach((g, gi) => {
            const groupTeams = shuffled.slice(gi * teamsPerGroup, gi * teamsPerGroup + teamsPerGroup);
            const groupFx = this.makeLeagueFixtures(groupTeams, repetitions);
            groupFx.forEach(m => {
                m.id = id++;
                m.group = g;
            });
            fx.push(...groupFx);
        });
        return fx;
    }

    seedKnockout(top, playoffTeams, allowThird = false) {
        if (!top || top.length < playoffTeams) return [];
        if (!top[0]?.group) {
            const qualified = top.slice(0, playoffTeams);
            const shuffled = this.shuffleArray(qualified);
            let id = 1000;
            const bracket = [];
            for (let i = 0; i < shuffled.length; i += 2) {
                bracket.push({
                    id: ++id,
                    home: shuffled[i].name,
                    away: shuffled[i + 1].name,
                    homeScore: null,
                    awayScore: null,
                    round: 1,
                });
            }
            return bracket;
        }

        const groups = [...new Set(top.map(t => t.group))];
        let winners = [], runners = [], thirds = [];
        groups.forEach(g => {
            const slice = top.filter(t => t.group === g);
            if (slice[0]) winners.push(slice[0]);
            if (slice[1]) runners.push(slice[1]);
            if (slice[2]) thirds.push(slice[2]);
        });

        let qualified = [];
        if (allowThird) {
            const bestThirds = thirds
                .sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf)
                .slice(0, 4);
            qualified = [...winners, ...runners, ...bestThirds];
        } else {
            qualified = [...winners, ...runners];
        }

        const shuffled = this.shuffleArray(qualified.slice(0, playoffTeams));
        let id = 1000;
        const bracket = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            bracket.push({
                id: ++id,
                home: shuffled[i].name,
                away: shuffled[i + 1].name,
                homeScore: null,
                awayScore: null,
                round: 1,
            });
        }
        return bracket;
    }

    generateKnockoutBracket(teams) {
        const shuffled = this.shuffleArray([...teams]);
        let id = 1000;
        const bracket = [];
        let round = 1;
        
        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                bracket.push({
                    id: id++,
                    home: shuffled[i],
                    away: shuffled[i + 1],
                    homeScore: null,
                    awayScore: null,
                    round: round
                });
            }
        }
        return bracket;
    }
}

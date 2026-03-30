import { COMPETITIONS } from '../data/competitions';
import { StateManager } from './StateManager';
import { FixtureGenerator } from './FixtureGenerator';
import { StatsCalculator } from './StatsCalculator';
import { MatchSimulator } from './MatchSimulator';
import { UIRenderer } from './UIRenderer';
import { SaveLoadManager } from './SaveLoadManager';

export class App {
    constructor() {
        this.state = new StateManager();
        this.fixtureGen = new FixtureGenerator();
        this.statsCalc = new StatsCalculator();
        this.matchSim = new MatchSimulator();
        this.ui = new UIRenderer(this);
        this.saveLoad = new SaveLoadManager(this);
        
        // Bind methods
        this.render = this.render.bind(this);
        this.advanceLeague = this.advanceLeague.bind(this);
        this.advancePlayoff = this.advancePlayoff.bind(this);
        this.advanceQualifying = this.advanceQualifying.bind(this);
        this.advanceLeaguePlayoff = this.advanceLeaguePlayoff.bind(this);
        this.resetState = this.resetState.bind(this);
        this.autoFillCurrentRoundResults = this.autoFillCurrentRoundResults.bind(this);
        this.startMatchSimulation = this.startMatchSimulation.bind(this);
    }

    getActualTeams() {
        if (!this.state.selectedComp) return [];
        return this.state.selectedComp.teams.length > 0
            ? this.state.selectedComp.teams
            : this.state.teamsConfirmed
            ? this.state.selectedTeams
            : [];
    }

    getTotalLeagueRounds() {
        return this.state.selectedComp?.rounds || 0;
    }

    hasGroups() {
        return this.state.selectedComp?.format === 'mixed' || this.state.selectedComp?.format === 'groups';
    }

    hasKnockout() {
        return this.state.selectedComp?.format === 'knockout' || this.state.selectedComp?.format === 'mixed';
    }

    getKnockoutTeamsCount() {
        return this.state.selectedComp?.format === 'knockout'
            ? this.state.selectedComp.teamCount
            : this.state.selectedComp?.playoffTeams || 0;
    }

    getTotalPlayoffRounds() {
        const knockoutTeamsCount = this.getKnockoutTeamsCount();
        return knockoutTeamsCount > 0 ? Math.ceil(Math.log2(knockoutTeamsCount)) : 0;
    }

    isUserMatch(match) {
        return this.state.gameMode === 'team' && this.state.userTeam && 
               (match.home === this.state.userTeam || match.away === this.state.userTeam);
    }

    updateFixtures() {
        const actualTeams = this.getActualTeams();
        if (!this.state.selectedComp || actualTeams.length === 0) return;
        
        if (this.state.selectedComp.format === 'league') {
            this.state.fixtures = this.fixtureGen.makeLeagueFixtures(actualTeams, this.state.selectedComp.repetitions);
        } else if (this.hasGroups()) {
            this.state.fixtures = this.fixtureGen.makeGroupFixtures(
                actualTeams,
                this.state.selectedComp.groupCount || 1,
                this.state.selectedComp.repetitions
            );
        } else if (this.state.selectedComp.format === 'knockout') {
            this.state.bracket = this.fixtureGen.generateKnockoutBracket(actualTeams);
            this.state.currentPhase = 'knockout';
            this.state.playoffRound = 1;
        }
    }

    computeTables() {
        const actualTeams = this.getActualTeams();
        if (!this.state.selectedComp || actualTeams.length === 0) return [];
        const stats = this.statsCalc.computeStats(actualTeams, this.state.fixtures, this.state.round, this.hasGroups());
        if (!this.hasGroups()) return [stats];
        const groupLabels = [...new Set(stats.map(s => s.group).filter(Boolean))];
        return groupLabels.map(g => {
            const teamsPerGroup = this.state.selectedComp.teamCount / (this.state.selectedComp.groupCount || 1);
            return stats.filter(t => t.group === g).slice(0, teamsPerGroup);
        });
    }

    advanceLeague() {
        const games = this.state.fixtures.filter(m => m.round === this.state.round);
        if (games.some(g => !this.state.scores[g.id])) {
            alert('Please fill in all scores for the current round.');
            return;
        }
        
        this.state.fixtures = this.state.fixtures.map(m =>
            this.state.scores[m.id]
                ? { ...m, homeScore: this.state.scores[m.id].home, awayScore: this.state.scores[m.id].away }
                : m
        );
        this.state.round++;
        this.state.scores = {};

        const totalLeagueRounds = this.getTotalLeagueRounds();
        if (this.state.round > totalLeagueRounds) {
            const finalTables = this.computeTables();
            if (this.state.selectedComp.leaguePlayoffs) {
                const [start, end] = this.state.selectedComp.leaguePlayoffs.positions.split('-').map(Number);
                const playoffTeams = finalTables[0].slice(start - 1, end);
                const homeTeams = [playoffTeams[0], playoffTeams[1]];
                const awayTeams = [playoffTeams[3], playoffTeams[2]];
                let id = 3000;
                this.state.leaguePlayoffBracket = [];
                for (let i = 0; i < homeTeams.length; i++) {
                    this.state.leaguePlayoffBracket.push({
                        id: id++,
                        home: homeTeams[i].name,
                        away: awayTeams[i].name,
                        homeScore: null,
                        awayScore: null,
                    });
                }
                this.state.leaguePlayoffRound = 0;
                this.state.currentPhase = 'league_playoffs';
            } else if (this.hasKnockout()) {
                this.state.bracket = this.fixtureGen.seedKnockout(finalTables.flat(), this.state.selectedComp.playoffTeams);
                this.state.playoffRound = 0;
                this.state.currentPhase = 'knockout';
            } else {
                this.state.currentPhase = 'finished';
            }
        }
        this.render();
    }

    advancePlayoff() {
        const currentRoundMatches = this.state.bracket.filter(m => m.round === this.state.playoffRound);
        
        for (const m of currentRoundMatches) {
            const score = this.state.scores[m.id];
            if (!score) {
                alert('Please fill in all scores for the current round.');
                return;
            }
            if (score.home === score.away) {
                alert();
                return;
            }
        }

        this.state.bracket = this.state.bracket.map(m =>
            this.state.scores[m.id]
                ? { ...m, homeScore: this.state.scores[m.id].home, awayScore: this.state.scores[m.id].away }
                : m
        );

        const winners = currentRoundMatches.map(m =>
            this.state.scores[m.id].home > this.state.scores[m.id].away ? m.home : m.away
        );

        if (winners.length > 1) {
            const nextRound = this.state.playoffRound + 1;
            let nextId = (this.state.bracket[this.state.bracket.length - 1]?.id || 2000) + 1;
            
            for (let i = 0; i < winners.length; i += 2) {
                this.state.bracket.push({
                    id: nextId++,
                    home: winners[i],
                    away: winners[i + 1],
                    homeScore: null,
                    awayScore: null,
                    round: nextRound
                });
            }
            
            this.state.playoffRound = nextRound;
            this.state.scores = {};
        } else {
            this.state.currentPhase = 'finished';
        }
        
        this.render();
    }

    advanceQualifying() {
        const games = this.state.qualifyingFixtures.filter(m => m.round === this.state.qualifyingRound);
        if (games.some(g => !this.state.scores[g.id])) {
            alert('Please fill in all scores for the current qualifying round.');
            return;
        }
        
        this.state.qualifyingFixtures = this.state.qualifyingFixtures.map(m =>
            this.state.scores[m.id]
                ? { ...m, homeScore: this.state.scores[m.id].home, awayScore: this.state.scores[m.id].away }
                : m
        );

        const teamsPerGroup = this.state.selectedComp.qualifying.pool.length / this.state.selectedComp.qualifying.groups;
        const totalQualifyingRounds = (teamsPerGroup % 2 === 0 ? teamsPerGroup - 1 : teamsPerGroup) * 2;

        if (this.state.qualifyingRound >= totalQualifyingRounds) {
            const stats = this.statsCalc.computeStats(
                this.state.selectedComp.qualifying.pool,
                this.state.qualifyingFixtures,
                this.state.qualifyingRound,
                true
            );
            const groupLabels = [...new Set(stats.map(s => s.group).filter(Boolean))];
            let qualifiers = [];
            groupLabels.forEach(g => {
                const groupStandings = stats.filter(t => t.group === g);
                const groupQualifiers = groupStandings
                    .slice(0, this.state.selectedComp.qualifying.advance)
                    .map(t => t.name);
                qualifiers.push(...groupQualifiers);
            });

            this.state.selectedComp.teams = [...this.state.selectedComp.teams, ...qualifiers];
            this.state.teamsConfirmed = true;
            this.state.currentPhase = 'league';
            this.state.round = 0;
            this.state.scores = {};
        } else {
            this.state.qualifyingRound++;
            this.state.scores = {};
        }
        this.render();
    }

    advanceLeaguePlayoff() {
        const matches = this.state.leaguePlayoffRound === 0
            ? this.state.leaguePlayoffBracket.slice(0, 2)
            : this.state.leaguePlayoffBracket.slice(2);
            
        for (const m of matches) {
            const score = this.state.scores[m.id];
            if (!score) {
                alert('Please fill in all scores for the current round.');
                return;
            }
            if (score.home === score.away) {
                alert();
                return;
            }
        }

        this.state.leaguePlayoffBracket = this.state.leaguePlayoffBracket.map(m =>
            this.state.scores[m.id]
                ? { ...m, homeScore: this.state.scores[m.id].home, awayScore: this.state.scores[m.id].away }
                : m
        );
        
        const winners = matches.map(m =>
            this.state.scores[m.id].home > this.state.scores[m.id].away ? m.home : m.away
        );

        if (this.state.leaguePlayoffRound === 0) {
            let nextId = (this.state.leaguePlayoffBracket[this.state.leaguePlayoffBracket.length - 1]?.id || 4000) + 1;
            const final = {
                id: nextId,
                home: winners[0],
                away: winners[1],
                homeScore: null,
                awayScore: null,
            };
            this.state.leaguePlayoffBracket.push(final);
            this.state.leaguePlayoffRound++;
            this.state.scores = {};
        } else {
            this.state.currentPhase = 'knockout';
        }
        this.render();
    }

    resetState() {
        this.state.reset();
        this.render();
    }

    autoFillCurrentRoundResults(matches, isKnockout = false, onlyOtherMatches = false) {
        if (!matches || matches.length === 0) return;
        matches.forEach((match) => {
            if (onlyOtherMatches && this.isUserMatch(match)) return;
            if (!this.state.scores[match.id] || this.state.scores[match.id].home === undefined) {
                const result = this.matchSim.generateWeightedResult(match.home, match.away, this.state.selectedComp, !isKnockout);
                this.state.scores = { ...this.state.scores, [match.id]: result };
            }
        });
        this.render();
    }

    startMatchSimulation(match, allowDraw = true) {
        this.matchSim.startMatchSimulation(match, allowDraw, this.state, (updatedScores) => {
            this.state.scores = updatedScores;
            this.render();
        });
    }

    render() {
        this.ui.render();
    }
}

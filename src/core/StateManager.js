import { COMPETITIONS } from '../data/competitions';

export class StateManager {
    constructor() {
        this.currentPhase = 'menu'; // menu, custom_creation, mode_selection, team_selection, qualifying, league, league_playoffs, knockout, finished
        this.selectedComp = null;
        this.fixtures = [];
        this.round = 0;
        this.scores = {};
        this.bracket = [];
        this.playoffRound = 0;
        this.selectedTeams = [];
        this.teamsConfirmed = false;
        this.qualifyingFixtures = [];
        this.qualifyingRound = 0;
        this.leaguePlayoffBracket = [];
        this.leaguePlayoffRound = 0;
        this.gameMode = 'league'; // 'league' | 'team'
        this.userTeam = null;
        this.matchSimulation = null;
    }

    reset() {
        this.currentPhase = 'menu';
        this.selectedComp = null;
        this.fixtures = [];
        this.round = 0;
        this.scores = {};
        this.bracket = [];
        this.playoffRound = 0;
        this.selectedTeams = [];
        this.teamsConfirmed = false;
        this.qualifyingFixtures = [];
        this.qualifyingRound = 0;
        this.leaguePlayoffBracket = [];
        this.leaguePlayoffRound = 0;
        this.gameMode = 'league';
        this.userTeam = null;
        this.matchSimulation = null;
    }
}

export class MatchSimulator {
    constructor() {
        this.FORMATION_HOME = [
            { x: 5, y: 50 },   // GK
            { x: 14, y: 22 },  { x: 14, y: 42 },  { x: 14, y: 58 },  { x: 14, y: 78 },  // back 4
            { x: 26, y: 35 },  { x: 26, y: 50 },  { x: 26, y: 65 },  // mid 3
            { x: 40, y: 30 },  { x: 40, y: 50 },  { x: 40, y: 70 },  // fwd 3
        ];
        this.PITCH_WIDTH = 100;
        this.PITCH_HEIGHT = 100;
        this.MATCH_DURATION_SEC = 25;
        this.GOAL_FLASH_MS = 1800;
    }

    get FORMATION_AWAY() {
        return this.FORMATION_HOME.map(p => ({ x: this.PITCH_WIDTH - p.x, y: p.y }));
    }

    getTeamStrength(teamName, competition) {
        if (competition?.teamStrengths && competition.teamStrengths[teamName]) {
            return competition.teamStrengths[teamName];
        }
        
        // For custom tournaments or teams without defined strength, use default based on position
        const actualTeams = competition?.teams || [];
        const teamIndex = actualTeams.indexOf(teamName);
        if (teamIndex !== -1 && actualTeams.length > 0) {
            const strengthRange = 85 - 65;
            const positionRatio = teamIndex / Math.max(1, actualTeams.length - 1);
            return Math.round(85 - (positionRatio * strengthRange));
        }
        
        return 75;
    }

    generateWeightedResult(homeTeam, awayTeam, competition, allowDraw = true) {
        const homeStrength = this.getTeamStrength(homeTeam, competition);
        const awayStrength = this.getTeamStrength(awayTeam, competition);
        
        const homeAdvantage = 0.3;
        const strengthDiff = (homeStrength - awayStrength) / 20;
        const homeExpectedGoals = 1.5 + strengthDiff + homeAdvantage;
        const awayExpectedGoals = 1.5 - strengthDiff;
        
        let homeGoals = Math.max(0, Math.round(homeExpectedGoals + (Math.random() - 0.5) * 2.5));
        let awayGoals = Math.max(0, Math.round(awayExpectedGoals + (Math.random() - 0.5) * 2.5));
        
        if (homeGoals === 0 && awayGoals === 0) {
            if (Math.random() < 0.5) {
                homeGoals = 1;
                awayGoals = 0;
            } else {
                homeGoals = 0;
                awayGoals = 1;
            }
        }
        
        if (!allowDraw && homeGoals === awayGoals) {
            const homeWinProb = 0.5 + (strengthDiff * 0.15);
            if (Math.random() < homeWinProb) {
                homeGoals += 1;
            } else {
                awayGoals += 1;
            }
        }
        
        return {
            home: Math.min(15, homeGoals),
            away: Math.min(15, awayGoals)
        };
    }

    initDots() {
        const home = this.FORMATION_HOME.map(pos => ({
            x: pos.x + (Math.random() - 0.5) * 4,
            y: pos.y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            baseX: pos.x,
            baseY: pos.y,
        }));
        const away = this.FORMATION_AWAY.map(pos => ({
            x: pos.x + (Math.random() - 0.5) * 4,
            y: pos.y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            baseX: pos.x,
            baseY: pos.y,
        }));
        return { home, away };
    }

    initBall() {
        return {
            x: 50,
            y: 50,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
        };
    }

    startMatchSimulation(match, allowDraw, state, onComplete) {
        if (state.matchSimulation?.animationId) cancelAnimationFrame(state.matchSimulation.animationId);
        
        const result = this.generateWeightedResult(match.home, match.away, state.selectedComp, allowDraw);
        const goalEvents = [];
        for (let i = 0; i < result.home; i++) goalEvents.push({ minute: Math.floor(Math.random() * 88) + 1, team: 'home' });
        for (let i = 0; i < result.away; i++) goalEvents.push({ minute: Math.floor(Math.random() * 88) + 1, team: 'away' });
        goalEvents.sort((a, b) => a.minute - b.minute);
        
        state.matchSimulation = {
            matchId: match.id,
            home: match.home,
            away: match.away,
            homeGoals: 0,
            awayGoals: 0,
            targetHome: result.home,
            targetAway: result.away,
            minute: 0,
            phase: 'playing',
            goalEvents,
            goalsShown: 0,
            dots: this.initDots(),
            ball: this.initBall(),
            startTime: null,
            animationId: null,
            goalFlashUntil: 0,
        };
        
        const runFrame = () => this.runSimulationFrame(state, onComplete);
        state.matchSimulation.animationId = requestAnimationFrame(runFrame);
    }

    updateDots(dots) {
        const margin = 3;
        const formationPull = 0.02;
        ['home', 'away'].forEach(side => {
            dots[side].forEach(d => {
                d.vx += (d.baseX - d.x) * formationPull + (Math.random() - 0.5) * 0.12;
                d.vy += (d.baseY - d.y) * formationPull + (Math.random() - 0.5) * 0.12;
                d.vx = Math.max(-1.2, Math.min(1.2, d.vx));
                d.vy = Math.max(-1.2, Math.min(1.2, d.vy));
                d.x += d.vx;
                d.y += d.vy;
                if (d.x < margin) { d.x = margin; d.vx *= -0.8; }
                if (d.x > 100 - margin) { d.x = 100 - margin; d.vx *= -0.8; }
                if (d.y < margin) { d.y = margin; d.vy *= -0.8; }
                if (d.y > 100 - margin) { d.y = 100 - margin; d.vy *= -0.8; }
            });
        });
    }

    updateBall(ball, dots) {
        const margin = 2;
        ball.x += ball.vx;
        ball.y += ball.vy;
        if (ball.x < margin) { ball.x = margin; ball.vx *= -0.9; }
        if (ball.x > 100 - margin) { ball.x = 100 - margin; ball.vx *= -0.9; }
        if (ball.y < margin) { ball.y = margin; ball.vy *= -0.9; }
        if (ball.y > 100 - margin) { ball.y = 100 - margin; ball.vy *= -0.9; }
        ball.vx += (Math.random() - 0.5) * 0.2;
        ball.vy += (Math.random() - 0.5) * 0.2;
        ball.vx = Math.max(-2, Math.min(2, ball.vx));
        ball.vy = Math.max(-2, Math.min(2, ball.vy));
    }

    runSimulationFrame(state, onComplete) {
        if (!state.matchSimulation || state.matchSimulation.phase !== 'playing') return;
        
        const sim = state.matchSimulation;
        if (!sim.startTime) sim.startTime = performance.now();
        
        const elapsed = (performance.now() - sim.startTime) / 1000;
        sim.minute = Math.min(90, Math.floor((elapsed / this.MATCH_DURATION_SEC) * 90));
        
        this.updateDots(sim.dots);
        if (sim.ball) this.updateBall(sim.ball, sim.dots);
        
        while (sim.goalsShown < sim.goalEvents.length && sim.goalEvents[sim.goalsShown].minute <= sim.minute) {
            const g = sim.goalEvents[sim.goalsShown];
            if (g.team === 'home') sim.homeGoals++;
            else sim.awayGoals++;
            sim.goalsShown++;
            sim.goalFlashUntil = performance.now() + this.GOAL_FLASH_MS;
        }
        
        if (sim.minute >= 90) {
            sim.phase = 'finished';
            onComplete({ ...state.scores, [sim.matchId]: { home: sim.targetHome, away: sim.targetAway } });
            if (sim.animationId) cancelAnimationFrame(sim.animationId);
            sim.animationId = null;
            return;
        }
        
        sim.animationId = requestAnimationFrame(() => this.runSimulationFrame(state, onComplete));
    }
}

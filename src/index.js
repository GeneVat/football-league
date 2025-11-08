import "./list.js";
import "./style.css";
import { COMPETITIONS } from "./list.js";

// --- FILE INPUT FOR LOADING ---
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".json";
fileInput.style.display = "none";
document.body.appendChild(fileInput);

// --- TYPES ---
const Match = {
  id: 0,
  home: "",
  away: "",
  homeScore: null,
  awayScore: null,
  round: null,
  group: null,
};

const TeamStats = {
  name: "",
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  gf: 0,
  ga: 0,
  pts: 0,
  group: null,
};

const PositionStyle = {
  bg: "",
  border: "",
  icon: "",
  label: null,
};

const Competition = {
  id: "",
  name: "",
  emoji: "",
  format: "",
  teamCount: 0,
  rounds: null,
  playoffTeams: null,
  groupCount: null,
  teams: [],
  positionStyles: {},
  leaguePlayoffs: null, // { positions: '3-6', winners: 1 }
  qualifying: null, // { pool: [], groups: 4, advance: 2 }
};

// --- COMPETITION DEFINITIONS ---

// --- UTILITIES ---
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeLeagueFixtures(teams, repetitions = 1) {
  const sched = [...teams];
  if (sched.length % 2) sched.push("BYE");
  const n = sched.length;
  let id = 1;
  const fx = [];

  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const h = sched[i],
        a = sched[n - 1 - i];
      if (h !== "BYE" && a !== "BYE") {
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
    const roundsInFirstHalf =
      teams.length % 2 === 0 ? teams.length - 1 : teams.length;
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

function makeGroupFixtures(teams, groupCount, repetitions = 1) {
  const shuffled = shuffleArray(teams);
  const teamsPerGroup = teams.length / groupCount;
  let id = 1;
  const fx = [];
  const groupLabels = Array.from({ length: groupCount }, (_, i) =>
    String.fromCharCode(65 + i)
  );

  groupLabels.forEach((g, gi) => {
    const groupTeams = shuffled.slice(
      gi * teamsPerGroup,
      gi * teamsPerGroup + teamsPerGroup
    );
    const groupFx = makeLeagueFixtures(groupTeams, repetitions);
    groupFx.forEach((m) => {
      m.id = id++;
      m.group = g;
    });
    fx.push(...groupFx);
  });
  return fx;
}

function computeStats(teams, fixtures, upto, hasGroups) {
  const map = Object.fromEntries(
    teams.map((t) => [
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
          ? fixtures.find((m) => m.home === t || m.away === t)?.group
          : undefined,
      },
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
    if (
      !m.round ||
      m.round > upto ||
      m.homeScore == null ||
      m.awayScore == null
    )
      continue;
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

function seedKnockout(top, playoffTeams, allowThird = false) {
  if (!top || top.length < playoffTeams) return [];
  if (!top[0]?.group) {
    const qualified = top.slice(0, playoffTeams);
    const shuffled = shuffleArray(qualified);
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

  const groups = [...new Set(top.map((t) => t.group))];
  let winners = [],
    runners = [],
    thirds = [];
  groups.forEach((g) => {
    const slice = top.filter((t) => t.group === g);
    if (slice[0]) winners.push(slice[0]);
    if (slice[1]) runners.push(slice[1]);
    if (slice[2]) thirds.push(slice[2]);
  });

  let qualified = [];
  if (allowThird) {
    const bestThirds = thirds
      .sort(
        (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf
      )
      .slice(0, 4);
    qualified = [...winners, ...runners, ...bestThirds];
  } else {
    qualified = [...winners, ...runners];
  }

  const shuffled = shuffleArray(qualified.slice(0, playoffTeams));
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

function getPositionStyle(position, competition) {
  if (!competition.positionStyles)
    return { bg: "bg-gray-800/40", border: "border-gray-700/60", icon: "⚪" };
  if ("all" in competition.positionStyles)
    return competition.positionStyles.all;
  for (const [key, style] of Object.entries(competition.positionStyles)) {
    if (key === position.toString()) return style;
    if (key.includes("-")) {
      const [start, end] = key.split("-").map(Number);
      if (position >= start && position <= end) return style;
    }
  }
  return { bg: "bg-gray-800/40", border: "border-gray-700/60", icon: "⚪" };
}

// --- UI UTILITIES ---
function createButton(variant, text, className, onClick, disabled = false) {
  const variants = {
    primary:
      "bg-blue-600 hover:bg-blue-500 text-white border-blue-500/50 shadow-lg shadow-blue-900/25",
    secondary:
      "bg-gray-800 hover:bg-gray-700 text-gray-100 border-gray-600/50 shadow-lg shadow-black/25",
    success:
      "bg-green-600 hover:bg-green-500 text-white border-green-500/50 shadow-lg shadow-green-900/25",
    warning:
      "bg-orange-600 hover:bg-orange-500 text-white border-orange-500/50 shadow-lg shadow-orange-900/25",
  };
  const button = document.createElement("button");
  button.className = `px-4 py-2.5 rounded-xl font-medium border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400/50 ${
    disabled ? "opacity-50 cursor-not-allowed" : ""
  } ${variants[variant]} ${className}`;
  button.textContent = text;
  button.disabled = disabled;
  if (onClick) button.onclick = onClick;
  return button;
}

function createLeagueTableRow(team, position, competition) {
  const style = getPositionStyle(position, competition);
  const row = document.createElement("div");
  row.className = `flex items-center justify-between p-2 rounded-lg ${style.bg} border ${style.border}`;
  row.title = style.label;

  const teamInfo = document.createElement("div");
  teamInfo.className = "flex items-center space-x-3 flex-1 min-w-0";
  teamInfo.innerHTML = `
        <span class="text-xs w-6 text-center font-bold">${position}</span>
        <span class="text-sm">${style.icon}</span>
        <span class="text-sm font-medium truncate">${team.name}</span>
      `;

  const stats = document.createElement("div");
  stats.className = "flex items-center space-x-4 text-xs font-mono";
  stats.innerHTML = `
        <span class="w-6 text-center">${team.played}</span> <span class="w-6 text-center">${team.wins}</span>
        <span class="w-6 text-center">${team.draws}</span> <span class="w-6 text-center">${team.losses}</span>
        <span class="w-8 text-center">${team.gf}-${team.ga}</span> <span class="w-8 text-center font-bold text-white">${team.pts}</span>
      `;

  row.appendChild(teamInfo);
  row.appendChild(stats);
  return row;
}

// --- STATE ---
let currentPhase = "menu"; // menu, custom_creation, team_selection, qualifying, league, league_playoffs, knockout, finished
let selectedComp = null;
let fixtures = [];
let round = 0;
let scores = {};
let bracket = [];
let playoffRound = 0;
let selectedTeams = [];
let teamsConfirmed = false;
let qualifyingFixtures = [];
let qualifyingRound = 0;
let leaguePlayoffBracket = [];
let leaguePlayoffRound = 0;

// --- SAVE/LOAD FUNCTIONS ---
function saveState() {
  const stateToSave = {
    currentPhase,
    selectedComp,
    fixtures,
    round,
    scores,
    bracket,
    playoffRound,
    selectedTeams,
    teamsConfirmed,
    qualifyingFixtures,
    qualifyingRound,
    leaguePlayoffBracket,
    leaguePlayoffRound,
  };
  try {
    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fls_save.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to save game:", error);
    alert("Error: Could not create the save file.");
  }
}

function triggerLoad() {
  fileInput.click();
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const savedState = JSON.parse(e.target.result);
      currentPhase = savedState.currentPhase;
      selectedComp = savedState.selectedComp;
      fixtures = savedState.fixtures;
      round = savedState.round;
      scores = savedState.scores;
      bracket = savedState.bracket;
      playoffRound = savedState.playoffRound;
      selectedTeams = savedState.selectedTeams;
      teamsConfirmed = savedState.teamsConfirmed;
      qualifyingFixtures = savedState.qualifyingFixtures;
      qualifyingRound = savedState.qualifyingRound;
      leaguePlayoffBracket = savedState.leaguePlayoffBracket;
      leaguePlayoffRound = savedState.leaguePlayoffRound;
      render();
    } catch (error) {
      console.error("Failed to load game:", error);
      alert("Error: The save file is corrupted or not a valid format.");
    } finally {
      fileInput.value = "";
    }
  };
  reader.onerror = function () {
    alert("Error reading the file.");
    fileInput.value = "";
  };
  reader.readAsText(file);
});

function getActualTeams() {
  if (!selectedComp) return [];
  return selectedComp.teams.length > 0
    ? selectedComp.teams
    : teamsConfirmed
    ? selectedTeams
    : [];
}

function getTotalLeagueRounds() {
  return selectedComp?.rounds || 0;
}
function hasGroups() {
  return selectedComp?.format === "mixed" || selectedComp?.format === "groups";
}
function hasKnockout() {
  return (
    selectedComp?.format === "knockout" || selectedComp?.format === "mixed"
  );
}
function getKnockoutTeamsCount() {
  return selectedComp?.format === "knockout"
    ? selectedComp.teamCount
    : selectedComp?.playoffTeams || 0;
}
function getTotalPlayoffRounds() {
  const knockoutTeamsCount = getKnockoutTeamsCount();
  return knockoutTeamsCount > 0 ? Math.ceil(Math.log2(knockoutTeamsCount)) : 0;
}

function resetState() {
  selectedComp = null;
  fixtures = [];
  round = 0;
  scores = {};
  bracket = [];
  playoffRound = 0;
  selectedTeams = [];
  teamsConfirmed = false;
  qualifyingFixtures = [];
  qualifyingRound = 0;
  leaguePlayoffBracket = [];
  leaguePlayoffRound = 0;
  currentPhase = "menu";
  render();
}

function generateKnockoutBracket(teams) {
  console.log("Generating knockout bracket with teams:", teams);
  const shuffled = shuffleArray([...teams]);
  let id = 1000;
  const bracket = [];
  let round = 1;
  
  // Create first round matches
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) { // Ensure we have a pair
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
  
  console.log("Generated bracket:", bracket);
  return bracket;
}

function updateFixtures() {
  const actualTeams = getActualTeams();
  if (!selectedComp || actualTeams.length === 0) return;
  
  if (selectedComp.format === "league") {
    fixtures = makeLeagueFixtures(actualTeams, selectedComp.repetitions);
  } else if (hasGroups()) {
    fixtures = makeGroupFixtures(
      actualTeams,
      selectedComp.groupCount || 1,
      selectedComp.repetitions
    );
  } else if (selectedComp.format === "knockout") {
    // Generate knockout bracket and immediately go to knockout phase
    bracket = generateKnockoutBracket(actualTeams);
    currentPhase = "knockout";
    playoffRound = 1;
  }
}

function computeTables() {
  const actualTeams = getActualTeams();
  if (!selectedComp || actualTeams.length === 0) return [];
  const stats = computeStats(actualTeams, fixtures, round, hasGroups());
  if (!hasGroups()) return [stats];
  const groupLabels = [...new Set(stats.map((s) => s.group).filter(Boolean))];
  return groupLabels.map((g) => {
    const teamsPerGroup =
      selectedComp.teamCount / (selectedComp.groupCount || 1);
    return stats.filter((t) => t.group === g).slice(0, teamsPerGroup);
  });
}

function advanceQualifying() {
  const games = qualifyingFixtures.filter((m) => m.round === qualifyingRound);
  if (games.some((g) => !scores[g.id])) {
    alert("Please fill in all scores for the current qualifying round.");
    return;
  }
  qualifyingFixtures = qualifyingFixtures.map((m) =>
    scores[m.id]
      ? { ...m, homeScore: scores[m.id].home, awayScore: scores[m.id].away }
      : m
  );

  const teamsPerGroup =
    selectedComp.qualifying.pool.length / selectedComp.qualifying.groups;
  const totalQualifyingRounds =
    (teamsPerGroup % 2 === 0 ? teamsPerGroup - 1 : teamsPerGroup) * 2; // Assuming double RR

  if (qualifyingRound >= totalQualifyingRounds) {
    const stats = computeStats(
      selectedComp.qualifying.pool,
      qualifyingFixtures,
      qualifyingRound,
      true
    );
    const groupLabels = [...new Set(stats.map((s) => s.group).filter(Boolean))];
    let qualifiers = [];
    groupLabels.forEach((g) => {
      const groupStandings = stats.filter((t) => t.group === g);
      const groupQualifiers = groupStandings
        .slice(0, selectedComp.qualifying.advance)
        .map((t) => t.name);
      qualifiers.push(...groupQualifiers);
    });

    selectedComp.teams = [...selectedComp.teams, ...qualifiers];
    teamsConfirmed = true;
    currentPhase = "league";
    round = 0;
    scores = {};
  } else {
    qualifyingRound++;
    scores = {};
  }
  render();
}

function advanceLeague() {
  const games = fixtures.filter((m) => m.round === round);
  if (games.some((g) => !scores[g.id])) {
    alert("Please fill in all scores for the current round.");
    return;
  }
  fixtures = fixtures.map((m) =>
    scores[m.id]
      ? { ...m, homeScore: scores[m.id].home, awayScore: scores[m.id].away }
      : m
  );
  round++;
  scores = {};

  const totalLeagueRounds = getTotalLeagueRounds();
  if (round > totalLeagueRounds) {
    const finalTables = computeTables();
    if (selectedComp.leaguePlayoffs) {
      const [start, end] = selectedComp.leaguePlayoffs.positions
        .split("-")
        .map(Number);
      const playoffTeams = finalTables[0].slice(start - 1, end);
      const homeTeams = [playoffTeams[0], playoffTeams[1]];
      const awayTeams = [playoffTeams[3], playoffTeams[2]]; // Seeded: 3v6, 4v5
      let id = 3000;
      leaguePlayoffBracket = [];
      for (let i = 0; i < homeTeams.length; i++) {
        leaguePlayoffBracket.push({
          id: id++,
          home: homeTeams[i].name,
          away: awayTeams[i].name,
          homeScore: null,
          awayScore: null,
        });
      }
      leaguePlayoffRound = 0;
      currentPhase = "league_playoffs";
    } else if (hasKnockout()) {
      bracket = seedKnockout(finalTables.flat(), selectedComp.playoffTeams);
      playoffRound = 0;
      currentPhase = "knockout";
    } else {
 currentPhase = "finished";    }
  }
  render();
}

function advanceLeaguePlayoff() {
  const matches =
    leaguePlayoffRound === 0
      ? leaguePlayoffBracket.slice(0, 2)
      : leaguePlayoffBracket.slice(2);
  for (const m of matches) {
    const score = scores[m.id];
    if (!score) {
      alert("Please fill in all scores for the current round.");
      return;
    }
    if (score.home === score.away) {
      alert(`A winner must be decided for the match: ${m.home} vs ${m.away}.`);
      return;
    }
  }

  leaguePlayoffBracket = leaguePlayoffBracket.map((m) =>
    scores[m.id]
      ? { ...m, homeScore: scores[m.id].home, awayScore: scores[m.id].away }
      : m
  );
  const winners = matches.map((m) =>
    scores[m.id].home > scores[m.id].away ? m.home : m.away
  );

  if (leaguePlayoffRound === 0) {
    // After Semis
    let nextId =
      (leaguePlayoffBracket[leaguePlayoffBracket.length - 1]?.id || 4000) + 1;
    const final = {
      id: nextId,
      home: winners[0],
      away: winners[1],
      homeScore: null,
      awayScore: null,
    };
    leaguePlayoffBracket.push(final);
    leaguePlayoffRound++;
    scores = {};
  } else {
    // After Final
    currentPhase = "knockout"; //
  }
  render();
}

function advancePlayoff() {
  const currentRoundMatches = bracket.filter(m => m.round === playoffRound);
  
  // Check if all current round matches have scores
  for (const m of currentRoundMatches) {
    const score = scores[m.id];
    if (!score) {
      alert("Please fill in all scores for the current round.");
      return;
    }
    if (score.home === score.away) {
      alert(`A winner must be decided for the match: ${m.home} vs ${m.away}.`);
      return;
    }
  }

  // Update scores in bracket
  bracket = bracket.map((m) =>
    scores[m.id]
      ? { ...m, homeScore: scores[m.id].home, awayScore: scores[m.id].away }
      : m
  );

  // Get winners for current round
  const winners = currentRoundMatches.map((m) =>
    scores[m.id].home > scores[m.id].away ? m.home : m.away
  );

  // Check if this is the final round
  if (winners.length > 1) {
    // Create next round matches
    const nextRound = playoffRound + 1;
    let nextId = (bracket[bracket.length - 1]?.id || 2000) + 1;
    
    for (let i = 0; i < winners.length; i += 2) {
      bracket.push({
        id: nextId++,
        home: winners[i],
        away: winners[i + 1],
        homeScore: null,
        awayScore: null,
        round: nextRound
      });
    }
    
    playoffRound = nextRound;
    scores = {};
  } else {
    // Tournament finished
    currentPhase = "finished";
  }
  
  render();
}

// --- BRACKET RENDERING ---
function renderBracket(bracketData, currentRound) {
  const container = document.createElement("div");
  container.className = "w-full overflow-x-auto";
  
  const bracketContainer = document.createElement("div");
  bracketContainer.className = "flex space-x-8 min-w-max py-4";
  
  const totalRounds = getTotalPlayoffRounds();
  
  // Group matches by round
  const matchesByRound = {};
  bracketData.forEach(match => {
    if (!matchesByRound[match.round]) {
      matchesByRound[match.round] = [];
    }
    matchesByRound[match.round].push(match);
  });
  
  // Create columns for each round
  for (let roundNum = 1; roundNum <= totalRounds; roundNum++) {
    const roundColumn = document.createElement("div");
    roundColumn.className = "flex flex-col space-y-8";
    
    const roundTitle = document.createElement("div");
    roundTitle.className = "text-center font-bold text-blue-300 mb-4";
    
    const roundNames = {
      1: totalRounds === 1 ? "Final" : 
         totalRounds === 2 ? "Semi-Finals" : 
         totalRounds === 3 ? "Quarter-Finals" : `Round of ${Math.pow(2, totalRounds - roundNum + 1)}`,
      [totalRounds]: "Final",
      [totalRounds - 1]: "Semi-Finals",
      [totalRounds - 2]: "Quarter-Finals"
    };
    
    roundTitle.textContent = roundNames[roundNum] || `Round ${roundNum}`;
    roundColumn.appendChild(roundTitle);
    
    const matches = matchesByRound[roundNum] || [];
    
    matches.forEach(match => {
      const matchElement = document.createElement("div");
      matchElement.className = `bg-gradient-to-br from-blue-900/40 to-blue-900/60 rounded-xl p-4 border ${
        roundNum === currentRound + 1 ? "border-yellow-500/60 shadow-lg shadow-yellow-900/25" : "border-blue-500/60"
      } min-w-64`;
      
      const isCurrentRound = roundNum === currentRound + 1;
      
      matchElement.innerHTML = `
        <div class="flex items-center justify-between space-x-4">
          <span class="font-medium text-sm truncate flex-1 text-right">${match.home}</span>
          <div class="flex items-center space-x-2">
            <input type="number" min="0" max="15" value="${scores[match.id]?.home ?? ""}" 
                   class="w-12 text-center text-sm bg-black/30 rounded border border-gray-600" 
                   ${!isCurrentRound ? "disabled" : ""}>
            <span class="font-bold text-gray-300">–</span>
            <input type="number" min="0" max="15" value="${scores[match.id]?.away ?? ""}" 
                   class="w-12 text-center text-sm bg-black/30 rounded border border-gray-600" 
                   ${!isCurrentRound ? "disabled" : ""}>
          </div>
          <span class="font-medium text-sm truncate flex-1">${match.away}</span>
        </div>
        ${match.homeScore !== null && match.awayScore !== null ? `
          <div class="text-xs text-center mt-2 text-green-300">
            ${match.homeScore > match.awayScore ? match.home : match.away} advances
          </div>
        ` : ""}
      `;
      
      if (isCurrentRound) {
        const inputs = matchElement.querySelectorAll("input");
        inputs[0].onchange = (e) => {
          let v = parseInt(e.target.value) || 0;
          v = Math.max(0, Math.min(15, v));
          e.target.value = v;
          scores = {
            ...scores,
            [match.id]: { ...(scores[match.id] || { home: 0, away: 0 }), home: v },
          };
        };
        inputs[1].onchange = (e) => {
          let v = parseInt(e.target.value) || 0;
          v = Math.max(0, Math.min(15, v));
          e.target.value = v;
          scores = {
            ...scores,
            [match.id]: { ...(scores[match.id] || { home: 0, away: 0 }), away: v },
          };
        };
      }
      
      roundColumn.appendChild(matchElement);
    });
    
    bracketContainer.appendChild(roundColumn);
  }
  
  container.appendChild(bracketContainer);
  return container;
}

function render() {
  const root = document.getElementById("root");
  root.innerHTML = "";

  // --- PHASE TRANSITION LOGIC ---
  if (
    currentPhase === "league" &&
    (fixtures.length === 0 || bracket.length > 0)
  ) {
    if (selectedComp.format === "knockout" && bracket.length === 0) {
      currentPhase = "knockout";
    } else {
      updateFixtures();
    }
  }

  if (currentPhase === "menu") {
    const container = document.createElement("div");
    container.className = "min-h-screen bg-black text-gray-100 p-6";
    container.innerHTML = `
          <div class="max-w-6xl mx-auto">
            <div class="bg-gray-900 border border-gray-700 rounded-2xl flex flex-col items-center justify-center p-8 mb-8">
              <div class="text-6xl mb-4 animate-bounce">⚽</div>
              <h1 class="text-4xl font-bold mb-2 text-blue-300">FLS</h1>
              <p class="text-gray-400 text-lg mb-6">Choose your competition</p>
              <div id="load-btn-container"></div>
            </div>
            <div id="comp-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"></div>
          </div>`;

    const loadBtnContainer = container.querySelector("#load-btn-container");
    const loadButton = createButton(
      "success",
      "💾 Upload Save",
      "",
      triggerLoad
    );
    loadBtnContainer.appendChild(loadButton);

    const compGrid = container.querySelector("#comp-grid");
    COMPETITIONS.forEach((comp) => {
      const button = createButton(
        "secondary",
        "",
        "h-40 flex flex-col items-center justify-center text-xl space-y-2 hover:scale-105",
        () => {
          selectedComp = comp;
          currentPhase = "league";
          render();
        }
      );
      button.innerHTML = `<div class="text-5xl">${comp.emoji}</div><span class="text-center">${comp.name}</span><span class="text-xs text-gray-400 capitalize">${comp.format} • ${comp.teamCount} teams</span>`;
      compGrid.appendChild(button);
    });
    const customButton = createButton(
      "primary",
      "",
      "h-40 flex flex-col items-center justify-center text-xl space-y-2 hover:scale-105",
      () => {
        currentPhase = "custom_creation";
        render();
      }
    );
    customButton.innerHTML = `<div class="text-5xl">🛠️</div><span class="text-center">Create Custom</span><span class="text-xs text-gray-400 capitalize">Your own tournament</span>`;
    compGrid.appendChild(customButton);
    root.appendChild(container);
    return;
  }

  if (currentPhase === "custom_creation") {
    const container = document.createElement("div");
    container.className = "min-h-screen bg-black text-gray-100 p-6";
    container.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <div class="bg-gray-900 border border-gray-700 rounded-2xl p-8">
                <h1 class="text-3xl font-bold mb-6 text-blue-300">Create Custom Tournament</h1>
                
                <form id="custom-form" class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium mb-2">Tournament Name</label>
                        <input type="text" id="comp-name" class="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white" placeholder="My Custom Tournament">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">Format</label>
                        <select id="comp-format" class="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white">
                            <option value="league">League (Round Robin)</option>
                            <option value="knockout">Knockout Tournament</option>
                            <option value="mixed">Groups + Knockout</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-2">Teams (one per line)</label>
                        <textarea id="team-list" rows="8" class="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white" placeholder="Team 1&#10;Team 2&#10;Team 3&#10;..."></textarea>
                    </div>
                    
                    <div id="format-options" class="space-y-4">
                        <!-- Dynamic options based on format selection -->
                    </div>
                    
                    <div class="flex gap-4">
                        <button type="button" id="create-tournament" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium">Create Tournament</button>
                        <button type="button" id="back-to-menu" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-medium">Back to Menu</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const formatSelect = container.querySelector("#comp-format");
    const formatOptions = container.querySelector("#format-options");

    const updateFormatOptions = () => {
      const format = formatSelect.value;
      formatOptions.innerHTML = "";

      if (format === "mixed") {
        formatOptions.innerHTML = `
                <div>
                    <label class="block text-sm font-medium mb-2">Number of Groups</label>
                    <input type="number" id="group-count" min="2" max="8" value="4" class="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2">Teams Advancing from Each Group</label>
                    <input type="number" id="advance-count" min="1" max="4" value="2" class="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white">
                </div>
            `;
      } else if (format === "league") {
        formatOptions.innerHTML = `
                <div>
                    <label class="block text-sm font-medium mb-2">Repetitions (1 = single round robin, 2 = double)</label>
                    <input type="number" id="repetitions" min="1" max="4" value="2" class="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white">
                </div>
            `;
      }
    };

    formatSelect.onchange = updateFormatOptions;
    updateFormatOptions();

    container.querySelector("#create-tournament").onclick = () => {
      const name =
        container.querySelector("#comp-name").value.trim() ||
        "Custom Tournament";
      const format = container.querySelector("#comp-format").value;
      const teamText = container.querySelector("#team-list").value.trim();

      if (!teamText) {
        alert("Please enter at least 2 teams");
        return;
      }

      const teams = teamText
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t);
      
      // Validate team count for knockout
     // Validate team count for knockout
if (format === "knockout") {
  if (teams.length < 2) {
    alert("Please enter at least 2 teams for knockout tournament");
    return;
  }
  // For knockout, we can handle any number of teams, but warn if not power of 2
  if ((teams.length & (teams.length - 1)) !== 0) {
    if (!confirm(`You have ${teams.length} teams. For a balanced knockout tournament, it's recommended to use a power of 2 (2, 4, 8, 16, etc.). Some teams may get byes. Continue anyway?`)) {
      return;
    }
  }
}

      // Create the custom competition
      selectedComp = {
        id: "custom",
        name: name,
        emoji: "🏆",
        format: format,
        teamCount: teams.length,
        teams: teams,
        positionStyles: {
          1: {
            bg: "bg-yellow-900/40",
            border: "border-yellow-500/60",
            icon: "🏆",
            label: "Champion",
          },
          "2-4": {
            bg: "bg-blue-900/40",
            border: "border-blue-500/60",
            icon: "🥈",
            label: "Top Finish",
          },
        },
      };

      // Set format-specific properties
      if (format === "league") {
        const repetitions =
          parseInt(container.querySelector("#repetitions")?.value) || 2;
        selectedComp.rounds =
          (teams.length % 2 === 0 ? teams.length - 1 : teams.length) *
          repetitions;
        selectedComp.repetitions = repetitions;
      } else if (format === "mixed") {
        const groupCount =
          parseInt(container.querySelector("#group-count")?.value) || 4;
        const advanceCount =
          parseInt(container.querySelector("#advance-count")?.value) || 2;

        if (teams.length % groupCount !== 0) {
          alert(
            `Number of teams (${teams.length}) must be divisible by number of groups (${groupCount})`
          );
          return;
        }

        selectedComp.groupCount = groupCount;
        selectedComp.rounds =
          ((teams.length / groupCount) % 2 === 0
            ? teams.length / groupCount - 1
            : teams.length / groupCount) * 2;
        selectedComp.playoffTeams = groupCount * advanceCount;
        selectedComp.repetitions = 2;
      } else if (format === "knockout") {
        // For knockout, we don't need rounds property
        selectedComp.rounds = 0;
      }

      currentPhase = "league";
      render();
    };

    container.querySelector("#back-to-menu").onclick = () => {
      currentPhase = "menu";
      render();
    };

    root.appendChild(container);
    return;
  }

  const needsTeamSelection = selectedComp.teams.length === 0 && !teamsConfirmed;
  if (needsTeamSelection) {
    return;
  }

  const isQualifyingPhase = currentPhase === "qualifying";
  if (isQualifyingPhase) {
    const matches = qualifyingFixtures.filter(
      (m) => m.round === qualifyingRound
    );
    const container = document.createElement("div");
    container.className =
      "min-h-screen bg-black text-gray-100 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6";

    const tableContainer = document.createElement("div");
    tableContainer.className =
      "lg:col-span-2 bg-gray-900 border border-gray-700 rounded-2xl p-6 flex flex-col shadow-xl";
    tableContainer.innerHTML = `<h3 class="text-2xl font-bold mb-4 text-blue-300">Qualifying Group Tables</h3>`;
    const stats = computeStats(
      selectedComp.qualifying.pool,
      qualifyingFixtures,
      qualifyingRound - 1,
      true
    );
    const tables = [...new Set(stats.map((s) => s.group).filter(Boolean))].map(
      (g) => stats.filter((t) => t.group === g)
    );
    const tableContent = document.createElement("div");
    tableContent.className = "space-y-4 overflow-y-auto pr-2 flex-grow";
    tables.forEach((groupStats) => {
      const groupDiv = document.createElement("div");
      groupDiv.className =
        "space-y-2 bg-gray-800/70 rounded-xl border border-gray-700 p-3 shadow-inner";
      groupDiv.innerHTML = `<h4 class="text-sm font-bold text-blue-300">📊 Group ${groupStats[0].group}</h4>
              <div class="text-left text-xs font-mono uppercase text-gray-400 flex justify-between px-2 mb-2">
                <span class="flex-1 ml-12">Team</span><div class="flex space-x-4"><span class="w-6 text-center">P</span><span class="w-6 text-center">W</span><span class="w-6 text-center">D</span><span class="w-6 text-center">L</span><span class="w-8 text-center">G/D</span><span class="w-8 text-center">Pts</span></div>
              </div>`;
      groupStats.forEach((t, i) =>
        groupDiv.appendChild(
          createLeagueTableRow(t, i + 1, {
            positionStyles: {
              [`1-${selectedComp.qualifying.advance}`]: {
                bg: "bg-green-900/40",
                border: "border-green-500/60",
                icon: "✔️",
                label: "Qualifies",
              },
            },
          })
        )
      );
      tableContent.appendChild(groupDiv);
    });
    tableContainer.appendChild(tableContent);

    const fixtureContainer = document.createElement("div");
    fixtureContainer.className =
      "bg-gray-900 border border-gray-700 rounded-2xl p-6 flex flex-col shadow-xl";
    fixtureContainer.innerHTML = `<div class="text-center mb-4"><h1 class="text-2xl font-bold text-blue-300">${selectedComp.emoji} ${selectedComp.name}</h1><p class="text-gray-400 text-lg">Qualifying Round</p></div><h3 class="text-xl font-bold mb-4 text-blue-300">Fixtures: Round ${qualifyingRound}</h3>`;
    const buttonDiv = document.createElement("div");
    buttonDiv.className = "flex flex-col space-y-3 mb-4";
    buttonDiv.appendChild(
      createButton(
        "success",
        "Advance Qualifying Round",
        "w-full py-3 text-lg",
        advanceQualifying
      )
    );
    buttonDiv.appendChild(
      createButton("warning", "💾 Download Save", "w-full py-2", saveState)
    );
    buttonDiv.appendChild(
      createButton("secondary", "← New Tournament", "w-full py-2", resetState)
    );
    const matchesDiv = document.createElement("div");
    matchesDiv.className = "space-y-3 overflow-y-auto pr-2 mb-4 flex-grow";
    matches.forEach((m) => {
      const matchDiv = document.createElement("div");
      matchDiv.className =
        "bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 shadow-lg border border-gray-700";
      matchDiv.innerHTML = `
            <div class="flex items-center justify-between text-base font-medium">
              <span class="w-1/3 truncate text-right pr-2">${m.home}</span>
              <div class="flex items-center space-x-2">
                <input type="number" min="0" max="15" value="${
                  scores[m.id]?.home ?? ""
                }" class="w-12 text-center text-lg bg-black/30 rounded-md border border-gray-600">
                <span class="text-xl font-bold text-gray-400">-</span>
                <input type="number" min="0" max="15" value="${
                  scores[m.id]?.away ?? ""
                }" class="w-12 text-center text-lg bg-black/30 rounded-md border border-gray-600">
              </div>
              <span class="w-1/3 truncate pl-2">${m.away}</span>
            </div>
            <div class="text-xs text-gray-400 text-center mt-1">Group ${
              m.group
            }</div>`;
      const inputs = matchDiv.querySelectorAll("input");
      inputs[0].onchange = (e) => {
        let v = parseInt(e.target.value) || 0;
        v = Math.max(0, Math.min(15, v));
        e.target.value = v;
        scores = {
          ...scores,
          [m.id]: { ...(scores[m.id] || { h: 0, a: 0 }), home: v },
        };
      };
      inputs[1].onchange = (e) => {
        let v = parseInt(e.target.value) || 0;
        v = Math.max(0, Math.min(15, v));
        e.target.value = v;
        scores = {
          ...scores,
          [m.id]: { ...(scores[m.id] || { h: 0, a: 0 }), away: v },
        };
      };
      matchesDiv.appendChild(matchDiv);
    });
    fixtureContainer.appendChild(buttonDiv);
    fixtureContainer.appendChild(matchesDiv);
    container.appendChild(tableContainer);
    container.appendChild(fixtureContainer);
    root.appendChild(container);
    return;
  }

  // Handle knockout-only tournaments - FIXED
  if (selectedComp.format === "knockout" && currentPhase === "league") {
    console.log("Knockout tournament detected, switching to knockout phase");
    // Generate fixtures and switch to knockout phase
    updateFixtures();
    // Don't return - let the rendering continue to show knockout phase
  }
  const isLeaguePhase =
    currentPhase === "league" &&
    (selectedComp.format === "league" || hasGroups());
  if (isLeaguePhase) {
    const totalLeagueRounds = getTotalLeagueRounds();
    const displayRound = round === 0 ? 1 : round;
    const matches = fixtures.filter((m) => m.round === displayRound);
    const container = document.createElement("div");
    container.className =
      "min-h-screen bg-black text-gray-100 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6";
    const tableContainer = document.createElement("div");
    tableContainer.className =
      "lg:col-span-2 bg-gray-900 border border-gray-700 rounded-2xl p-6 flex flex-col shadow-xl";
    tableContainer.innerHTML = `<h3 class="text-2xl font-bold mb-4 text-blue-300">${
      hasGroups() ? "Group Tables" : "League Table"
    }</h3>`;
    const tables = computeTables();
    const tableContent = document.createElement("div");
    tableContent.className = "space-y-4 overflow-y-auto pr-2 flex-grow";
    if (tables.length > 0 && tables[0].length > 0) {
      tables.forEach((groupStats) => {
        const groupDiv = document.createElement("div");
        groupDiv.className =
          "space-y-2 bg-gray-800/70 rounded-xl border border-gray-700 p-3 shadow-inner";
        if (hasGroups()) {
          groupDiv.innerHTML = `<h4 class="text-sm font-bold text-blue-300">📊 Group ${groupStats[0].group}</h4>`;
        }
        groupDiv.innerHTML += `<div class="text-left text-xs font-mono uppercase text-gray-400 flex justify-between px-2 mb-2"><span class="flex-1 ml-12">Team</span><div class="flex space-x-4"><span class="w-6 text-center">P</span><span class="w-6 text-center">W</span><span class="w-6 text-center">D</span><span class="w-6 text-center">L</span><span class="w-8 text-center">G/D</span><span class="w-8 text-center">Pts</span></div></div>`;
        groupStats.forEach((t, i) =>
          groupDiv.appendChild(createLeagueTableRow(t, i + 1, selectedComp))
        );
        tableContent.appendChild(groupDiv);
      });
    } else {
      tableContent.innerHTML = `<div class="text-gray-400 p-4 text-center">The ${
        hasGroups() ? "tournament" : "season"
      } is about to begin...</div>`;
    }
    tableContainer.appendChild(tableContent);

    const fixtureContainer = document.createElement("div");
    fixtureContainer.className =
      "bg-gray-900 border border-gray-700 rounded-2xl p-6 flex flex-col shadow-xl";
    fixtureContainer.innerHTML = `<div class="text-center mb-4"><h1 class="text-2xl font-bold text-blue-300">${
      selectedComp.emoji
    } ${selectedComp.name}</h1><p class="text-gray-400 text-lg">${
      round > 0 ? `Round ${round} of ${totalLeagueRounds}` : "Pre-Season"
    }</p></div><h3 class="text-xl font-bold mb-4 text-blue-300">Fixtures: Round ${displayRound}</h3>`;
    const buttonDiv = document.createElement("div");
    buttonDiv.className = "flex flex-col space-y-3 mb-4";
    if (round === 0) {
      buttonDiv.appendChild(
        createButton("primary", "🚀 Start", "w-full py-3 text-lg", () => {
          round = 1;
          render();
        })
      );
    } else {
      buttonDiv.appendChild(
        createButton(
          "success",
          "Advance Round",
          "w-full py-3 text-lg",
          advanceLeague
        )
      );
    }
    buttonDiv.appendChild(
      createButton("warning", "💾 Download Save", "w-full py-2", saveState)
    );
    buttonDiv.appendChild(
      createButton("secondary", "← New Tournament", "w-full py-2", resetState)
    );
    const matchesDiv = document.createElement("div");
    matchesDiv.className = "space-y-3 overflow-y-auto pr-2 mb-4 flex-grow";
    matches.forEach((m) => {
      const matchDiv = document.createElement("div");
      matchDiv.className =
        "bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 shadow-lg border border-gray-700";
      matchDiv.innerHTML = `
            <div class="flex items-center justify-between text-base font-medium">
              <span class="w-1/3 truncate text-right pr-2">${m.home}</span>
              <div class="flex items-center space-x-2">
                <input type="number" min="0" max="15" value="${
                  scores[m.id]?.home ?? ""
                }" class="w-12 text-center text-lg bg-black/30 rounded-md border border-gray-600" ${
        round === 0 ? "disabled" : ""
      }>
                <span class="text-xl font-bold text-gray-400">-</span>
                <input type="number" min="0" max="15" value="${
                  scores[m.id]?.away ?? ""
                }" class="w-12 text-center text-lg bg-black/30 rounded-md border border-gray-600" ${
        round === 0 ? "disabled" : ""
      }>
              </div>
              <span class="w-1/3 truncate pl-2">${m.away}</span>
            </div>
            ${
              hasGroups()
                ? `<div class="text-xs text-gray-400 text-center mt-1">Group ${m.group}</div>`
                : ""
            }
          `;
      const inputs = matchDiv.querySelectorAll("input");
      inputs[0].onchange = (e) => {
        let v = parseInt(e.target.value) || 0;
        v = Math.max(0, Math.min(15, v));
        e.target.value = v;
        scores = {
          ...scores,
          [m.id]: { ...(scores[m.id] || { h: 0, a: 0 }), home: v },
        };
      };
      inputs[1].onchange = (e) => {
        let v = parseInt(e.target.value) || 0;
        v = Math.max(0, Math.min(15, v));
        e.target.value = v;
        scores = {
          ...scores,
          [m.id]: { ...(scores[m.id] || { h: 0, a: 0 }), away: v },
        };
      };
      matchesDiv.appendChild(matchDiv);
    });
    fixtureContainer.appendChild(buttonDiv);
    fixtureContainer.appendChild(matchesDiv);
    container.appendChild(tableContainer);
    container.appendChild(fixtureContainer);
    root.appendChild(container);
    return;
  }

  const isKnockoutPhase = currentPhase === "knockout" || currentPhase === "league_playoffs";
if (isKnockoutPhase) {
  console.log("Rendering knockout phase, bracket:", bracket, "playoffRound:", playoffRound);
  
  const isLeaguePO = currentPhase === "league_playoffs";
  const bracketToUse = isLeaguePO ? leaguePlayoffBracket : bracket;
  const roundToUse = isLeaguePO ? leaguePlayoffRound : playoffRound;
  const advanceFn = isLeaguePO ? advanceLeaguePlayoff : advancePlayoff;
  
  // Get current round matches
  const currentRoundMatches = bracketToUse.filter(m => m.round === roundToUse);
  
  console.log("Current round matches:", currentRoundMatches);
  
  // FIX: Prevent infinite recursion by checking if we should finish the tournament
  if (currentRoundMatches.length === 0) {
    // Check if we have a completed final match
    const finalMatch = bracketToUse.find(m => m.round === roundToUse - 1);
    if (finalMatch && finalMatch.homeScore !== null && finalMatch.awayScore !== null) {
      // Tournament is legitimately finished
      currentPhase = "finished";
    } else {
      // This is an error state - regenerate bracket
      console.log("No matches found, regenerating bracket");
      if (selectedComp.format === "knockout") {
        bracket = generateKnockoutBracket(getActualTeams());
        playoffRound = 1;
      }
    }
    // Only render once to prevent recursion
    if (currentPhase === "finished") {
      render();
    } else {
      // Add a small delay to prevent immediate recursion
      setTimeout(() => render(), 10);
    }
    return;
  }

  // Rest of the knockout rendering code remains the same...
  const totalRounds = Math.ceil(Math.log2(getKnockoutTeamsCount()));
  let stageName;
  
  if (isLeaguePO) {
    stageName = roundToUse === 0 ? "Playoff Semi-Finals" : "Playoff Final";
  } else {
    const stageNames = {
      1: totalRounds === 1 ? "Final" : 
         totalRounds === 2 ? "Semi-finals" : 
         totalRounds === 3 ? "Quarter-finals" : `Round of ${getKnockoutTeamsCount()}`,
      [totalRounds]: "Final",
      [totalRounds - 1]: "Semi-finals",
      [totalRounds - 2]: "Quarter-finals"
    };
    stageName = stageNames[roundToUse] || `Round ${roundToUse}`;
  }

  const container = document.createElement("div");
  container.className = "min-h-screen bg-black text-gray-100 p-6 flex flex-col items-center";
  container.innerHTML = `
    <h1 class="text-4xl font-bold mb-4 text-blue-300">${stageName}</h1>
    <p class="text-blue-400 mb-2 text-lg">${selectedComp.name}</p>
    <div class="text-gray-400 mb-6">Round ${roundToUse} of ${totalRounds}</div>
  `;
  
  const matchesDiv = document.createElement("div");
  matchesDiv.className = "space-y-4 w-full max-w-3xl mb-6";
  
  currentRoundMatches.forEach((m) => {
    const matchDiv = document.createElement("div");
    matchDiv.className = "bg-gradient-to-br from-blue-900/40 to-blue-900/60 rounded-xl p-5 border border-blue-500/60 shadow-lg";
    matchDiv.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-xl w-2/5 truncate text-right pr-4">${m.home}</span>
        <div class="flex items-center space-x-4">
          <input type="number" min="0" max="15" value="${scores[m.id]?.home ?? ""}" 
                 class="w-16 text-center text-xl bg-black/30 rounded-md border border-gray-600">
          <span class="font-bold text-2xl text-gray-300">–</span>
          <input type="number" min="0" max="15" value="${scores[m.id]?.away ?? ""}" 
                 class="w-16 text-center text-xl bg-black/30 rounded-md border border-gray-600">
        </div>
        <span class="font-bold text-xl w-2/5 truncate text-left pl-4">${m.away}</span>
      </div>
    `;
    
    const inputs = matchDiv.querySelectorAll("input");
    inputs[0].onchange = (e) => {
      let v = parseInt(e.target.value) || 0;
      v = Math.max(0, Math.min(15, v));
      e.target.value = v;
      scores = {
        ...scores,
        [m.id]: { ...(scores[m.id] || { home: 0, away: 0 }), home: v },
      };
    };
    inputs[1].onchange = (e) => {
      let v = parseInt(e.target.value) || 0;
      v = Math.max(0, Math.min(15, v));
      e.target.value = v;
      scores = {
        ...scores,
        [m.id]: { ...(scores[m.id] || { home: 0, away: 0 }), away: v },
      };
    };
    
    matchesDiv.appendChild(matchDiv);
  });
  
  const buttonDiv = document.createElement("div");
  buttonDiv.className = "flex gap-4 items-center";
  
  const isFinalRound = roundToUse === totalRounds;
  buttonDiv.appendChild(
    createButton(
      "success",
      isFinalRound ? "🏆 Finish Tournament" : "⚡ Advance to Next Round",
      "text-xl py-4 px-8",
      advanceFn
    )
  );
  buttonDiv.appendChild(
    createButton("warning", "💾 Download Save", "py-3 px-6", saveState)
  );
  buttonDiv.appendChild(
    createButton("secondary", "← New Tournament", "py-3 px-6", resetState)
  );
  
  container.appendChild(matchesDiv);
  container.appendChild(buttonDiv);
  root.appendChild(container);
  return;
}

  if (currentPhase === "finished") {
    let champion = "Unknown",
      finalMessage = "Champion";
    const finalTables = computeTables();

    if (leaguePlayoffBracket.length > 0) {
      const final = leaguePlayoffBracket[leaguePlayoffBracket.length - 1];
      champion = final.homeScore > final.awayScore ? final.home : final.away;
      finalMessage = "Playoff Winner";
    } else if (bracket.length > 0) {
      const final = bracket[bracket.length - 1];
      champion = final.homeScore > final.awayScore ? final.home : final.away;
    } else if (finalTables.length > 0 && finalTables[0].length > 0) {
      champion = finalTables[0][0].name;
    }

    const container = document.createElement("div");
    container.className =
      "min-h-screen bg-black text-gray-100 p-6 flex flex-col items-center justify-center";
    container.innerHTML = `
          <div class="w-full max-w-4xl bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center shadow-2xl">
            <div class="text-6xl animate-bounce mb-4">🏆</div>
            <h1 class="text-4xl font-bold mb-3 text-yellow-300">${selectedComp.name} ${finalMessage}</h1>
            <p class="text-6xl font-extrabold text-yellow-400 animate-pulse my-6">${champion}</p>
            <div id="finish-btn-container"></div>
            <div id="standings-container" class="mt-8 text-left"></div>
          </div>
        `;
    container
      .querySelector("#finish-btn-container")
      .appendChild(
        createButton(
          "primary",
          "Start New Tournament",
          "text-lg py-3",
          resetState
        )
      );

    if (selectedComp.format !== "knockout") {
      const standingsDiv = container.querySelector("#standings-container");
      standingsDiv.innerHTML = `<h3 class="text-xl font-bold text-blue-300 mb-4">Final Standings</h3>`;
      finalTables.forEach((groupStats) => {
        const groupDiv = document.createElement("div");
        groupDiv.className =
          "space-y-2 bg-gray-800/70 rounded-xl border border-gray-700 p-3 shadow-inner mb-4";
        if (hasGroups()) {
          groupDiv.innerHTML = `<h4 class="text-sm font-bold text-blue-300">📊 Group ${groupStats[0].group}</h4>`;
        }
        groupDiv.innerHTML += `<div class="text-left text-xs font-mono uppercase text-gray-400 flex justify-between px-2 mb-2"><span class="flex-1 ml-12">Team</span><div class="flex space-x-4"><span class="w-6 text-center">P</span><span class="w-6 text-center">W</span><span class="w-6 text-center">D</span><span class="w-6 text-center">L</span><span class="w-8 text-center">G/D</span><span class="w-8 text-center">Pts</span></div></div>`;
        groupStats.forEach((t, i) =>
          groupDiv.appendChild(createLeagueTableRow(t, i + 1, selectedComp))
        );
        standingsDiv.appendChild(groupDiv);
      });
    }
    root.appendChild(container);
    return;
  }

  root.innerHTML =
    '<div class="min-h-screen bg-black text-gray-100 p-6">Loading or unexpected state...</div>';
}

// Initial render
render();
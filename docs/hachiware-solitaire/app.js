(() => {
  'use strict';

  const SUITS = ['♠', '♥', '♣', '♦'];
  const SUIT_KEYS = ['S', 'H', 'C', 'D'];
  const RANKS = {1:'A',11:'J',12:'Q',13:'K'};
  const STORAGE_KEY = 'hachiware-solitaire-state-v20';
  const STATS_KEY = 'hachiware-solitaire-stats-v1';

  const DIFFICULTIES = {
    1: {name:'エキスパート', draw:1, hints:6, undos:4, glow:false, lockFoundation:false, maxRun:5, emptyKingSingle:false, autoFoundation:true, foundationGap:99, desc:'ヒント6回・やり直し4回・連続移動5枚まで'},
    2: {name:'プロ', draw:1, hints:5, undos:3, glow:false, lockFoundation:true, maxRun:4, emptyKingSingle:true, autoFoundation:false, foundationGap:3, desc:'ヒント5回・組札戻し不可・連続移動4枚まで'},
    3: {name:'マスター', draw:1, hints:4, undos:2, glow:false, lockFoundation:true, maxRun:3, emptyKingSingle:true, autoFoundation:false, foundationGap:2, desc:'ヒント4回・組札バランス制限・連続移動3枚まで'},
    4: {name:'極', draw:1, hints:3, undos:1, glow:false, lockFoundation:true, maxRun:2, emptyKingSingle:true, autoFoundation:false, foundationGap:1, desc:'ヒント3回・組札バランス厳格・連続移動2枚まで'},
    5: {name:'ねこ神級 MAX', draw:1, hints:3, undos:0, glow:false, lockFoundation:true, maxRun:1, emptyKingSingle:true, autoFoundation:false, foundationGap:1, desc:'ヒント3回・やり直しなし・1枚移動・組札バランス厳格'}
  };

  const els = {
    stock: document.getElementById('stockPile'),
    waste: document.getElementById('wastePile'),
    drawNext: document.getElementById('drawNextBtn'),
    foundations: document.getElementById('foundations'),
    tableau: document.getElementById('tableau'),
    difficulty: document.getElementById('difficultyLabel'),
    moves: document.getElementById('movesLabel'),
    time: document.getElementById('timeLabel'),
    redeal: document.getElementById('redealLabel'),
    undo: document.getElementById('undoBtn'),
    hint: document.getElementById('hintBtn'),
    newGame: document.getElementById('newBtn'),
    settings: document.getElementById('settingsBtn'),
    settingsSheet: document.getElementById('settingsSheet'),
    closeSettings: document.getElementById('closeSettingsBtn'),
    difficultyGrid: document.getElementById('difficultyGrid'),
    statsList: document.getElementById('statsList'),
    resetStats: document.getElementById('resetStatsBtn'),
    helperTitle: document.getElementById('helperTitle'),
    helperText: document.getElementById('helperText'),
    catLine: document.getElementById('catLine'),
    winSheet: document.getElementById('winSheet'),
    winSummary: document.getElementById('winSummary'),
    winNew: document.getElementById('winNewBtn'),
    winClose: document.getElementById('winCloseBtn'),
    gameOverSheet: document.getElementById('gameOverSheet'),
    gameOverNew: document.getElementById('gameOverNewBtn'),
    gameOverUndo: document.getElementById('gameOverUndoBtn'),
    install: document.getElementById('installBtn')
  };

  let state = null;
  let selected = null;
  let undoStack = [];
  let timer = null;
  let deferredInstall = null;
  let dragState = null;
  let suppressClickUntil = 0;

  function newStats() {
    return {wins:{1:0,2:0,3:0,4:0,5:0}, best:{1:null,2:null,3:null,4:null,5:null}, played:{1:0,2:0,3:0,4:0,5:0}};
  }

  function loadStats() {
    try { return {...newStats(), ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}')}; }
    catch { return newStats(); }
  }

  function saveStats(stats) { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }

  function cardColor(card) { return (card.suit === 'H' || card.suit === 'D') ? 'red' : 'black'; }
  function rankLabel(rank) { return RANKS[rank] || String(rank); }
  function suitSymbol(card) { return SUITS[SUIT_KEYS.indexOf(card.suit)]; }

  function catSuitArt(suit) {
    const label = suit === 'S' ? 'スペード' : suit === 'H' ? 'ハート' : suit === 'C' ? 'クラブ' : 'ダイヤ';
    if (suit === 'S') return '<svg class="suit-art" viewBox="0 0 100 100" role="img" aria-label="'+label+'"><path d="M50 5C40 22 14 35 14 57c0 15 11 25 25 25 6 0 11-2 15-6-2 9-6 15-12 19h16c-6-4-10-10-12-19 4 4 9 6 15 6 14 0 25-10 25-25C86 35 60 22 50 5z" fill="#1a1b1d"/><path d="M34 39l8-10 8 11 8-11 9 11-2 23c-2 14-9 21-15 21s-13-7-15-21z" fill="#fff7e8"/><path d="M42 29l8 11 8-11-8 4z" fill="#17181a"/><ellipse cx="39" cy="52" rx="8" ry="9" fill="#bde34b"/><ellipse cx="61" cy="52" rx="8" ry="9" fill="#bde34b"/><ellipse cx="39" cy="53" rx="4" ry="6" fill="#17221a"/><ellipse cx="61" cy="53" rx="4" ry="6" fill="#17221a"/><circle cx="36" cy="48" r="2" fill="#fff"/><circle cx="58" cy="48" r="2" fill="#fff"/><path d="M46 64l4-3 4 3-4 4z" fill="#f4a7aa"/><path d="M50 68c-3 4-7 5-10 3m10-3c3 4 7 5 10 3" fill="none" stroke="#573c3d" stroke-width="1.6" stroke-linecap="round"/><path d="M34 66H18m17 5H21m45-5h16m-17 5h14" stroke="#fff7e8" stroke-width="2" stroke-linecap="round"/></svg>';
    if (suit === 'H') return '<svg class="suit-art" viewBox="0 0 100 100" role="img" aria-label="'+label+'"><path d="M50 91C42 78 13 63 13 36 13 20 24 10 38 10c8 0 14 4 18 10 4-6 10-10 18-10 14 0 25 10 25 26 0 27-29 42-49 55z" fill="#d94750"/><path d="M31 32l9-10 10 10 10-10 10 10-3 25c-2 13-9 21-17 21s-15-8-17-21z" fill="#1a1b1d"/><path d="M39 37l11-9 11 9v25c-3 9-7 13-11 13s-8-4-11-13z" fill="#fff7e8"/><ellipse cx="41" cy="47" rx="7" ry="8" fill="#bde34b"/><ellipse cx="59" cy="47" rx="7" ry="8" fill="#bde34b"/><ellipse cx="41" cy="48" rx="3.6" ry="5.5" fill="#17221a"/><ellipse cx="59" cy="48" rx="3.6" ry="5.5" fill="#17221a"/><path d="M46 59l4-3 4 3-4 4z" fill="#f4a7aa"/><circle cx="27" cy="64" r="10" fill="#fff7e8"/><circle cx="73" cy="64" r="10" fill="#fff7e8"/><circle cx="27" cy="64" r="4.5" fill="#f3a4a8"/><circle cx="73" cy="64" r="4.5" fill="#f3a4a8"/></svg>';
    if (suit === 'C') return '<svg class="suit-art" viewBox="0 0 100 100" role="img" aria-label="'+label+'"><path d="M50 40c-5-19 6-31 20-31 14 0 24 10 24 23 0 11-7 19-16 22 10 2 17 10 17 21 0 13-10 23-24 23-10 0-18-5-21-13-3 8-11 13-21 13C15 98 5 88 5 75c0-11 7-19 17-21C13 51 6 43 6 32 6 19 16 9 30 9c14 0 25 12 20 31z" fill="#1a1b1d"/><path d="M45 66h10c1 12 5 21 12 29H33c7-8 11-17 12-29z" fill="#1a1b1d"/><g fill="#fff7e8"><circle cx="30" cy="31" r="13"/><circle cx="70" cy="31" r="13"/><circle cx="50" cy="67" r="13"/></g><g fill="#f3a4a8"><circle cx="30" cy="31" r="5"/><circle cx="70" cy="31" r="5"/><circle cx="50" cy="67" r="5"/></g><g fill="#f3a4a8"><circle cx="24" cy="23" r="2.6"/><circle cx="36" cy="23" r="2.6"/><circle cx="64" cy="23" r="2.6"/><circle cx="76" cy="23" r="2.6"/><circle cx="44" cy="59" r="2.6"/><circle cx="56" cy="59" r="2.6"/></g></svg>';
    return '<svg class="suit-art" viewBox="0 0 100 100" role="img" aria-label="'+label+'"><path d="M50 4L94 50 50 96 6 50z" fill="#d94750"/><path d="M31 31l9-9 10 10 10-10 9 9-2 27c-1 14-8 23-17 23s-16-9-17-23z" fill="#1a1b1d"/><path d="M39 38l11-9 11 9v24c-2 10-7 15-11 15s-9-5-11-15z" fill="#fff7e8"/><ellipse cx="41" cy="48" rx="7" ry="8" fill="#bde34b"/><ellipse cx="59" cy="48" rx="7" ry="8" fill="#bde34b"/><ellipse cx="41" cy="49" rx="3.6" ry="5.5" fill="#17221a"/><ellipse cx="59" cy="49" rx="3.6" ry="5.5" fill="#17221a"/><path d="M46 60l4-3 4 3-4 4z" fill="#f4a7aa"/><path d="M24 62c5-9 12-10 17-4v13H28zM76 62c-5-9-12-10-17-4v13h13z" fill="#fff7e8"/><circle cx="33" cy="63" r="3" fill="#f3a4a8"/><circle cx="67" cy="63" r="3" fill="#f3a4a8"/></svg>';
  }

  function catBackArt() {
    return '<svg class="card-back-art" viewBox="0 0 100 142" aria-hidden="true"><defs><pattern id="q" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="26" height="26" fill="#739061"/><path d="M0 0H26V26H0z" fill="none" stroke="#d8d5a8" stroke-width="1" stroke-dasharray="2 3"/></pattern></defs><rect x="1" y="1" width="98" height="140" rx="9" fill="#fff7e8"/><rect x="5" y="5" width="90" height="132" rx="7" fill="url(#q)" stroke="#d7bd82" stroke-width="1.4"/><g transform="translate(22 39) scale(.56)"><path d="M14 31L28 10l16 13 16-13 14 21-2 35c-2 18-14 30-28 30S18 84 16 66z" fill="#1b1b1d"/><path d="M32 36l12-10 12 10v35c-3 11-7 16-12 16s-9-5-12-16z" fill="#fff7e8"/><ellipse cx="34" cy="49" rx="8" ry="9" fill="#bde34b"/><ellipse cx="54" cy="49" rx="8" ry="9" fill="#bde34b"/><circle cx="34" cy="50" r="4" fill="#17221a"/><circle cx="54" cy="50" r="4" fill="#17221a"/><path d="M40 63l4-3 4 3-4 4z" fill="#f4a7aa"/></g><g fill="#f5c0b7" opacity=".95"><circle cx="18" cy="20" r="3"/><circle cx="14" cy="15" r="1.5"/><circle cx="18" cy="13" r="1.5"/><circle cx="22" cy="15" r="1.5"/><circle cx="82" cy="119" r="3"/><circle cx="78" cy="114" r="1.5"/><circle cx="82" cy="112" r="1.5"/><circle cx="86" cy="114" r="1.5"/></g><g font-size="11" font-family="serif" opacity=".9"><text x="75" y="27" fill="#1b1b1d">♠</text><text x="15" y="124" fill="#c33a49">♥</text><text x="77" y="126" fill="#1b1b1d">♣</text><text x="13" y="29" fill="#c33a49">♦</text></g></svg>';
  }

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }


  function shuffledCopy(items) {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function makeCard(suit, rank, faceUp = false) {
    return {id:`${suit}${rank}`, suit, rank, faceUp};
  }

  function buildOpeningStructure() {
    const reds = shuffledCopy(['H','D']);
    const blacks = shuffledCopy(['S','C']);
    const startsBlack = Math.random() < .5;
    const first = startsBlack ? blacks : reds;
    const second = startsBlack ? reds : blacks;

    const chain = [
      makeCard(first[0], 13, true),
      makeCard(second[0], 12, true),
      makeCard(first[1], 11, true),
      makeCard(first[0], 10, true),
      makeCard(second[1], 9, true),
      makeCard(first[1], 8, true),
      makeCard(second[0], 7, true)
    ];

    const bridgeSuit = second[Math.floor(Math.random() * second.length)];
    const bridge = makeCard(bridgeSuit, 11, false);
    return {chain, bridge};
  }

  function buildFoundationOrder(blockers, bridge) {
    const blocked = new Set(blockers.map(c => c.id));
    blocked.add(bridge.id);
    const order = [];
    for (let rank = 1; rank <= 13; rank++) {
      for (const suit of shuffledCopy(SUIT_KEYS)) {
        const id = `${suit}${rank}`;
        if (!blocked.has(id)) order.push(makeCard(suit, rank, false));
      }
    }
    return order;
  }

  function splitBalancedStock(order, count = 10) {
    const suitCounts = Object.fromEntries(SUIT_KEYS.map(s => [s, 0]));
    const chosen = [];
    const chosenIndexes = new Set();

    // Entire order is rank-major. These targets spread stock from low to high ranks.
    const targets = [0.05,0.14,0.23,0.32,0.41,0.50,0.60,0.70,0.82,0.94]
      .slice(0, count)
      .map(f => Math.round((order.length - 1) * f));

    for (const target of targets) {
      let best = null;
      for (let i = 0; i < order.length; i++) {
        if (chosenIndexes.has(i)) continue;
        const card = order[i];

        // Four suits should be distributed roughly 2-3 cards each.
        if (suitCounts[card.suit] >= 3) continue;

        const band = card.rank <= 4 ? 0 : card.rank <= 9 ? 1 : 2;
        const bandCount = chosen.filter(x => (x.card.rank <= 4 ? 0 : x.card.rank <= 9 ? 1 : 2) === band).length;
        const score =
          Math.abs(i - target) * 10 +
          suitCounts[card.suit] * 5 +
          bandCount * 2;

        if (!best || score < best.score) best = {index:i, card, score};
      }

      if (!best) {
        const i = order.findIndex((_, idx) => !chosenIndexes.has(idx));
        best = {index:i, card:order[i], score:0};
      }

      chosenIndexes.add(best.index);
      suitCounts[best.card.suit] += 1;
      chosen.push(best);
    }

    chosen.sort((a,b) => a.index - b.index);
    const stockDrawOrder = chosen.map(x => x.card);
    const tableauOrder = order.filter((_, idx) => !chosenIndexes.has(idx));
    return {stockDrawOrder, tableauOrder};
  }

  function chooseCapacities() {
    // Final tableau column sizes are always all different:
    // 3,4,5,6,7,8,9 cards in a random column order.
    // One visible card sits on each column, so hidden capacities are 2..8.
    return shuffledCopy([2,3,4,5,6,7,8]);
  }


  function distributeBalanced(order, visible, bridge) {
    const capacities = chooseCapacities();
    const columns = Array.from({length:7}, () => []);
    const kCol = visible.findIndex(c => c.rank === 13);
    const jCol = visible.findIndex(c => c.rank === 11);
    const openCols = [0,1,2,3,4,5,6].filter(c => c !== kCol && c !== jCol);

    columns[jCol].push(bridge);

    const lateNeed = capacities[kCol] + (capacities[jCol] - 1);
    const late = order.slice(-lateNeed);
    const early = order.slice(0, order.length - lateNeed);

    let lateTurn = Math.random() < .5 ? kCol : jCol;
    for (const card of late) {
      let candidates = [kCol, jCol].filter(col => columns[col].length < capacities[col]);
      if (candidates.length > 1) {
        const preferred = candidates.find(col => {
          const prev = columns[col][columns[col].length - 1];
          return col === lateTurn && (!prev || prev.suit !== card.suit);
        });
        if (preferred != null) candidates = [preferred];
      }
      const col = candidates[0];
      columns[col].push(card);
      lateTurn = col === kCol ? jCol : kCol;
    }

    for (let index = 0; index < early.length; index++) {
      const card = early[index];
      const available = openCols.filter(col => columns[col].length < capacities[col]);
      const minRatio = Math.min(...available.map(col => columns[col].length / capacities[col]));
      let candidates = available.filter(col =>
        (columns[col].length / capacities[col]) <= minRatio + 0.20
      );

      const diffSuit = candidates.filter(col => {
        const prev = columns[col][columns[col].length - 1];
        return !prev || prev.suit !== card.suit;
      });
      if (diffSuit.length) candidates = diffSuit;

      const diffRank = candidates.filter(col => {
        const prev = columns[col][columns[col].length - 1];
        return !prev || prev.rank !== card.rank;
      });
      if (diffRank.length) candidates = diffRank;

      const diffColor = candidates.filter(col => {
        const prev = columns[col][columns[col].length - 1] || visible[col];
        return cardColor(prev) !== cardColor(card);
      });
      if (diffColor.length) candidates = diffColor;

      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      columns[pick].push(card);
    }

    return columns;
  }

  function makeNewState(level) {
    const {chain, bridge} = buildOpeningStructure();
    const visible = shuffledCopy(chain);
    const fullHiddenOrder = buildFoundationOrder(chain, bridge);

    // 10 cards go to the upper-left stock, balanced across suits and rank bands.
    // Remaining 34 + bridge = 35 hidden tableau cards.
    // Final column sizes are exactly 3,4,5,6,7,8,9 in a random order.
    const {stockDrawOrder, tableauOrder} = splitBalancedStock(fullHiddenOrder, 10);
    const hiddenColumns = distributeBalanced(tableauOrder, visible, bridge);

    const tableau = Array.from({length:7}, (_, col) => {
      const physicalHidden = hiddenColumns[col].slice().reverse();
      physicalHidden.forEach(card => card.faceUp = false);
      return [...physicalHidden, visible[col]];
    });

    // drawFromStock uses pop(), so reverse the intended draw sequence.
    const stock = stockDrawOrder.slice().reverse();
    stock.forEach(card => card.faceUp = false);

    return {
      version: 20,
      difficulty: Number(level),
      stock,
      waste: [],
      foundations: [[],[],[],[]],
      tableau,
      moves: 0,
      seconds: 0,
      redealsUsed: 0,
      hintsUsed: 0,
      won: false,
      gameOver: false,
      started: true,
      updatedAt: Date.now()
    };
  }

  function saveGame() {
    if (!state) return;
    state.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || saved.version !== 20 || !DIFFICULTIES[saved.difficulty]) return null;
      if (saved.gameOver == null) saved.gameOver = false;
      return saved;
    } catch { return null; }
  }

  function startNewGame(level = state?.difficulty || 2) {
    state = makeNewState(Number(level));
    selected = null;
    undoStack = [];
    const stats = loadStats();
    stats.played[level] = (stats.played[level] || 0) + 1;
    saveStats(stats);
    saveGame();
    setHelper('52枚すべて標準トランプだにゃ', `${DIFFICULTIES[level].name}で開始。カード表面は52枚すべて標準トランプSVGそのものを表示。J・Q・Kも実際の絵札画像だよ。`);
    render();
    closeSheet(els.settingsSheet);
    closeSheet(els.winSheet);
    if (els.gameOverSheet) closeSheet(els.gameOverSheet);
  }

  function snapshot() {
    const cfg = DIFFICULTIES[state.difficulty];
    if (cfg.undos === 0) return;
    undoStack.push(clone(state));
    const cap = Number.isFinite(cfg.undos) ? cfg.undos : 100;
    if (undoStack.length > cap) undoStack.shift();
  }

  function undo() {
    if (!undoStack.length || DIFFICULTIES[state.difficulty].undos === 0 || state.won) return;
    state = undoStack.pop();
    selected = null;
    saveGame();
    setHelper('やり直したにゃ', 'ひとつ前の状態に戻したよ。');
    if (els.gameOverSheet) closeSheet(els.gameOverSheet);
    render();
  }

  function incrementMove() {
    state.moves += 1;
    state.started = true;
  }

  function drawFromStock() {
    if (state.won || state.gameOver) return;
    const cfg = DIFFICULTIES[state.difficulty];
    selected = null;

    if (!state.stock.length) {
      setHelper('山札はここまでだにゃ', '山札は1周だけ。残っている場札と捨て札で続きを考えよう。');
      checkGameOver();
      return;
    }

    snapshot();
    const count = Math.min(cfg.draw, state.stock.length);
    for (let i = 0; i < count; i++) {
      const card = state.stock.pop();
      card.faceUp = true;
      state.waste.push(card);
    }
    incrementMove();
    setHelper('山札をめくったにゃ', count === 1 ? '1枚めくり。使えるカードをすぐ確認しよう。' : `${count}枚めくり。いちばん上のカードから使えるよ。`);
    saveGame();
    render();
  }

  function topCard(arr) { return arr.length ? arr[arr.length - 1] : null; }

  function canPlaceOnTableau(card, dest) {
    const top = topCard(dest);
    if (!top) return card.rank === 13;
    return top.faceUp && top.rank === card.rank + 1 && cardColor(top) !== cardColor(card);
  }

  function foundationBalanceAllows(card, foundation) {
    const gap = DIFFICULTIES[state.difficulty].foundationGap;
    if (gap >= 99 || card.rank <= 2) return true;
    const cardIsRed = cardColor(card) === 'red';
    const oppositeSuits = cardIsRed ? ['S','C'] : ['H','D'];
    const oppositeRanks = oppositeSuits.map(suit => {
      const idx = SUIT_KEYS.indexOf(suit);
      return topCard(state.foundations[idx])?.rank || 0;
    });
    return card.rank <= Math.min(...oppositeRanks) + gap;
  }

  function canPlaceOnFoundation(card, foundation) {
    const top = topCard(foundation);
    const normal = !top ? card.rank === 1 : (top.suit === card.suit && card.rank === top.rank + 1);
    return normal && foundationBalanceAllows(card, foundation);
  }

  function validRun(cards) {
    if (!cards.length || cards.some(c => !c.faceUp)) return false;
    for (let i = 0; i < cards.length - 1; i++) {
      if (cards[i].rank !== cards[i+1].rank + 1 || cardColor(cards[i]) === cardColor(cards[i+1])) return false;
    }
    return true;
  }


  function canSelectRun(cards) {
    if (!validRun(cards)) return false;
    const cfg = DIFFICULTIES[state.difficulty];
    return cards.length <= cfg.maxRun;
  }

  function canMoveRunToTableau(cards, dest) {
    if (!canSelectRun(cards)) return false;
    const cfg = DIFFICULTIES[state.difficulty];
    if (!dest.length && cfg.emptyKingSingle && cards.length !== 1) return false;
    return canPlaceOnTableau(cards[0], dest);
  }

  function getSelectedCards() {
    if (!selected) return [];
    if (selected.type === 'waste') return state.waste.length ? [topCard(state.waste)] : [];
    if (selected.type === 'foundation') return state.foundations[selected.foundation].length ? [topCard(state.foundations[selected.foundation])] : [];
    if (selected.type === 'tableau') return state.tableau[selected.col].slice(selected.index);
    return [];
  }

  function selectSource(source) {
    if (state.won || state.gameOver) return;
    if (selected && sameSelection(selected, source)) {
      if (tryAutoFoundation()) return;
      selected = null;
      render();
      return;
    }
    selected = source;
    const cards = getSelectedCards();
    if (!cards.length || !canSelectRun(cards)) {
      selected = null;
      const maxRun = DIFFICULTIES[state.difficulty].maxRun;
      setHelper('その並びは動かせないにゃ', `この難易度は連続移動が最大${maxRun}枚。表向きの赤黒交互・連番を選んでね。`);
    } else {
      setHelper('選択したにゃ', `${rankLabel(cards[0].rank)}${suitSymbol(cards[0])} をどこへ動かす？`);
    }
    render();
  }

  function sameSelection(a, b) {
    return a?.type === b?.type && a?.col === b?.col && a?.index === b?.index && a?.foundation === b?.foundation;
  }

  function removeSelectedCards() {
    if (selected.type === 'waste') return [state.waste.pop()];
    if (selected.type === 'foundation') return [state.foundations[selected.foundation].pop()];
    if (selected.type === 'tableau') return state.tableau[selected.col].splice(selected.index);
    return [];
  }

  function revealTableauTop(col) {
    const top = topCard(state.tableau[col]);
    if (top && !top.faceUp) top.faceUp = true;
  }

  function moveToTableau(destCol) {
    if (!selected) return;
    const cards = getSelectedCards();
    if (!cards.length || !canMoveRunToTableau(cards, state.tableau[destCol])) {
      const cfg = DIFFICULTIES[state.difficulty];
      const emptyRule = cfg.emptyKingSingle ? '空列はKを1枚だけ。' : '空列はKから。';
      setHelper('そこには置けないにゃ', `赤黒交互で数字を1つずつ小さく。連続移動は最大${cfg.maxRun}枚。 ${emptyRule}`);
      return;
    }
    if (selected.type === 'tableau' && selected.col === destCol) { selected = null; render(); return; }

    snapshot();
    const sourceCol = selected.type === 'tableau' ? selected.col : null;
    const moving = removeSelectedCards();
    state.tableau[destCol].push(...moving);
    if (sourceCol !== null) revealTableauTop(sourceCol);
    selected = null;
    incrementMove();
    saveGame();
    setHelper('いい移動だにゃ', '次にめくれる裏向きカードを増やしていこう。');
    render();
    checkWin();
  }

  function moveToFoundation(destIndex) {
    if (!selected) return;
    const cards = getSelectedCards();
    if (cards.length !== 1 || !canPlaceOnFoundation(cards[0], state.foundations[destIndex])) {
      setHelper('組札には置けないにゃ', 'Aから同じマークで、数字を1つずつ上げて並べるよ。');
      return;
    }
    if (selected.type === 'foundation' && selected.foundation === destIndex) { selected = null; render(); return; }

    snapshot();
    const sourceCol = selected.type === 'tableau' ? selected.col : null;
    const moving = removeSelectedCards();
    state.foundations[destIndex].push(moving[0]);
    if (sourceCol !== null) revealTableauTop(sourceCol);
    selected = null;
    incrementMove();
    saveGame();
    setHelper('組札に入ったにゃ', `${rankLabel(moving[0].rank)}${suitSymbol(moving[0])} を積んだよ。`);
    render();
    checkWin();
  }

  function tryAutoFoundation() {
    if (!selected || !DIFFICULTIES[state.difficulty].autoFoundation) return false;
    const cards = getSelectedCards();
    if (cards.length !== 1) return false;
    const target = state.foundations.findIndex(f => canPlaceOnFoundation(cards[0], f));
    if (target < 0) return false;
    moveToFoundation(target);
    return true;
  }

  function foundationTargetFor(card) {
    return state.foundations.findIndex(f => canPlaceOnFoundation(card, f));
  }


  function hasAnyLegalMove() {
    if (!state || state.won) return false;

    // 山札が残っていれば、まだめくる手がある。
    if (state.stock.length > 0) return true;

    // めくれる裏向き場札がある。
    for (const col of state.tableau) {
      const top = topCard(col);
      if (top && !top.faceUp) return true;
    }

    // 捨て札の一番上。
    const waste = topCard(state.waste);
    if (waste) {
      if (foundationTargetFor(waste) >= 0) return true;
      for (let d = 0; d < 7; d++) if (canPlaceOnTableau(waste, state.tableau[d])) return true;
    }

    // 場札 → 組札 / 場札 → 別の場札。
    for (let c = 0; c < 7; c++) {
      const col = state.tableau[c];
      if (!col.length) continue;
      const top = topCard(col);
      if (top?.faceUp && foundationTargetFor(top) >= 0) return true;

      for (let i = 0; i < col.length; i++) {
        if (!col[i].faceUp) continue;
        const run = col.slice(i);
        if (!validRun(run)) continue;
        for (let d = 0; d < 7; d++) {
          if (d === c) continue;
          if (canMoveRunToTableau(run, state.tableau[d])) return true;
        }
      }
    }

    // 難易度1〜3のみ、組札から場札へ戻す手を合法手として数える。
    if (!DIFFICULTIES[state.difficulty].lockFoundation) {
      for (let f = 0; f < 4; f++) {
        const card = topCard(state.foundations[f]);
        if (!card) continue;
        for (let d = 0; d < 7; d++) if (canPlaceOnTableau(card, state.tableau[d])) return true;
      }
    }

    return false;
  }

  function showGameOver() {
    if (!state || state.won || state.gameOver) return;
    state.gameOver = true;
    selected = null;
    saveGame();
    setHelper('ゲームオーバーだにゃ', '山札を使い切り、場札・めくり札・組札にも合法手がなくなったよ。ヒントや「1手戻す」が残っていれば別の順番を試そう。');
    if (els.gameOverUndo) els.gameOverUndo.disabled = undoStack.length === 0 || DIFFICULTIES[state.difficulty].undos === 0;
    if (els.gameOverSheet) openSheet(els.gameOverSheet);
  }

  function checkGameOver() {
    if (!state || state.won || state.gameOver) return;
    if (!hasAnyLegalMove()) showGameOver();
  }

  function hint() {
    if (state.won || state.gameOver) return;
    const cfg = DIFFICULTIES[state.difficulty];
    if (cfg.hints !== Infinity && state.hintsUsed >= cfg.hints) {
      setHelper('ヒントは使い切ったにゃ', '下のカードを開けられる移動、空列の使い方、組札のバランスを順に確認してみよう。');
      return;
    }

    const move = findHintMove();
    if (!move) {
      setHelper('ヒント候補が見つからないにゃ', '組札へ上げられるカードか、別列へ逃がせる表札がないか確認してみよう。');
      return;
    }

    state.hintsUsed += 1;
    saveGame();
    flashHint(move.selector, move.targetSelector);
    setHelper('ここを見るにゃ', move.text);
    renderStatus();
  }

  function findHintMove() {
    const candidates = [];

    const waste = topCard(state.waste);
    if (waste) {
      const f = foundationTargetFor(waste);
      if (f >= 0) {
        candidates.push({
          score: waste.rank <= 2 ? 92 : 62,
          text: `めくり札の ${rankLabel(waste.rank)}${suitSymbol(waste)} を組札へ。`,
          selector: '[data-source="waste"]',
          targetSelector: `[data-foundation-slot="${f}"]`
        });
      }
      for (let d = 0; d < 7; d++) {
        if (canPlaceOnTableau(waste, state.tableau[d])) {
          candidates.push({
            score: state.tableau[d].length === 0 ? 78 : 68,
            text: `めくり札の ${rankLabel(waste.rank)}${suitSymbol(waste)} を${d+1}列目へ。`,
            selector: '[data-source="waste"]',
            targetSelector: `[data-tableau-dest="${d}"]`
          });
        }
      }
    }

    if (state.stock.length > 0) {
      candidates.push({
        score: 18,
        text: '左上の山札を1枚めくってみよう。',
        selector: '#stockPile',
        targetSelector: null
      });
    }


    for (let c = 0; c < 7; c++) {
      const col = state.tableau[c];
      if (!col.length) continue;
      const top = topCard(col);

      if (top?.faceUp) {
        const f = foundationTargetFor(top);
        if (f >= 0) {
          const exposes = col.length > 1 && !col[col.length - 2].faceUp;
          candidates.push({
            score: exposes ? 150 : (top.rank <= 2 ? 55 : 28),
            text: `${c+1}列目の ${rankLabel(top.rank)}${suitSymbol(top)} を組札へ。`,
            selector: `[data-col="${c}"][data-index="${col.length-1}"]`,
            targetSelector: `[data-foundation-slot="${f}"]`
          });
        }
      }

      for (let i = 0; i < col.length; i++) {
        if (!col[i].faceUp) continue;
        const run = col.slice(i);
        if (!canSelectRun(run)) continue;

        for (let d = 0; d < 7; d++) {
          if (d === c || !canMoveRunToTableau(run, state.tableau[d])) continue;
          const exposes = i > 0 && !col[i - 1].faceUp;
          const toEmpty = state.tableau[d].length === 0;
          const sourceDepth = col.length - i;

          let score = 35;
          if (exposes) score += 145;
          if (toEmpty) score += 28;
          if (run[0].rank === 13) score += 12;
          score += Math.max(0, 14 - sourceDepth);

          candidates.push({
            score,
            text: `${c+1}列目の ${rankLabel(run[0].rank)}${suitSymbol(run[0])} からを${d+1}列目へ。`,
            selector: `[data-col="${c}"][data-index="${i}"]`,
            targetSelector: `[data-tableau-dest="${d}"]`
          });
        }
      }
    }

    candidates.sort((a,b) => b.score - a.score);
    return candidates[0] || null;
  }

  function flashHint(selector, targetSelector) {
    requestAnimationFrame(() => {
      const nodes = [document.querySelector(selector), targetSelector ? document.querySelector(targetSelector) : null].filter(Boolean);
      nodes.forEach(node => node.classList.add('hint-flash'));
      setTimeout(() => nodes.forEach(node => node.classList.remove('hint-flash')), 1400);
    });
  }


  function checkWin() {
    if (state.foundations.reduce((n, f) => n + f.length, 0) !== 52 || state.won) return;
    state.won = true;
    state.gameOver = false;
    if (els.gameOverSheet) closeSheet(els.gameOverSheet);
    saveGame();
    const stats = loadStats();
    const level = state.difficulty;
    stats.wins[level] = (stats.wins[level] || 0) + 1;
    if (!stats.best[level] || state.seconds < stats.best[level]) stats.best[level] = state.seconds;
    saveStats(stats);
    els.winSummary.textContent = `難易度${level}・${formatTime(state.seconds)}・${state.moves}手でクリア！`;
    els.catLine.textContent = 'やったにゃ！完全クリア！';
    setHelper('おめでとう！', '全部のカードが組札にそろったにゃ。');
    openSheet(els.winSheet);
    render();
  }

  function render() {
    renderFoundations();
    renderWaste();
    renderStock();
    renderTableau();
    renderStatus();
    renderStats();
    queueMicrotask(checkGameOver);
  }

  function pipLayout(rank) {
    const layouts = {
      2: [['c'],['c']],
      3: [['c'],['c'],['c']],
      4: [['l','r'],['l','r']],
      5: [['l','r'],['c'],['l','r']],
      6: [['l','r'],['l','r'],['l','r']],
      7: [['c'],['l','r'],['c'],['l','r']],
      8: [['c'],['l','r'],['l','r'],['c'],['l','r']],
      9: [['l','r'],['l','r'],['c'],['l','r'],['l','r']],
      10:[['l','r'],['c'],['l','r'],['l','r'],['c'],['l','r']]
    };
    return layouts[rank] || [];
  }

  function numberPips(card) {
    return pipLayout(card.rank).map((row, rowIndex, all) => {
      const flip = rowIndex >= Math.ceil(all.length / 2) ? ' pip-row-flip' : '';
      return `<div class="classic-pip-row${flip}">${row.map(pos =>
        `<span class="classic-pip classic-pip-${pos}">${suitSymbol(card)}</span>`
      ).join('')}</div>`;
    }).join('');
  }

  function courtArt(card) {
    const suit = suitSymbol(card);
    const suitColor = cardColor(card) === 'red' ? '#c82035' : '#15191d';
    const red = '#c82035';
    const blue = '#1f4f8a';
    const yellow = '#e3b53d';
    const skin = '#f5dfbd';
    const ink = '#111';

    const topFigure = card.rank === 13
      ? `
        <g>
          <path d="M35 28l5-13 10 8 10-8 5 13z" fill="${yellow}" stroke="${ink}" stroke-width="2"/>
          <path d="M50 25c-9 0-15 7-15 16v7c0 9 6 16 15 16s15-7 15-16v-7c0-9-6-16-15-16z" fill="${skin}" stroke="${ink}" stroke-width="2"/>
          <circle cx="43" cy="43" r="2.2" fill="${ink}"/><circle cx="57" cy="43" r="2.2" fill="${ink}"/>
          <path d="M43 51c4 4 10 4 14 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M34 63l16-10 16 10 8 28H26z" fill="${red}" stroke="${ink}" stroke-width="2"/>
          <path d="M39 63l11 15 11-15" fill="${blue}" stroke="${ink}" stroke-width="2"/>
          <path d="M72 31v48" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
          <path d="M65 32h14l-7-13z" fill="${yellow}" stroke="${ink}" stroke-width="2"/>
          <path d="M31 76h38" stroke="#fff" stroke-width="2" opacity=".85"/>
          <text x="50" y="91" text-anchor="middle" font-family="Georgia,serif" font-size="19" font-weight="700" fill="#fff">${suit}</text>
        </g>`
      : card.rank === 12
      ? `
        <g>
          <path d="M35 28l5-13 10 8 10-8 5 13z" fill="${yellow}" stroke="${ink}" stroke-width="2"/>
          <path d="M50 25c-9 0-15 7-15 16v7c0 9 6 16 15 16s15-7 15-16v-7c0-9-6-16-15-16z" fill="${skin}" stroke="${ink}" stroke-width="2"/>
          <circle cx="43" cy="43" r="2.2" fill="${ink}"/><circle cx="57" cy="43" r="2.2" fill="${ink}"/>
          <path d="M44 52c4 3 8 3 12 0" fill="none" stroke="${ink}" stroke-width="2.1" stroke-linecap="round"/>
          <path d="M31 63l19-10 19 10 5 28H26z" fill="${blue}" stroke="${ink}" stroke-width="2"/>
          <path d="M38 63l12 15 12-15" fill="${red}" stroke="${ink}" stroke-width="2"/>
          <path d="M69 35c8 4 8 13 2 18" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
          <circle cx="70" cy="31" r="5" fill="${yellow}" stroke="${ink}" stroke-width="2"/>
          <path d="M32 76h36" stroke="#fff" stroke-width="2" opacity=".85"/>
          <text x="50" y="91" text-anchor="middle" font-family="Georgia,serif" font-size="19" font-weight="700" fill="#fff">${suit}</text>
        </g>`
      : `
        <g>
          <path d="M34 29h32l-4-10-12 7-12-7z" fill="${red}" stroke="${ink}" stroke-width="2"/>
          <path d="M50 25c-9 0-15 7-15 16v7c0 9 6 16 15 16s15-7 15-16v-7c0-9-6-16-15-16z" fill="${skin}" stroke="${ink}" stroke-width="2"/>
          <circle cx="43" cy="43" r="2.2" fill="${ink}"/><circle cx="57" cy="43" r="2.2" fill="${ink}"/>
          <path d="M44 52c4 3 8 3 12 0" fill="none" stroke="${ink}" stroke-width="2.1" stroke-linecap="round"/>
          <path d="M31 63l19-10 19 10 5 28H26z" fill="${red}" stroke="${ink}" stroke-width="2"/>
          <path d="M38 63l12 15 12-15" fill="${yellow}" stroke="${ink}" stroke-width="2"/>
          <path d="M71 30v48" stroke="${ink}" stroke-width="3"/>
          <path d="M66 30h10" stroke="${ink}" stroke-width="3"/>
          <path d="M31 76h38" stroke="#fff" stroke-width="2" opacity=".85"/>
          <text x="50" y="91" text-anchor="middle" font-family="Georgia,serif" font-size="19" font-weight="700" fill="#fff">${suit}</text>
        </g>`;

    return `
      <svg class="classic-court" viewBox="0 0 100 140" aria-hidden="true">
        <defs>
          <clipPath id="courtTop${card.suit}${card.rank}"><rect x="19" y="10" width="62" height="60"/></clipPath>
          <clipPath id="courtBottom${card.suit}${card.rank}"><rect x="19" y="70" width="62" height="60"/></clipPath>
        </defs>
        <rect x="19" y="10" width="62" height="120" rx="5" fill="#fffef9" stroke="#111" stroke-width="1.5"/>
        <g clip-path="url(#courtTop${card.suit}${card.rank})">${topFigure}</g>
        <g clip-path="url(#courtBottom${card.suit}${card.rank})" transform="translate(100 140) rotate(180)">${topFigure}</g>
        <path d="M19 70h62" stroke="#111" stroke-width="1" opacity=".18"/>
        <text x="50" y="73" text-anchor="middle" font-family="Georgia,serif" font-size="17" font-weight="700" fill="${suitColor}">${suit}</text>
      </svg>`;
  }


  function classicCardFace(card) {
    const topCorner = `<span class="classic-index classic-index-top"><span class="classic-rank">${rankLabel(card.rank)}</span><span class="classic-suit">${suitSymbol(card)}</span></span>`;
    const bottomCorner = `<span class="classic-index classic-index-bottom"><span class="classic-rank">${rankLabel(card.rank)}</span><span class="classic-suit">${suitSymbol(card)}</span></span>`;

    let center = '';
    if (card.rank === 1) {
      center = `<span class="classic-ace">${suitSymbol(card)}</span>`;
    } else if (card.rank <= 10) {
      center = `<div class="classic-pips rank-${card.rank}">${numberPips(card)}</div>`;
    } else {
      center = courtArt(card);
    }

    return `<span class="classic-face">${topCorner}<span class="classic-center">${center}</span>${bottomCorner}</span>`;
  }

  function realCardFace(card) {
    const rank = rankLabel(card.rank);
    const suit = suitSymbol(card);
    const rankClass = card.rank === 10 ? ' rank-ten' : '';
    return `
      <img class="real-card-image" src="cards/${card.suit}${card.rank}.svg" alt="">
      <span class="giant-index giant-index-top${rankClass}">
        <span class="giant-rank">${rank}</span>
        <span class="giant-suit">${suit}</span>
      </span>
      <span class="giant-index giant-index-bottom${rankClass}">
        <span class="giant-rank">${rank}</span>
        <span class="giant-suit">${suit}</span>
      </span>`;
  }

  function realCardBack() {
    return '<img class="real-card-image real-card-back" src="cards/BACK.svg" alt="">';
  }

  function cardButton(card, meta, topPx = 0) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `card ${card.faceUp ? `face-up ${cardColor(card)}` : 'face-down'}`;
    btn.style.top = `${topPx}px`;
    btn.setAttribute('aria-label', card.faceUp ? `${rankLabel(card.rank)}${suitSymbol(card)}` : '裏向きのカード');
    Object.entries(meta).forEach(([k,v]) => btn.dataset[k] = String(v));

    if (card.faceUp) {
      btn.innerHTML = realCardFace(card);
    } else {
      btn.innerHTML = realCardBack();
    }

    if (isSelectedMeta(meta)) btn.classList.add('selected');
    if (DIFFICULTIES[state.difficulty].glow && card.faceUp && isPlayableCard(card, meta)) btn.classList.add('playable');
    return btn;
  }

  function isSelectedMeta(meta) {
    if (!selected) return false;
    if (meta.source === 'waste') return selected.type === 'waste';
    if (meta.source === 'foundation') return selected.type === 'foundation' && selected.foundation === Number(meta.foundation);
    if (meta.source === 'tableau') return selected.type === 'tableau' && selected.col === Number(meta.col) && Number(meta.index) >= selected.index;
    return false;
  }

  function isPlayableCard(card, meta) {
    if (meta.source === 'waste' || (meta.source === 'tableau' && Number(meta.index) === state.tableau[Number(meta.col)].length - 1)) {
      if (foundationTargetFor(card) >= 0) return true;
    }
    for (let c=0;c<7;c++) {
      if (meta.source === 'tableau' && c === Number(meta.col)) continue;
      if (canPlaceOnTableau(card, state.tableau[c])) return true;
    }
    return false;
  }

  function renderStock() {
    els.stock.innerHTML = '';
    els.stock.classList.toggle('has-cards', state.stock.length > 0);
    els.stock.classList.toggle('empty', state.stock.length === 0);
    els.stock.setAttribute('aria-label', state.stock.length ? `山札 ${state.stock.length}枚` : '空の山札');
    if (state.stock.length) els.stock.innerHTML = realCardBack();
    if (els.drawNext) {
      els.drawNext.disabled = state.stock.length === 0;
      els.drawNext.textContent = state.stock.length ? `次をめくる ${state.stock.length}` : '山札終了';
    }
  }

  function renderWaste() {
    els.waste.innerHTML = '';
    const card = topCard(state.waste);
    els.waste.classList.toggle('has-card', !!card);
    if (card) els.waste.appendChild(cardButton(card, {source:'waste'}));
  }

  function renderFoundations() {
    els.foundations.innerHTML = '';
    for (let i=0;i<4;i++) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'foundation-slot';
      slot.dataset.foundationSlot = i;
      slot.dataset.suit = SUITS[i];
      slot.setAttribute('aria-label', `組札 ${i+1}`);
      const card = topCard(state.foundations[i]);
      if (card) slot.appendChild(cardButton(card, {source:'foundation', foundation:i}));
      else slot.innerHTML = `<span class="foundation-standard-suit ${(SUIT_KEYS[i] === 'H' || SUIT_KEYS[i] === 'D') ? 'red' : 'black'}">${SUITS[i]}</span>`;
      els.foundations.appendChild(slot);
    }
  }

  function renderTableau() {
    els.tableau.innerHTML = '';
    const step = Math.min(35, Math.max(25, window.innerWidth * 0.068));
    const faceDownStep = Math.max(19, step * .74);

    state.tableau.forEach((col, colIndex) => {
      const column = document.createElement('div');
      column.className = 'tableau-column';
      column.dataset.tableauDest = colIndex;
      column.setAttribute('aria-label', `場札 ${colIndex + 1}列目`);
      let y = 0;
      col.forEach((card, index) => {
        const btn = cardButton(card, {source:'tableau', col:colIndex, index}, y);
        column.appendChild(btn);
        y += card.faceUp ? step : faceDownStep;
      });
      column.style.minHeight = `${Math.max(90, y + 85)}px`;
      els.tableau.appendChild(column);
    });
  }

  function renderStatus() {
    const cfg = DIFFICULTIES[state.difficulty];
    els.difficulty.textContent = `${state.difficulty} ${cfg.name}`;
    els.moves.textContent = state.moves;
    els.time.textContent = formatTime(state.seconds);
    els.redeal.textContent = `${state.tableau.reduce((n, col) => n + col.length, 0)}/${state.stock.length}`;
    const hintLeft = cfg.hints === Infinity ? '∞' : Math.max(0, cfg.hints - state.hintsUsed);
    els.hint.textContent = `💡 ヒント ${hintLeft}`;
    els.undo.disabled = DIFFICULTIES[state.difficulty].undos === 0 || undoStack.length === 0 || state.won;
    els.hint.disabled = cfg.hints !== Infinity && state.hintsUsed >= cfg.hints;
  }

  function renderDifficultyOptions() {
    els.difficultyGrid.innerHTML = '';
    for (let level=1;level<=5;level++) {
      const cfg = DIFFICULTIES[level];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `difficulty-card ${state?.difficulty === level ? 'active' : ''}`;
      btn.dataset.level = level;
      btn.innerHTML = `<span class="level-row"><strong>難易度${level}｜${cfg.name}</strong><span class="level-dots">${'★'.repeat(level)}${'☆'.repeat(5-level)}</span></span><small>${cfg.desc}</small>`;
      els.difficultyGrid.appendChild(btn);
    }
  }

  function renderStats() {
    renderDifficultyOptions();
    const stats = loadStats();
    els.statsList.innerHTML = '';
    for (let level=1; level<=5; level++) {
      const row = document.createElement('div');
      row.className = 'stats-row';
      const best = stats.best[level] ? formatTime(stats.best[level]) : '—';
      row.innerHTML = `<span>難易度${level}</span><span>クリア ${stats.wins[level] || 0}回 ／ 最速 ${best}</span>`;
      els.statsList.appendChild(row);
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2,'0');
    const s = (seconds % 60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }

  function setHelper(title, text) {
    els.helperTitle.textContent = title;
    els.helperText.textContent = text;
  }

  function openSheet(sheet) { sheet.classList.remove('hidden'); }
  function closeSheet(sheet) { sheet.classList.add('hidden'); }

  function handleGameClick(e) {
    if (Date.now() < suppressClickUntil || state?.gameOver) return;
    const cardEl = e.target.closest('.card');
    const foundationSlot = e.target.closest('.foundation-slot');
    const tableauDest = e.target.closest('.tableau-column');

    if (e.target.closest('#stockPile')) { drawFromStock(); return; }

    if (cardEl) {
      const source = cardEl.dataset.source;
      if (source === 'waste') {
        if (selected && selected.type !== 'waste') { setHelper('移動先を選んでね', '捨て札は移動先にはできないにゃ。'); return; }
        selectSource({type:'waste'});
        return;
      }
      if (source === 'foundation') {
        const f = Number(cardEl.dataset.foundation);
        if (selected && selected.type !== 'foundation') { moveToFoundation(f); return; }
        if (DIFFICULTIES[state.difficulty].lockFoundation) {
          setHelper('組札は戻せないにゃ', 'この難易度では、一度組札へ置いたカードは場札へ戻せないよ。');
          return;
        }
        selectSource({type:'foundation', foundation:f});
        return;
      }
      if (source === 'tableau') {
        const col = Number(cardEl.dataset.col);
        const index = Number(cardEl.dataset.index);
        const card = state.tableau[col][index];
        if (!card.faceUp) {
          if (index === state.tableau[col].length - 1) {
            snapshot();
            card.faceUp = true;
            incrementMove();
            saveGame();
            setHelper('カードをめくったにゃ', `${rankLabel(card.rank)}${suitSymbol(card)} が出たよ。`);
            render();
          }
          return;
        }
        if (selected && !(selected.type === 'tableau' && selected.col === col && selected.index === index)) {
          moveToTableau(col);
          return;
        }
        selectSource({type:'tableau', col, index});
        return;
      }
    }

    if (foundationSlot && selected) { moveToFoundation(Number(foundationSlot.dataset.foundationSlot)); return; }
    if (tableauDest && selected) { moveToTableau(Number(tableauDest.dataset.tableauDest)); }
  }


  function sourceFromCardElement(cardEl) {
    const source = cardEl.dataset.source;
    if (source === 'waste') return {type:'waste'};
    if (source === 'foundation') return {type:'foundation', foundation:Number(cardEl.dataset.foundation)};
    if (source === 'tableau') return {type:'tableau', col:Number(cardEl.dataset.col), index:Number(cardEl.dataset.index)};
    return null;
  }

  function cleanupDrag() {
    if (!dragState) return;
    if (dragState.ghost) dragState.ghost.remove();
    if (dragState.cardEl) {
      dragState.cardEl.style.visibility = '';
      dragState.cardEl.classList.remove('drag-source');
    }
    dragState = null;
  }

  function updateDragGhost(x, y) {
    if (!dragState?.ghost) return;
    dragState.ghost.style.left = `${x - dragState.offsetX}px`;
    dragState.ghost.style.top = `${y - dragState.offsetY}px`;
  }

  function beginCardDrag(cardEl, event) {
    const source = sourceFromCardElement(cardEl);
    if (!source) return;
    dragState = {
      pointerId: event.pointerId,
      cardEl,
      source,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - cardEl.getBoundingClientRect().left,
      offsetY: event.clientY - cardEl.getBoundingClientRect().top,
      active: false,
      ghost: null
    };
  }

  function activateCardDrag(event) {
    if (!dragState || dragState.active) return;
    const sourceCards = (() => {
      const prev = selected;
      selected = dragState.source;
      const cards = getSelectedCards();
      selected = prev;
      return cards;
    })();
    if (!sourceCards.length || !canSelectRun(sourceCards)) {
      cleanupDrag();
      return;
    }

    dragState.active = true;
    selected = dragState.source;

    const rect = dragState.cardEl.getBoundingClientRect();
    const ghost = dragState.cardEl.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.classList.remove('selected', 'playable', 'hint-flash');
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.appendChild(ghost);
    dragState.ghost = ghost;
    dragState.cardEl.classList.add('drag-source');
    dragState.cardEl.style.visibility = 'hidden';
    updateDragGhost(event.clientX, event.clientY);
    document.body.classList.add('is-dragging-card');
  }

  function finishCardDrag(event) {
    if (!dragState) return;
    const wasActive = dragState.active;
    const source = dragState.source;
    const sourceEl = dragState.cardEl;

    if (!wasActive) {
      cleanupDrag();
      return;
    }

    // Hide ghost/source while hit-testing the actual drop target.
    if (dragState.ghost) dragState.ghost.style.display = 'none';
    sourceEl.style.visibility = 'hidden';
    const target = document.elementFromPoint(event.clientX, event.clientY);
    sourceEl.style.visibility = '';
    document.body.classList.remove('is-dragging-card');

    // Keep the source selected while the existing move rules validate the drop.
    selected = source;
    const foundationSlot = target?.closest?.('.foundation-slot');
    const tableauColumn = target?.closest?.('.tableau-column');

    cleanupDrag();
    suppressClickUntil = Date.now() + 500;

    if (foundationSlot) {
      moveToFoundation(Number(foundationSlot.dataset.foundationSlot));
      return;
    }
    if (tableauColumn) {
      moveToTableau(Number(tableauColumn.dataset.tableauDest));
      return;
    }

    selected = null;
    setHelper('そこには置けないにゃ', 'カードの上か、空いている列・組札の枠までドラッグしてね。');
    render();
  }

  function setupPointerDrag() {
    const gameArea = document.getElementById('gameArea');

    gameArea.addEventListener('pointerdown', e => {
      if (state?.won || e.pointerType === 'mouse' && e.button !== 0) return;
      const cardEl = e.target.closest('.card');
      if (!cardEl) return;

      // 裏向きカードはタップでめくる。ドラッグ対象は表向きだけ。
      const source = sourceFromCardElement(cardEl);
      let card = null;
      if (source?.type === 'waste') card = topCard(state.waste);
      if (source?.type === 'foundation') card = topCard(state.foundations[source.foundation]);
      if (source?.type === 'tableau') card = state.tableau[source.col][source.index];
      if (!card?.faceUp) return;

      beginCardDrag(cardEl, e);
      try { cardEl.setPointerCapture(e.pointerId); } catch {}
    }, {passive:true});

    gameArea.addEventListener('pointermove', e => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      const distance = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);
      if (!dragState.active && distance >= 8) activateCardDrag(e);
      if (dragState?.active) {
        e.preventDefault();
        updateDragGhost(e.clientX, e.clientY);
      }
    }, {passive:false});

    gameArea.addEventListener('pointerup', e => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      finishCardDrag(e);
    });

    gameArea.addEventListener('pointercancel', () => {
      document.body.classList.remove('is-dragging-card');
      cleanupDrag();
    });
  }

  function setupEvents() {
    document.getElementById('gameArea').addEventListener('click', handleGameClick);
    if (els.drawNext) els.drawNext.addEventListener('click', e => { e.stopPropagation(); drawFromStock(); });
    setupPointerDrag();
    els.undo.addEventListener('click', undo);
    els.hint.addEventListener('click', hint);
    els.newGame.addEventListener('click', () => {
      if (state.moves === 0 || confirm('現在のゲームを終了して、新しいゲームを始めますか？')) startNewGame(state.difficulty);
    });
    els.settings.addEventListener('click', () => { renderStats(); openSheet(els.settingsSheet); });
    els.closeSettings.addEventListener('click', () => closeSheet(els.settingsSheet));
    els.settingsSheet.addEventListener('click', e => { if (e.target === els.settingsSheet) closeSheet(els.settingsSheet); });
    els.difficultyGrid.addEventListener('click', e => {
      const btn = e.target.closest('[data-level]');
      if (!btn) return;
      const level = Number(btn.dataset.level);
      if (level === state.difficulty) { closeSheet(els.settingsSheet); return; }
      if (state.moves === 0 || confirm(`難易度${level}で新しいゲームを始めますか？`)) startNewGame(level);
    });
    els.resetStats.addEventListener('click', () => {
      if (!confirm('クリア回数と最速記録をすべて削除しますか？')) return;
      saveStats(newStats());
      renderStats();
      setHelper('記録をリセットしたにゃ', 'ゲームの途中データはそのまま残っているよ。');
    });
    els.winNew.addEventListener('click', () => startNewGame(state.difficulty));
    els.winClose.addEventListener('click', () => closeSheet(els.winSheet));
    els.winSheet.addEventListener('click', e => { if (e.target === els.winSheet) closeSheet(els.winSheet); });

    if (els.gameOverNew) els.gameOverNew.addEventListener('click', () => startNewGame(state.difficulty));
    if (els.gameOverUndo) els.gameOverUndo.addEventListener('click', () => {
      if (!undoStack.length || DIFFICULTIES[state.difficulty].undos === 0) return;
      closeSheet(els.gameOverSheet);
      undo();
    });

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstall = e;
      els.install.classList.remove('hidden');
    });
    els.install.addEventListener('click', async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      els.install.classList.add('hidden');
    });

    window.addEventListener('resize', renderTableau);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
    window.addEventListener('pagehide', saveGame);
  }

  function startClock() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (!state || state.won || !state.started || document.hidden) return;
      state.seconds += 1;
      els.time.textContent = formatTime(state.seconds);
      if (state.seconds % 10 === 0) saveGame();
    }, 1000);
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(reg => {
        reg.update().catch(() => {});
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) reg.update().catch(() => {});
        });
      })
      .catch(() => {});
  }

  function boot() {
    state = loadGame();
    if (!state || state.won) state = makeNewState(2);
    setupEvents();
    render();
    startClock();
    registerSW();
    if (!localStorage.getItem(STORAGE_KEY)) {
      const stats = loadStats();
      stats.played[state.difficulty] = (stats.played[state.difficulty] || 0) + 1;
      saveStats(stats);
      saveGame();
    }
  }

  boot();
})();

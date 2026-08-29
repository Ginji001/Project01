(() => {
  'use strict';

  const SUITS = ['♠', '♥', '♣', '♦'];
  const SUIT_KEYS = ['S', 'H', 'C', 'D'];
  const RANKS = {1:'A',11:'J',12:'Q',13:'K'};
  const STORAGE_KEY = 'hachiware-solitaire-state-v1';
  const STATS_KEY = 'hachiware-solitaire-stats-v1';

  const DIFFICULTIES = {
    1: {name:'のんびり', draw:1, redeals:Infinity, hints:Infinity, undos:Infinity, glow:true, desc:'1枚めくり・山札再利用∞・ヒント∞・やり直し∞'},
    2: {name:'やさしい', draw:1, redeals:3, hints:10, undos:20, glow:false, desc:'1枚めくり・山札再利用3回・ヒント10回'},
    3: {name:'ふつう', draw:3, redeals:3, hints:5, undos:10, glow:false, desc:'3枚めくり・山札再利用3回・ヒント5回'},
    4: {name:'むずかしい', draw:3, redeals:1, hints:2, undos:3, glow:false, desc:'3枚めくり・山札再利用1回・ヒント2回'},
    5: {name:'ねこ神級', draw:3, redeals:0, hints:0, undos:0, glow:false, desc:'3枚めくり・山札再利用なし・ヒント/やり直しなし'}
  };

  const els = {
    stock: document.getElementById('stockPile'),
    waste: document.getElementById('wastePile'),
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

  function freshDeck() {
    const deck = [];
    for (const suit of SUIT_KEYS) {
      for (let rank = 1; rank <= 13; rank++) deck.push({id:`${suit}${rank}`, suit, rank, faceUp:false});
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function makeNewState(level) {
    const deck = freshDeck();
    const tableau = Array.from({length:7}, () => []);
    for (let col = 0; col < 7; col++) {
      for (let n = 0; n <= col; n++) tableau[col].push(deck.pop());
      tableau[col][tableau[col].length - 1].faceUp = true;
    }
    deck.forEach(c => c.faceUp = false);
    return {
      version: 1,
      difficulty: level,
      stock: deck,
      waste: [],
      foundations: [[],[],[],[]],
      tableau,
      moves: 0,
      seconds: 0,
      redealsUsed: 0,
      hintsUsed: 0,
      won: false,
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
      if (!saved || saved.version !== 1 || !DIFFICULTIES[saved.difficulty]) return null;
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
    setHelper('新しいゲーム', `${DIFFICULTIES[level].name}で開始したにゃ。まずAを探そう。`);
    render();
    closeSheet(els.settingsSheet);
    closeSheet(els.winSheet);
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
    render();
  }

  function incrementMove() {
    state.moves += 1;
    state.started = true;
  }

  function drawFromStock() {
    if (state.won) return;
    const cfg = DIFFICULTIES[state.difficulty];
    selected = null;

    if (state.stock.length) {
      snapshot();
      const count = Math.min(cfg.draw, state.stock.length);
      for (let i = 0; i < count; i++) {
        const card = state.stock.pop();
        card.faceUp = true;
        state.waste.push(card);
      }
      incrementMove();
      setHelper('山札をめくったにゃ', `${count}枚めくり。使えるカードがないか見てみよう。`);
      saveGame();
      render();
      return;
    }

    const canRedeal = state.waste.length && (cfg.redeals === Infinity || state.redealsUsed < cfg.redeals);
    if (canRedeal) {
      snapshot();
      state.stock = state.waste.reverse();
      state.stock.forEach(c => c.faceUp = false);
      state.waste = [];
      state.redealsUsed += 1;
      incrementMove();
      setHelper('山札を戻したにゃ', `山札の再利用 ${state.redealsUsed}回目。`);
      saveGame();
      render();
    } else {
      setHelper('山札はここまで', 'この難易度では、もう山札を戻せないにゃ。');
    }
  }

  function topCard(arr) { return arr.length ? arr[arr.length - 1] : null; }

  function canPlaceOnTableau(card, dest) {
    const top = topCard(dest);
    if (!top) return card.rank === 13;
    return top.faceUp && top.rank === card.rank + 1 && cardColor(top) !== cardColor(card);
  }

  function canPlaceOnFoundation(card, foundation) {
    const top = topCard(foundation);
    if (!top) return card.rank === 1;
    return top.suit === card.suit && card.rank === top.rank + 1;
  }

  function validRun(cards) {
    if (!cards.length || cards.some(c => !c.faceUp)) return false;
    for (let i = 0; i < cards.length - 1; i++) {
      if (cards[i].rank !== cards[i+1].rank + 1 || cardColor(cards[i]) === cardColor(cards[i+1])) return false;
    }
    return true;
  }

  function getSelectedCards() {
    if (!selected) return [];
    if (selected.type === 'waste') return state.waste.length ? [topCard(state.waste)] : [];
    if (selected.type === 'foundation') return state.foundations[selected.foundation].length ? [topCard(state.foundations[selected.foundation])] : [];
    if (selected.type === 'tableau') return state.tableau[selected.col].slice(selected.index);
    return [];
  }

  function selectSource(source) {
    if (state.won) return;
    if (selected && sameSelection(selected, source)) {
      if (tryAutoFoundation()) return;
      selected = null;
      render();
      return;
    }
    selected = source;
    const cards = getSelectedCards();
    if (!cards.length || !validRun(cards)) {
      selected = null;
      setHelper('そのカードは動かせないにゃ', '表向きで、順番につながったカードを選んでね。');
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
    if (!cards.length || !validRun(cards) || !canPlaceOnTableau(cards[0], state.tableau[destCol])) {
      setHelper('そこには置けないにゃ', '色を交互にして、数字を1つずつ小さく並べるよ。空列はKだけ。');
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
    if (!selected) return false;
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

  function hint() {
    if (state.won) return;
    const cfg = DIFFICULTIES[state.difficulty];
    if (cfg.hints !== Infinity && state.hintsUsed >= cfg.hints) {
      setHelper('ヒントは使い切ったにゃ', '盤面をよく見て、裏向きカードを開ける手を優先しよう。');
      return;
    }

    const move = findHintMove();
    if (!move) {
      setHelper('動ける手が見つからないにゃ', state.stock.length ? '山札をめくってみよう。' : '山札の再利用ができるか確認してね。');
      return;
    }

    state.hintsUsed += 1;
    saveGame();
    flashHint(move.selector);
    setHelper('ここを見るにゃ', move.text);
    renderStatus();
  }

  function findHintMove() {
    const waste = topCard(state.waste);
    if (waste) {
      const f = foundationTargetFor(waste);
      if (f >= 0) return {text:`捨て札の ${rankLabel(waste.rank)}${suitSymbol(waste)} を組札へ。`, selector:'[data-source="waste"]'};
      for (let c=0;c<7;c++) if (canPlaceOnTableau(waste, state.tableau[c])) return {text:`捨て札の ${rankLabel(waste.rank)}${suitSymbol(waste)} を${c+1}列目へ。`, selector:'[data-source="waste"]'};
    }

    for (let c=0;c<7;c++) {
      const col = state.tableau[c];
      if (!col.length) continue;
      const top = topCard(col);
      if (top.faceUp && foundationTargetFor(top) >= 0) return {text:`${c+1}列目の ${rankLabel(top.rank)}${suitSymbol(top)} を組札へ。`, selector:`[data-col="${c}"][data-index="${col.length-1}"]`};
      for (let i=0;i<col.length;i++) {
        if (!col[i].faceUp) continue;
        const run = col.slice(i);
        if (!validRun(run)) continue;
        for (let d=0;d<7;d++) {
          if (d===c) continue;
          if (canPlaceOnTableau(run[0], state.tableau[d])) {
            const exposes = i > 0 && !col[i-1].faceUp;
            if (exposes || run[0].rank === 13) return {text:`${c+1}列目の ${rankLabel(run[0].rank)}${suitSymbol(run[0])} からを${d+1}列目へ。`, selector:`[data-col="${c}"][data-index="${i}"]`};
          }
        }
      }
    }

    if (state.stock.length) return {text:'山札をめくって、新しいカードを出してみよう。', selector:'#stockPile'};
    const canRedeal = state.waste.length && (DIFFICULTIES[state.difficulty].redeals === Infinity || state.redealsUsed < DIFFICULTIES[state.difficulty].redeals);
    if (canRedeal) return {text:'空になった山札をタップして、捨て札を戻そう。', selector:'#stockPile'};
    return null;
  }

  function flashHint(selector) {
    requestAnimationFrame(() => {
      const node = document.querySelector(selector);
      if (!node) return;
      node.classList.add('hint-flash');
      setTimeout(() => node.classList.remove('hint-flash'), 1400);
    });
  }

  function checkWin() {
    if (state.foundations.reduce((n, f) => n + f.length, 0) !== 52 || state.won) return;
    state.won = true;
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
  }

  function cardButton(card, meta, topPx = 0) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `card ${card.faceUp ? `face-up ${cardColor(card)}` : 'face-down'}`;
    btn.style.top = `${topPx}px`;
    btn.setAttribute('aria-label', card.faceUp ? `${rankLabel(card.rank)}${suitSymbol(card)}` : '裏向きのカード');
    Object.entries(meta).forEach(([k,v]) => btn.dataset[k] = String(v));

    if (card.faceUp) {
      btn.innerHTML = `<span class="card-corner"><span>${rankLabel(card.rank)}</span><span class="suit">${suitSymbol(card)}</span></span><span class="card-center">${catSuitArt(card.suit)}</span>`;
    } else {
      btn.innerHTML = catBackArt();
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
    if (state.stock.length) els.stock.innerHTML = catBackArt();
  }

  function renderWaste() {
    els.waste.innerHTML = '';
    const card = topCard(state.waste);
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
      else slot.innerHTML = catSuitArt(SUIT_KEYS[i]);
      els.foundations.appendChild(slot);
    }
  }

  function renderTableau() {
    els.tableau.innerHTML = '';
    const step = Math.min(30, Math.max(21, window.innerWidth * 0.06));
    const faceDownStep = Math.max(13, step * .62);

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
    if (cfg.redeals === Infinity) els.redeal.textContent = '∞';
    else els.redeal.textContent = `${Math.max(0, cfg.redeals - state.redealsUsed)}`;
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
    if (Date.now() < suppressClickUntil) return;
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
    if (!sourceCards.length || !validRun(sourceCards)) {
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
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
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

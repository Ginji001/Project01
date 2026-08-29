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
      btn.innerHTML = `<span class="card-corner"><span>${rankLabel(card.rank)}</span><span class="suit">${suitSymbol(card)}</span></span><span class="card-center">${suitSymbol(card)}</span>`;
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

  function setupEvents() {
    document.getElementById('gameArea').addEventListener('click', handleGameClick);
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

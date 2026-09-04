(() => {
  "use strict";

  const STORAGE_KEY = "hachiware-bullet-state-v1";
  const VERSION = 1;
  const SYMBOLS = {
    task: "・",
    done: "×",
    migrated: "＞",
    cancelled: "－",
    idea: "💡",
    event: "○",
    note: "—"
  };
  const LABELS = {
    task: "タスク",
    done: "完了",
    migrated: "先送り",
    cancelled: "キャンセル",
    idea: "アイデア・メモ",
    event: "イベント・予定",
    note: "ノート"
  };
  const MONTHS_JA = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const DOW = ["日","月","火","水","木","金","土"];

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const pad = n => String(n).padStart(2,"0");
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  const parseDate = s => new Date(`${s}T12:00:00`);
  const formatDate = s => parseDate(s).toLocaleDateString("ja-JP", {year:"numeric",month:"long",day:"numeric",weekday:"short"});
  const yen = n => new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY",maximumFractionDigits:0}).format(Number(n)||0);
  const deepCopy = obj => JSON.parse(JSON.stringify(obj));

  function defaultState(){
    const now = new Date();
    return {
      version: VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {theme:"system", weekStartsMonday:false},
      entries: [],
      monthlyGoals: {},
      future: [],
      habits: [],
      habitChecks: {},
      finance: [],
      budgets: {},
      collections: [],
      ui: {view:"today", selectedDate:dateKey(now), selectedMonth:monthKey(now)}
    };
  }

  function normalizeState(raw){
    const d = defaultState();
    if(!raw || typeof raw !== "object") return d;
    return {
      ...d,
      ...raw,
      version: VERSION,
      settings:{...d.settings,...(raw.settings||{})},
      ui:{...d.ui,...(raw.ui||{})},
      entries:Array.isArray(raw.entries)?raw.entries:[],
      monthlyGoals:raw.monthlyGoals||{},
      future:Array.isArray(raw.future)?raw.future:[],
      habits:Array.isArray(raw.habits)?raw.habits:[],
      habitChecks:raw.habitChecks||{},
      finance:Array.isArray(raw.finance)?raw.finance:[],
      budgets:raw.budgets||{},
      collections:Array.isArray(raw.collections)?raw.collections:[]
    };
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : defaultState();
    }catch{
      return defaultState();
    }
  }

  let state = loadState();
  let deferredInstallPrompt = null;
  let toastTimer = null;

  function saveState(){
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const el = $("#saveState");
    if(el){ el.textContent = "保存済み"; }
  }
  function mutate(fn, render=true){
    const el = $("#saveState");
    if(el) el.textContent = "保存中…";
    fn(state);
    saveState();
    if(render) renderApp();
  }
  function toast(msg){
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>el.classList.add("hidden"),2200);
  }

  function applyTheme(){
    const mode = state.settings.theme || "system";
    const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }

  function setView(view){
    state.ui.view = view;
    saveState();
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    renderApp();
    $("#sidebar").classList.remove("open");
    $("#main").focus({preventScroll:true});
  }

  function renderApp(){
    applyTheme();
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===state.ui.view));
    const root = $("#viewRoot");
    switch(state.ui.view){
      case "daily": root.innerHTML = renderDaily(); break;
      case "monthly": root.innerHTML = renderMonthly(); break;
      case "future": root.innerHTML = renderFuture(); break;
      case "habits": root.innerHTML = renderHabits(); break;
      case "finance": root.innerHTML = renderFinance(); break;
      case "collections": root.innerHTML = renderCollections(); break;
      case "key": root.innerHTML = renderKey(); break;
      case "settings": root.innerHTML = renderSettings(); break;
      default: root.innerHTML = renderToday(); break;
    }
    bindDynamicHandlers();
  }

  function installBanner(){
    if(!deferredInstallPrompt) return "";
    return `<div class="install-banner"><div><strong>アプリとして追加できます</strong><div style="font-size:12px;opacity:.82">ホーム画面からすぐ開けます。</div></div><button class="secondary-btn" data-action="install">追加</button></div>`;
  }

  function renderToday(){
    const today = dateKey(new Date());
    const items = entriesForDate(today);
    const tasks = items.filter(x=>["task","done","migrated","cancelled"].includes(x.type));
    const open = tasks.filter(x=>x.type==="task").length;
    const done = tasks.filter(x=>x.type==="done").length;
    const habitStats = habitStatsForMonth(new Date());
    const financeStats = financeStatsForMonth(new Date());
    return `<section class="page">
      ${installBanner()}
      <div class="page-head"><div><div class="eyebrow">${esc(formatDate(today))}</div><h1>今日</h1></div><div class="toolbar"><button class="secondary-btn" data-action="goto-date" data-date="${today}">今日のログ</button></div></div>
      <div class="grid three" style="margin-bottom:16px">
        <div class="card"><div class="metric">${open}</div><div class="metric-label">未完了タスク</div></div>
        <div class="card"><div class="metric">${done}</div><div class="metric-label">完了タスク</div></div>
        <div class="card"><div class="metric">${habitStats.rate}%</div><div class="metric-label">今月の習慣達成率</div></div>
      </div>
      <div class="grid two">
        <div class="card"><div class="card-head"><h2>今日のログ</h2><button class="ghost-btn" data-action="add-entry" data-date="${today}">＋ 追加</button></div>${entryList(items, today)}</div>
        <div class="grid">
          <div class="card"><div class="card-head"><h2>今月の家計</h2><span class="badge">${MONTHS_JA[new Date().getMonth()]}</span></div><div class="metric ${financeStats.balance<0?'negative':'positive'}">${yen(financeStats.balance)}</div><div class="metric-label">収支（収入 − 支出）</div><div class="subtle" style="margin-top:10px">支出 ${yen(financeStats.expense)} / 収入 ${yen(financeStats.income)}</div></div>
          <div class="card"><div class="card-head"><h2>次の予定</h2></div>${upcomingEvents()}</div>
        </div>
      </div>
    </section>`;
  }

  function renderDaily(){
    const selected = state.ui.selectedDate || dateKey(new Date());
    const d = parseDate(selected);
    const prev = new Date(d); prev.setDate(prev.getDate()-1);
    const next = new Date(d); next.setDate(next.getDate()+1);
    const items = entriesForDate(selected);
    return `<section class="page">
      <div class="page-head"><div><div class="eyebrow">デイリーログ</div><h1>${esc(formatDate(selected))}</h1></div>
        <div class="toolbar"><button class="secondary-btn" data-action="goto-date" data-date="${dateKey(prev)}">‹ 前日</button><input class="field" style="width:auto" id="dailyDate" type="date" value="${selected}"><button class="secondary-btn" data-action="goto-date" data-date="${dateKey(next)}">翌日 ›</button><button class="primary-btn" data-action="add-entry" data-date="${selected}">＋ 追加</button></div>
      </div>
      <div class="card"><div class="card-head"><h2>ログ</h2><span class="badge">${items.length}件</span></div>${entryList(items, selected)}</div>
    </section>`;
  }

  function renderMonthly(){
    const [year,month] = (state.ui.selectedMonth||monthKey(new Date())).split("-").map(Number);
    const current = new Date(year,month-1,1);
    const prev = new Date(year,month-2,1), next = new Date(year,month,1);
    const goals = state.monthlyGoals[`${year}-${pad(month)}`] || [];
    return `<section class="page">
      <div class="page-head"><div><div class="eyebrow">マンスリーログ</div><h1>${year}年 ${month}月</h1></div>
        <div class="toolbar"><button class="secondary-btn" data-action="goto-month" data-month="${monthKey(prev)}">‹</button><input class="field" style="width:auto" id="monthPicker" type="month" value="${year}-${pad(month)}"><button class="secondary-btn" data-action="goto-month" data-month="${monthKey(next)}">›</button></div></div>
      <div class="grid two">
        <div class="card"><div class="card-head"><h2>カレンダー</h2></div>${calendarHtml(current)}</div>
        <div class="card"><div class="card-head"><h2>今月の目標・タスク</h2><button class="ghost-btn" data-action="add-goal" data-month="${year}-${pad(month)}">＋ 追加</button></div>${goalList(goals,`${year}-${pad(month)}`)}</div>
      </div>
    </section>`;
  }

  function renderFuture(){
    const base = new Date(); base.setDate(1);
    const months = [];
    for(let i=0;i<6;i++){
      const d = new Date(base.getFullYear(),base.getMonth()+i,1);
      const key = monthKey(d);
      const items = state.future.filter(x=>x.month===key).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
      months.push(`<div class="card future-month"><div class="card-head"><h3>${d.getFullYear()}年 ${d.getMonth()+1}月</h3><button class="mini-btn" data-action="add-future" data-month="${key}">＋</button></div>${items.length?`<div class="future-list">${items.map(x=>`<div class="future-item"><div>${esc(SYMBOLS[x.type]||"○")} ${esc(x.text)}</div><div class="entry-meta">${x.date?esc(x.date):"日付未定"}</div><div class="entry-actions"><button class="mini-btn" data-action="edit-future" data-id="${x.id}">編集</button><button class="mini-btn" data-action="delete-future" data-id="${x.id}">削除</button></div></div>`).join("")}</div>`:`<div class="empty-state">予定なし</div>`}</div>`);
    }
    return `<section class="page"><div class="page-head"><div><div class="eyebrow">6か月を見渡す</div><h1>フューチャーログ</h1></div></div><div class="future-grid">${months.join("")}</div></section>`;
  }

  function renderHabits(){
    const [year,month] = (state.ui.selectedMonth||monthKey(new Date())).split("-").map(Number);
    const days = new Date(year,month,0).getDate();
    const key = `${year}-${pad(month)}`;
    const header = Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join("");
    const rows = state.habits.map(h=>{
      const cells = Array.from({length:days},(_,i)=>{
        const dk = `${key}-${pad(i+1)}`;
        const on = !!state.habitChecks[`${h.id}:${dk}`];
        return `<td><button class="habit-check ${on?'on':''}" data-action="toggle-habit" data-id="${h.id}" data-date="${dk}" aria-label="${esc(h.name)} ${i+1}日">${on?'✓':'·'}</button></td>`;
      }).join("");
      return `<tr><td><strong>${esc(h.name)}</strong><button class="mini-btn" style="float:right" data-action="edit-habit" data-id="${h.id}">…</button></td>${cells}</tr>`;
    }).join("");
    const stats = habitStatsForMonth(new Date(year,month-1,1));
    return `<section class="page">
      <div class="page-head"><div><div class="eyebrow">Habit Tracker</div><h1>習慣</h1></div><div class="toolbar"><input class="field" style="width:auto" id="habitMonth" type="month" value="${key}"><button class="primary-btn" data-action="add-habit">＋ 習慣</button></div></div>
      <div class="grid two" style="margin-bottom:16px"><div class="card"><div class="metric">${stats.rate}%</div><div class="metric-label">今月の達成率</div></div><div class="card"><div class="metric">${state.habits.length}</div><div class="metric-label">追跡中の習慣</div></div></div>
      <div class="card habit-table-wrap">${state.habits.length?`<table class="habit-table"><thead><tr><th>習慣</th>${header}</tr></thead><tbody>${rows}</tbody></table>`:`<div class="empty-state">習慣を追加すると、日ごとにチェックできます。</div>`}</div>
    </section>`;
  }

  function renderFinance(){
    const key = state.ui.selectedMonth||monthKey(new Date());
    const [y,m] = key.split("-").map(Number);
    const items = state.finance.filter(x=>x.date.startsWith(key)).sort((a,b)=>b.date.localeCompare(a.date));
    const stats = financeStatsForMonth(new Date(y,m-1,1));
    const budget = Number(state.budgets[key]||0);
    const remain = budget - stats.expense;
    return `<section class="page">
      <div class="page-head"><div><div class="eyebrow">Finance</div><h1>家計</h1></div><div class="toolbar"><input class="field" style="width:auto" id="financeMonth" type="month" value="${key}"><button class="primary-btn" data-action="add-finance">＋ 収支</button></div></div>
      <div class="grid three" style="margin-bottom:16px"><div class="card"><div class="metric positive">${yen(stats.income)}</div><div class="metric-label">収入</div></div><div class="card"><div class="metric negative">${yen(stats.expense)}</div><div class="metric-label">支出</div></div><div class="card"><div class="metric ${stats.balance<0?'negative':'positive'}">${yen(stats.balance)}</div><div class="metric-label">収支</div></div></div>
      <div class="grid two">
        <div class="card"><div class="card-head"><h2>予算</h2><button class="ghost-btn" data-action="set-budget" data-month="${key}">設定</button></div><div class="metric">${budget?yen(budget):"未設定"}</div><div class="subtle">${budget?`残り ${yen(remain)}`:"月の支出予算を設定できます。"}</div></div>
        <div class="card"><div class="card-head"><h2>支出ログ</h2><span class="badge">${items.length}件</span></div>${financeList(items)}</div>
      </div>
    </section>`;
  }

  function renderCollections(){
    const items = [...state.collections].sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
    return `<section class="page"><div class="page-head"><div><div class="eyebrow">読書・インプット・アイデア</div><h1>コレクション</h1></div><button class="primary-btn" data-action="add-collection">＋ コレクション</button></div>
      ${items.length?`<div class="grid three">${items.map(x=>`<div class="card collection-card"><div class="card-head"><div><span class="badge">${esc(x.kind||"メモ")}</span><h2 style="margin-top:8px">${esc(x.title)}</h2></div><button class="mini-btn" data-action="edit-collection" data-id="${x.id}">…</button></div><div class="collection-body">${esc(x.body||"")}</div><div class="entry-meta">更新 ${new Date(x.updatedAt||Date.now()).toLocaleDateString("ja-JP")}</div></div>`).join("")}</div>`:`<div class="empty-state">読書メモ、調べもの、記事アイデアなどを自由に保存できます。</div>`}</section>`;
  }

  function renderKey(){
    const defs = [
      ["・","タスク","まだ完了していない行動"],["×","完了したタスク","終わったタスク"],["＞","先送りしたタスク","別の日・月へ移動するタスク"],["－","キャンセルしたタスク","やらないと決めたタスク"],["💡","アイデア・ひらめき・メモ","思いつきや発見"],["○","イベント・予定","日時のある予定"]
    ];
    return `<section class="page"><div class="page-head"><div><div class="eyebrow">Key</div><h1>記号ルール</h1></div></div><div class="card">${defs.map(([s,t,d])=>`<div class="key-row"><div class="key-symbol">${s}</div><div><strong>${t}</strong><div class="subtle">${d}</div></div></div>`).join("")}</div></section>`;
  }

  function renderSettings(){
    const theme = state.settings.theme||"system";
    return `<section class="page"><div class="page-head"><div><div class="eyebrow">端末設定</div><h1>設定</h1></div></div>
      <div class="card settings-list">
        <div class="setting-row"><div><div class="setting-title">表示テーマ</div><div class="setting-desc">端末設定に合わせるか、明るさを固定します。</div></div><select id="themeSelect" class="select" style="width:auto"><option value="system" ${theme==='system'?'selected':''}>端末に合わせる</option><option value="light" ${theme==='light'?'selected':''}>ライト</option><option value="dark" ${theme==='dark'?'selected':''}>ダーク</option></select></div>
        <div class="setting-row"><div><div class="setting-title">データを書き出す</div><div class="setting-desc">Mac/Windows間の移行やバックアップ用JSONを保存します。</div></div><button class="secondary-btn" data-action="export">書き出す</button></div>
        <div class="setting-row"><div><div class="setting-title">データを読み込む</div><div class="setting-desc">別端末で書き出したJSONを取り込みます。</div></div><button class="secondary-btn" data-action="import">読み込む</button></div>
        <div class="setting-row"><div><div class="setting-title">すべてのデータを消去</div><div class="setting-desc">この端末に保存されたハチワレバレットのデータのみ削除します。</div></div><button class="danger-btn" data-action="reset">消去</button></div>
      </div>
      <div class="card" style="margin-top:16px"><h2>保存について</h2><p class="subtle" style="line-height:1.7">アプリのコードはGitHubで共通化できます。入力した日記・家計・習慣データは、この端末のブラウザ内に保存され、GitHubへ自動送信しません。別端末へ移す場合は「書き出す／読み込む」を使用します。</p></div>
    </section>`;
  }

  function entryList(items,date){
    if(!items.length) return `<div class="empty-state">まだログがありません。<br><button class="ghost-btn" data-action="add-entry" data-date="${date}">最初の項目を追加</button></div>`;
    return `<div class="list">${items.map(x=>`<div class="entry"><div class="entry-symbol">${esc(SYMBOLS[x.type]||"—")}</div><div class="entry-main"><div class="entry-title">${esc(x.text)}</div>${x.time?`<div class="entry-meta">${esc(x.time)}</div>`:""}</div><div class="entry-actions">${x.type==='task'?`<button class="mini-btn" title="完了" data-action="complete-entry" data-id="${x.id}">✓</button>`:""}<button class="mini-btn" data-action="edit-entry" data-id="${x.id}">編集</button><button class="mini-btn" data-action="delete-entry" data-id="${x.id}">削除</button></div></div>`).join("")}</div>`;
  }

  function entriesForDate(date){ return state.entries.filter(x=>x.date===date).sort((a,b)=>(a.order||0)-(b.order||0) || (a.createdAt||"").localeCompare(b.createdAt||"")); }

  function goalList(goals,key){
    if(!goals.length) return `<div class="empty-state">今月の目標・タスクを追加できます。</div>`;
    return `<div class="list">${goals.map(x=>`<div class="entry"><div class="entry-symbol">${x.done?'×':'・'}</div><div class="entry-main"><div class="entry-title">${esc(x.text)}</div></div><div class="entry-actions"><button class="mini-btn" data-action="toggle-goal" data-month="${key}" data-id="${x.id}">${x.done?'戻す':'完了'}</button><button class="mini-btn" data-action="delete-goal" data-month="${key}" data-id="${x.id}">削除</button></div></div>`).join("")}</div>`;
  }

  function calendarHtml(first){
    const year = first.getFullYear(), month = first.getMonth();
    const startDay = new Date(year,month,1).getDay();
    const days = new Date(year,month+1,0).getDate();
    const prevDays = new Date(year,month,0).getDate();
    const today = dateKey(new Date());
    const cells = [];
    for(let i=0;i<42;i++){
      let day = i-startDay+1, d, muted=false;
      if(day<1){d=new Date(year,month-1,prevDays+day);muted=true}
      else if(day>days){d=new Date(year,month+1,day-days);muted=true}
      else d=new Date(year,month,day);
      const key=dateKey(d), notes=entriesForDate(key).slice(0,3);
      cells.push(`<div class="day ${muted?'muted':''} ${key===today?'today':''}"><button data-action="goto-date" data-date="${key}"><div class="day-num">${d.getDate()}</div>${notes.map(x=>`<div class="day-note">${esc(SYMBOLS[x.type]||'—')} ${esc(x.text)}</div>`).join('')}</button></div>`);
    }
    const dows = DOW.map(x=>`<div class="dow">${x}</div>`).join("");
    return `<div class="month-grid">${dows}${cells.join("")}</div>`;
  }

  function financeList(items){
    if(!items.length) return `<div class="empty-state">この月の収支はまだありません。</div>`;
    return `<div>${items.map(x=>`<div class="finance-row"><div>${esc(x.date.slice(5).replace('-','/'))}</div><div><strong>${esc(x.item)}</strong><div class="entry-meta">${esc(x.category||'未分類')}</div></div><div class="amount ${x.kind==='expense'?'negative':'positive'}">${x.kind==='expense'?'-':'+'}${yen(x.amount)}</div><div>${esc(x.kind==='expense'?'支出':'収入')}</div><button class="mini-btn" data-action="edit-finance" data-id="${x.id}">…</button></div>`).join("")}</div>`;
  }

  function financeStatsForMonth(d){
    const key=monthKey(d); let income=0,expense=0;
    state.finance.filter(x=>x.date.startsWith(key)).forEach(x=>{ if(x.kind==='income')income+=Number(x.amount)||0;else expense+=Number(x.amount)||0; });
    return {income,expense,balance:income-expense};
  }

  function habitStatsForMonth(d){
    const key=monthKey(d); const days=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    const total=state.habits.length*days; if(!total)return {rate:0,done:0,total:0};
    let done=0; Object.keys(state.habitChecks).forEach(k=>{ if(k.includes(`:${key}-`) && state.habitChecks[k])done++; });
    return {rate:Math.round(done/total*100),done,total};
  }

  function upcomingEvents(){
    const today=dateKey(new Date());
    const list=[...state.entries.filter(x=>x.type==='event'&&x.date>=today).map(x=>({date:x.date,text:x.text})),...state.future.filter(x=>x.date&&x.date>=today).map(x=>({date:x.date,text:x.text}))].sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
    if(!list.length)return `<div class="empty-state">予定はありません。</div>`;
    return `<div class="list">${list.map(x=>`<div class="entry"><div class="entry-symbol">○</div><div class="entry-main"><div class="entry-title">${esc(x.text)}</div><div class="entry-meta">${esc(formatDate(x.date))}</div></div></div>`).join("")}</div>`;
  }

  function openModal(title,html,onOpen){
    $("#modalTitle").textContent=title;
    $("#modalBody").innerHTML=html;
    $("#modalBackdrop").classList.remove("hidden");
    setTimeout(()=>$("#modalBody input, #modalBody textarea, #modalBody select")?.focus(),40);
    if(onOpen)onOpen();
  }
  function closeModal(){ $("#modalBackdrop").classList.add("hidden"); $("#modalBody").innerHTML=""; }

  function entryForm(date,existing=null){
    const x=existing||{type:"task",text:"",date,time:""};
    openModal(existing?"ログを編集":"ログを追加",`<form id="entryForm" class="form"><div class="inline-fields"><div class="form-row"><label>種類</label><select class="select" name="type">${Object.entries(LABELS).map(([k,v])=>`<option value="${k}" ${x.type===k?'selected':''}>${SYMBOLS[k]} ${esc(v)}</option>`).join('')}</select></div><div class="form-row"><label>日付</label><input class="field" type="date" name="date" value="${esc(x.date||date)}" required></div></div><div class="form-row"><label>内容</label><textarea class="area" name="text" required placeholder="内容を入力">${esc(x.text||'')}</textarea></div><div class="form-row"><label>時刻（任意）</label><input class="field" type="time" name="time" value="${esc(x.time||'')}"></div><div class="form-actions"><button type="button" class="secondary-btn" data-action="modal-close">キャンセル</button><button class="primary-btn" type="submit">保存</button></div></form>`);
    $("#entryForm").addEventListener("submit",e=>{
      e.preventDefault(); const fd=new FormData(e.currentTarget);
      mutate(s=>{
        if(existing){Object.assign(existing,{type:fd.get("type"),date:fd.get("date"),text:String(fd.get("text")).trim(),time:fd.get("time"),updatedAt:new Date().toISOString()});}
        else s.entries.push({id:uid(),type:fd.get("type"),date:fd.get("date"),text:String(fd.get("text")).trim(),time:fd.get("time"),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      }); closeModal(); toast("保存しました");
    });
  }

  function goalForm(month){
    openModal("今月の目標・タスクを追加",`<form id="goalForm" class="form"><div class="form-row"><label>内容</label><textarea class="area" name="text" required placeholder="今月の目標やタスク"></textarea></div><div class="form-actions"><button type="button" class="secondary-btn" data-action="modal-close">キャンセル</button><button class="primary-btn">追加</button></div></form>`);
    $("#goalForm").addEventListener("submit",e=>{e.preventDefault();const text=String(new FormData(e.currentTarget).get("text")).trim();mutate(s=>{if(!s.monthlyGoals[month])s.monthlyGoals[month]=[];s.monthlyGoals[month].push({id:uid(),text,done:false});});closeModal();});
  }

  function futureForm(month,existing=null){
    const x=existing||{month,date:"",type:"event",text:""};
    openModal(existing?"予定を編集":"フューチャーログを追加",`<form id="futureForm" class="form"><div class="inline-fields"><div class="form-row"><label>種類</label><select class="select" name="type"><option value="event" ${x.type==='event'?'selected':''}>○ イベント・予定</option><option value="task" ${x.type==='task'?'selected':''}>・ タスク</option><option value="idea" ${x.type==='idea'?'selected':''}>💡 アイデア</option></select></div><div class="form-row"><label>日付（任意）</label><input class="field" type="date" name="date" value="${esc(x.date||'')}"></div></div><div class="form-row"><label>内容</label><textarea class="area" name="text" required>${esc(x.text||'')}</textarea></div><div class="form-actions"><button type="button" class="secondary-btn" data-action="modal-close">キャンセル</button><button class="primary-btn">保存</button></div></form>`);
    $("#futureForm").addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.currentTarget),date=fd.get("date"),m=date?String(date).slice(0,7):month;mutate(s=>{if(existing)Object.assign(existing,{month:m,date,type:fd.get("type"),text:String(fd.get("text")).trim()});else s.future.push({id:uid(),month:m,date,type:fd.get("type"),text:String(fd.get("text")).trim()});});closeModal();});
  }

  function habitForm(existing=null){
    openModal(existing?"習慣を編集":"習慣を追加",`<form id="habitForm" class="form"><div class="form-row"><label>習慣名</label><input class="field" name="name" required value="${esc(existing?.name||'')}" placeholder="例：早起き"></div><div class="form-actions">${existing?`<button type="button" class="danger-btn" id="deleteHabit">削除</button>`:''}<span style="flex:1"></span><button type="button" class="secondary-btn" data-action="modal-close">キャンセル</button><button class="primary-btn">保存</button></div></form>`);
    $("#habitForm").addEventListener("submit",e=>{e.preventDefault();const name=String(new FormData(e.currentTarget).get("name")).trim();mutate(s=>{if(existing)existing.name=name;else s.habits.push({id:uid(),name,createdAt:new Date().toISOString()});});closeModal();});
    $("#deleteHabit")?.addEventListener("click",()=>{if(!confirm("この習慣とチェック履歴を削除しますか？"))return;mutate(s=>{s.habits=s.habits.filter(h=>h.id!==existing.id);Object.keys(s.habitChecks).filter(k=>k.startsWith(existing.id+":")).forEach(k=>delete s.habitChecks[k]);});closeModal();});
  }

  function financeForm(existing=null){
    const x=existing||{date:dateKey(new Date()),kind:"expense",item:"",amount:"",category:""};
    openModal(existing?"収支を編集":"収支を追加",`<form id="financeForm" class="form"><div class="inline-fields"><div class="form-row"><label>日付</label><input class="field" type="date" name="date" required value="${esc(x.date)}"></div><div class="form-row"><label>区分</label><select class="select" name="kind"><option value="expense" ${x.kind==='expense'?'selected':''}>支出</option><option value="income" ${x.kind==='income'?'selected':''}>収入</option></select></div></div><div class="form-row"><label>項目</label><input class="field" name="item" required value="${esc(x.item)}" placeholder="例：食費"></div><div class="inline-fields"><div class="form-row"><label>金額</label><input class="field" type="number" min="0" step="1" name="amount" required value="${esc(x.amount)}"></div><div class="form-row"><label>分類</label><input class="field" name="category" value="${esc(x.category||'')}" placeholder="例：変動費"></div></div><div class="form-actions">${existing?`<button type="button" class="danger-btn" id="deleteFinance">削除</button>`:''}<span style="flex:1"></span><button type="button" class="secondary-btn" data-action="modal-close">キャンセル</button><button class="primary-btn">保存</button></div></form>`);
    $("#financeForm").addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.currentTarget),obj={date:fd.get("date"),kind:fd.get("kind"),item:String(fd.get("item")).trim(),amount:Number(fd.get("amount")),category:String(fd.get("category")||"").trim()};mutate(s=>{if(existing)Object.assign(existing,obj);else s.finance.push({id:uid(),...obj,createdAt:new Date().toISOString()});});closeModal();});
    $("#deleteFinance")?.addEventListener("click",()=>{if(!confirm("この収支を削除しますか？"))return;mutate(s=>s.finance=s.finance.filter(f=>f.id!==existing.id));closeModal();});
  }

  function collectionForm(existing=null){
    const x=existing||{kind:"アイデア",title:"",body:""};
    openModal(existing?"コレクションを編集":"コレクションを追加",`<form id="collectionForm" class="form"><div class="form-row"><label>種類</label><select class="select" name="kind">${["アイデア","読書・インプット","記事構成","調べもの","その他"].map(k=>`<option ${x.kind===k?'selected':''}>${k}</option>`).join('')}</select></div><div class="form-row"><label>タイトル</label><input class="field" name="title" required value="${esc(x.title)}"></div><div class="form-row"><label>内容</label><textarea class="area" name="body" style="min-height:220px">${esc(x.body||'')}</textarea></div><div class="form-actions">${existing?`<button type="button" class="danger-btn" id="deleteCollection">削除</button>`:''}<span style="flex:1"></span><button type="button" class="secondary-btn" data-action="modal-close">キャンセル</button><button class="primary-btn">保存</button></div></form>`);
    $("#collectionForm").addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.currentTarget),obj={kind:fd.get("kind"),title:String(fd.get("title")).trim(),body:String(fd.get("body")||"").trim(),updatedAt:new Date().toISOString()};mutate(s=>{if(existing)Object.assign(existing,obj);else s.collections.push({id:uid(),createdAt:new Date().toISOString(),...obj});});closeModal();});
    $("#deleteCollection")?.addEventListener("click",()=>{if(!confirm("このコレクションを削除しますか？"))return;mutate(s=>s.collections=s.collections.filter(c=>c.id!==existing.id));closeModal();});
  }

  function bindDynamicHandlers(){
    $$('[data-action]').forEach(el=>el.addEventListener('click',handleAction));
    $("#dailyDate")?.addEventListener("change",e=>{state.ui.selectedDate=e.target.value;saveState();renderApp()});
    $("#monthPicker")?.addEventListener("change",e=>{state.ui.selectedMonth=e.target.value;saveState();renderApp()});
    $("#habitMonth")?.addEventListener("change",e=>{state.ui.selectedMonth=e.target.value;saveState();renderApp()});
    $("#financeMonth")?.addEventListener("change",e=>{state.ui.selectedMonth=e.target.value;saveState();renderApp()});
    $("#themeSelect")?.addEventListener("change",e=>{state.settings.theme=e.target.value;saveState();renderApp()});
  }

  async function handleAction(e){
    const el=e.currentTarget,a=el.dataset.action;
    if(a==="modal-close")return closeModal();
    if(a==="add-entry")return entryForm(el.dataset.date||dateKey(new Date()));
    if(a==="edit-entry")return entryForm(state.entries.find(x=>x.id===el.dataset.id)?.date,state.entries.find(x=>x.id===el.dataset.id));
    if(a==="complete-entry")return mutate(()=>{const x=state.entries.find(v=>v.id===el.dataset.id);if(x)x.type="done"});
    if(a==="delete-entry"){if(confirm("このログを削除しますか？"))mutate(s=>s.entries=s.entries.filter(x=>x.id!==el.dataset.id));return}
    if(a==="goto-date"){state.ui.selectedDate=el.dataset.date;state.ui.view="daily";saveState();return renderApp()}
    if(a==="goto-month"){state.ui.selectedMonth=el.dataset.month;saveState();return renderApp()}
    if(a==="add-goal")return goalForm(el.dataset.month);
    if(a==="toggle-goal")return mutate(()=>{const x=(state.monthlyGoals[el.dataset.month]||[]).find(v=>v.id===el.dataset.id);if(x)x.done=!x.done});
    if(a==="delete-goal")return mutate(()=>state.monthlyGoals[el.dataset.month]=(state.monthlyGoals[el.dataset.month]||[]).filter(v=>v.id!==el.dataset.id));
    if(a==="add-future")return futureForm(el.dataset.month);
    if(a==="edit-future")return futureForm(state.future.find(x=>x.id===el.dataset.id)?.month,state.future.find(x=>x.id===el.dataset.id));
    if(a==="delete-future"){if(confirm("この予定を削除しますか？"))mutate(s=>s.future=s.future.filter(x=>x.id!==el.dataset.id));return}
    if(a==="add-habit")return habitForm();
    if(a==="edit-habit")return habitForm(state.habits.find(x=>x.id===el.dataset.id));
    if(a==="toggle-habit")return mutate(s=>{const k=`${el.dataset.id}:${el.dataset.date}`;s.habitChecks[k]=!s.habitChecks[k]});
    if(a==="add-finance")return financeForm();
    if(a==="edit-finance")return financeForm(state.finance.find(x=>x.id===el.dataset.id));
    if(a==="set-budget")return setBudget(el.dataset.month);
    if(a==="add-collection")return collectionForm();
    if(a==="edit-collection")return collectionForm(state.collections.find(x=>x.id===el.dataset.id));
    if(a==="export")return exportData();
    if(a==="import")return $("#importInput").click();
    if(a==="reset")return resetData();
    if(a==="install")return installPWA();
  }

  function setBudget(month){
    const current=state.budgets[month]||"";
    const value=prompt(`${month} の支出予算（円）`,current);
    if(value===null)return; const num=Number(value);
    if(!Number.isFinite(num)||num<0)return toast("0以上の金額を入力してください");
    mutate(s=>s.budgets[month]=num);
  }

  function exportData(){
    const payload={app:"hachiware-bullet",exportedAt:new Date().toISOString(),data:state};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`hachiware-bullet-backup-${dateKey(new Date())}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500);toast("バックアップを書き出しました");
  }

  function importData(file){
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const j=JSON.parse(reader.result);
        const incoming=j?.app==="hachiware-bullet"?j.data:j;
        if(!incoming||typeof incoming!=="object")throw new Error();
        if(!confirm("現在の端末データを、読み込んだバックアップで置き換えますか？"))return;
        state=normalizeState(incoming);saveState();renderApp();toast("データを読み込みました");
      }catch{toast("読み込めないファイルです")}
    };
    reader.readAsText(file);
  }

  function resetData(){
    if(!confirm("この端末のハチワレバレットのデータをすべて消去します。よろしいですか？"))return;
    if(!confirm("元に戻せません。続けますか？"))return;
    state=defaultState();saveState();renderApp();toast("データを消去しました");
  }

  async function installPWA(){
    if(!deferredInstallPrompt)return;
    deferredInstallPrompt.prompt();
    try{await deferredInstallPrompt.userChoice}catch{}
    deferredInstallPrompt=null;renderApp();
  }

  function initEvents(){
    $$(".nav-item").forEach(b=>b.addEventListener("click",()=>b.dataset.view&&setView(b.dataset.view)));
    $("#quickAddBtn").addEventListener("click",()=>entryForm(state.ui.selectedDate||dateKey(new Date())));
    $("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
    $("#modalClose").addEventListener("click",closeModal);
    $("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
    $("#importInput").addEventListener("change",e=>{const f=e.target.files?.[0];if(f)importData(f);e.target.value=""});
    window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;renderApp()});
    window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;toast("アプリを追加しました");renderApp()});
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if(state.settings.theme==="system")applyTheme()});
  }

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }
  initEvents();
  renderApp();
})();

(() => {
  "use strict";

  const KEY = "skincare-pwa-data-v1";
  const DB_NAME = "skincare-pwa-photos";
  const DB_STORE = "photos";
  const DAY_NAMES = ["日","月","火","水","木","金","土"];
  const CATEGORIES = ["洗顔","化粧水","美容液","乳液","クリーム","日焼け止め","その他"];

  const defaultState = () => ({
    version: 1,
    products: [],
    routines: { morning: [], night: [] },
    weekdayExtras: {0:[],1:[],2:[],3:[],4:[],5:[],6:[]},
    history: {},
    settings: { dark: false }
  });

  let state = loadState();
  let activeTab = "home";
  let routineTime = "morning";
  let weekdaySelected = new Date().getDay();
  let historyMode = "history";
  let productQuery = "";
  let installPrompt = null;
  let isOnline = navigator.onLine;

  const $ = (sel, root=document) => root.querySelector(sel);
  const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));
  const todayKey = (d=new Date()) => {
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  };
  const fmtDate = (key) => new Date(key+"T12:00:00").toLocaleDateString("ja-JP", {month:"long",day:"numeric",weekday:"short"});
  const fmtLongToday = () => new Date().toLocaleDateString("ja-JP", {year:"numeric",month:"long",day:"numeric",weekday:"long"});

  function loadState(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw) return defaultState();
      const parsed=JSON.parse(raw);
      const d=defaultState();
      return {
        ...d,...parsed,
        routines:{...d.routines,...(parsed.routines||{})},
        weekdayExtras:{...d.weekdayExtras,...(parsed.weekdayExtras||{})},
        settings:{...d.settings,...(parsed.settings||{})}
      };
    }catch{return defaultState();}
  }
  function saveState(){ localStorage.setItem(KEY, JSON.stringify(state)); }
  function productName(id){ return state.products.find(p=>p.id===id)?.name || "製品未設定"; }
  function timeLabel(t){ return t==="morning"?"朝":"夜"; }
  function timeSteps(time, date=new Date()){
    const base=(state.routines[time]||[]).map(x=>({...x,_key:`r:${x.id}`,_extra:false}));
    const extras=(state.weekdayExtras[date.getDay()]||[]).filter(x=>x.time===time).map(x=>({...x,_key:`w:${x.id}`,_extra:true}));
    return [...base,...extras];
  }
  function historyFor(key){
    if(!state.history[key]) state.history[key]={morning:[],night:[],productIds:[]};
    return state.history[key];
  }
  function updateHistoryProducts(key){
    const rec=historyFor(key);
    const ids=new Set();
    ["morning","night"].forEach(time=>{
      const steps=timeSteps(time,new Date(key+"T12:00:00"));
      for(const step of steps){ if(rec[time].includes(step._key) && step.productId) ids.add(step.productId); }
    });
    rec.productIds=[...ids];
  }
  function toggleCompletion(time, key){
    const date=todayKey(), rec=historyFor(date), arr=rec[time], i=arr.indexOf(key);
    if(i>=0) arr.splice(i,1); else arr.push(key);
    updateHistoryProducts(date); saveState(); render();
  }
  function progress(time){
    const steps=timeSteps(time), rec=historyFor(todayKey()), done=steps.filter(s=>rec[time].includes(s._key)).length;
    return {done,total:steps.length,pct:steps.length?Math.round(done/steps.length*100):0,steps};
  }
  function appHeader(title, subtitle=""){ return `<div class="topbar"><div class="title"><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:""}</div><span class="status">${isOnline?"オンライン":"オフライン"}</span></div>`; }
  function nav(){ const items=[["home","⌂","ホーム"],["routine","☼","ルーティン"],["products","▣","製品"],["history","◷","履歴"],["settings","⚙","設定"]]; return `<nav class="nav">${items.map(([id,ico,label])=>`<button data-nav="${id}" class="${activeTab===id?"active":""}"><span class="ico">${ico}</span>${label}</button>`).join("")}</nav>`; }
  function renderHome(){
    const mp=progress("morning"), np=progress("night");
    const section=(time,p)=>{ const allDone=p.total>0&&p.done===p.total; return `<section class="card"><div class="section-title"><div><h2>${timeLabel(time)}のケア</h2><div class="sub">${p.done}/${p.total} 完了</div></div><strong>${p.pct}%</strong></div><div class="progress"><span style="width:${p.pct}%"></span></div>${p.steps.length?p.steps.map(s=>{const done=historyFor(todayKey())[time].includes(s._key);return `<div class="routine-item"><button class="check ${done?"done":""}" data-complete="${time}|${s._key}">${done?"✓":""}</button><div class="item-main ${done?"done-text":""}"><div class="item-name">${esc(s.name)}</div><div class="item-meta">${s.productId?esc(productName(s.productId)):"製品未設定"}${s.amount?` ・ ${esc(s.amount)}`:""}${s._extra?" ・ 曜日別ケア":""}${s.note?`<br>${esc(s.note)}`:""}</div></div></div>`;}).join(""):`<div class="empty">${timeLabel(time)}のルーティンが未設定です。<br>「ルーティン」から追加できます。</div>`}${allDone?`<div class="complete">✓ ${timeLabel(time)}のケア完了</div>`:""}</section>`; };
    const allTotal=mp.total+np.total, allDone=mp.done+np.done;
    return `${appHeader("スキンケア管理",fmtLongToday())}${allTotal>0&&allDone===allTotal?`<div class="complete" style="margin-bottom:14px">今日のケア完了 ✓</div>`:""}${section("morning",mp)}${section("night",np)}`;
  }
  function routineRow(s,index,list,time,extra=false){ return `<div class="list-row"><div class="item-main"><div class="item-name">${esc(s.name)}</div><div class="item-meta">${s.productId?esc(productName(s.productId)):"製品未設定"}${s.amount?` ・ ${esc(s.amount)}`:""}${s.note?`<br>${esc(s.note)}`:""}</div></div><div class="list-actions">${!extra?`<button class="btn small ghost" data-move="${time}|${s.id}|up" ${index===0?"disabled":""}>↑</button><button class="btn small ghost" data-move="${time}|${s.id}|down" ${index===list.length-1?"disabled":""}>↓</button>`:""}<button class="btn small secondary" data-edit-routine="${extra?"extra":"base"}|${time}|${s.id}">編集</button><button class="btn small danger" data-del-routine="${extra?"extra":"base"}|${time}|${s.id}">削除</button></div></div>`; }
  function renderRoutine(){
    const list=state.routines[routineTime]||[], extras=(state.weekdayExtras[weekdaySelected]||[]).filter(x=>x.time===routineTime);
    return `${appHeader("ルーティン","朝・夜と曜日別のケアを設定")}<div class="tabs"><button class="tab ${routineTime==="morning"?"active":""}" data-rtime="morning">朝</button><button class="tab ${routineTime==="night"?"active":""}" data-rtime="night">夜</button></div><section class="card"><div class="section-title"><h2>${timeLabel(routineTime)}の基本ルーティン</h2><button class="btn small" data-add-routine="base">＋追加</button></div>${list.length?list.map((s,i)=>routineRow(s,i,list,routineTime,false)).join(""):`<div class="empty">まだステップがありません</div>`}</section><section class="card"><div class="section-title"><div><h2>曜日別の追加ケア</h2><div class="sub">選んだ曜日だけ今日の画面に追加</div></div><button class="btn small" data-add-routine="extra">＋追加</button></div><div class="weekday-grid">${DAY_NAMES.map((d,i)=>`<button class="weekday ${weekdaySelected===i?"active":""}" data-weekday="${i}">${d}</button>`).join("")}</div><div style="margin-top:12px">${extras.length?extras.map((s,i)=>routineRow(s,i,extras,routineTime,true)).join(""):`<div class="empty">${DAY_NAMES[weekdaySelected]}曜日の追加ケアはありません</div>`}</div></section>`;
  }
  function renderProducts(){
    const query=productQuery.trim().toLowerCase(), list=state.products.filter(p=>!query||`${p.name} ${p.brand}`.toLowerCase().includes(query));
    return `${appHeader("製品","使っているスキンケアを管理")}<section class="card"><div class="row"><input id="product-search" class="grow" placeholder="製品名・ブランドで検索" value="${esc(productQuery)}"><button class="btn" data-add-product>＋追加</button></div></section><section class="card">${list.length?list.map(p=>`<div class="list-row"><div class="item-main"><div class="item-name">${esc(p.name)}</div><div class="item-meta">${esc(p.brand||"ブランド未設定")} ・ ${esc(p.category)} ・ ${p.timing==="both"?"朝・夜":timeLabel(p.timing)}${p.opened?`<br>開封日: ${esc(p.opened)}`:""}${p.note?`<br>${esc(p.note)}`:""}</div></div><div class="list-actions"><button class="btn small secondary" data-edit-product="${p.id}">編集</button><button class="btn small danger" data-del-product="${p.id}">削除</button></div></div>`).join(""):`<div class="empty">製品がありません</div>`}</section>`;
  }
  function historyRows(){ const keys=Object.keys(state.history).sort().reverse(); if(!keys.length)return `<div class="empty">まだ使用履歴がありません。<br>ホームでケアを完了すると記録されます。</div>`; return keys.map(key=>{const rec=state.history[key],mSteps=timeSteps("morning",new Date(key+"T12:00:00")),nSteps=timeSteps("night",new Date(key+"T12:00:00")),products=(rec.productIds||[]).map(productName);return `<div class="month-row"><strong>${esc(fmtDate(key))}</strong><div><span class="pill">朝 ${(rec.morning||[]).length}/${mSteps.length}</span><span class="pill">夜 ${(rec.night||[]).length}/${nSteps.length}</span>${products.length?`<div class="sub" style="margin-top:5px">${products.map(esc).join("・")}</div>`:""}</div><button class="btn small danger" data-del-history="${key}">削除</button></div>`;}).join(""); }
  async function renderHistory(){ const root=$("#view"); root.innerHTML=`${appHeader("履歴","毎日のケアと肌写真を確認")}<div class="tabs"><button class="tab ${historyMode==="history"?"active":""}" data-hmode="history">使用履歴</button><button class="tab ${historyMode==="photos"?"active":""}" data-hmode="photos">肌写真</button></div><section class="card" id="history-content">${historyMode==="history"?historyRows():"<div class='empty'>写真を読み込み中…</div>"}</section>${historyMode==="photos"?`<button class="fab" data-add-photo aria-label="肌写真を追加">＋</button>`:""}`; if(historyMode==="photos")await renderPhotosInto(); }
  async function renderPhotosInto(){ const photos=await getAllPhotos(),box=$("#history-content");if(!box)return;box.innerHTML=`<div class="section-title"><div><h2>肌写真</h2><div class="sub">端末内に保存・画像は圧縮</div></div><button class="btn small" data-add-photo>＋追加</button></div>${photos.length?`<div class="photo-grid">${photos.map(p=>`<div class="photo-card"><img src="${p.dataUrl}" alt="肌写真"><div class="photo-body"><div class="photo-date">${esc(p.date)}</div>${p.note?`<div class="photo-note">${esc(p.note)}</div>`:""}<button class="btn small danger" style="margin-top:8px" data-del-photo="${p.id}">削除</button></div></div>`).join("")}</div>`:`<div class="empty">肌写真はまだありません</div>`}`;bindViewEvents(); }
  function renderSettings(){ const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent),standalone=window.matchMedia?.("(display-mode: standalone)").matches;return `${appHeader("設定","バックアップ・表示・PWA")}<section class="card"><div class="switch-row"><div><div class="item-name">ダークモード</div><div class="item-meta">暗い場所で見やすい表示</div></div><button class="switch ${state.settings.dark?"on":""}" data-dark><span></span></button></div></section><section class="card"><div class="section-title"><h2>バックアップ</h2></div><div class="row"><button class="btn secondary" data-export>JSONで書き出す</button><button class="btn ghost" data-import>JSONから読み込む</button><input type="file" id="import-file" accept="application/json" hidden></div></section><section class="card"><div class="section-title"><h2>ホーム画面に追加</h2></div><div class="install-box">${standalone?"このPWAはホーム画面から起動中です。":installPrompt?`<button class="btn" data-install>インストール</button>`:ios?"iPhone: Safariで開き、共有ボタン →「ホーム画面に追加」を選択してください。":"Android: ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選択してください。"}</div></section><section class="card danger-zone"><div class="section-title"><h2>全データ削除</h2></div><button class="btn danger" data-clear-all>すべて削除</button></section>`; }
  function render(){ document.body.classList.toggle("dark",!!state.settings.dark);const app=$("#app");app.innerHTML=`<div class="shell"><div id="view"></div></div>${nav()}`;const view=$("#view");if(activeTab==="home")view.innerHTML=renderHome();else if(activeTab==="routine")view.innerHTML=renderRoutine();else if(activeTab==="products")view.innerHTML=renderProducts();else if(activeTab==="settings")view.innerHTML=renderSettings();else renderHistory();bindViewEvents(); }
  function optionsProducts(selected=""){ return `<option value="">製品未設定</option>`+state.products.map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)}${p.brand?`（${esc(p.brand)}）`:""}</option>`).join(""); }
  function showModal(html){ const wrap=document.createElement("div");wrap.className="modal-backdrop";wrap.id="modal";wrap.innerHTML=`<div class="modal">${html}</div>`;document.body.appendChild(wrap);wrap.addEventListener("click",e=>{if(e.target===wrap)closeModal();}); }
  function closeModal(){ $("#modal")?.remove(); }
  function openRoutineModal(kind,time,id=""){ const extra=kind==="extra",source=extra?(state.weekdayExtras[weekdaySelected]||[]):(state.routines[time]||[]),item=source.find(x=>x.id===id)||{name:"",productId:"",amount:"",note:"",time};showModal(`<h3>${id?"ステップを編集":"ステップを追加"}</h3><form id="routine-form"><div class="field"><label>ステップ名</label><input name="name" required value="${esc(item.name)}"></div><div class="field"><label>製品</label><select name="productId">${optionsProducts(item.productId)}</select></div><div class="field"><label>使用量</label><input name="amount" value="${esc(item.amount||"")}"></div><div class="field"><label>メモ</label><textarea name="note">${esc(item.note||"")}</textarea></div><div class="row"><button type="button" class="btn ghost" data-close>キャンセル</button><button class="btn grow" type="submit">保存</button></div></form>`);$("[data-close]").onclick=closeModal;$("#routine-form").onsubmit=e=>{e.preventDefault();const fd=new FormData(e.currentTarget),data={id:id||uid(),name:String(fd.get("name")||"").trim(),productId:String(fd.get("productId")||""),amount:String(fd.get("amount")||"").trim(),note:String(fd.get("note")||"").trim(),time};if(!data.name)return;if(extra){const arr=state.weekdayExtras[weekdaySelected]||[],i=arr.findIndex(x=>x.id===id);if(i>=0)arr[i]=data;else arr.push(data);}else{const arr=state.routines[time],i=arr.findIndex(x=>x.id===id);if(i>=0)arr[i]=data;else arr.push(data);}saveState();closeModal();render();}; }
  function openProductModal(id=""){ const p=state.products.find(x=>x.id===id)||{name:"",brand:"",category:"美容液",timing:"both",opened:"",note:""};showModal(`<h3>${id?"製品を編集":"製品を追加"}</h3><form id="product-form"><div class="field"><label>製品名</label><input name="name" required value="${esc(p.name)}"></div><div class="field"><label>ブランド</label><input name="brand" value="${esc(p.brand)}"></div><div class="grid2"><div class="field"><label>カテゴリ</label><select name="category">${CATEGORIES.map(c=>`<option ${c===p.category?"selected":""}>${c}</option>`).join("")}</select></div><div class="field"><label>使用タイミング</label><select name="timing"><option value="morning" ${p.timing==="morning"?"selected":""}>朝</option><option value="night" ${p.timing==="night"?"selected":""}>夜</option><option value="both" ${p.timing==="both"?"selected":""}>朝・夜</option></select></div></div><div class="field"><label>開封日</label><input type="date" name="opened" value="${esc(p.opened||"")}"></div><div class="field"><label>メモ</label><textarea name="note">${esc(p.note||"")}</textarea></div><div class="row"><button type="button" class="btn ghost" data-close>キャンセル</button><button class="btn grow" type="submit">保存</button></div></form>`);$("[data-close]").onclick=closeModal;$("#product-form").onsubmit=e=>{e.preventDefault();const fd=new FormData(e.currentTarget),data={id:id||uid(),name:String(fd.get("name")||"").trim(),brand:String(fd.get("brand")||"").trim(),category:String(fd.get("category")||"その他"),timing:String(fd.get("timing")||"both"),opened:String(fd.get("opened")||""),note:String(fd.get("note")||"").trim()};if(!data.name)return;const i=state.products.findIndex(x=>x.id===id);if(i>=0)state.products[i]=data;else state.products.push(data);saveState();closeModal();render();}; }
  function openPhotoModal(){ showModal(`<h3>肌写真を追加</h3><form id="photo-form"><div class="field"><label>写真</label><input type="file" name="photo" accept="image/*" capture="user" required></div><div class="field"><label>撮影日</label><input type="date" name="date" value="${todayKey()}" required></div><div class="field"><label>メモ</label><textarea name="note"></textarea></div><div class="row"><button type="button" class="btn ghost" data-close>キャンセル</button><button class="btn grow" type="submit">保存</button></div></form>`);$("[data-close]").onclick=closeModal;$("#photo-form").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),file=fd.get("photo");if(!(file instanceof File)||!file.size)return;const dataUrl=await compressImage(file,1280,.78);await putPhoto({id:uid(),date:String(fd.get("date")||todayKey()),note:String(fd.get("note")||"").trim(),dataUrl,createdAt:Date.now()});closeModal();render();}; }
  function bindViewEvents(){ document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{activeTab=b.dataset.nav;render();});document.querySelectorAll("[data-complete]").forEach(b=>b.onclick=()=>{const [time,key]=b.dataset.complete.split("|");toggleCompletion(time,key);});document.querySelectorAll("[data-rtime]").forEach(b=>b.onclick=()=>{routineTime=b.dataset.rtime;render();});document.querySelectorAll("[data-weekday]").forEach(b=>b.onclick=()=>{weekdaySelected=Number(b.dataset.weekday);render();});document.querySelectorAll("[data-add-routine]").forEach(b=>b.onclick=()=>openRoutineModal(b.dataset.addRoutine,routineTime));document.querySelectorAll("[data-edit-routine]").forEach(b=>b.onclick=()=>{const [kind,time,id]=b.dataset.editRoutine.split("|");openRoutineModal(kind,time,id);});document.querySelectorAll("[data-del-routine]").forEach(b=>b.onclick=()=>{const [kind,time,id]=b.dataset.delRoutine.split("|");if(!confirm("このステップを削除しますか？"))return;if(kind==="extra")state.weekdayExtras[weekdaySelected]=state.weekdayExtras[weekdaySelected].filter(x=>x.id!==id);else state.routines[time]=state.routines[time].filter(x=>x.id!==id);saveState();render();});document.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{const [time,id,dir]=b.dataset.move.split("|"),arr=state.routines[time],i=arr.findIndex(x=>x.id===id),j=dir==="up"?i-1:i+1;if(i<0||j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];saveState();render();});$("[data-add-product]")?.addEventListener("click",()=>openProductModal());document.querySelectorAll("[data-edit-product]").forEach(b=>b.onclick=()=>openProductModal(b.dataset.editProduct));document.querySelectorAll("[data-del-product]").forEach(b=>b.onclick=()=>{const id=b.dataset.delProduct;if(confirm("この製品を削除しますか？")){state.products=state.products.filter(x=>x.id!==id);saveState();render();}});$("#product-search")?.addEventListener("input",e=>{productQuery=e.target.value;render();$("#product-search")?.focus();});document.querySelectorAll("[data-hmode]").forEach(b=>b.onclick=()=>{historyMode=b.dataset.hmode;render();});document.querySelectorAll("[data-del-history]").forEach(b=>b.onclick=()=>{if(confirm("この日の履歴を削除しますか？")){delete state.history[b.dataset.delHistory];saveState();render();}});document.querySelectorAll("[data-add-photo]").forEach(b=>b.onclick=openPhotoModal);document.querySelectorAll("[data-del-photo]").forEach(b=>b.onclick=async()=>{if(confirm("この写真を削除しますか？")){await deletePhoto(b.dataset.delPhoto);render();}});$("[data-dark]")?.addEventListener("click",()=>{state.settings.dark=!state.settings.dark;saveState();render();});$("[data-install]")?.addEventListener("click",async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;render();}});$("[data-export]")?.addEventListener("click",exportData);$("[data-import]")?.addEventListener("click",()=>$("#import-file")?.click());$("#import-file")?.addEventListener("change",importData);$("[data-clear-all]")?.addEventListener("click",async()=>{if(!confirm("この端末のスキンケア管理データをすべて削除します。元に戻せません。よろしいですか？"))return;state=defaultState();saveState();await clearPhotos();render();}); }
  function openDB(){ return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE,{keyPath:"id"});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}); }
  async function dbTx(mode,fn){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,mode),store=tx.objectStore(DB_STORE);fn(store,resolve,reject);tx.onerror=()=>reject(tx.error);tx.oncomplete=()=>db.close();});}
  async function putPhoto(photo){return dbTx("readwrite",(s,res,rej)=>{const r=s.put(photo);r.onsuccess=()=>res(photo);r.onerror=()=>rej(r.error);});}
  async function getAllPhotos(){return dbTx("readonly",(s,res,rej)=>{const r=s.getAll();r.onsuccess=()=>res((r.result||[]).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||b.createdAt-a.createdAt));r.onerror=()=>rej(r.error);});}
  async function deletePhoto(id){return dbTx("readwrite",(s,res,rej)=>{const r=s.delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
  async function clearPhotos(){return dbTx("readwrite",(s,res,rej)=>{const r=s.clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
  function compressImage(file,maxDim=1280,quality=.78){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{let w=img.width,h=img.height,scale=Math.min(1,maxDim/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale);const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(c.toDataURL("image/jpeg",quality));};img.onerror=reject;img.src=url;});}
  async function exportData(){const photos=await getAllPhotos(),payload={exportedAt:new Date().toISOString(),app:"スキンケア管理",state,photos},blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`skincare-backup-${todayKey()}.json`;a.click();}
  async function importData(e){const file=e.target.files?.[0];if(!file)return;try{const payload=JSON.parse(await file.text());if(!payload.state)throw new Error();if(!confirm("現在のデータをバックアップ内容で置き換えますか？"))return;state={...defaultState(),...payload.state};saveState();await clearPhotos();for(const p of(payload.photos||[]))await putPhoto(p);render();alert("読み込みが完了しました");}catch{alert("読み込めないJSONファイルです");}}
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;render();});window.addEventListener("online",()=>{isOnline=true;render();});window.addEventListener("offline",()=>{isOnline=false;render();});if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));render();
})();

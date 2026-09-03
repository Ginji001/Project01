/* Practical management extension v2 */
const V2_WEEK_DAYS=['月','火','水','木','金','土','日'];
const V2_DAY_BY_JS=['日','月','火','水','木','金','土'];
let v2HistoryFilter='';
let v2RoutineDay=V2_DAY_BY_JS[new Date().getDay()];
let v2LogState={type:null,id:null};

function v2Esc(v){return escapeHtml(v==null?'':v)}
function v2LocalDateTime(date=new Date()){const d=new Date(date.getTime()-date.getTimezoneOffset()*60000);return d.toISOString().slice(0,16)}
function v2DayDiff(a,b){const x=new Date(a),y=new Date(b);x.setHours(0,0,0,0);y.setHours(0,0,0,0);return Math.round((x-y)/86400000)}
function v2Days(item){
  if(item.days)return String(item.days).split(',').map(x=>x.trim()).filter(Boolean);
  if((item.frequency||'').includes('毎日'))return V2_WEEK_DAYS;
  return [];
}
function v2Slots(item){
  if(item.slot==='朝・夜')return ['朝','夜'];
  if(['朝','夜','寝る前','必要時'].includes(item.slot))return [item.slot];
  return item.slot?[item.slot]:[];
}
function v2ProductsForDay(day){
  return data.products.filter(p=>p.status==='使用中'&&p.useFrame!=='休止'&&v2Days(p).includes(day));
}
function v2RoutineHtml(day){
  const products=v2ProductsForDay(day);
  if(!products.length)return '<div class="empty-state small-empty">この曜日のルーティンはまだありません。</div>';
  const order=['朝','夜','寝る前','必要時','その他'];
  const buckets=new Map(order.map(x=>[x,[]]));
  products.forEach(p=>{
    const slots=v2Slots(p);
    if(!slots.length)buckets.get('その他').push(p);
    else slots.forEach(slot=>(buckets.get(slot)||buckets.get('その他')).push(p));
  });
  return order.filter(slot=>buckets.get(slot).length).map(slot=>{
    const rows=buckets.get(slot).map(item=>
      '<div class="routine-item"><div><strong>'+v2Esc(item.name)+'</strong><small>'+
      v2Esc([item.useFrame,item.category,item.risk?'刺激 '+item.risk:''].filter(Boolean).join(' ・ '))+
      '</small></div><button class="routine-log-btn" data-product-log="'+item.id+'" type="button">記録</button></div>'
    ).join('');
    return '<div class="routine-group"><h3>'+slot+'</h3>'+rows+'</div>';
  }).join('');
}
function v2RenderToday(){
  const day=V2_DAY_BY_JS[new Date().getDay()];
  $('#todayLabel').textContent=formatDate(new Date().toISOString())+'（'+day+'）';
  $('#todayRoutine').innerHTML=v2RoutineHtml(day);
}
function v2RenderDayPicker(){
  $('#routineDayPicker').innerHTML=V2_WEEK_DAYS.map(day=>
    '<button class="day-chip '+(day===v2RoutineDay?'active':'')+'" data-routine-day="'+day+'" type="button">'+day+'</button>'
  ).join('');
}
function v2RenderWeekly(){$('#weeklyRoutine').innerHTML=v2RoutineHtml(v2RoutineDay)}
function v2Ingredients(text){
  return String(text||'').split(/[、,，\n\/・+＋]/).map(part=>
    part.replace(/[（(].*?[)）]/g,'').replace(/\d+(?:\.\d+)?\s*%/g,'').trim().toLowerCase()
  ).filter(x=>x.length>=2);
}
function v2LatestTreatmentLog(refId){
  return data.history.filter(h=>h.type==='treatment'&&h.refId===refId).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0]||null;
}
function v2RenderSafety(){
  const root=$('#safetyChecks');
  const active=data.products.filter(p=>p.status==='使用中'&&p.useFrame!=='休止');
  const checks=[];
  const map=new Map();
  active.forEach(p=>v2Ingredients(p.ingredients).forEach(ing=>{
    if(!map.has(ing))map.set(ing,[]);
    map.get(ing).push(p.name);
  }));
  [...map.entries()].filter(([,names])=>new Set(names).size>=2).slice(0,4).forEach(([ing,names])=>{
    checks.push({level:'watch',title:'「'+ing+'」が複数製品に登録',detail:[...new Set(names)].join(' / ')});
  });
  const today=new Date();
  data.treatments.filter(t=>t.status==='継続').forEach(t=>{
    if(t.nextDate){
      const until=v2DayDiff(t.nextDate,today);
      if(until>=0)active.filter(p=>Number(p.pauseBefore||0)>0&&until<=Number(p.pauseBefore||0)).forEach(p=>{
        checks.push({level:'alert',title:p.name+'：施術前の休止期間',detail:t.name+'まであと'+until+'日。登録した休止目安は'+Number(p.pauseBefore)+'日です。'});
      });
    }
    const last=v2LatestTreatmentLog(t.id);
    if(last){
      const since=v2DayDiff(today,last.createdAt);
      active.filter(p=>Number(p.pauseAfter||0)>0&&since>=0&&since<=Number(p.pauseAfter||0)).forEach(p=>{
        checks.push({level:'alert',title:p.name+'：施術後の休止期間',detail:t.name+'から'+since+'日。登録した休止目安は'+Number(p.pauseAfter)+'日です。'});
      });
    }
  });
  const todayProducts=v2ProductsForDay(V2_DAY_BY_JS[new Date().getDay()]);
  ['朝','夜','寝る前'].forEach(slot=>{
    const high=todayProducts.filter(p=>p.risk==='高'&&v2Slots(p).includes(slot));
    if(high.length>=2)checks.push({level:'watch',title:slot+'：刺激リスク「高」が複数',detail:high.map(x=>x.name).join(' / ')});
  });
  if(active.some(p=>p.category==='処方薬'))checks.push({level:'info',title:'処方薬を登録中',detail:'処方薬はアプリ内のルーティンやメモより、医師・薬剤師の指示を優先してください。'});
  if(!active.length&&!data.treatments.length){
    root.innerHTML='<div class="empty-state small-empty">製品や施術を登録すると、重複・休止期間・刺激リスクをここで確認できます。</div>';
    return;
  }
  if(!checks.length){
    root.innerHTML='<div class="check-ok"><span>✓</span><div><strong>登録情報上の注意はありません</strong><small>成分・施術前後の休止・刺激リスクを自動確認しています。</small></div></div>';
    return;
  }
  root.innerHTML='<div class="check-list">'+checks.slice(0,8).map(c=>
    '<div class="check-row '+c.level+'"><span>'+(c.level==='alert'?'!':c.level==='watch'?'△':'i')+'</span><div><strong>'+
    v2Esc(c.title)+'</strong><small>'+v2Esc(c.detail)+'</small></div></div>'
  ).join('')+'</div>';
}
function v2RenderSkinLatest(){
  const root=$('#latestSkinLog');
  const item=data.history.filter(h=>h.type==='skin').sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];
  if(!item){root.className='empty-state';root.textContent='肌状態の記録はまだありません。';return}
  root.className='skin-latest';
  root.innerHTML='<div class="skin-score-large">'+v2Esc(item.score||'3')+'<span>/5</span></div><div><strong>'+
    v2Esc(item.condition||'状態タグなし')+'</strong><p>'+formatDate(item.createdAt,true)+(item.note?' ・ '+v2Esc(item.note):'')+'</p></div>';
}
function v2NumField(name,label,value,suffix){
  return '<div class="field"><label for="field-'+name+'">'+label+'</label><div class="number-wrap"><input id="field-'+name+'" name="'+name+'" type="number" min="0" max="90" step="1" value="'+Number(value||0)+'"><span>'+suffix+'</span></div></div>';
}
function v2DateField(name,label,value){
  const d=value?String(value).slice(0,10):'';
  return '<div class="field"><label for="field-'+name+'">'+label+'</label><input id="field-'+name+'" name="'+name+'" type="date" value="'+v2Esc(d)+'"></div>';
}
function v2DayField(value){
  const selected=String(value||'').split(',').filter(Boolean);
  return '<div class="field"><span>使用曜日</span><input id="field-days" name="days" type="hidden" value="'+v2Esc(selected.join(','))+'"><div class="day-picker editor-days">'+
    V2_WEEK_DAYS.map(day=>'<button class="day-chip '+(selected.includes(day)?'active':'')+'" data-editor-day="'+day+'" type="button">'+day+'</button>').join('')+
    '</div></div>';
}

productFields=function(item={}){
  const days=item.days!==undefined?item.days:V2_WEEK_DAYS.join(',');
  return photoField()+textField('name','製品名',item.name,'例：化粧水、クリームなど',true)+textField('brand','ブランド・メーカー',item.brand,'任意')+
    selectField('category','カテゴリ',item.category,['','クレンジング','洗顔','化粧水','美容液','乳液','クリーム','日焼け止め','パック','処方薬','その他'])+
    textField('ingredients','主成分・濃度',item.ingredients,'例：ナイアシンアミド 5%、セラミド')+
    textField('purpose','目的・役割',item.purpose,'例：保湿、毛穴、ニキビ対策')+
    selectField('useFrame','保管・使用枠',item.useFrame||'通常',['通常','実家','寝る前','休止'])+
    selectField('slot','使用タイミング',item.slot,['','朝','夜','朝・夜','寝る前','必要時','その他'])+
    v2DayField(days)+textField('frequency','使用頻度',item.frequency,'例：毎日、週3回')+
    selectField('risk','刺激リスク（自分用の目安）',item.risk||'低',['低','中','高'])+
    '<div class="field-grid two">'+v2NumField('pauseBefore','施術前の休止目安',item.pauseBefore||0,'日')+v2NumField('pauseAfter','施術後の休止目安',item.pauseAfter||0,'日')+'</div>'+
    selectField('status','状態',item.status||'使用中',['使用中','休止','終了'])+
    textAreaField('caution','併用・注意メモ',item.caution,'重複、刺激、併用時に気をつけること')+
    textAreaField('notes','その他メモ',item.notes,'使い方・保管場所など');
};
treatmentFields=function(item={}){
  return photoField()+textField('name','施術名',item.name,'例：ピーリング、ダーマペンなど',true)+
    selectField('category','カテゴリ',item.category,['','セルフケア','美容医療','皮膚科','機器','その他'])+
    textField('purpose','目的',item.purpose,'例：毛穴、肌質、ニキビ跡')+textField('frequency','頻度・周期',item.frequency,'例：4週間ごと')+
    v2DateField('nextDate','次回予定日',item.nextDate)+textField('details','設定・条件',item.details,'例：深さ、出力など')+
    '<div class="field-grid two">'+v2NumField('preCareDays','施術前の注意期間',item.preCareDays||0,'日')+v2NumField('postCareDays','施術後の回復期間',item.postCareDays||0,'日')+'</div>'+
    selectField('status','状態',item.status||'継続',['継続','休止','終了'])+
    textAreaField('caution','安全・注意メモ',item.caution,'炎症時は避ける、肌状態を優先する等')+
    textAreaField('notes','その他メモ',item.notes,'施術条件や経過など');
};

function v2ProductMatch(item){
  const q=$('#productSearch').value.trim().toLowerCase(),status=$('#productStatusFilter').value,frame=$('#productFrameFilter').value,risk=$('#productRiskFilter').value;
  const text=[item.name,item.brand,item.category,item.ingredients,item.purpose,item.notes,item.caution,item.useFrame,item.days].join(' ').toLowerCase();
  return(!q||text.includes(q))&&(!status||item.status===status)&&(!frame||item.useFrame===frame)&&(!risk||item.risk===risk);
}
renderProducts=async function(){
  const list=$('#productList'),items=data.products.filter(v2ProductMatch).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  if(!items.length){list.innerHTML='<div class="empty-state">'+(data.products.length?'条件に合う製品はありません。':'製品はまだ登録されていません。')+'</div>';return}
  list.innerHTML='';
  for(const item of items){
    const url=item.imageId?await getImageUrl(item.imageId):null;
    const card=document.createElement('article');card.className='item-card';
    card.innerHTML='<div class="item-card-main">'+
      (url?'<img class="item-image" src="'+url+'" alt="'+v2Esc(item.name)+'の写真">':'<div class="item-image-placeholder" aria-hidden="true">▣</div>')+
      '<div class="item-meta"><div class="item-topline"><span class="badge">'+v2Esc(item.status||'使用中')+'</span>'+
      (item.category?'<span class="badge muted">'+v2Esc(item.category)+'</span>':'')+
      (item.risk?'<span class="badge risk-'+v2Esc(item.risk)+'">刺激 '+v2Esc(item.risk)+'</span>':'')+
      '</div><h3>'+v2Esc(item.name)+'</h3><p>'+v2Esc(item.brand||'ブランド未設定')+'</p><p>'+
      v2Esc([item.useFrame,item.slot,item.days||'曜日未設定'].filter(Boolean).join(' ・ '))+'</p></div></div>'+
      '<details class="item-details"><summary>詳細を見る</summary><dl>'+
      '<div><dt>主成分・濃度</dt><dd>'+v2Esc(item.ingredients||'未設定')+'</dd></div>'+
      '<div><dt>目的・役割</dt><dd>'+v2Esc(item.purpose||'未設定')+'</dd></div>'+
      '<div><dt>使用頻度</dt><dd>'+v2Esc(item.frequency||'未設定')+'</dd></div>'+
      '<div><dt>施術前の休止</dt><dd>'+Number(item.pauseBefore||0)+'日</dd></div>'+
      '<div><dt>施術後の休止</dt><dd>'+Number(item.pauseAfter||0)+'日</dd></div>'+
      '<div><dt>併用・注意</dt><dd>'+v2Esc(item.caution||item.notes||'未設定')+'</dd></div></dl>'+
      (item.category==='処方薬'?'<p class="inline-note">処方薬はアプリ内設定より、医師・薬剤師からの指示を優先してください。</p>':'')+
      '</details><div class="item-actions"><button class="log" data-product-log="'+item.id+'" type="button">使用記録</button><button data-product-edit="'+item.id+'" type="button">編集</button><button class="delete" data-product-delete="'+item.id+'" type="button">削除</button></div>';
    list.appendChild(card);
  }
};
function v2TreatmentMatch(item){
  const q=$('#treatmentSearch').value.trim().toLowerCase(),status=$('#treatmentStatusFilter').value,category=$('#treatmentCategoryFilter').value;
  const text=[item.name,item.category,item.purpose,item.frequency,item.details,item.notes,item.caution].join(' ').toLowerCase();
  return(!q||text.includes(q))&&(!status||item.status===status)&&(!category||item.category===category);
}
renderTreatments=async function(){
  const list=$('#treatmentList'),items=data.treatments.filter(v2TreatmentMatch).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  if(!items.length){list.innerHTML='<div class="empty-state">'+(data.treatments.length?'条件に合う施術はありません。':'施術はまだ登録されていません。')+'</div>';return}
  list.innerHTML='';
  for(const item of items){
    const url=item.imageId?await getImageUrl(item.imageId):null;
    const last=v2LatestTreatmentLog(item.id);
    const card=document.createElement('article');card.className='item-card';
    card.innerHTML='<div class="item-card-main">'+
      (url?'<img class="item-image" src="'+url+'" alt="'+v2Esc(item.name)+'の写真">':'<div class="item-image-placeholder" aria-hidden="true">✦</div>')+
      '<div class="item-meta"><div class="item-topline"><span class="badge">'+v2Esc(item.status||'継続')+'</span>'+
      (item.category?'<span class="badge muted">'+v2Esc(item.category)+'</span>':'')+'</div><h3>'+v2Esc(item.name)+'</h3><p>'+v2Esc(item.purpose||'目的未設定')+'</p><p>'+
      (item.nextDate?'次回 '+v2Esc(formatDate(item.nextDate)):'次回予定日 未設定')+'</p></div></div>'+
      '<details class="item-details"><summary>詳細を見る</summary><dl>'+
      '<div><dt>頻度・周期</dt><dd>'+v2Esc(item.frequency||'未設定')+'</dd></div>'+
      '<div><dt>設定・条件</dt><dd>'+v2Esc(item.details||'未設定')+'</dd></div>'+
      '<div><dt>施術前の注意期間</dt><dd>'+Number(item.preCareDays||0)+'日</dd></div>'+
      '<div><dt>施術後の回復期間</dt><dd>'+Number(item.postCareDays||0)+'日</dd></div>'+
      '<div><dt>最終実施</dt><dd>'+(last?v2Esc(formatDate(last.createdAt,true)):'記録なし')+'</dd></div>'+
      '<div><dt>注意</dt><dd>'+v2Esc(item.caution||item.notes||'未設定')+'</dd></div></dl></details>'+
      '<div class="item-actions"><button class="log" data-treatment-log="'+item.id+'" type="button">実施記録</button><button data-treatment-edit="'+item.id+'" type="button">編集</button><button class="delete" data-treatment-delete="'+item.id+'" type="button">削除</button></div>';
    list.appendChild(card);
  }
};
renderHistory=function(){
  const list=$('#historyList'),items=data.history.filter(x=>!v2HistoryFilter||x.type===v2HistoryFilter).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  if(!items.length){list.innerHTML='<div class="empty-state">'+(v2HistoryFilter?'この種類の記録はありません。':'使用・施術・肌状態の記録はまだありません。')+'</div>';return}
  list.innerHTML=items.map(item=>
    '<article class="timeline-item"><div class="timeline-head"><div><h3>'+v2Esc(item.title)+'</h3><p>'+v2Esc(item.typeLabel||'')+' ・ '+formatDate(item.createdAt,true)+'</p></div>'+
    (item.type==='skin'?'<span class="score-badge">'+v2Esc(item.score||'3')+'/5</span>':'')+'</div>'+
    (item.condition?'<p class="history-condition">'+v2Esc(item.condition)+'</p>':'')+(item.note?'<p>'+v2Esc(item.note)+'</p>':'')+
    '<button class="timeline-delete" data-history-delete="'+item.id+'" type="button">この記録を削除</button></article>'
  ).join('');
};
renderRecent=function(){
  const recent=[...data.products.map(x=>({...x,kind:'製品'})),...data.treatments.map(x=>({...x,kind:'施術'}))].sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,4);
  const root=$('#recentItems');
  if(!recent.length){root.className='empty-state';root.textContent='まだ登録はありません。';return}
  root.className='card-list';
  root.innerHTML=recent.map(item=>'<article class="recent-row"><div><span class="badge">'+item.kind+'</span><strong>'+v2Esc(item.name)+'</strong></div><small>'+formatDate(item.updatedAt,true)+'</small></article>').join('');
};
renderAll=function(){
  $('#productCount').textContent=data.products.filter(x=>x.status==='使用中').length;
  $('#treatmentCount').textContent=data.treatments.filter(x=>x.status==='継続').length;
  $('#historyCount').textContent=data.history.length;
  renderProducts();renderTreatments();renderHistory();renderRecent();v2RenderToday();v2RenderWeekly();v2RenderDayPicker();v2RenderSafety();v2RenderSkinLatest();
};

function v2OpenLog(type,id){
  const source=type==='product'?data.products:data.treatments,item=source.find(x=>x.id===id);
  if(!item)return;
  v2LogState={type,id};
  $('#logTitle').textContent=item.name+'を'+(type==='product'?'使用':'実施')+'記録';
  $('#logDateTime').value=v2LocalDateTime();
  $('#logNote').value='';
  $('#logDialog').showModal();
}
function v2CloseLog(){if($('#logDialog').open)$('#logDialog').close()}
function v2SubmitLog(e){
  e.preventDefault();
  const source=v2LogState.type==='product'?data.products:data.treatments,item=source.find(x=>x.id===v2LogState.id);
  if(!item)return v2CloseLog();
  const local=$('#logDateTime').value;
  data.history.push({id:uid('history'),refId:item.id,type:v2LogState.type,typeLabel:v2LogState.type==='product'?'製品使用':'施術実施',title:item.name,createdAt:local?new Date(local).toISOString():new Date().toISOString(),note:$('#logNote').value.trim()});
  saveData();v2CloseLog();toast(v2LogState.type==='product'?'使用を記録しました':'実施を記録しました');
}
addHistory=function(type,id){v2OpenLog(type,id)};

function v2OpenSkin(){
  $('#skinScore').value='3';$('#skinCondition').value='';$('#skinNote').value='';
  $$('#skinScorePicker button').forEach(b=>b.classList.toggle('active',b.dataset.score==='3'));
  $('#skinDialog').showModal();
}
function v2CloseSkin(){if($('#skinDialog').open)$('#skinDialog').close()}
function v2SubmitSkin(e){
  e.preventDefault();
  const score=$('#skinScore').value||'3',condition=$('#skinCondition').value.trim(),note=$('#skinNote').value.trim();
  data.history.push({id:uid('skin'),type:'skin',typeLabel:'肌状態',title:'肌状態 '+score+'/5',score,condition,note,createdAt:new Date().toISOString()});
  saveData();v2CloseSkin();toast('肌状態を記録しました');
}
async function v2RemoveHistory(id){
  const item=data.history.find(x=>x.id===id);if(!item)return;
  const ok=await confirmAction('この記録を削除しますか？',item.title+' の履歴だけを削除します。','削除する');
  if(!ok)return;
  data.history=data.history.filter(x=>x.id!==id);saveData();toast('記録を削除しました');
}

['productSearch','productStatusFilter','productFrameFilter','productRiskFilter'].forEach(id=>$('#'+id).addEventListener(id==='productSearch'?'input':'change',renderProducts));
['treatmentSearch','treatmentStatusFilter','treatmentCategoryFilter'].forEach(id=>$('#'+id).addEventListener(id==='treatmentSearch'?'input':'change',renderTreatments));
$('#logForm').addEventListener('submit',v2SubmitLog);
$('#logCancel').addEventListener('click',v2CloseLog);
$('#newSkinLogBtn').addEventListener('click',v2OpenSkin);
$('#skinForm').addEventListener('submit',v2SubmitSkin);
$('#skinCancel').addEventListener('click',v2CloseSkin);
$$('#skinScorePicker button').forEach(btn=>btn.addEventListener('click',()=>{
  $('#skinScore').value=btn.dataset.score;
  $$('#skinScorePicker button').forEach(x=>x.classList.toggle('active',x===btn));
}));
document.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.dataset.editorDay){
    t.classList.toggle('active');
    const hidden=$('#field-days');
    if(hidden)hidden.value=$$('.editor-days .day-chip.active').map(x=>x.dataset.editorDay).join(',');
  }
  if(t.dataset.routineDay){v2RoutineDay=t.dataset.routineDay;v2RenderDayPicker();v2RenderWeekly()}
  if(t.dataset.historyFilter!==undefined){
    v2HistoryFilter=t.dataset.historyFilter;
    $$('#historyFilters .segment').forEach(x=>x.classList.toggle('active',x===t));
    renderHistory();
  }
  if(t.dataset.historyDelete)v2RemoveHistory(t.dataset.historyDelete);
});
$('#logDialog').addEventListener('click',e=>{if(e.target===$('#logDialog'))v2CloseLog()});
$('#skinDialog').addEventListener('click',e=>{if(e.target===$('#skinDialog'))v2CloseSkin()});

renderAll();

/* Full tap interaction extension v3 */
let v3HistoryEditId=null;
let v3CurrentScreen=(location.hash||'#home').slice(1);
const V3_VALID_SCREENS=['home','products','treatments','history','settings'];

function v3OpenScreen(target,push=true){
  if(!V3_VALID_SCREENS.includes(target))target='home';
  $$('.screen').forEach(el=>el.classList.toggle('active',el.dataset.screen===target));
  $$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.target===target));
  const titles={home:'ホーム',products:'製品',treatments:'施術',history:'履歴',settings:'設定'};
  $('#screenTitle').textContent=titles[target]||'美容管理';
  v3CurrentScreen=target;
  if(push&&location.hash!=='#'+target)history.pushState({screen:target},'', '#'+target);
  window.scrollTo({top:0,behavior:'smooth'});
  $('#app').focus({preventScroll:true});
}
switchScreen=function(target){v3OpenScreen(target,true)};

function v3CloseDetail(){if($('#detailDialog').open)$('#detailDialog').close()}
function v3Dl(rows){return '<dl class="detail-list">'+rows.filter(r=>r[1]!==undefined&&r[1]!==null&&String(r[1]).trim()!=='').map(r=>'<div><dt>'+v2Esc(r[0])+'</dt><dd>'+v2Esc(r[1])+'</dd></div>').join('')+'</dl>'}
async function v3OpenItemDetail(type,id){
  const source=type==='product'?data.products:data.treatments;
  const item=source.find(x=>x.id===id);if(!item)return;
  $('#detailEyebrow').textContent=type==='product'?'PRODUCT':'TREATMENT';
  $('#detailTitle').textContent=item.name;
  const image=item.imageId?await getImageUrl(item.imageId):null;
  let html=image?'<img class="detail-image" src="'+image+'" alt="'+v2Esc(item.name)+'の写真">':'';
  if(type==='product'){
    html+='<div class="detail-badges"><span class="badge">'+v2Esc(item.status||'使用中')+'</span>'+
      (item.category?'<span class="badge muted">'+v2Esc(item.category)+'</span>':'')+
      (item.risk?'<span class="badge risk-'+v2Esc(item.risk)+'">刺激 '+v2Esc(item.risk)+'</span>':'')+'</div>';
    html+=v3Dl([
      ['ブランド・メーカー',item.brand||'未設定'],['カテゴリ',item.category||'未設定'],['主成分・濃度',item.ingredients||'未設定'],
      ['目的・役割',item.purpose||'未設定'],['使用枠',item.useFrame||'通常'],['使用タイミング',item.slot||'未設定'],
      ['使用曜日',item.days||'未設定'],['使用頻度',item.frequency||'未設定'],['刺激リスク',item.risk||'低'],
      ['施術前の休止目安',Number(item.pauseBefore||0)+'日'],['施術後の休止目安',Number(item.pauseAfter||0)+'日'],
      ['併用・注意メモ',item.caution||'未設定'],['その他メモ',item.notes||'未設定']
    ]);
    if(item.category==='処方薬')html+='<p class="detail-warning">処方薬はアプリの設定より、医師・薬剤師の指示を優先してください。</p>';
  }else{
    const last=v2LatestTreatmentLog(item.id);
    html+='<div class="detail-badges"><span class="badge">'+v2Esc(item.status||'継続')+'</span>'+
      (item.category?'<span class="badge muted">'+v2Esc(item.category)+'</span>':'')+'</div>';
    html+=v3Dl([
      ['カテゴリ',item.category||'未設定'],['目的',item.purpose||'未設定'],['頻度・周期',item.frequency||'未設定'],
      ['次回予定日',item.nextDate?formatDate(item.nextDate):'未設定'],['設定・条件',item.details||'未設定'],
      ['施術前の注意期間',Number(item.preCareDays||0)+'日'],['施術後の回復期間',Number(item.postCareDays||0)+'日'],
      ['最終実施',last?formatDate(last.createdAt,true):'記録なし'],['安全・注意メモ',item.caution||'未設定'],['その他メモ',item.notes||'未設定']
    ]);
  }
  $('#detailBody').innerHTML=html;
  $('#detailActions').innerHTML=
    '<button class="primary-btn" data-detail-log="'+type+':'+id+'" type="button">'+(type==='product'?'使用を記録':'実施を記録')+'</button>'+
    '<button class="secondary-btn" data-detail-edit="'+type+':'+id+'" type="button">編集</button>'+
    '<button class="secondary-btn danger-text" data-detail-delete="'+type+':'+id+'" type="button">削除</button>';
  $('#detailDialog').showModal();
}

function v3OpenHistoryEdit(id){
  const item=data.history.find(x=>x.id===id);if(!item)return;
  v3HistoryEditId=id;
  $('#historyEditTitle').textContent=item.type==='skin'?'肌状態を編集':'記録を編集';
  const dt=v2LocalDateTime(new Date(item.createdAt||Date.now()));
  let fields='<div class="field"><label for="historyEditDate">日時</label><input id="historyEditDate" name="createdAt" type="datetime-local" value="'+v2Esc(dt)+'" required></div>';
  if(item.type==='skin'){
    fields+='<div class="field"><label for="historyEditScore">肌状態スコア</label><select id="historyEditScore" name="score">'+[1,2,3,4,5].map(n=>'<option value="'+n+'" '+(String(item.score||3)===String(n)?'selected':'')+'>'+n+' / 5</option>').join('')+'</select></div>'+
      '<div class="field"><label for="historyEditCondition">状態タグ</label><input id="historyEditCondition" name="condition" type="text" value="'+v2Esc(item.condition||'')+'" placeholder="例：乾燥、赤み、安定"></div>';
  }
  fields+='<div class="field"><label for="historyEditNote">メモ</label><textarea id="historyEditNote" name="note" placeholder="メモ">'+v2Esc(item.note||'')+'</textarea></div>';
  $('#historyEditFields').innerHTML=fields;
  $('#historyEditDialog').showModal();
}
function v3CloseHistoryEdit(){if($('#historyEditDialog').open)$('#historyEditDialog').close();v3HistoryEditId=null}
function v3SubmitHistoryEdit(e){
  e.preventDefault();const item=data.history.find(x=>x.id===v3HistoryEditId);if(!item)return v3CloseHistoryEdit();
  const fd=new FormData($('#historyEditForm'));const local=String(fd.get('createdAt')||'');
  item.createdAt=local?new Date(local).toISOString():item.createdAt;
  item.note=String(fd.get('note')||'').trim();
  if(item.type==='skin'){item.score=String(fd.get('score')||'3');item.condition=String(fd.get('condition')||'').trim();item.title='肌状態 '+item.score+'/5'}
  saveData();v3CloseHistoryEdit();toast('記録を更新しました');
}

function v3OpenInfo(title,html){
  $('#infoTitle').textContent=title;$('#infoBody').innerHTML=html;$('#infoDialog').showModal();
}
function v3CloseInfo(){if($('#infoDialog').open)$('#infoDialog').close()}
function v3ThemeLabel(){
  const theme=document.documentElement.dataset.theme||'light';
  $('#settingsThemeLabel').textContent=theme==='dark'?'ダークモード':'ライトモード';
}
async function v3ImageCount(){
  try{
    const db=await openDb();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(IMAGE_STORE,'readonly');const req=tx.objectStore(IMAGE_STORE).count();
      req.onsuccess=()=>{db.close();resolve(req.result||0)};req.onerror=()=>{db.close();reject(req.error)}
    });
  }catch{return 0}
}
async function v3ShowStorage(){
  const images=await v3ImageCount();
  v3OpenInfo('保存状況','<div class="info-stats"><p><span>製品</span><strong>'+data.products.length+'件</strong></p><p><span>施術</span><strong>'+data.treatments.length+'件</strong></p><p><span>履歴</span><strong>'+data.history.length+'件</strong></p><p><span>保存画像</span><strong>'+images+'枚</strong></p></div><p class="info-note">データはこの端末のブラウザ内に保存されています。定期的なJSONバックアップをおすすめします。</p>');
}

const v3BaseRenderProducts=renderProducts;
renderProducts=async function(){
  await v3BaseRenderProducts();
  $$('#productList .item-card').forEach(card=>{
    const btn=card.querySelector('[data-product-log]');if(!btn)return;
    card.dataset.itemType='product';card.dataset.itemId=btn.dataset.productLog;card.classList.add('tap-card');card.tabIndex=0;
  });
};
const v3BaseRenderTreatments=renderTreatments;
renderTreatments=async function(){
  await v3BaseRenderTreatments();
  $$('#treatmentList .item-card').forEach(card=>{
    const btn=card.querySelector('[data-treatment-log]');if(!btn)return;
    card.dataset.itemType='treatment';card.dataset.itemId=btn.dataset.treatmentLog;card.classList.add('tap-card');card.tabIndex=0;
  });
};
const v3BaseRoutineHtml=v2RoutineHtml;
v2RoutineHtml=function(day){
  const wrapper=document.createElement('div');wrapper.innerHTML=v3BaseRoutineHtml(day);
  wrapper.querySelectorAll('.routine-item').forEach(row=>{
    const btn=row.querySelector('[data-product-log]');if(btn){row.dataset.itemType='product';row.dataset.itemId=btn.dataset.productLog;row.classList.add('tap-row');row.tabIndex=0}
  });
  return wrapper.innerHTML;
};
renderRecent=function(){
  const recent=[...data.products.map(x=>({...x,kind:'製品',type:'product'})),...data.treatments.map(x=>({...x,kind:'施術',type:'treatment'}))]
    .sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,4);
  const root=$('#recentItems');
  if(!recent.length){root.className='empty-state';root.textContent='まだ登録はありません。';return}
  root.className='card-list';
  root.innerHTML=recent.map(item=>'<button class="recent-row tap-card" data-item-type="'+item.type+'" data-item-id="'+item.id+'" type="button"><div><span class="badge">'+item.kind+'</span><strong>'+v2Esc(item.name)+'</strong></div><small>'+formatDate(item.updatedAt,true)+' ›</small></button>').join('');
};
const v3BaseSkinLatest=v2RenderSkinLatest;
v2RenderSkinLatest=function(){
  v3BaseSkinLatest();
  const root=$('#latestSkinLog');
  if(data.history.some(h=>h.type==='skin')){root.classList.add('tap-card');root.tabIndex=0;root.dataset.goSkinHistory='1'}
};
const v3BaseSafety=v2RenderSafety;
v2RenderSafety=function(){
  v3BaseSafety();
  $$('#safetyChecks .check-row,#safetyChecks .check-ok').forEach(row=>{
    row.classList.add('tap-card');row.tabIndex=0;row.dataset.goSafety='1';
  });
};

const v3BaseRenderAll=renderAll;
renderAll=function(){
  v3BaseRenderAll();
  v3ThemeLabel();
};

document.addEventListener('click',e=>{
  const t=e.target.closest('[data-go-screen]');if(t){v3OpenScreen(t.dataset.goScreen,true);return}
  const recent=e.target.closest('[data-item-type][data-item-id]');if(recent&&!e.target.closest('button[data-product-log],button[data-treatment-log],[data-product-edit],[data-treatment-edit],[data-product-delete],[data-treatment-delete],summary')){
    v3OpenItemDetail(recent.dataset.itemType,recent.dataset.itemId);return;
  }
  const card=e.target.closest('.item-card[data-item-type][data-item-id]');
  if(card&&!e.target.closest('button,summary,details')){v3OpenItemDetail(card.dataset.itemType,card.dataset.itemId);return}
  const routine=e.target.closest('.routine-item[data-item-type][data-item-id]');
  if(routine&&!e.target.closest('button')){v3OpenItemDetail(routine.dataset.itemType,routine.dataset.itemId);return}
  const hist=e.target.closest('.timeline-item');
  if(hist&&!e.target.closest('button')){
    const del=hist.querySelector('[data-history-delete]');if(del)v3OpenHistoryEdit(del.dataset.historyDelete);return;
  }
  if(e.target.closest('[data-go-skin-history]')){v2HistoryFilter='skin';v3OpenScreen('history',true);$$('#historyFilters .segment').forEach(x=>x.classList.toggle('active',x.dataset.historyFilter==='skin'));renderHistory();return}
  if(e.target.closest('[data-go-safety]')){v3OpenScreen('products',true);return}
  const log=e.target.closest('[data-detail-log]');if(log){const [type,id]=log.dataset.detailLog.split(':');v3CloseDetail();v2OpenLog(type,id);return}
  const edit=e.target.closest('[data-detail-edit]');if(edit){const [type,id]=edit.dataset.detailEdit.split(':');v3CloseDetail();openEditor(type,id);return}
  const del=e.target.closest('[data-detail-delete]');if(del){const [type,id]=del.dataset.detailDelete.split(':');v3CloseDetail();removeItem(type,id);return}
});

document.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&document.activeElement?.matches('.item-card[data-item-type][data-item-id],.routine-item[data-item-type][data-item-id],[data-go-skin-history],[data-go-safety]')){
    e.preventDefault();document.activeElement.click();
  }
});

$('#detailClose').addEventListener('click',v3CloseDetail);
$('#detailDialog').addEventListener('click',e=>{if(e.target===$('#detailDialog'))v3CloseDetail()});
$('#historyEditForm').addEventListener('submit',v3SubmitHistoryEdit);
$('#historyEditCancel').addEventListener('click',v3CloseHistoryEdit);
$('#historyEditDialog').addEventListener('click',e=>{if(e.target===$('#historyEditDialog'))v3CloseHistoryEdit()});
$('#infoClose').addEventListener('click',v3CloseInfo);
$('#infoDialog').addEventListener('click',e=>{if(e.target===$('#infoDialog'))v3CloseInfo()});
$('#settingsThemeBtn').addEventListener('click',()=>{
  applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');v3ThemeLabel();toast(document.documentElement.dataset.theme==='dark'?'ダークモードに変更しました':'ライトモードに変更しました');
});
$('#settingsHomeBtn').addEventListener('click',()=>{
  v3OpenInfo('ホーム画面に追加','<ol class="info-steps"><li>iPhoneでこのPWAをSafariで開きます。</li><li>画面下の「共有」をタップします。</li><li>「ホーム画面に追加」をタップします。</li><li>右上の「追加」をタップします。</li></ol><p class="info-note">ホーム画面から開くと、通常のアプリに近い表示で使用できます。</p>');
});
$('#settingsStorageBtn').addEventListener('click',v3ShowStorage);

window.addEventListener('popstate',()=>v3OpenScreen((location.hash||'#home').slice(1),false));
window.addEventListener('hashchange',()=>v3OpenScreen((location.hash||'#home').slice(1),false));

const v3Start=V3_VALID_SCREENS.includes(v3CurrentScreen)?v3CurrentScreen:'home';
v3OpenScreen(v3Start,false);
renderAll();

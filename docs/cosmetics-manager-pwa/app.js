const STORAGE_KEY='cosmetics-manager-data-v1';
const THEME_KEY='cosmetics-manager-theme';
const DB_NAME='cosmetics-manager-images';
const DB_VERSION=1;
const IMAGE_STORE='images';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const emptyData=()=>({products:[],treatments:[],history:[]});
let data=loadData();
let editorState={type:null,id:null,imageBlob:null,imageId:null,removeImage:false};
let confirmResolver=null;

function loadData(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return emptyData();
    const parsed=JSON.parse(raw);
    return {
      products:Array.isArray(parsed.products)?parsed.products:[],
      treatments:Array.isArray(parsed.treatments)?parsed.treatments:[],
      history:Array.isArray(parsed.history)?parsed.history:[]
    };
  }catch{return emptyData()}
}
function saveData(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));renderAll()}
function uid(prefix='id'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function formatDate(iso,withTime=false){
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return '';
  return new Intl.DateTimeFormat('ja-JP',withTime?{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}:{year:'numeric',month:'numeric',day:'numeric'}).format(d)
}
function toast(message){
  const el=$('#toast');el.textContent=message;el.classList.add('show');
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1800)
}
function switchScreen(target){
  $$('.screen').forEach(el=>el.classList.toggle('active',el.dataset.screen===target));
  $$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.target===target));
  const titles={home:'ホーム',products:'製品',treatments:'施術',history:'履歴',settings:'設定'};
  $('#screenTitle').textContent=titles[target]||'美容管理';
  window.scrollTo({top:0,behavior:'smooth'});
  $('#app').focus({preventScroll:true})
}

function renderAll(){
  $('#productCount').textContent=data.products.filter(x=>x.status==='使用中').length;
  $('#treatmentCount').textContent=data.treatments.filter(x=>x.status==='継続').length;
  $('#historyCount').textContent=data.history.length;
  renderProducts();renderTreatments();renderHistory();renderRecent()
}
async function renderProducts(){
  const list=$('#productList');
  const q=$('#productSearch').value.trim().toLowerCase();
  const items=data.products.filter(item=>[item.name,item.brand,item.category,item.ingredients,item.purpose,item.notes].join(' ').toLowerCase().includes(q))
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  if(!items.length){list.innerHTML='<div class="empty-state">'+(q?'検索条件に合う製品はありません。':'製品はまだ登録されていません。')+'</div>';return}
  list.innerHTML='';
  for(const item of items){
    const url=item.imageId?await getImageUrl(item.imageId):null;
    const card=document.createElement('article');card.className='item-card';
    card.innerHTML='<div class="item-card-main">'+
      (url?'<img class="item-image" src="'+url+'" alt="'+escapeHtml(item.name)+'の写真">':'<div class="item-image-placeholder" aria-hidden="true">▣</div>')+
      '<div class="item-meta"><div class="item-topline"><span class="badge">'+escapeHtml(item.status)+'</span>'+
      (item.category?'<span class="badge muted">'+escapeHtml(item.category)+'</span>':'')+'</div>'+
      '<h3>'+escapeHtml(item.name)+'</h3><p>'+escapeHtml(item.brand||'ブランド未設定')+'</p>'+
      '<p>'+escapeHtml([item.slot,item.frequency].filter(Boolean).join(' ・ ')||'使用タイミング未設定')+'</p></div></div>'+
      '<div class="item-actions"><button class="log" data-product-log="'+item.id+'" type="button">使用記録</button>'+
      '<button data-product-edit="'+item.id+'" type="button">編集</button><button class="delete" data-product-delete="'+item.id+'" type="button">削除</button></div>';
    list.appendChild(card)
  }
}
async function renderTreatments(){
  const list=$('#treatmentList');
  const q=$('#treatmentSearch').value.trim().toLowerCase();
  const items=data.treatments.filter(item=>[item.name,item.category,item.purpose,item.frequency,item.details,item.notes].join(' ').toLowerCase().includes(q))
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  if(!items.length){list.innerHTML='<div class="empty-state">'+(q?'検索条件に合う施術はありません。':'施術はまだ登録されていません。')+'</div>';return}
  list.innerHTML='';
  for(const item of items){
    const url=item.imageId?await getImageUrl(item.imageId):null;
    const card=document.createElement('article');card.className='item-card';
    card.innerHTML='<div class="item-card-main">'+
      (url?'<img class="item-image" src="'+url+'" alt="'+escapeHtml(item.name)+'の写真">':'<div class="item-image-placeholder" aria-hidden="true">✦</div>')+
      '<div class="item-meta"><div class="item-topline"><span class="badge">'+escapeHtml(item.status)+'</span>'+
      (item.category?'<span class="badge muted">'+escapeHtml(item.category)+'</span>':'')+'</div>'+
      '<h3>'+escapeHtml(item.name)+'</h3><p>'+escapeHtml(item.purpose||'目的未設定')+'</p><p>'+escapeHtml(item.frequency||'頻度未設定')+'</p></div></div>'+
      '<div class="item-actions"><button class="log" data-treatment-log="'+item.id+'" type="button">実施記録</button>'+
      '<button data-treatment-edit="'+item.id+'" type="button">編集</button><button class="delete" data-treatment-delete="'+item.id+'" type="button">削除</button></div>';
    list.appendChild(card)
  }
}
function renderHistory(){
  const list=$('#historyList');
  if(!data.history.length){list.innerHTML='<div class="empty-state">使用・施術の記録はまだありません。</div>';return}
  list.innerHTML=data.history.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(item=>
    '<article class="timeline-item"><h3>'+escapeHtml(item.title)+'</h3><p>'+escapeHtml(item.typeLabel)+' ・ '+formatDate(item.createdAt,true)+'</p>'+
    (item.note?'<p>'+escapeHtml(item.note)+'</p>':'')+'</article>'
  ).join('')
}
function renderRecent(){
  const recent=[...data.products.map(x=>({...x,kind:'製品'})),...data.treatments.map(x=>({...x,kind:'施術'}))]
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,4);
  const root=$('#recentItems');
  if(!recent.length){root.className='empty-state';root.textContent='まだ登録はありません。';return}
  root.className='card-list';
  root.innerHTML=recent.map(item=>'<article class="item-card"><div class="item-topline"><span class="badge">'+item.kind+'</span><span class="badge muted">'+escapeHtml(item.status)+'</span></div><div class="item-meta"><h3>'+escapeHtml(item.name)+'</h3><p>'+formatDate(item.updatedAt,true)+' 更新</p></div></article>').join('')
}

function textField(name,label,value='',placeholder='',required=false){return '<div class="field"><label for="field-'+name+'">'+label+'</label><input id="field-'+name+'" name="'+name+'" type="text" value="'+escapeHtml(value||'')+'" placeholder="'+escapeHtml(placeholder)+'" '+(required?'required':'')+'></div>'}
function textAreaField(name,label,value='',placeholder=''){return '<div class="field"><label for="field-'+name+'">'+label+'</label><textarea id="field-'+name+'" name="'+name+'" placeholder="'+escapeHtml(placeholder)+'">'+escapeHtml(value||'')+'</textarea></div>'}
function selectField(name,label,value,options){return '<div class="field"><label for="field-'+name+'">'+label+'</label><select id="field-'+name+'" name="'+name+'">'+options.map(opt=>'<option value="'+escapeHtml(opt)+'" '+(opt===value?'selected':'')+'>'+escapeHtml(opt||'選択してください')+'</option>').join('')+'</select></div>'}
function photoField(){return '<div class="field"><span>写真</span><input id="imageInput" name="image" type="file" accept="image/*"><img id="photoPreview" class="photo-preview" alt="登録写真のプレビュー"><div class="photo-tools"><button id="removePhotoBtn" type="button">写真を削除</button></div></div>'}
function productFields(item={}){
  return photoField()+textField('name','製品名',item.name,'例：化粧水、クリームなど',true)+textField('brand','ブランド・メーカー',item.brand,'任意')+
    selectField('category','カテゴリ',item.category,['','クレンジング','洗顔','化粧水','美容液','乳液','クリーム','日焼け止め','パック','処方薬','その他'])+
    textField('ingredients','主成分・濃度',item.ingredients,'例：ナイアシンアミド 5%')+textField('purpose','目的・役割',item.purpose,'例：保湿、毛穴、ニキビ対策')+
    selectField('slot','使用タイミング',item.slot,['','朝','夜','朝・夜','寝る前','必要時','その他'])+textField('frequency','使用頻度',item.frequency,'例：毎日、週3回')+
    selectField('status','状態',item.status||'使用中',['使用中','休止','終了'])+textAreaField('notes','メモ',item.notes,'使い方・注意点など')
}
function treatmentFields(item={}){
  return photoField()+textField('name','施術名',item.name,'例：ピーリング、ダーマペンなど',true)+
    selectField('category','カテゴリ',item.category,['','セルフケア','美容医療','皮膚科','機器','その他'])+
    textField('purpose','目的',item.purpose,'例：毛穴、肌質、ニキビ跡')+textField('frequency','頻度・周期',item.frequency,'例：4週間ごと')+
    textField('details','設定・条件',item.details,'例：深さ、出力など')+selectField('status','状態',item.status||'継続',['継続','休止','終了'])+
    textAreaField('notes','メモ・注意点',item.notes,'施術前後の注意など')
}

async function openEditor(type,id=null){
  const source=type==='product'?data.products:data.treatments;
  const item=id?source.find(x=>x.id===id):null;
  editorState={type,id,imageBlob:null,imageId:item?.imageId||null,removeImage:false};
  $('#editorEyebrow').textContent=id?'編集':'新規登録';
  $('#editorTitle').textContent=(type==='product'?'製品':'施術')+'を'+(id?'編集':'登録');
  $('#editorFields').innerHTML=type==='product'?productFields(item||{}):treatmentFields(item||{});
  $('#editorDialog').showModal();
  $('#imageInput').addEventListener('change',handleImagePick);
  $('#removePhotoBtn').addEventListener('click',()=>{
    editorState.imageBlob=null;editorState.removeImage=true;editorState.imageId=null;
    const p=$('#photoPreview');p.removeAttribute('src');p.classList.remove('visible')
  });
  if(item?.imageId){
    const url=await getImageUrl(item.imageId);
    if(url){const p=$('#photoPreview');p.src=url;p.classList.add('visible')}
  }
}
function closeEditor(){if($('#editorDialog').open)$('#editorDialog').close()}
async function handleImagePick(event){
  const file=event.target.files?.[0];if(!file)return;
  try{
    const blob=await compressImage(file,960,.78);
    editorState.imageBlob=blob;editorState.removeImage=false;
    const p=$('#photoPreview');p.src=URL.createObjectURL(blob);p.classList.add('visible')
  }catch{toast('写真を読み込めませんでした')}
}
async function handleSaveEditor(event){
  event.preventDefault();
  const form=new FormData($('#editorForm'));
  const now=new Date().toISOString();
  const source=editorState.type==='product'?data.products:data.treatments;
  const existing=editorState.id?source.find(x=>x.id===editorState.id):null;
  const record={...(existing||{}),id:existing?.id||uid(editorState.type),createdAt:existing?.createdAt||now,updatedAt:now};
  for(const [key,value] of form.entries())if(key!=='image')record[key]=String(value).trim();
  if(!record.name)return;
  if(editorState.removeImage&&existing?.imageId)await deleteImage(existing.imageId);
  if(editorState.imageBlob){
    if(existing?.imageId)await deleteImage(existing.imageId);
    record.imageId=uid('img');await putImage(record.imageId,editorState.imageBlob)
  }else if(editorState.removeImage)record.imageId=null;
  if(existing)Object.assign(existing,record);else source.push(record);
  saveData();closeEditor();toast(existing?'更新しました':'登録しました')
}
async function addHistory(type,id){
  const source=type==='product'?data.products:data.treatments;
  const item=source.find(x=>x.id===id);if(!item)return;
  data.history.push({id:uid('history'),refId:id,type,typeLabel:type==='product'?'製品使用':'施術実施',title:item.name,createdAt:new Date().toISOString(),note:''});
  saveData();toast(type==='product'?'使用を記録しました':'実施を記録しました')
}
async function removeItem(type,id){
  const source=type==='product'?data.products:data.treatments;
  const item=source.find(x=>x.id===id);if(!item)return;
  const ok=await confirmAction(item.name+'を削除しますか？','この操作は取り消せません。履歴は残ります。','削除する');if(!ok)return;
  if(item.imageId)await deleteImage(item.imageId);
  if(type==='product')data.products=data.products.filter(x=>x.id!==id);else data.treatments=data.treatments.filter(x=>x.id!==id);
  saveData();toast('削除しました')
}
function confirmAction(title,message,okLabel='実行する'){
  $('#confirmTitle').textContent=title;$('#confirmMessage').textContent=message;$('#confirmOk').textContent=okLabel;$('#confirmDialog').showModal();
  return new Promise(resolve=>{confirmResolver=resolve})
}
function resolveConfirm(value){if($('#confirmDialog').open)$('#confirmDialog').close();if(confirmResolver)confirmResolver(value);confirmResolver=null}
async function resetAll(){
  const ok=await confirmAction('全データを削除しますか？','登録した製品・施術・履歴・写真をこの端末からすべて削除します。','全削除する');if(!ok)return;
  data=emptyData();localStorage.removeItem(STORAGE_KEY);await clearImages();renderAll();toast('初期状態に戻しました')
}
async function clearHistory(){
  if(!data.history.length)return toast('削除する履歴がありません');
  const ok=await confirmAction('履歴を削除しますか？','製品・施術の登録内容は残り、履歴だけ削除されます。','履歴を削除');if(!ok)return;
  data.history=[];saveData();toast('履歴を削除しました')
}
async function exportBackup(){
  const images={};
  for(const item of [...data.products,...data.treatments]){
    if(!item.imageId||images[item.imageId])continue;
    const blob=await getImage(item.imageId);if(blob)images[item.imageId]=await blobToDataUrl(blob)
  }
  const payload={version:1,exportedAt:new Date().toISOString(),data,images};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='美容管理バックアップ_'+new Date().toISOString().slice(0,10)+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),500);toast('バックアップを書き出しました')
}
async function importBackup(file){
  try{
    const payload=JSON.parse(await file.text());
    if(!payload?.data||!Array.isArray(payload.data.products)||!Array.isArray(payload.data.treatments)||!Array.isArray(payload.data.history))throw new Error();
    const ok=await confirmAction('バックアップを復元しますか？','現在の登録内容はバックアップの内容に置き換わります。','復元する');if(!ok)return;
    await clearImages();for(const [id,dataUrl] of Object.entries(payload.images||{}))await putImage(id,dataUrlToBlob(dataUrl));
    data=payload.data;saveData();toast('バックアップを復元しました')
  }catch{toast('このバックアップは読み込めません')}finally{$('#importInput').value=''}
}

function applyTheme(theme){
  document.documentElement.dataset.theme=theme;localStorage.setItem(THEME_KEY,theme);
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='dark'?'#171420':'#fff8f5';
  const toggle=$('#themeToggle');if(toggle)toggle.textContent=theme==='dark'?'☾':'☼'
}
function initTheme(){const saved=localStorage.getItem(THEME_KEY);applyTheme(saved||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'))}

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(IMAGE_STORE))req.result.createObjectStore(IMAGE_STORE)};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)
  })
}
async function withStore(mode,action){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(IMAGE_STORE,mode);const store=tx.objectStore(IMAGE_STORE);action(store);
    tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}
  })
}
async function putImage(id,blob){return withStore('readwrite',s=>s.put(blob,id))}
async function deleteImage(id){return withStore('readwrite',s=>s.delete(id))}
async function clearImages(){return withStore('readwrite',s=>s.clear())}
async function getImage(id){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(IMAGE_STORE,'readonly');const req=tx.objectStore(IMAGE_STORE).get(id);
    req.onsuccess=()=>{db.close();resolve(req.result||null)};req.onerror=()=>{db.close();reject(req.error)}
  })
}
async function getImageUrl(id){const blob=await getImage(id);return blob?URL.createObjectURL(blob):null}
function compressImage(file,maxSide=960,quality=.78){
  return new Promise((resolve,reject)=>{
    const img=new Image();const url=URL.createObjectURL(file);
    img.onload=()=>{
      const scale=Math.min(1,maxSide/Math.max(img.width,img.height));const canvas=document.createElement('canvas');
      canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob=>{URL.revokeObjectURL(url);blob?resolve(blob):reject(new Error())},'image/jpeg',quality)
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error())};img.src=url
  })
}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)})}
function dataUrlToBlob(dataUrl){
  const [meta,body]=dataUrl.split(',');const mime=meta.match(/data:(.*?);base64/)?.[1]||'application/octet-stream';const bin=atob(body);const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:mime})
}

function bindEvents(){
  $$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchScreen(btn.dataset.target)));
  $$('[data-action="new-product"]').forEach(btn=>btn.addEventListener('click',()=>openEditor('product')));
  $$('[data-action="new-treatment"]').forEach(btn=>btn.addEventListener('click',()=>openEditor('treatment')));
  $('#productSearch').addEventListener('input',renderProducts);$('#treatmentSearch').addEventListener('input',renderTreatments);
  $('#editorForm').addEventListener('submit',handleSaveEditor);$('#closeEditor').addEventListener('click',closeEditor);$('#cancelEditor').addEventListener('click',closeEditor);
  $('#confirmCancel').addEventListener('click',()=>resolveConfirm(false));$('#confirmOk').addEventListener('click',()=>resolveConfirm(true));
  $('#resetBtn').addEventListener('click',resetAll);$('#clearHistoryBtn').addEventListener('click',clearHistory);$('#exportBtn').addEventListener('click',exportBackup);
  $('#importInput').addEventListener('change',e=>e.target.files?.[0]&&importBackup(e.target.files[0]));
  $('#themeToggle').addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  document.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return;
    if(t.dataset.productEdit)openEditor('product',t.dataset.productEdit);
    if(t.dataset.treatmentEdit)openEditor('treatment',t.dataset.treatmentEdit);
    if(t.dataset.productDelete)removeItem('product',t.dataset.productDelete);
    if(t.dataset.treatmentDelete)removeItem('treatment',t.dataset.treatmentDelete);
    if(t.dataset.productLog)addHistory('product',t.dataset.productLog);
    if(t.dataset.treatmentLog)addHistory('treatment',t.dataset.treatmentLog)
  });
  $('#editorDialog').addEventListener('click',e=>{if(e.target===$('#editorDialog'))closeEditor()});
  $('#confirmDialog').addEventListener('cancel',e=>{e.preventDefault();resolveConfirm(false)})
}
initTheme();bindEvents();renderAll();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

/* 製品の特定（バーコード → AI写真解析 → 公式画像との照合）
 * - APIキーと設定はこの端末の localStorage にだけ保存します
 * - 解析する写真は、利用者自身のAPIキーで Anthropic API に直接送信されます
 * - 公式画像はURLだけを端末内の製品データに保存し、この端末の画面でのみ表示します */
(()=>{
'use strict';
const SK='beauty-ai-settings';
const API='https://api.anthropic.com/v1/messages';
const OBF='https://world.openbeautyfacts.org/api/v2/product/';
const MODELS=[['claude-opus-5-5','Opus 5.5（高精度・既定）'],['claude-sonnet-5-5','Sonnet 5.5（低コスト）']];
const CATS=['クレンジング','洗顔','化粧水','美容液','乳液','クリーム','日焼け止め','パック','処方薬','その他'];

const loadSettings=()=>{let s={};try{s=JSON.parse(localStorage.getItem(SK)||'{}')}catch{}return {key:'',model:MODELS[0][0],...s}};
const saveSettings=s=>{try{localStorage.setItem(SK,JSON.stringify(s))}catch{}};
const esc=s=>escapeHtml(String(s??''));
const httpsUrl=u=>/^https:\/\/[^\s"'<>]+$/.test(u||'')?u:'';
const blobToB64=async blob=>(await blobToDataUrl(blob)).split(',')[1];
const imgPart=async blob=>({type:'image',source:{type:'base64',media_type:blob.type||'image/jpeg',data:await blobToB64(blob)}});

/* ---------- Claude API（ブラウザから直接） ---------- */
async function callClaude(content,{search=false}={}){
  const s=loadSettings();
  if(!s.key)throw new Error('NO_KEY');
  const messages=[{role:'user',content}];
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),150000);
  try{
    for(let turn=0;turn<4;turn++){
      const body={model:s.model,max_tokens:4000,output_config:{effort:'medium'},messages};
      if(search)body.tools=[{type:'web_search_20260209',name:'web_search',max_uses:5}];
      const res=await fetch(API,{method:'POST',signal:ctl.signal,headers:{
        'content-type':'application/json','x-api-key':s.key,'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body)});
      const json=await res.json().catch(()=>({}));
      if(!res.ok){const e=new Error(json?.error?.message||'HTTP '+res.status);e.status=res.status;throw e}
      if(json.stop_reason==='pause_turn'){messages.push({role:'assistant',content:json.content});continue}
      if(json.stop_reason==='refusal')throw new Error('モデルが応答を拒否しました');
      return json.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
    }
    throw new Error('検索が完了しませんでした。もう一度お試しください');
  }finally{clearTimeout(timer)}
}
function lastJson(text){
  const found=String(text).match(/\{[^{}]*\}/g)||[];
  for(let i=found.length-1;i>=0;i--){try{return JSON.parse(found[i])}catch{}}
  throw new Error('解析結果を読み取れませんでした');
}
function explainError(e){
  if(e.message==='NO_KEY')return 'APIキーが未設定です';
  if(e.name==='AbortError')return '時間がかかりすぎました。もう一度お試しください';
  if(e.status===401||e.status===403)return 'APIキーが正しくないか、権限がありません';
  if(e.status===429)return '利用制限に達しました。しばらくしてからお試しください';
  if(e instanceof TypeError)return '通信に失敗しました。ネットワークを確認してください';
  return e.message||'失敗しました';
}

/* ---------- バーコード ---------- */
async function detectBarcode(blob){
  if(!('BarcodeDetector' in window))return null;
  try{
    const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});
    const bmp=await createImageBitmap(blob);
    return (await det.detect(bmp))[0]?.rawValue||null;
  }catch{return null}
}
async function lookupBarcode(code){
  try{
    const res=await fetch(OBF+encodeURIComponent(code)+'.json?fields=product_name,brands',{headers:{Accept:'application/json'}});
    const j=await res.json();
    if(j.status===1&&j.product)return [j.product.brands,j.product.product_name].filter(Boolean).join(' ').trim()||null;
  }catch{}
  return null;
}

/* ---------- 特定 → 公式画像との照合 ---------- */
async function identify({blob,jan,hint}){
  const parts=[];
  if(blob)parts.push(await imgPart(blob));
  parts.push({type:'text',text:
'化粧品・スキンケア製品の照合担当として、次の情報から製品を特定してください。\n'+
(blob?'・添付画像は利用者が撮った製品の写真です。\n':'')+
(jan?'・バーコード(JAN/EAN): '+jan+'\n':'')+
(hint?'・バーコードDBの候補: '+hint+'（不正確な場合があります）\n':'')+
'\nWeb検索で、メーカーまたは公式ブランドサイトの商品ページを探してください。\n'+
'- 推測で埋めず、確認できない項目は空文字にする。\n'+
'- 通販モール・転売・レビュー・ブログは officialPageUrl / officialImageUrl に使わない。\n'+
'- officialImageUrl は公式ページ上の商品画像ファイルの直接URL(https)。\n'+
'- category は次のどれか、または空文字: '+CATS.join('、')+'\n'+
'- ingredients は公式に記載された主成分・有効成分の範囲で短く。\n'+
'最後に、次のキーだけのJSONオブジェクトを1つ出力してください（前後の説明は不要）:\n'+
'{"name":"","brand":"","category":"","ingredients":"","purpose":"","officialPageUrl":"","officialImageUrl":"","confidence":0.0,"reason":""}\n'+
'confidence は特定の確からしさ(0〜1)、reason は根拠を1文で。'});
  const r=lastJson(await callClaude(parts,{search:true}));
  const out={
    name:String(r.name||''),brand:String(r.brand||''),category:CATS.includes(r.category)?r.category:'',
    ingredients:String(r.ingredients||''),purpose:String(r.purpose||''),
    officialPage:httpsUrl(r.officialPageUrl),officialImage:httpsUrl(r.officialImageUrl),
    confidence:Math.max(0,Math.min(1,Number(r.confidence)||0)),reason:String(r.reason||''),
    verify:{state:'nophoto'}
  };
  if(blob&&out.officialImage){
    try{
      const v=lastJson(await callClaude([
        await imgPart(blob),{type:'image',source:{type:'url',url:out.officialImage}},
        {type:'text',text:'1枚目は利用者が撮った製品写真、2枚目はメーカー公式サイトの商品画像です。同じ製品（同一の商品名・シリーズ）か判定してください。容量違いは同一扱い、別シリーズ・別商品は不一致です。次のJSONだけを出力: {"match":true,"confidence":0.0,"reason":""}'}
      ]));
      out.verify={state:v.match?'match':'mismatch',confidence:Number(v.confidence)||0,reason:String(v.reason||'')};
    }catch(e){
      if(e.message==='NO_KEY'||e.status===401)throw e;
      out.verify={state:'failed'};
    }
  }else if(blob){out.verify={state:'failed'}}
  return out;
}

/* ---------- 設定ダイアログ ---------- */
function ensureSettingsDialog(){
  let d=document.getElementById('aiDialog');if(d)return d;
  d=document.createElement('dialog');d.id='aiDialog';d.className='confirm-dialog';
  d.innerHTML='<form class="confirm-card" method="dialog"><h2>AI製品特定の設定</h2>'+
    '<div class="field"><label for="aiKey">Anthropic APIキー</label><input id="aiKey" type="password" autocomplete="off" placeholder="sk-ant-..."></div>'+
    '<div class="field"><label for="aiModel">モデル</label><select id="aiModel">'+MODELS.map(m=>'<option value="'+m[0]+'">'+m[1]+'</option>').join('')+'</select></div>'+
    '<p class="id-note">キーはこの端末のブラウザ内にだけ保存されます。解析する写真は、あなたのキーでAnthropic APIへ直接送信され、利用料がかかります。共有端末では保存しないでください。</p>'+
    '<div class="confirm-actions"><button class="secondary-btn" id="aiClear" type="button">キーを削除</button><button class="primary-btn" id="aiSave" type="button">保存</button></div>'+
    '<button class="secondary-btn" id="aiClose" type="button" style="margin-top:8px;width:100%">閉じる</button></form>';
  document.body.appendChild(d);
  d.querySelector('#aiSave').addEventListener('click',()=>{
    saveSettings({key:d.querySelector('#aiKey').value.trim(),model:d.querySelector('#aiModel').value});
    refreshSettingsLabel();d.close();toast('AI設定を保存しました');
  });
  d.querySelector('#aiClear').addEventListener('click',()=>{
    saveSettings({...loadSettings(),key:''});d.querySelector('#aiKey').value='';refreshSettingsLabel();toast('APIキーを削除しました');
  });
  d.querySelector('#aiClose').addEventListener('click',()=>d.close());
  return d;
}
function openSettings(){
  const d=ensureSettingsDialog(),s=loadSettings();
  d.querySelector('#aiKey').value=s.key;d.querySelector('#aiModel').value=s.model;
  if(!d.open)d.showModal();
}
function refreshSettingsLabel(){
  const el=document.getElementById('aiSettingsLabel');
  if(el)el.textContent=loadSettings().key?'APIキー設定済み':'APIキー未設定（写真・バーコードから製品を特定）';
}
function mountSettingsRow(){
  const anchor=document.getElementById('settingsStorageBtn');
  if(!anchor||document.getElementById('settingsAiBtn'))return;
  const b=document.createElement('button');b.id='settingsAiBtn';b.className='setting-row';b.type='button';
  b.innerHTML='<span><strong>AI製品特定の設定</strong><small id="aiSettingsLabel"></small></span><span>›</span>';
  b.addEventListener('click',openSettings);anchor.after(b);refreshSettingsLabel();
}

/* ---------- バーコード読み取りダイアログ ---------- */
function scanBarcode(){
  return new Promise(resolve=>{
    const d=document.createElement('dialog');d.className='confirm-dialog';
    const supported='BarcodeDetector' in window&&navigator.mediaDevices?.getUserMedia;
    d.innerHTML='<form class="confirm-card" method="dialog"><h2>バーコードを読む</h2>'+
      (supported?'<video class="scan-video" playsinline muted></video><p class="id-note">パッケージのバーコードを枠いっぱいに映してください。</p>'
        :'<p class="id-note">この端末・ブラウザはカメラでのバーコード読み取りに未対応です。バーコード下の数字を入力してください。</p>')+
      '<div class="field"><label for="janInput">バーコードの数字（8〜13桁）</label><input id="janInput" inputmode="numeric" pattern="[0-9]{8,13}" placeholder="4901234567894"></div>'+
      '<div class="confirm-actions"><button class="secondary-btn" type="button" data-x>キャンセル</button><button class="primary-btn" type="button" data-ok>この番号で特定</button></div></form>';
    document.body.appendChild(d);
    let stream=null,stop=false,done=false;
    const finish=v=>{if(done)return;done=true;stop=true;stream?.getTracks().forEach(t=>t.stop());if(d.open)d.close();d.remove();resolve(v)};
    d.addEventListener('cancel',e=>{e.preventDefault();finish(null)});
    d.querySelector('[data-x]').addEventListener('click',()=>finish(null));
    d.querySelector('[data-ok]').addEventListener('click',()=>{
      const v=d.querySelector('#janInput').value.replace(/\D/g,'');
      if(v.length<8||v.length>13)return toast('8〜13桁の数字を入力してください');
      finish(v);
    });
    d.showModal();
    if(!supported)return;
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false}).then(async s=>{
      if(stop){s.getTracks().forEach(t=>t.stop());return}
      stream=s;const video=d.querySelector('video');video.srcObject=s;await video.play().catch(()=>{});
      const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});
      const tick=async()=>{
        if(stop)return;
        try{const r=await det.detect(video);if(r[0]?.rawValue)return finish(r[0].rawValue)}catch{}
        setTimeout(tick,250);
      };
      tick();
    }).catch(()=>{d.querySelector('video')?.remove();toast('カメラを使えませんでした。番号を入力してください')});
  });
}

/* ---------- 製品編集画面への組み込み ---------- */
function setField(name,value){
  const el=document.querySelector('#editorForm [name="'+name+'"]');
  if(el&&value)el.value=value;
}
function verifyLine(v){
  switch(v.state){
    case 'match':return '<p class="id-verify ok">✓ 撮った写真と公式画像が一致しました</p>';
    case 'mismatch':return '<p class="id-verify ng">⚠ 撮った写真と公式画像が一致しません（別製品・別デザインの可能性）'+(v.reason?'<br><small>'+esc(v.reason)+'</small>':'')+'</p>';
    case 'failed':return '<p class="id-verify">画像の照合はできませんでした（公式画像を取得できない等）</p>';
    default:return '<p class="id-verify">写真がないため画像の照合はしていません</p>';
  }
}
function renderResult(box,r,onAdopt){
  const pageOk=!!r.officialPage;
  box.innerHTML='<div class="id-card">'+
    (r.officialImage?'<img class="id-official" src="'+esc(r.officialImage)+'" alt="公式サイトの商品画像" referrerpolicy="no-referrer" loading="lazy">':'')+
    '<div class="id-info"><strong>'+esc(r.name||'（製品名を特定できませんでした）')+'</strong>'+
    '<span>'+esc([r.brand,r.category].filter(Boolean).join(' / '))+'</span>'+
    '<span>確からしさ '+Math.round(r.confidence*100)+'%'+(r.reason?'｜'+esc(r.reason):'')+'</span>'+
    (pageOk?'<a class="official-link" href="'+esc(r.officialPage)+'" target="_blank" rel="noopener noreferrer">公式ページを確認 ↗</a>':'<span class="id-warn">公式ページは見つかりませんでした</span>')+'</div></div>'+
    verifyLine(r.verify)+
    '<div class="photo-tools"><button type="button" data-adopt>'+(r.verify.state==='mismatch'?'違う可能性があるが採用':'この製品を採用')+'</button></div>';
  if(!r.name)box.querySelector('[data-adopt]').disabled=true;
  box.querySelector('[data-adopt]').addEventListener('click',()=>onAdopt(r));
}
async function currentBlob(){
  if(editorState.imageBlob)return editorState.imageBlob;
  if(editorState.imageId&&!editorState.removeImage){try{return await getImage(editorState.imageId)}catch{}}
  return null;
}
function mountIdentify(id){
  const fields=document.getElementById('editorFields');if(!fields||fields.querySelector('.id-block'))return;
  const item=id?data.products.find(x=>x.id===id):null;
  const wrap=document.createElement('div');wrap.className='field id-block';
  wrap.innerHTML='<span>製品を特定（公式情報を確認）</span>'+
    '<div class="photo-tools"><button type="button" data-id-scan>バーコードを読む</button><button type="button" data-id-photo>写真から特定</button></div>'+
    '<p class="id-note">バーコード→写真の順で手がかりを使い、メーカー公式サイトの情報と画像を照合します。結果は確認してから採用できます。<a href="#" data-id-settings>AI設定</a></p>'+
    '<div id="idStatus" class="id-status" role="status" aria-live="polite"></div><div id="idResult"></div>'+
    '<input type="hidden" name="officialImage" value="'+esc(item?.officialImage||'')+'">'+
    '<input type="hidden" name="officialSource" value="'+esc(item?.officialSource||'')+'">'+
    (item?.officialImage?'<div class="photo-tools"><button type="button" data-id-unlink>公式写真のリンクを外す</button></div>':'');
  fields.prepend(wrap);
  const status=wrap.querySelector('#idStatus'),box=wrap.querySelector('#idResult');
  const buttons=[...wrap.querySelectorAll('[data-id-scan],[data-id-photo]')];
  const busy=(on,msg='')=>{buttons.forEach(b=>b.disabled=on);status.textContent=msg;if(on)box.innerHTML=''};
  const adopt=r=>{
    setField('name',r.name);setField('brand',r.brand);setField('category',r.category);
    setField('ingredients',r.ingredients);setField('purpose',r.purpose);
    wrap.querySelector('[name="officialImage"]').value=r.officialImage;
    wrap.querySelector('[name="officialSource"]').value=r.officialPage;
    box.innerHTML='<p class="id-verify ok">✓ 入力欄に反映しました。内容を確認して「保存」してください</p>';
    toast('公式情報を反映しました');
  };
  const run=async(input)=>{
    if(!loadSettings().key){toast('先にAPIキーを設定してください');openSettings();return}
    try{
      busy(true,'公式サイトを検索して照合中…（最大1〜2分かかります）');
      const r=await identify(input);
      busy(false);renderResult(box,r,adopt);
    }catch(e){busy(false,explainError(e));if(e.message==='NO_KEY'||e.status===401)openSettings()}
  };
  wrap.querySelector('[data-id-settings]').addEventListener('click',e=>{e.preventDefault();openSettings()});
  wrap.querySelector('[data-id-unlink]')?.addEventListener('click',e=>{
    wrap.querySelector('[name="officialImage"]').value='';wrap.querySelector('[name="officialSource"]').value='';
    e.target.closest('.photo-tools').remove();toast('保存すると公式写真のリンクが外れます');
  });
  wrap.querySelector('[data-id-photo]').addEventListener('click',async()=>{
    const blob=await currentBlob();
    if(!blob)return toast('先に「写真」欄で製品の写真を選んでください');
    busy(true,'バーコードを確認中…');
    const jan=await detectBarcode(blob);
    const hint=jan?await lookupBarcode(jan):null;
    busy(false);run({blob,jan,hint});
  });
  wrap.querySelector('[data-id-scan]').addEventListener('click',async()=>{
    const jan=await scanBarcode();if(!jan)return;
    busy(true,'バーコード '+jan+' を検索中…');
    const hint=await lookupBarcode(jan);
    const blob=await currentBlob();
    busy(false);run({blob,jan,hint});
  });
}

/* openEditor を包んで、製品の編集時だけ特定ブロックを差し込む */
const baseOpenEditor=openEditor;
openEditor=async function(type,id=null){
  await baseOpenEditor(type,id);
  if(type==='product')mountIdentify(id);
};
mountSettingsRow();
})();

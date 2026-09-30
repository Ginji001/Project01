/* 製品の特定（無料・端末内中心）
 * バーコード読み取り → 無料の製品DB(Open Beauty Facts)検索 → 写真の文字認識(OCR) →
 * ブランドから公式サイトの検索リンクを作り、利用者が公式ページと見比べて確認します。
 * APIキーや課金は一切ありません。写真はこの端末の外へ送信しません
 * （初回のみ、文字認識エンジンと辞書データをCDNから読み込みます）。 */
(()=>{
'use strict';
const OBF='https://world.openbeautyfacts.org/';
const TESS='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

/* ブランド → 公式サイトのドメイン（検索リンク用。必要に応じて追記できます） */
const BRANDS=[
  ['KOSÉ / ONE BY KOSÉ',['onebykose','kose','コーセー','雪肌精'],'kose.co.jp'],
  ['トゥヴェール',['tvert','トゥヴェール'],'tvert.jp'],
  ['SKIN1004',['skin1004'],'skin1004.com'],
  ['ロート製薬',['rohto','ロート','メラノcc','melano'],'rohto.co.jp'],
  ['COSRX',['cosrx'],'cosrx.co.kr'],
  ['Dear Klairs',['klairs','クレアス'],'klairscosmetics.com'],
  ['SOFINA',['sofina','ソフィーナ'],'sofina.co.jp'],
  ['CELORABY',['celoraby'],'celoraby.com'],
  ['MEDIHEAL',['mediheal','メディヒール'],'mediheal.jp'],
  ['DW-EGF',['easydew','dw-egf'],'easydew.us'],
  ['マルホ',['maruho','マルホ'],'maruho.co.jp'],
  ['資生堂 / アクアレーベル',['shiseido','資生堂','アクアレーベル','aqualabel'],'shiseido.co.jp'],
  ['Anua',['anua','アヌア'],'anua.com'],
  ['花王',['kao','花王'],'kao.com'],
  ['キュレル',['curel','キュレル'],'curel.net'],
  ['ビオレ',['biore','ビオレ'],'biore.jp'],
  ['肌ラボ',['hadalabo','肌ラボ'],'hadalabo.jp'],
  ['ファンケル',['fancl','ファンケル'],'fancl.co.jp'],
  ['ポーラ',['pola','ポーラ'],'pola.co.jp'],
  ['DHC',['dhc'],'dhc.co.jp'],
  ['オルビス',['orbis','オルビス'],'orbis.co.jp'],
  ['ニベア',['nivea','ニベア'],'nivea.co.jp'],
  ['ラ ロッシュ ポゼ',['laroche','ラロッシュ'],'laroche-posay.jp']
];

const esc=s=>escapeHtml(String(s??''));
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const httpsUrl=u=>/^https:\/\/[^\s"'<>]+$/.test(u||'')?u:'';
const searchUrl=q=>'https://www.google.com/search?q='+encodeURIComponent(q);

/* ---------- バーコード ---------- */
async function detectBarcode(blob){
  if(!('BarcodeDetector' in window))return null;
  try{
    const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});
    const bmp=await createImageBitmap(blob);
    return (await det.detect(bmp))[0]?.rawValue||null;
  }catch{return null}
}
async function obfFetch(path){
  try{
    const res=await fetch(OBF+path,{headers:{Accept:'application/json'}});
    return res.ok?await res.json():null;
  }catch{return null}
}
const obfItem=p=>({name:p.product_name||'',brand:(p.brands||'').split(',')[0].trim(),ingredients:(p.ingredients_text||'').slice(0,120),code:p.code||''});
async function lookupBarcode(code){
  const j=await obfFetch('api/v2/product/'+encodeURIComponent(code)+'.json?fields=product_name,brands,ingredients_text,code');
  return j?.status===1&&j.product&&j.product.product_name?obfItem(j.product):null;
}
async function searchDb(text){
  if(!text)return [];
  const j=await obfFetch('cgi/search.pl?search_simple=1&action=process&json=1&page_size=5&fields=product_name,brands,ingredients_text,code&search_terms='+encodeURIComponent(text));
  return (j?.products||[]).filter(p=>p.product_name).map(obfItem);
}

/* ---------- 文字認識（端末内OCR） ---------- */
let tessPromise=null;
function loadTesseract(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  return tessPromise||(tessPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=TESS;
    s.onload=()=>resolve(window.Tesseract);
    s.onerror=()=>{tessPromise=null;reject(new Error('文字認識エンジンを読み込めませんでした（通信を確認してください）'))};
    document.head.appendChild(s);
  }));
}
async function recognize(blob,onProgress){
  const T=await loadTesseract();
  const r=await T.recognize(blob,'jpn+eng',{logger:m=>{if(m.status==='recognizing text')onProgress?.(m.progress)}});
  return String(r.data?.text||'');
}
function textLines(text){
  const cjoin=/(?<=[぀-ヿ㐀-鿿])\s+(?=[぀-ヿ㐀-鿿])/g;
  const seen=new Set();
  return text.split(/\n+/).map(l=>l.normalize('NFKC').replace(cjoin,'').replace(/[|｜_~^*]/g,' ').replace(/\s+/g,' ').trim())
    .filter(l=>{
      const letters=(l.match(/[A-Za-z぀-ヿ㐀-鿿]/g)||[]).length;
      if(l.length<4||l.length>40||letters<4||letters/l.length<.6||seen.has(l))return false;
      seen.add(l);return true;
    });
}
function pickCandidates(lines){
  return lines.map(l=>{
      const cjk=/[぀-ヿ㐀-鿿]/.test(l),caps=/[A-Z]{3,}/.test(l);
      return {l,score:l.length+(cjk?6:0)+(caps?3:0)};
    }).sort((a,b)=>b.score-a.score).slice(0,4).map(x=>x.l);
}
function findBrand(...texts){
  const hay=norm(texts.filter(Boolean).join(' '));
  if(!hay)return null;
  return BRANDS.find(b=>b[1].some(k=>hay.includes(norm(k))))||null;
}

/* ---------- 特定の実行 ---------- */
async function analyze({blob,jan},onStatus){
  const out={jan:jan||null,candidates:[],db:[],brand:null,ocrFailed:false};
  if(blob&&!out.jan){onStatus('バーコードを確認中…');out.jan=await detectBarcode(blob)}
  let byJan=null;
  if(out.jan){onStatus('バーコード '+out.jan+' を製品データベースで検索中…');byJan=await lookupBarcode(out.jan)}
  if(byJan)out.db.push(byJan);
  let lines=[],raw='';
  if(blob&&!byJan){
    try{
      onStatus('写真の文字を読み取り中…（初回はエンジンの読み込みで少し時間がかかります）');
      raw=await recognize(blob,p=>onStatus('写真の文字を読み取り中… '+Math.round(p*100)+'%'));
      lines=textLines(raw);
    }catch(e){out.ocrFailed=e.message||true}
  }
  out.candidates=pickCandidates(lines);
  if(!byJan&&out.candidates[0]){
    onStatus('製品データベースを検索中…');
    out.db.push(...await searchDb(out.candidates[0]));
  }
  out.brand=findBrand(byJan?.brand,byJan?.name,raw);
  return out;
}

/* ---------- バーコード読み取りダイアログ ---------- */
function scanBarcode(){
  return new Promise(resolve=>{
    const d=document.createElement('dialog');d.className='confirm-dialog';
    const supported='BarcodeDetector' in window&&navigator.mediaDevices?.getUserMedia;
    d.innerHTML='<form class="confirm-card" method="dialog"><h2>バーコードを読む</h2>'+
      (supported?'<video class="scan-video" playsinline muted></video><p class="id-note">パッケージのバーコードを枠いっぱいに映してください。</p>'
        :'<p class="id-note">この端末・ブラウザはカメラでのバーコード読み取りに未対応です。バーコード下の数字を入力してください。</p>')+
      '<div class="field"><label for="janInput">バーコードの数字（8〜13桁）</label><input id="janInput" inputmode="numeric" placeholder="4901234567894"></div>'+
      '<div class="confirm-actions"><button class="secondary-btn" type="button" data-x>キャンセル</button><button class="primary-btn" type="button" data-ok>この番号で検索</button></div></form>';
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
function officialSearchLink(r,name){
  const q=[name||r.db[0]?.name||r.candidates[0]||'',r.brand?'':(r.db[0]?.brand||'')].filter(Boolean).join(' ');
  if(r.brand)return {href:searchUrl('site:'+r.brand[2]+' '+(q||r.brand[0])),label:r.brand[0]+' の公式サイトで探す ↗'};
  if(r.jan&&!q)return {href:searchUrl(r.jan),label:'バーコード番号で検索 ↗'};
  return q?{href:searchUrl(q+' 公式'),label:'公式サイトを検索 ↗'}:null;
}
function renderResult(box,r){
  const chips=[];
  r.db.forEach((x,i)=>chips.push({kind:'db',i,text:x.name+(x.brand?'（'+x.brand+'）':'')}));
  r.candidates.forEach((t,i)=>chips.push({kind:'ocr',i,text:t}));
  const link=officialSearchLink(r);
  const facts=[r.jan?'バーコード: '+r.jan:'',r.brand?'ブランド: '+r.brand[0]:''].filter(Boolean);
  box.innerHTML=(facts.length?'<p class="id-facts">'+esc(facts.join('　'))+'</p>':'')+
    (chips.length?'<p class="id-note">候補をタップすると入力欄に反映します（製品名は後から直せます）</p><div class="id-chips">'+
      chips.map((c,k)=>'<button type="button" class="id-chip" data-chip="'+k+'">'+(c.kind==='db'?'DB ':'文字 ')+esc(c.text)+'</button>').join('')+'</div>':
      '<p class="id-note">候補を見つけられませんでした。'+(r.jan?'':'バーコードや製品名が大きく写った写真でお試しください。')+'</p>')+
    (r.ocrFailed?'<p class="id-warn">'+esc(typeof r.ocrFailed==='string'?r.ocrFailed:'文字認識に失敗しました')+'</p>':'')+
    (link?'<a class="official-link" href="'+esc(link.href)+'" target="_blank" rel="noopener noreferrer">'+esc(link.label)+'</a>':'')+
    '<p class="id-note">公式ページを開いて、手元の製品と見比べてください。一致したらそのページのURLを下の欄に貼ると、製品の詳細からいつでも公式ページを開けます。</p>';
  box.querySelectorAll('[data-chip]').forEach(btn=>btn.addEventListener('click',()=>{
    const c=chips[+btn.dataset.chip];
    if(c.kind==='db'){const x=r.db[c.i];setField('name',x.name);setField('brand',x.brand||r.brand?.[0]);setField('ingredients',x.ingredients)}
    else{setField('name',c.text);if(r.brand)setField('brand',r.brand[0].split(' / ')[0])}
    const again=officialSearchLink(r,c.kind==='db'?r.db[c.i].name:c.text);
    const a=box.querySelector('.official-link');if(a&&again){a.href=again.href;a.textContent=again.label}
    toast('入力欄に反映しました');
  }));
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
  wrap.innerHTML='<span>製品を特定（無料・端末内で処理）</span>'+
    '<div class="photo-tools"><button type="button" data-id-scan>バーコードを読む</button><button type="button" data-id-photo>写真から特定</button></div>'+
    '<div id="idStatus" class="id-status" role="status" aria-live="polite"></div><div id="idResult"></div>'+
    '<label for="field-officialSource" class="id-label">公式ページのURL（任意）</label>'+
    '<input id="field-officialSource" name="officialSource" type="url" inputmode="url" placeholder="https://..." value="'+esc(httpsUrl(item?.officialSource))+'">';
  fields.prepend(wrap);
  const status=wrap.querySelector('#idStatus'),box=wrap.querySelector('#idResult');
  const buttons=[...wrap.querySelectorAll('[data-id-scan],[data-id-photo]')];
  const run=async input=>{
    buttons.forEach(b=>b.disabled=true);box.innerHTML='';
    try{
      const r=await analyze(input,m=>{status.textContent=m});
      status.textContent='';renderResult(box,r);
    }catch(e){status.textContent='失敗しました: '+(e.message||e)}
    finally{buttons.forEach(b=>b.disabled=false)}
  };
  wrap.querySelector('[data-id-photo]').addEventListener('click',async()=>{
    const blob=await currentBlob();
    if(!blob)return toast('先に「写真」欄で製品の写真を選んでください');
    run({blob});
  });
  wrap.querySelector('[data-id-scan]').addEventListener('click',async()=>{
    const jan=await scanBarcode();if(!jan)return;
    run({blob:await currentBlob(),jan});
  });
}

/* openEditor を包んで、製品の編集時だけ特定ブロックを差し込む */
const baseOpenEditor=openEditor;
openEditor=async function(type,id=null){
  await baseOpenEditor(type,id);
  if(type==='product')mountIdentify(id);
};
})();

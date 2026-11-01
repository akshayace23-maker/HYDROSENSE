// HydroSense SPA - hash router, bilingual UI (EN/TA), all features
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const state={user:null,lang:localStorage.getItem('hs_lang')==='ta'?'ta':'en',meta:{aiEnabled:false,authorityDomain:'krct.ac.in'}};
const t=(k,p)=>{let s=(I18N[state.lang][k]??I18N.en[k]??k);if(p)for(const x in p)s=s.replace('{'+x+'}',p[x]);return s;};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=$('#app'),actions={},forms={},changes={};let cleanups=[];
const ICON={dead_fish:'🐟',garbage:'🗑️',excess_plants:'🌿',foul_smell:'👃',possible_sewage:'🚰',algal_surface:'🟢',muddy_water:'🟤',foam:'🫧',water_level:'📏',encroachment:'🏗️'};
const ISSUES=Object.keys(ICON),TYPES=['pond','lake','river','reservoir','tank','wetland','other'];
const STATUSES=['submitted','under_review','verified','inspection_assigned','field_inspection','action_planned','action_taken','follow_up_required','resolved','reopened','rejected'];
const PRIOS=['low','medium','high','critical'],CATS=['alert','restoration','inspection','awareness','general'];
const PCOL={low:'#94a3b8',medium:'#14b8a6',high:'#f59e0b',critical:'#ef4444'};
const SYS={'Report submitted':'status_submitted','Priority raised: 5+ community confirmations':'reason_confirmations','Field inspection recorded':'record_inspection','Follow-up evidence uploaded':'followup'};
const dt=s=>s?new Date(s).toLocaleString(state.lang==='ta'?'ta-IN':'en-IN',{dateStyle:'medium',timeStyle:'short'}):'';
const wbN=r=>r.wb_name||r.name||t('unnamed');
const stB=s=>`<span class="badge st-${s}">${esc(t('status_'+s))}</span>`,prB=p=>`<span class="badge pr-${p}">${esc(t('prio_'+p))}</span>`;
const chips=l=>l.map(i=>`<span class="chip">${ICON[i]||''} ${esc(t('issue_'+i))}</span>`).join('');
const opts=(list,pre,sel)=>list.map(v=>`<option value="${v}"${v===sel?' selected':''}>${esc(t(pre+v))}</option>`).join('');
const errMsg=e=>{const k='err_'+(e.code||'');return I18N.en[k]?t(k):t('err_network');};

function toast(msg,type){const d=document.createElement('div');d.className='toast '+(type||'');d.textContent=msg;$('#toasts').append(d);setTimeout(()=>d.remove(),4500);}
async function api(url,o={}){
  const init={method:o.method||'GET',headers:{'X-HS-CSRF':'1'},credentials:'same-origin'};
  if(o.form)init.body=o.form;else if(o.body){init.headers['Content-Type']='application/json';init.body=JSON.stringify(o.body);}
  let r;try{r=await fetch(url,init);}catch{const e=new Error('network');e.code='network';throw e;}
  let j={};try{j=await r.json();}catch{}
  if(!r.ok){const e=new Error(j.error||'error');e.code=j.error||'server_error';throw e;}
  return j;
}
const loading=()=>{app.innerHTML=`<div class="container center mu">${esc(t('loading'))}</div>`;};
function modal(html){const m=$('#modal');m.innerHTML=`<div class="card">${html}</div>`;m.classList.remove('hidden');}
const closeModal=()=>$('#modal').classList.add('hidden');

// ---------- chrome ----------
function renderChrome(){
  const u=state.user,h=location.hash||'#/',L=(href,k)=>`<a href="${href}" class="${h===href||(href!=='#/'&&h.startsWith(href))?'on':''}">${esc(t(k))}</a>`;
  let links=L('#/','nav_home');
  if(!u||u.role==='citizen')links+=L('#/report','nav_report');
  links+=L('#/track','nav_track')+L('#/map','nav_map')+L('#/water-bodies','nav_wb')+L('#/news','nav_news');
  if(u&&u.role==='citizen')links+=L('#/my','nav_my');
  if(u&&u.role==='authority')links+=L('#/dashboard','nav_dash')+L('#/alerts','nav_alerts');
  $('#nav').innerHTML=`<div class="nav-in"><a class="logo" href="#/"><svg viewBox="0 0 64 64"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5eead4"/><stop offset="1" stop-color="#0e7490"/></linearGradient></defs><path d="M32 4C20 22 12 32 12 42a20 20 0 0 0 40 0C52 32 44 22 32 4z" fill="url(#lg)"/></svg>${esc(t('brand'))}</a>
  <nav class="links" id="links">${links}</nav><div class="nav-r">
  ${u?`<span class="badge" title="${esc(u.email)}">${esc(u.name.split(' ')[0])}</span><button class="ibtn" data-act="logout">${esc(t('logout'))}</button>`:`<a class="ibtn" href="#/login">${esc(t('login'))}</a><a class="ibtn" href="#/register">${esc(t('register'))}</a>`}
  <button class="ibtn" data-act="lang" aria-label="Language">${esc(t('lang_btn'))}</button><button class="ibtn" data-act="theme" aria-label="${esc(t('theme'))}">◐</button>
  <button class="ibtn burger" data-act="burger" aria-label="${esc(t('menu'))}">☰</button></div></div>`;
  $('#footer').innerHTML=`<b>${esc(t('brand'))}</b> — ${esc(t('tagline'))}<br>${esc(t('footer'))}`;
  $('#skip').textContent=t('skip');
}

// ---------- router ----------
const routes=[
  [/^\/?$/,home],[/^\/login$/,()=>authPage('login')],[/^\/register$/,()=>authPage('register')],
  [/^\/report$/,reportPage,'citizen'],[/^\/track(?:\/(.*))?$/,trackPage],[/^\/my$/,myPage,'citizen'],
  [/^\/r\/([\w-]+)$/,detailPage],[/^\/map$/,mapPage],[/^\/water-bodies$/,wbList],[/^\/wb\/(\d+)$/,wbProfile],
  [/^\/news(?:\/(\w+))?$/,newsPage],[/^\/dashboard$/,dashPage,'authority'],[/^\/alerts$/,alertsPage,'authority']
];
async function route(){
  cleanups.forEach(f=>{try{f()}catch{}});cleanups=[];
  const path=(location.hash.slice(1)||'/').split('?')[0];
  renderChrome();$('#links')&&$('#links').classList.remove('open');
  for(const [re,fn,role] of routes){
    const m=path.match(re);if(!m)continue;
    if(role&&!state.user){sessionStorage.setItem('hs_next',location.hash);toast(t('need_login'));location.hash='#/login';return;}
    if(role&&state.user.role!==role){toast(t('err_forbidden'),'err');location.hash='#/';return;}
    try{await fn(...m.slice(1));}catch(e){app.innerHTML=`<div class="container center"><h2>${esc(e.code==='not_found'?t('not_found_t'):errMsg(e))}</h2><a class="btn" href="#/">${esc(t('nav_home'))}</a></div>`;}
    window.scrollTo(0,0);return;
  }
  app.innerHTML=`<div class="container center"><h2>${esc(t('not_found_t'))}</h2><a class="btn" href="#/">${esc(t('nav_home'))}</a></div>`;
}
addEventListener('hashchange',route);

// ---------- global events ----------
document.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(!a)return;const f=actions[a.dataset.act];if(f){e.preventDefault();f(a,e);}});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-form]');if(!f)return;e.preventDefault();const h=forms[f.dataset.form];if(h)h(f,e);});
document.addEventListener('change',e=>{const f=e.target.closest('[data-change]');if(f&&changes[f.dataset.change])changes[f.dataset.change](f,e);});
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
Object.assign(actions,{
  lang(){state.lang=state.lang==='en'?'ta':'en';localStorage.setItem('hs_lang',state.lang);document.documentElement.lang=state.lang;route();},
  theme(){const n=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',n);localStorage.setItem('hs_theme',n);},
  burger(){$('#links').classList.toggle('open');},
  closemodal:closeModal,
  async logout(){try{await api('/api/auth/logout',{method:'POST',body:{}});}catch{}state.user=null;toast(t('logged_out'));location.hash='#/';renderChrome();},
  async confirm(el){
    if(!state.user){toast(t('need_login'));location.hash='#/login';return;}
    if(!window.confirm(t('see_too_q')))return;
    try{const r=await api(`/api/reports/${encodeURIComponent(el.dataset.code)}/confirm`,{method:'POST',body:{}});toast(t('conf_count',{n:r.confirmations}));el.disabled=true;el.textContent='✓ '+t('confirmed');if(el.dataset.reload)route();}
    catch(x){toast(errMsg(x),'err');}
  }
});


const feedCard=(r,solved)=>`<article class="card"><div class="row between"><b>${esc(wbN(r))}</b>${stB(r.status)}</div>
 <div class="hint">${esc(t('type_'+r.wb_type))}${r.address?' · 📍 '+esc(r.address):''} · ${esc(dt(solved?r.updated_at:r.created_at))}</div>
 <div class="chips" style="margin:.5rem 0">${chips(r.issues)}</div>${r.notes?`<p class="mu">${esc(r.notes)}</p>`:''}
 <div class="row between" style="border-top:1px solid var(--card-b);padding-top:.6rem"><span class="hint">👥 ${esc(t('conf_count',{n:r.confirmations}))}</span>
 <span class="row">${solved?`<span class="badge st-resolved">✅ ${esc(t('solved_on'))} ${esc(dt(r.updated_at))}</span>`:`<button class="btn sm" data-act="confirm" data-code="${esc(r.code)}">👁 ${esc(t('see_too'))}</button>`}<a class="btn ghost sm" href="#/r/${esc(r.code)}">${esc(t('details'))}</a></span></div></article>`;

// ---------- home ----------
async function home(){
  const loop=t('loop').split('|');
  const feats=[['📍',1],['📷',2],['👥',3],['🧭',4],['🗺️',5],['🌿',6]];
  app.innerHTML=`<section class="hero"><canvas id="hero3d" aria-hidden="true"></canvas><div class="hero-in"><div class="hero-txt">
   <span class="pill">💧 ${esc(t('hero_badge'))}</span><h1>${esc(t('hero_title'))}</h1><div class="tag">${esc(t('tagline'))}</div><p>${esc(t('hero_sub'))}</p>
   <div class="row" style="margin-top:1.4rem"><a class="btn" href="#/report">${esc(t('cta_report'))} →</a><a class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" href="#/track">${esc(t('cta_track'))}</a><a class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" href="#/map">${esc(t('cta_map'))}</a></div></div></div></section>
  <section class="container"><div class="grid g4" id="stats"></div>
   <h2 class="center" style="margin-top:2.5rem">${esc(t('recent_t'))}</h2><div class="grid g2" id="recent"></div><p class="center"><a class="btn" href="#/news/open">${esc(t('view_all'))}</a></p>
   <h2 class="center" style="margin-top:2.5rem">${esc(t('feat_title'))}</h2>
   <div class="grid g3">${feats.map(([i,n])=>`<div class="card fcard"><div class="ico">${i}</div><h3>${esc(t('f'+n+'_t'))}</h3><p class="mu">${esc(t('f'+n+'_d'))}</p></div>`).join('')}</div>
   <h2 class="center" style="margin-top:2.5rem">${esc(t('loop_title'))}</h2><div class="chips" style="justify-content:center">${loop.map((x,i)=>`<span class="chip"><i>${i+1}</i>${esc(x)}</span>`).join('')}</div>
   <div class="card" style="margin-top:2rem"><h3>🔬 ${esc(t('integrity_t'))}</h3><p class="mu">${esc(t('integrity_d'))}</p></div></section>`;
  cleanups.push(window.HS_hero($('#hero3d')));
  api('/api/feed').then(f=>{const col=(k,l,list,s)=>`<a href="#/news/${k}" style="text-decoration:none;color:inherit"><div class="card"><h3>${s?'✅':'⚠️'} ${esc(t(l))}</h3>${list.length?list.slice(0,3).map(r=>`<div style="padding:.5rem 0;border-top:1px solid var(--card-b)"><b>${esc(wbN(r))}</b> ${stB(r.status)}<div class="chips" style="margin-top:.3rem">${chips(r.issues.slice(0,3))}</div><span class="hint">${esc(dt(s?r.updated_at:r.created_at))} · 👥 ${r.confirmations}</span></div>`).join(''):`<p class="mu">${esc(t(s?'feed_empty_solved':'feed_empty_open'))}</p>`}</div></a>`;
    const el=$('#recent');if(el)el.innerHTML=col('open','tab_open',f.open,false)+col('solved','tab_solved',f.solved,true);}).catch(()=>{});
  try{const s=await api('/api/public-stats');$('#stats').innerHTML=[['reports','stat_reports'],['waterBodies','stat_wb'],['resolved','stat_resolved'],['confirmations','stat_conf']].map(([k,l])=>`<div class="card stat"><b>${s[k]}</b>${esc(t(l))}</div>`).join('');}catch{}
}

// ---------- auth ----------
function authPage(mode){
  let role=null;
  const draw=()=>{
    if(!role){app.innerHTML=`<div class="container narrow center"><h1>${esc(t('auth_choose'))}</h1><div class="grid g2" style="margin-top:1.5rem">
      ${['citizen','authority'].map(r=>`<button class="rolecard" data-act="pickrole" data-role="${r}"><span class="ico">${r==='citizen'?'🧑':'🏛️'}</span><h2>${esc(t('role_'+r))}</h2><p class="mu">${esc(t('role_'+r+'_d'))}</p></button>`).join('')}</div>
      <p class="mu" style="margin-top:1.5rem">${esc(t(mode==='login'?'no_account':'have_account'))} <a href="#/${mode==='login'?'register':'login'}">${esc(t(mode==='login'?'register':'login'))}</a></p></div>`;return;}
    const reg=mode==='register';
    app.innerHTML=`<div class="container narrow"><div class="card"><h1>${esc(t(reg?'register_as':'login_as'))} ${esc(t('role_'+role))}</h1>
     <form data-form="auth" class="stack" novalidate>
      ${reg?`<div><label class="f" for="a_name">${esc(t('name'))}</label><input id="a_name" type="text" autocomplete="name" required maxlength="80"></div>`:''}
      <div><label class="f" for="a_email">${esc(t('email'))}</label><input id="a_email" type="email" autocomplete="email" required>${role==='authority'&&reg?`<div class="hint">${esc(t('auth_domain_hint',{d:state.meta.authorityDomain}))}</div>`:''}</div>
      ${reg?`<div><label class="f" for="a_phone">${esc(t('phone'))}</label><input id="a_phone" type="tel" autocomplete="tel" maxlength="20"></div>`:''}
      <div><label class="f" for="a_pw">${esc(t('password'))}</label><input id="a_pw" type="password" autocomplete="${reg?'new-password':'current-password'}" required maxlength="100">${reg?`<div class="hint">${esc(t('pw_hint'))}</div>`:''}</div>
      <div class="row between"><button class="btn" type="submit">${esc(t(reg?'register':'login'))}</button><button type="button" class="btn ghost" data-act="changerole">${esc(t('change_role'))}</button></div>
     </form><p class="mu">${esc(t(reg?'have_account':'no_account'))} <a href="#/${reg?'login':'register'}">${esc(t(reg?'login':'register'))}</a></p></div></div>`;
  };
  actions.pickrole=el=>{role=el.dataset.role;draw();};actions.changerole=()=>{role=null;draw();};
  forms.auth=async f=>{
    const b=f.querySelector('button[type=submit]');b.disabled=true;
    const body={role,email:$('#a_email').value,password:$('#a_pw').value};
    if(mode==='register'){body.name=$('#a_name').value;body.phone=$('#a_phone').value;}
    try{const r=await api('/api/auth/'+mode,{method:'POST',body});state.user=r.user;toast(t(mode==='login'?'logged_in':'registered'));
      const next=sessionStorage.getItem('hs_next');sessionStorage.removeItem('hs_next');
      location.hash=next||(r.user.role==='authority'?'#/dashboard':'#/my');renderChrome();}
    catch(e){toast(errMsg(e),'err');b.disabled=false;}
  };
  draw();
}

// ---------- report wizard ----------
function reportPage(){
  const draft={files:[],lat:null,lng:null,ai:null,aiRan:false,step:1};
  const u=state.user,TILE='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  app.innerHTML=`<section class="container narrow"><h1>${esc(t('rep_title'))}</h1>
  <div class="steps">${[1,2,3,4].map(i=>`<div class="stepdot" data-s="${i}"><b>${i}</b><span>${esc(t('step'+i))}</span></div>`).join('')}</div>
  <form id="repForm" data-form="report" novalidate class="card">
   <div data-p="1"><h2>${esc(t('step1'))}</h2>
    <label class="f" for="wbType">${esc(t('wb_type'))}</label><select id="wbType">${opts(TYPES,'type_')}</select>
    <label class="f" for="wbName">${esc(t('wb_name'))}</label><input id="wbName" type="text" maxlength="100" placeholder="${esc(t('wb_name_ph'))}">
    <div class="row" style="margin:1rem 0 .5rem"><button type="button" class="btn" data-act="locate">📍 ${esc(t('use_loc'))}</button><span class="hint">${esc(t('coords'))}: <b id="coords" class="mono">—</b></span></div>
    <div class="hint">${esc(t('loc_hint'))}</div><div id="pickmap" class="map"></div>
    <label class="f" for="addr">${esc(t('address'))}</label><input id="addr" type="text" maxlength="200">
    <div id="nearby" class="stack"></div></div>
   <div data-p="2" class="hidden"><h2>${esc(t('photos_t'))}</h2><p class="hint">${esc(t('photo_tips'))}</p>
    <div class="row"><label class="btn"><input type="file" id="fCam" accept="image/*" capture="environment" hidden>📷 ${esc(t('take_photo'))}</label>
    <label class="btn ghost"><input type="file" id="fGal" accept="image/jpeg,image/png,image/webp" multiple hidden>🖼️ ${esc(t('from_gallery'))}</label></div>
    <div id="previews" class="previews"></div><div id="aiBox"></div></div>
   <div data-p="3" class="hidden"><h2>${esc(t('obs_t'))}</h2><p class="hint">${esc(t('obs_hint'))}</p>
    <div class="checks">${ISSUES.map(k=>`<label class="chk"><input type="checkbox" name="issues" value="${k}"><span class="ico">${ICON[k]}</span><span>${esc(t('issue_'+k))}</span></label>`).join('')}</div>
    <label class="f" for="notes">${esc(t('notes'))}</label><textarea id="notes" maxlength="1500"></textarea>
    <label class="chk" style="margin-top:1rem"><input type="checkbox" id="anon"><span><b>🕶️ ${esc(t('anon'))}</b><br><span class="hint">${esc(t('anon_d'))}</span></span></label>
    <div id="contactBox"><h3 style="margin-top:1rem">${esc(t('contact_t'))}</h3><div class="grid g3"><div><label class="f" for="cName">${esc(t('name'))}</label><input id="cName" type="text" value="${esc(u.name)}" maxlength="80"></div>
    <div><label class="f" for="cEmail">${esc(t('email'))}</label><input id="cEmail" type="email" value="${esc(u.email)}"></div><div><label class="f" for="cPhone">${esc(t('phone'))}</label><input id="cPhone" type="tel" maxlength="20"></div></div></div></div>
   <div data-p="4" class="hidden"><h2>${esc(t('review_t'))}</h2><div id="review" class="stack"></div></div>
   <div class="row between" style="margin-top:1.5rem"><button type="button" class="btn ghost" data-act="prev">← ${esc(t('back'))}</button>
    <button type="button" class="btn" data-act="next" id="btnNext">${esc(t('next'))} →</button><button type="submit" class="btn hidden" id="btnSubmit">✔ ${esc(t('submit'))}</button></div>
  </form></section>`;
  const map=L.map('pickmap').setView([10.9,78.75],11);cleanups.push(()=>map.remove());
  L.tileLayer(TILE,{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© OpenStreetMap'}).addTo(map);
  let marker=null,nt=null;
  const setPin=(lat,lng,zoom)=>{draft.lat=lat;draft.lng=lng;
    if(!marker){marker=L.marker([lat,lng],{draggable:true,icon:L.divIcon({className:'',html:'<div class="pin">📍</div>',iconSize:[28,28],iconAnchor:[14,28]})}).addTo(map);marker.on('dragend',()=>{const p=marker.getLatLng();setPin(p.lat,p.lng);});}
    else marker.setLatLng([lat,lng]);
    if(zoom)map.setView([lat,lng],zoom);$('#coords').textContent=lat.toFixed(5)+', '+lng.toFixed(5);clearTimeout(nt);nt=setTimeout(nearby,350);};
  map.on('click',e=>setPin(e.latlng.lat,e.latlng.lng));
  async function nearby(){
    try{const r=await api(`/api/reports/nearby?lat=${draft.lat}&lng=${draft.lng}`);const box=$('#nearby');if(!box)return;
      box.innerHTML=r.reports.length?`<div class="card"><h3>⚠️ ${esc(t('nearby_t'))}</h3><p class="hint">${esc(t('nearby_d'))}</p>${r.reports.map(x=>`<div class="row between" style="padding:.5rem 0;border-top:1px solid var(--card-b)"><div><b>${esc(wbN(x))}</b> <span class="mono hint">${esc(x.code)}</span><div class="chips">${chips(x.issues)}</div><span class="hint">${esc(t('conf_count',{n:x.confirmations}))}</span></div>
        <button type="button" class="btn sm" data-act="confirm" data-code="${esc(x.code)}">👁 ${esc(t('see_too'))}</button></div>`).join('')}</div>`:'';}catch{}
  }
  function show(n){draft.step=n;$$('[data-p]').forEach(p=>p.classList.toggle('hidden',+p.dataset.p!==n));
    $$('.stepdot').forEach(d=>{d.classList.toggle('on',+d.dataset.s===n);d.classList.toggle('done',+d.dataset.s<n);});
    $('[data-act=prev]').style.visibility=n===1?'hidden':'visible';$('#btnNext').classList.toggle('hidden',n===4);$('#btnSubmit').classList.toggle('hidden',n!==4);
    if(n===1)setTimeout(()=>map.invalidateSize(),50);if(n===4)buildReview();window.scrollTo(0,0);}
  function buildReview(){const iss=$$('input[name=issues]:checked').map(i=>i.value),an=$('#anon').checked;
    $('#review').innerHTML=`<div class="card"><p><b>${esc(t('wb_type'))}:</b> ${esc(t('type_'+$('#wbType').value))} — ${esc($('#wbName').value||t('unnamed'))}</p><p><b>${esc(t('location'))}:</b> <span class="mono">${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}</span> ${esc($('#addr').value)}</p>
     <p><b>${esc(t('evidence'))}:</b> ${esc(t('photos_count',{n:draft.files.length}))}</p><p><b>${esc(t('observations'))}:</b></p><div class="chips">${chips(iss)}</div><p>${esc($('#notes').value)}</p>
     <p><b>${esc(t('reporting_as'))}:</b> ${esc(t(an?'anon_label':'identified_label'))}</p></div>`;}
  const syncAnon=()=>$('#contactBox').classList.toggle('hidden',$('#anon').checked);$('#anon').addEventListener('change',syncAnon);
  function previews(){const box=$('#previews');box.innerHTML='';draft.files.forEach((f,i)=>{const d=document.createElement('div');d.className='prev';const im=new Image();im.src=URL.createObjectURL(f);im.alt='';const b=document.createElement('button');b.type='button';b.textContent='×';b.title=t('remove');b.dataset.act='rmphoto';b.dataset.i=i;d.append(im,b);box.append(d);});}
  async function addFiles(list){
    for(const f of list){if(!/^image\/(jpeg|png|webp)$/.test(f.type)){toast(t('err_invalid_file'),'err');continue;}
      if(f.size>8*1024*1024){toast(t('err_file_too_large'),'err');continue;}
      if(draft.files.length>=6){toast(t('max_photos'),'err');break;}draft.files.push(f);}
    previews();
    if(draft.files.length&&!draft.aiRan){draft.aiRan=true;runAi(draft.files[0]);}
  }
  async function runAi(file){const box=$('#aiBox');box.innerHTML=`<div class="card"><b>🤖 ${esc(t('ai_t'))}</b><p class="hint">${esc(t('ai_checking'))}</p></div>`;
    try{const fd=new FormData();fd.append('photo',file);const r=await api('/api/ai-check',{method:'POST',form:fd});
      if(!r.available){box.innerHTML=`<div class="card"><b>🤖 ${esc(t('ai_t'))}</b><p class="hint">${esc(t('ai_unavailable'))}</p></div>`;return;}draft.ai=r;const x=r.result;
      box.innerHTML=`<div class="card"><b>🤖 ${esc(t('ai_t'))}</b><p>${esc(t(x.water_body_plausible?'ai_plausible':'ai_not_plausible'))}</p>${x.visible.length?`<p class="hint">${esc(t('ai_visible'))}</p><ul>${x.visible.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:''}<p class="hint">${esc(t('ai_limit'))}</p></div>`;
    }catch{box.innerHTML=`<div class="card"><b>🤖 ${esc(t('ai_t'))}</b><p class="hint">${esc(t('ai_unavailable'))}</p></div>`;}}
  $('#fCam').addEventListener('change',e=>{addFiles([...e.target.files]);e.target.value='';});
  $('#fGal').addEventListener('change',e=>{addFiles([...e.target.files]);e.target.value='';});
  Object.assign(actions,{
    locate(){if(!navigator.geolocation)return toast(t('loc_denied'),'err');navigator.geolocation.getCurrentPosition(p=>setPin(p.coords.latitude,p.coords.longitude,17),()=>toast(t('loc_denied'),'err'),{enableHighAccuracy:true,timeout:12000});},
    rmphoto(el){draft.files.splice(+el.dataset.i,1);if(!draft.files.length){draft.aiRan=false;draft.ai=null;$('#aiBox').innerHTML='';}previews();},
    prev(){if(draft.step>1)show(draft.step-1);},
    next(){
      if(draft.step===1&&draft.lat==null)return toast(t('need_pin'),'err');
      if(draft.step===3&&!$$('input[name=issues]:checked').length&&!$('#notes').value.trim())return toast(t('need_obs'),'err');
      show(draft.step+1);}
  });
  forms.report=async()=>{
    if(draft.step<4)return actions.next();
    const b=$('#btnSubmit');b.disabled=true;b.textContent=t('submitting');
    const fd=new FormData(),an=$('#anon').checked;
    fd.append('type',$('#wbType').value);fd.append('name',$('#wbName').value);fd.append('lat',draft.lat);fd.append('lng',draft.lng);fd.append('address',$('#addr').value);
    $$('input[name=issues]:checked').forEach(i=>fd.append('issues',i.value));fd.append('notes',$('#notes').value);fd.append('anonymous',an);
    if(!an){fd.append('contact_name',$('#cName').value);fd.append('contact_email',$('#cEmail').value);fd.append('contact_phone',$('#cPhone').value);}
    if(draft.ai){fd.append('ai',JSON.stringify(draft.ai.result));fd.append('ai_sig',draft.ai.sig);}
    draft.files.forEach(f=>fd.append('photos',f));
    try{const r=await api('/api/reports',{method:'POST',form:fd});
      modal(`<div class="check">✅</div><h2>${esc(t('success_t'))}</h2><p class="mu">${esc(t('success_id'))}</p><div class="big">${esc(r.code)}</div>
       <div class="row" style="justify-content:center"><a class="btn" data-act="closemodal" href="#/r/${esc(r.code)}">${esc(t('view_report'))}</a><a class="btn ghost" data-act="closemodal" href="#/my">${esc(t('go_my'))}</a></div>`);
      actions.closemodal=()=>{closeModal();};
    }catch(e){toast(errMsg(e),'err');b.disabled=false;b.textContent='✔ '+t('submit');}
  };
  show(1);
}

// ---------- track / my ----------
function repCard(r){return `<a class="card" href="#/r/${esc(r.code)}" style="display:block;text-decoration:none;color:inherit"><div class="row between"><b>${esc(wbN(r))}</b>${stB(r.status)}</div>
 <div class="mono hint">${esc(r.code)} · ${esc(dt(r.created_at))}</div><div class="chips" style="margin:.4rem 0">${chips(r.issues)}</div><div class="row">${prB(r.priority)}<span class="hint">👥 ${r.confirmations}</span>${r.address?`<span class="hint">📍 ${esc(r.address)}</span>`:''}</div></a>`;}
async function trackPage(q){
  q=q?decodeURIComponent(q):'';
  app.innerHTML=`<section class="container narrow"><h1>${esc(t('track_t'))}</h1><form data-form="track" class="row" style="flex-wrap:nowrap"><input type="search" id="tq" placeholder="${esc(t('track_ph'))}" value="${esc(q)}" maxlength="100"><button class="btn" type="submit">${esc(t('search'))}</button></form><div id="tres" class="grid" style="margin-top:1rem"></div></section>`;
  forms.track=()=>{const v=$('#tq').value.trim();if(v)location.hash='#/track/'+encodeURIComponent(v);};
  if(q){try{const r=await api('/api/track?q='+encodeURIComponent(q));$('#tres').innerHTML=r.reports.length?r.reports.map(repCard).join(''):`<p class="mu">${esc(t('no_results'))}</p>`;}catch(e){toast(errMsg(e),'err');}}
}
async function myPage(){
  loading();const r=await api('/api/my/reports'),b=r.badge,lv=b.level,pct=Math.min(100,Math.round((b.reports*2+b.confirmations)/10*100));
  app.innerHTML=`<section class="container narrow"><h1>${esc(t('my_t'))}</h1><div class="card"><div class="row between"><div><span class="ico">${['🌱','💧','🛡️'][lv]}</span> <b>${esc(t('badge_t'))}: ${esc(t('badge_'+lv))}</b></div><span class="hint">${b.reports} ${esc(t('nav_report'))} · ${b.confirmations} ${esc(t('see_too'))}</span></div>
   <div class="bar" style="margin:.6rem 0"><i style="width:${pct}%"></i></div><p class="hint">${esc(t('badge_d'))}</p></div>
   <div class="grid" style="margin-top:1rem">${r.reports.length?r.reports.map(repCard).join(''):`<p class="mu">${esc(t('my_empty'))}</p><a class="btn" href="#/report">${esc(t('cta_report'))}</a>`}</div></section>`;
}

// ---------- report detail ----------
async function detailPage(code){
  loading();const {report:r}=await api('/api/reports/'+encodeURIComponent(code));const au=state.user&&state.user.role==='authority';
  const ph=(k)=>r.photos.filter(p=>k.includes(p.kind));
  const fig=p=>`<figure><a href="${esc(p.url)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(p.url)}" alt=""></a><figcaption>${esc(t(p.kind==='before'?'before':p.kind==='after'?'after':'followup'))} · ${esc(dt(p.created_at))}</figcaption></figure>`;
  const ans=v=>t('ans_'+v);
  const insp=i=>`<div class="card" style="margin-bottom:.6rem"><div class="hint">${esc(dt(i.created_at))} · ${esc(i.inspector)}</div><div class="grid g3" style="margin:.4rem 0">${Object.entries(i.data.fields||{}).map(([k,v])=>`<div><span class="hint">${esc(t('f_'+k))}</span><br><b>${esc(ans(v))}</b></div>`).join('')}</div>
    <div class="chips">${Object.entries(i.data.stress||{}).filter(([,v])=>v).map(([k])=>`<span class="chip">⚠️ ${esc(t('st_'+k))}</span>`).join('')}${i.data.producers?`<span class="chip">🌱 ${esc(t('producers'))}</span>`:''}${i.data.consumers?`<span class="chip">🐟 ${esc(t('consumers'))}</span>`:''}</div>${i.data.notes?`<p>${esc(i.data.notes)}</p>`:''}</div>`;
  const rep=r.reporter?`<div class="card"><h3>${esc(t('reporter'))}</h3><p>${esc(r.reporter.name||'')}<br><span class="mono">${esc(r.reporter.email||'')}</span><br>${esc(r.reporter.phone||'')}</p>${r.reporter.badge?`<span class="badge">${['🌱','💧','🛡️'][r.reporter.badge.level]} ${esc(t('badge_'+r.reporter.badge.level))}</span>`:''}</div>`:(au&&r.anonymous?`<div class="card"><p class="mu">🕶️ ${esc(t('anon_report'))}</p></div>`:'');
  const ai=r.ai_check?`<div class="card"><h3>🤖 ${esc(t('ai_summary'))}</h3><p>${esc(t(r.ai_check.water_body_plausible?'ai_plausible':'ai_not_plausible'))}</p><ul>${(r.ai_check.visible||[]).map(v=>`<li>${esc(v)}</li>`).join('')}</ul><p class="hint">${esc(t('ai_limit'))}</p></div>`:'';
  app.innerHTML=`<section class="container"><div class="row between"><div><span class="mono mu">${esc(r.code)}</span><h1>${esc(wbN(r))}</h1></div><div class="row noprint">${stB(r.status)}${prB(r.priority)}<button class="btn ghost sm" onclick="window.print()">🖨 ${esc(t('print'))}</button></div></div>
   <div class="grid g2" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))"><div class="stack">
    <div class="card"><p><b>${esc(t('wb_type'))}:</b> ${esc(t('type_'+r.wb_type))} · <a href="#/wb/${r.wb_id}">${esc(t('wb_hist'))} →</a></p><p><b>${esc(t('reported_on'))}:</b> ${esc(dt(r.created_at))}</p><p><b>${esc(t('location'))}:</b> <span class="mono">${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</span> ${esc(r.address||'')}</p>
     <p><b>${esc(t('observations'))}:</b></p><div class="chips">${chips(r.issues)}</div>${r.notes?`<p>${esc(r.notes)}</p>`:''}
     <div class="card" style="margin-top:1rem"><b>👥 ${esc(t('conf_count',{n:r.confirmations}))}</b><p class="hint">${esc(t('conf_note'))}</p>
      ${r.mine?'':(['resolved','rejected'].includes(r.status)?'':(state.user?(r.confirmed_by_me?`<button class="btn sm" disabled>✓ ${esc(t('confirmed'))}</button>`:`<button class="btn sm noprint" data-act="confirm" data-code="${esc(r.code)}" data-reload="1">👁 ${esc(t('see_too'))}</button>`):`<a class="btn sm" href="#/login">${esc(t('login_to_confirm'))}</a>`))}</div></div>
    ${rep}${ai}
    <div class="card"><h3>📷 ${esc(t('evidence'))}</h3>${r.photos.length?`<div class="photos">${r.photos.map(fig).join('')}</div>`:`<p class="mu">${esc(t('none_yet'))}</p>`}
     ${r.mine?`<form data-form="evidence" data-code="${esc(r.code)}" class="noprint" style="margin-top:1rem"><label class="f">${esc(t('upload_followup'))}</label><input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required><button class="btn sm" style="margin-top:.5rem">${esc(t('save'))}</button></form>`:''}</div>
   </div><div class="stack">
    <div class="card"><h3>🧭 ${esc(t('timeline'))}</h3><div class="tl">${r.updates.map(u=>`<div>${stB(u.status)} <span class="hint">${esc(dt(u.created_at))} · ${esc(t('by_'+u.actor_role))}${u.actor_name?' — '+esc(u.actor_name):''}</span>${u.remarks&&u.remarks!=='Report submitted'?`<p>${esc(SYS[u.remarks]?t(SYS[u.remarks]):u.remarks)}</p>`:''}</div>`).join('')}</div></div>
    <div class="card"><h3>🔬 ${esc(t('inspections'))}</h3><p class="hint">${esc(t('insp_note'))}</p>${r.inspections.length?r.inspections.map(insp).join(''):`<p class="mu">${esc(t('none_yet'))}</p>`}</div>
    <div class="card"><h3>🛠️ ${esc(t('actions'))}</h3>${r.actions.length?r.actions.map(a=>`<p><span class="hint">${esc(dt(a.created_at))} · ${esc(a.created_by)}</span><br>${esc(a.description)}</p>`).join(''):`<p class="mu">${esc(t('none_yet'))}</p>`}
     ${ph(['before']).length&&ph(['after']).length?`<p class="hint">${esc(t('ba_note'))}</p>`:''}</div>
   </div></div>
   ${au?authorityPanel(r):''}</section>`;
}
function authorityPanel(r){
  const sel=(n,list,pre,cur)=>`<select name="${n}">${opts(list,pre,cur)}</select>`;
  const F=['visible_pollution','sewage_inflow','solid_waste','vegetation','fish_condition','odour','water_appearance'],S=['algal_growth','fish_mortality','invasive_plants','biodiversity_reduction','habitat_disturbance'];
  return `<div class="card noprint" style="margin-top:1.5rem"><h2>🏛️ ${esc(t('auth_panel'))}</h2><div class="grid g2" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
   <form data-form="astatus" data-code="${esc(r.code)}"><h3>${esc(t('update_status'))}</h3><label class="f">${esc(t('status'))}</label>${sel('status',STATUSES,'status_',r.status)}<label class="f">${esc(t('priority'))}</label>${sel('priority',PRIOS,'prio_',r.priority)}<label class="f">${esc(t('remarks'))}</label><textarea name="remarks" maxlength="600"></textarea><button class="btn" style="margin-top:.6rem">${esc(t('save'))}</button></form>
   <form data-form="aaction" data-code="${esc(r.code)}"><h3>${esc(t('record_action'))}</h3><label class="f">${esc(t('action_desc'))}</label><textarea name="description" required maxlength="1000"></textarea><label class="f">${esc(t('after_photo'))}</label><input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple><button class="btn" style="margin-top:.6rem">${esc(t('save'))}</button></form></div>
   <details class="card" style="margin-top:1rem"><summary>${esc(t('record_inspection'))}</summary><form data-form="ainsp" data-code="${esc(r.code)}"><div class="grid g3">${F.map(k=>`<div><label class="f">${esc(t('f_'+k))}</label><select name="f_${k}">${['observed','not_observed','unable'].map(v=>`<option value="${v}"${v==='unable'?' selected':''}>${esc(t('ans_'+v))}</option>`).join('')}</select></div>`).join('')}</div>
    <h3 style="margin-top:1rem">${esc(t('stress_t'))}</h3><div class="checks">${S.map(k=>`<label class="chk"><input type="checkbox" name="s_${k}">${esc(t('st_'+k))}</label>`).join('')}<label class="chk"><input type="checkbox" name="producers">🌱 ${esc(t('producers'))}</label><label class="chk"><input type="checkbox" name="consumers">🐟 ${esc(t('consumers'))}</label></div>
    <label class="f">${esc(t('notes'))}</label><textarea name="notes" maxlength="1000"></textarea><button class="btn" style="margin-top:.6rem">${esc(t('save'))}</button></form></details>
   <button class="btn danger sm" style="margin-top:1rem" data-act="delreport" data-code="${esc(r.code)}">🗑 ${esc(t('delete'))}</button></div>`;
}
const done=(m)=>{toast(m||t('saved'));route();};
forms.astatus=async f=>{try{await api(`/api/admin/reports/${f.dataset.code}/status`,{method:'POST',body:{status:f.status.value,priority:f.priority.value,remarks:f.remarks.value}});done();}catch(e){toast(errMsg(e),'err');}};
forms.aaction=async f=>{try{await api(`/api/admin/reports/${f.dataset.code}/action`,{method:'POST',form:new FormData(f)});done();}catch(e){toast(errMsg(e),'err');}};
forms.evidence=async f=>{try{await api(`/api/reports/${f.dataset.code}/evidence`,{method:'POST',form:new FormData(f)});done(t('uploaded'));}catch(e){toast(errMsg(e),'err');}};
forms.ainsp=async f=>{const g=n=>f.elements[n],body={fields:{},stress:{},producers:g('producers').checked,consumers:g('consumers').checked,notes:g('notes').value};
  ['visible_pollution','sewage_inflow','solid_waste','vegetation','fish_condition','odour','water_appearance'].forEach(k=>body.fields[k]=g('f_'+k).value);
  ['algal_growth','fish_mortality','invasive_plants','biodiversity_reduction','habitat_disturbance'].forEach(k=>body.stress[k]=g('s_'+k).checked);
  try{await api(`/api/admin/reports/${f.dataset.code}/inspection`,{method:'POST',body});done();}catch(e){toast(errMsg(e),'err');}};
actions.delreport=async el=>{if(!window.confirm(t('confirm_delete')))return;try{await api('/api/admin/reports/'+el.dataset.code,{method:'DELETE'});toast(t('deleted'));location.hash='#/dashboard';}catch(e){toast(errMsg(e),'err');}};

// ---------- GIS map ----------
async function mapPage(){
  loading();const data=await api('/api/map');
  app.innerHTML=`<section class="container"><h1>${esc(t('map_t'))}</h1><div class="card"><div class="grid g4" style="align-items:end">
   <div><label class="f">${esc(t('status'))}</label><select id="mfS" data-change="mapf"><option value="">${esc(t('all'))}</option>${opts(STATUSES,'status_')}</select></div>
   <div><label class="f">${esc(t('category'))}</label><select id="mfC" data-change="mapf"><option value="">${esc(t('all'))}</option>${opts(ISSUES,'issue_')}</select></div>
   <div><label class="f">${esc(t('priority'))}</label><select id="mfP" data-change="mapf"><option value="">${esc(t('all'))}</option>${opts(PRIOS,'prio_')}</select></div>
   <div><label class="f">${esc(t('date_from'))}</label><input type="date" id="mfF" data-change="mapf"></div><div><label class="f">${esc(t('date_to'))}</label><input type="date" id="mfT" data-change="mapf"></div></div>
   <div class="row" style="margin-top:.8rem">${[['L1','layer_wb'],['L2','layer_reports'],['L3','layer_heat']].map(([id,k])=>`<label class="row"><input type="checkbox" id="${id}" data-change="mapf" checked> ${esc(t(k))}</label>`).join('')}<span class="hint" id="mcount"></span></div></div>
   <div id="gis" class="map tall" style="margin-top:1rem"></div></section>`;
  const map=L.map('gis').setView([10.9,78.75],10);cleanups.push(()=>map.remove());
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© OpenStreetMap'}).addTo(map);
  const gW=L.layerGroup().addTo(map),gR=L.layerGroup().addTo(map),gH=L.layerGroup().addTo(map);
  function draw(){
    [gW,gR,gH].forEach(g=>g.clearLayers());
    const s=$('#mfS').value,c=$('#mfC').value,p=$('#mfP').value,f=$('#mfF').value,to=$('#mfT').value;
    const reps=data.reports.filter(r=>(!s||r.status===s)&&(!c||r.issues.includes(c))&&(!p||r.priority===p)&&(!f||r.created_at.slice(0,10)>=f)&&(!to||r.created_at.slice(0,10)<=to));
    $('#mcount').textContent=t('map_count',{n:reps.length});
    if($('#L1').checked)data.waterBodies.forEach(w=>L.circleMarker([w.lat,w.lng],{radius:12,color:'#5eead4',weight:3,fillColor:'#0e7490',fillOpacity:.85}).bindPopup(`<b>💧 ${esc(w.name||t('unnamed'))}</b><br>${esc(t('type_'+w.type))} · ${w.n} ${esc(t('wb_reports'))}<br><a href="#/wb/${w.id}">${esc(t('open_detail'))} →</a>`).addTo(gW));
    if($('#L2').checked)reps.forEach(r=>L.circleMarker([r.lat,r.lng],{radius:7,color:'#fff',weight:2,fillColor:PCOL[r.priority],fillOpacity:.95}).bindPopup(`<b>${esc(wbN(r))}</b><br><span style="font-family:monospace">${esc(r.code)}</span><br>${esc(t('status_'+r.status))} · ${esc(t('prio_'+r.priority))}<br>${r.issues.map(i=>ICON[i]+' '+esc(t('issue_'+i))).join('<br>')}<br>👥 ${r.confirmations}<br>
      <button class="btn sm" style="margin:.4rem .3rem 0 0" data-act="confirm" data-code="${esc(r.code)}">👁 ${esc(t('see_too'))}</button><a href="#/r/${esc(r.code)}">${esc(t('open_detail'))} →</a>`).addTo(gR));
    if($('#L3').checked){const cell={};reps.forEach(r=>{const k=Math.round(r.lat*100)+','+Math.round(r.lng*100);(cell[k]=cell[k]||{lat:0,lng:0,n:0});const o=cell[k];o.lat+=r.lat;o.lng+=r.lng;o.n++;});
      Object.values(cell).forEach(o=>L.circle([o.lat/o.n,o.lng/o.n],{radius:350+o.n*180,stroke:false,fillColor:'#ef4444',fillOpacity:Math.min(.55,.12+o.n*.08)}).addTo(gH));}
    return reps;
  }
  changes.mapf=draw;const first=draw();
  const pts=[...data.waterBodies.map(w=>[w.lat,w.lng]),...first.map(r=>[r.lat,r.lng])];if(pts.length)map.fitBounds(pts,{padding:[40,40],maxZoom:15});
}

// ---------- water bodies ----------
async function wbList(){
  loading();const {waterBodies:ws}=await api('/api/water-bodies');
  app.innerHTML=`<section class="container"><h1>${esc(t('wb_t'))}</h1><input type="search" id="wbq" placeholder="${esc(t('wb_search'))}" data-change="wbq" style="max-width:420px"><div class="grid g3" id="wbl" style="margin-top:1rem"></div></section>`;
  const draw=()=>{const q=$('#wbq').value.toLowerCase();const l=ws.filter(w=>!q||(w.name||'').toLowerCase().includes(q)||(w.address||'').toLowerCase().includes(q));
    $('#wbl').innerHTML=l.length?l.map(w=>`<a class="card" href="#/wb/${w.id}" style="text-decoration:none;color:inherit"><div class="ico">💧</div><h3>${esc(w.name||t('unnamed'))}</h3><span class="badge">${esc(t('type_'+w.type))}</span><p class="hint">${esc(w.address||'')}</p><p>${w.reports} ${esc(t('wb_reports'))} · ${w.open_reports} ${esc(t('wb_open'))}</p></a>`).join(''):`<p class="mu">${esc(t(ws.length?'no_results':'none_yet'))}</p>`;};
  changes.wbq=draw;$('#wbq').addEventListener('input',draw);draw();
}
async function wbProfile(id){
  loading();const d=await api('/api/water-bodies/'+id),w=d.waterBody,f=d.fwri;
  const ba=['before','after'].map(k=>d.photos.filter(p=>p.kind===k));
  app.innerHTML=`<section class="container"><div class="row between"><div><span class="badge">${esc(t('type_'+w.type))}</span><h1>${esc(w.name||t('unnamed'))}</h1><p class="mu">${esc(w.address||'')} <span class="mono">${w.lat.toFixed(4)}, ${w.lng.toFixed(4)}</span></p></div><button class="btn ghost sm noprint" onclick="window.print()">🖨 ${esc(t('print'))}</button></div>
   <div class="grid g4"><div class="card stat"><b>${d.reports.length}</b>${esc(t('wb_reports'))}</div><div class="card stat"><b>${d.inspections.length}</b>${esc(t('inspections'))}</div><div class="card stat"><b>${d.actions.length}</b>${esc(t('actions'))}</div><div class="card stat"><b>${d.confirmations}</b>${esc(t('stat_conf'))}</div></div>
   <div class="card" style="margin-top:1rem"><h3>🌿 ${esc(t('fwri_t'))}</h3>${f?`<div class="row between"><b style="font-size:2rem">${f.score}/100</b><span class="badge">${esc(t('lvl_'+f.level))}</span></div><div class="bar" style="margin:.5rem 0"><i style="width:${f.score}%"></i></div><p class="hint">${esc(t('fwri_based',{n:f.count}))}</p>`:`<p class="mu">${esc(t('fwri_none'))}</p>`}<p class="hint">ⓘ ${esc(t('fwri_label'))}</p></div>
   <div class="card" style="margin-top:1rem"><h3>🖼 ${esc(t('wb_ba'))}</h3>${ba[0].length||ba[1].length?`<div class="grid g2"><div><b>${esc(t('before'))}</b><div class="photos">${ba[0].slice(0,6).map(p=>`<figure><img loading="lazy" src="${esc(p.url)}" alt=""><figcaption>${esc(dt(p.created_at))}</figcaption></figure>`).join('')}</div></div><div><b>${esc(t('after'))}</b>${ba[1].length?`<div class="photos">${ba[1].slice(0,6).map(p=>`<figure><img loading="lazy" src="${esc(p.url)}" alt=""><figcaption>${esc(dt(p.created_at))}</figcaption></figure>`).join('')}</div>`:`<p class="mu">${esc(t('none_yet'))}</p>`}</div></div><p class="hint">${esc(t('ba_note'))}</p>`:`<p class="mu">${esc(t('none_yet'))}</p>`}</div>
   <h2 style="margin-top:1.5rem">${esc(t('wb_hist'))}</h2><div class="grid g2" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">${d.reports.length?d.reports.map(repCard).join(''):`<p class="mu">${esc(t('none_yet'))}</p>`}</div>
   <h2 style="margin-top:1.5rem">${esc(t('actions'))}</h2>${d.actions.length?d.actions.map(a=>`<div class="card" style="margin-bottom:.5rem"><span class="hint">${esc(dt(a.created_at))} · <a href="#/r/${esc(a.code)}">${esc(a.code)}</a></span><p>${esc(a.description)}</p></div>`).join(''):`<p class="mu">${esc(t('none_yet'))}</p>`}</section>`;
}

// ---------- news ----------
async function newsPage(tab){
  tab=['open','solved','updates'].includes(tab)?tab:'open';loading();
  const au=state.user&&state.user.role==='authority';
  const tabs=`<div class="row" style="margin:1rem 0">${['open','solved','updates'].map(k=>`<a class="btn ${k===tab?'':'ghost'} sm" href="#/news/${k}">${esc(t('tab_'+k))}</a>`).join('')}</div>`;
  let body='';
  if(tab==='updates'){
    const {news}=await api('/api/news');
    body=(au?`<details class="card" style="margin-bottom:1rem"><summary>${esc(t('post_news'))}</summary><form data-form="news"><label class="f">${esc(t('title'))}</label><input type="text" name="title" required maxlength="150"><label class="f">${esc(t('category'))}</label><select name="category">${opts(CATS,'cat_')}</select><label class="f">${esc(t('body'))}</label><textarea name="body" required maxlength="3000"></textarea><button class="btn" style="margin-top:.6rem">${esc(t('publish'))}</button></form></details>`:'')+
    `<div class="stack">${news.length?news.map(n=>`<article class="card"><div class="row between"><span class="badge">${esc(t('cat_'+n.category))}</span><span class="hint">${esc(dt(n.created_at))}</span></div><h3 style="margin-top:.5rem">${esc(n.title)}</h3><p style="white-space:pre-wrap">${esc(n.body)}</p><div class="row between"><span class="hint">— ${esc(n.author)}</span>${au?`<button class="btn danger sm" data-act="delnews" data-id="${n.id}">🗑</button>`:''}</div></article>`).join(''):`<p class="mu">${esc(t('news_empty'))}</p>`}</div>`;
  }else{
    const f=await api('/api/feed'),list=tab==='open'?f.open:f.solved;
    body=`<p class="mu">${esc(t('feed_sub'))}</p><div class="stack">${list.length?list.map(r=>feedCard(r,tab==='solved')).join(''):`<p class="mu">${esc(t(tab==='open'?'feed_empty_open':'feed_empty_solved'))}</p>`}</div>`;
  }
  app.innerHTML=`<section class="container narrow"><h1>${esc(t('news_t'))}</h1><h3 class="mu">${esc(t('feed_t'))}</h3>${tabs}${body}</section>`;
}
forms.news=async f=>{try{await api('/api/news',{method:'POST',body:{title:f.title.value,category:f.category.value,body:f.body.value}});done(t('published'));}catch(e){toast(errMsg(e),'err');}};
actions.delnews=async el=>{if(!window.confirm(t('confirm_delete')))return;try{await api('/api/news/'+el.dataset.id,{method:'DELETE'});route();}catch(e){toast(errMsg(e),'err');}};

// ---------- authority dashboard / alerts ----------
async function dashPage(){
  loading();const s=await api('/api/admin/stats');
  app.innerHTML=`<section class="container"><div class="row between"><h1>${esc(t('dash_t'))}</h1><a class="btn ghost sm" href="/api/admin/export.csv">⬇ ${esc(t('export_csv'))}</a></div>
   <div class="grid g4">${[['total','d_total'],['pending','d_pending'],['high','d_high'],['inspection','d_insp'],['resolved','d_resolved']].map(([k,l])=>`<div class="card stat"><b>${s[k]}</b>${esc(t(l))}</div>`).join('')}</div>
   <div class="card" style="margin-top:1rem"><div class="row"><div><label class="f">${esc(t('status'))}</label><select id="dS" data-change="dash"><option value="">${esc(t('all'))}</option>${opts(STATUSES,'status_')}</select></div><div><label class="f">${esc(t('priority'))}</label><select id="dP" data-change="dash"><option value="">${esc(t('all'))}</option>${opts(PRIOS,'prio_')}</select></div></div>
   <div class="scroll" style="margin-top:1rem"><table><thead><tr><th>${esc(t('report_id'))}</th><th>${esc(t('wb_t'))}</th><th>${esc(t('observations'))}</th><th>${esc(t('status'))}</th><th>${esc(t('priority'))}</th><th>👥</th><th></th></tr></thead><tbody id="dbody"></tbody></table></div></div></section>`;
  const load=async()=>{const q=new URLSearchParams();if($('#dS').value)q.set('status',$('#dS').value);if($('#dP').value)q.set('priority',$('#dP').value);
    try{const {reports}=await api('/api/admin/reports?'+q);$('#dbody').innerHTML=reports.length?reports.map(r=>`<tr><td class="mono">${esc(r.code)}<br><span class="hint">${esc(dt(r.created_at))}</span></td><td>${esc(wbN(r))}</td><td>${r.issues.map(i=>ICON[i]).join(' ')}</td><td>${stB(r.status)}</td><td>${prB(r.priority)}</td><td>${r.confirmations}</td><td><a class="btn sm" href="#/r/${esc(r.code)}">${esc(t('view'))}</a></td></tr>`).join(''):`<tr><td colspan="7" class="mu">${esc(t('no_results'))}</td></tr>`;}catch(e){toast(errMsg(e),'err');}};
  changes.dash=load;load();
}
async function alertsPage(){
  loading();const {alerts}=await api('/api/admin/alerts');
  app.innerHTML=`<section class="container narrow"><h1>🚨 ${esc(t('alerts_t'))}</h1><div class="stack">${alerts.length?alerts.map(a=>`<a class="card" href="#/r/${esc(a.code)}" style="display:block;text-decoration:none;color:inherit;border-left:4px solid ${PCOL[a.priority]}"><div class="row between"><b>${esc(wbN(a))}</b>${prB(a.priority)}</div><div class="mono hint">${esc(a.code)}</div><div class="chips">${chips(a.issues)}</div><p class="hint">⚠️ ${esc(t('reason_'+a.reason))} · 👥 ${a.confirmations}</p></a>`).join(''):`<p class="mu">${esc(t('alerts_empty'))}</p>`}</div></section>`;
}

// ---------- boot ----------
(async function(){
  try{state.meta=Object.assign(state.meta,await api('/api/config'));}catch{}
  try{state.user=(await api('/api/auth/me')).user;}catch{}
  route();
})();
})();

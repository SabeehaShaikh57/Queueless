/* =====================================================
   QUEUELESS — Main Application Script
   js/app.js

   Table of Contents:
     1.  State Variables
     2.  Backend API Layer (with Demo Fallback)
     3.  Demo Data (works without backend)
     4.  Page Navigation
     5.  Toast Notification System
     6.  Sound Alerts (Web Audio API)
     7.  Auth: Login & Register
     8.  Socket.IO Real-time Setup
     9.  User Dashboard Init
    10.  Browse / Business Cards
    11.  Join Queue Flow
    12.  My Token Card & Live Queue
    13.  Cancel Token
    14.  Notifications (User)
    15.  Queue History
    16.  Profile Management
    17.  Voice Assistant (Web Speech API)
    18.  Admin Dashboard Init
    19.  Admin: Overview & Refresh
    20.  Admin: Queue Management
    21.  Admin: Call Next / Skip / Remove
    22.  Admin: Walk-in Customer
    23.  Admin: Pause / Delay Queue
    24.  Admin: Audio Announcement
    25.  Admin: Businesses
    26.  Admin: Notifications & Broadcast
    27.  Admin: Analytics Charts
    28.  Admin: Services Management
    29.  Utility Functions
    30.  Auto-init on Page Load

   API Endpoints used:
     POST /api/auth/register
     POST /api/auth/login
     GET  /api/business/list
     POST /api/business/create
     POST /api/queue/join
     GET  /api/queue/status/:business_id
     POST /api/queue/next

   NOTE: All API calls fall back to demo data if the
   backend is offline, so the website always works.
===================================================== */

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
const API = (() => {
  const saved = localStorage.getItem('ql_api_base');
  if (saved) return saved.replace(/\/+$/, '');
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
})();
let user = null, loginRole = 'customer', myToken = null;
let bizList = [], qHistory = [], notifs = [], svcs = [];
let paused = false, servedCount = 0;
let pollId = null, adminPollId = null;
let notifyTarget = null;
let socket = null;
let recognition = null, listening = false;
let pendingBiz = null;
let adminHist = [];
let faqPollId = null;

function addAdminHist(bizId, tokenNumber, status, action, avgWait='--') {
  const biz = bizList.find(b => String(b.id) === String(bizId));
  const date = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  adminHist.unshift({
    date,
    business: biz?.name || 'Business',
    total: '1',
    avgWait,
    peakToken: `#${tokenNumber}`,
    status,
    action
  });
  if (adminHist.length > 100) adminHist = adminHist.slice(0, 100);
}

// ═══════════════════════════════════════════
// BACKEND API — with demo fallback
// ═══════════════════════════════════════════
async function api(method, path, body) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    const tok = ls('ql_tok');
    if (tok) opts.headers['Authorization'] = 'Bearer ' + tok;
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(API + path, opts);
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || 'Request failed');
    return { ok: true, data: d };
  } catch(e) {
    return { ok: false, err: e.message, offline: e.message.includes('fetch') };
  }
}

// ═══════════════════════════════════════════
// DEMO DATA — used when backend is offline
// ═══════════════════════════════════════════
const DEMO_BIZ = [
  { id: 1, name: 'Sunrise Clinic', type: 'clinic', location: '12 MG Road, Mumbai', hours: '9am–6pm' },
  { id: 2, name: 'City Salon & Spa', type: 'salon', location: '45 Linking Road, Bandra', hours: '10am–8pm' },
  { id: 3, name: 'QuickCuts Barber', type: 'barber', location: '7 Hill Street, Pune', hours: '8am–7pm' },
  { id: 4, name: 'FreshMart Grocery', type: 'grocery', location: '90 MG Road, Bangalore', hours: '7am–10pm' },
  { id: 5, name: 'MediCare Pharmacy', type: 'pharmacy', location: '3 Park Street, Kolkata', hours: '8am–9pm' },
  { id: 6, name: 'State Bank Branch', type: 'bank', location: '1 Connaught Place, Delhi', hours: '10am–4pm' },
];

// In-memory demo queue store
const demoQueues = {
  1: [
    { id: 1, token_number: 12, status: 'waiting', created_at: new Date(Date.now()-1800000) },
    { id: 2, token_number: 13, status: 'waiting', created_at: new Date(Date.now()-1500000) },
    { id: 3, token_number: 14, status: 'waiting', created_at: new Date(Date.now()-1200000) },
    { id: 4, token_number: 15, status: 'waiting', created_at: new Date(Date.now()-900000) },
    { id: 5, token_number: 16, status: 'waiting', created_at: new Date(Date.now()-600000) },
  ],
  2: [
    { id: 10, token_number: 5, status: 'waiting', created_at: new Date(Date.now()-900000) },
    { id: 11, token_number: 6, status: 'waiting', created_at: new Date(Date.now()-600000) },
    { id: 12, token_number: 7, status: 'waiting', created_at: new Date(Date.now()-300000) },
  ],
  3: [
    { id: 20, token_number: 3, status: 'waiting', created_at: new Date(Date.now()-600000) },
    { id: 21, token_number: 4, status: 'waiting', created_at: new Date(Date.now()-300000) },
  ],
  4: [], 5: [], 6: [],
};

let demoTokenCounter = { 1:17, 2:8, 3:5, 4:1, 5:1, 6:1 };

async function getBiz() {
  const r = await api('GET', '/business/list');
  if (r.ok) { bizList = r.data; return bizList; }
  bizList = [...DEMO_BIZ]; return bizList;
}

async function getQueue(bizId) {
  const r = await api('GET', `/queue/status/${bizId}`);
  if (r.ok) return r.data;
  return demoQueues[bizId] || [];
}

async function joinQueue(bizId, customerName, service) {
  const r = await api('POST', '/queue/join', { business_id: bizId });
  if (r.ok) return { ok: true, token: r.data.token };
  // Demo: add to local queue — include customer name & service so admin sees them
  const next = demoTokenCounter[bizId] || 1;
  demoTokenCounter[bizId] = next + 1;
  if (!demoQueues[bizId]) demoQueues[bizId] = [];
  demoQueues[bizId].push({
    id: Date.now(),
    token_number: next,
    status: 'waiting',
    created_at: new Date(),
    customerName: customerName || 'Customer',
    service: service || 'General'
  });
  return { ok: true, token: next };
}

async function callNextApi(bizId) {
  const r = await api('POST', '/queue/next', { business_id: bizId });
  if (r.ok) {
    if (!r.data || !r.data.served) return { ok: false, empty: true };
    return { ok: true, served: r.data.served };
  }
  // Demo
  const q = demoQueues[bizId] || [];
  if (!q.length) return { ok: false, empty: true };
  const first = q.shift();
  return { ok: true, served: first.token_number };
}

async function doCreateBiz(name, type, location, hours) {
  const r = await api('POST', '/business/create', { name, type, location });
  if (r.ok) return true;
  // Demo: add locally
  const newId = Math.max(...DEMO_BIZ.map(b=>b.id), 0) + 1;
  DEMO_BIZ.push({ id: newId, name, type, location, hours: hours||'' });
  bizList = [...DEMO_BIZ];
  demoQueues[newId] = [];
  demoTokenCounter[newId] = 1;
  return true;
}

async function doLogin(email, pw) {
  const r = await api('POST', '/auth/login', { email, password: pw });
  if (r.ok) return { ok: true, token: r.data.token };
  // Demo login — always works
  const fakeToken = btoa(JSON.stringify({ id: Date.now(), email })) + '.demo.sig';
  return { ok: true, token: fakeToken, demo: true };
}

async function doRegisterApi(name, email, pw) {
  const r = await api('POST', '/auth/register', { name, email, password: pw });
  if (r.ok) return { ok: true };
  // Demo — always works
  return { ok: true, demo: true };
}

// ═══════════════════════════════════════════
// PAGE NAVIGATION
// ═══════════════════════════════════════════
function sp(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
  document.getElementById('vf').style.display = id === 'page-user' ? 'flex' : 'none';
  if (id === 'page-user') initUserDash();
  if (id === 'page-admin') initAdminDash();
}

// Helpers
function ls(k, v) { if (v===undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }
function lsr(k) { localStorage.removeItem(k); }
function esc(s) { return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtTime(ts) { try { return new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); } catch(e){return '—';} }
function timeAgo(d) { const s=Math.floor((Date.now()-new Date(d))/1000); if(s<60)return 'just now'; if(s<3600)return Math.floor(s/60)+'m ago'; return Math.floor(s/3600)+'h ago'; }
function om(id) { document.getElementById(id).classList.add('open'); }
function cm(id) { document.getElementById(id).classList.remove('open'); }

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
function toast(type, title, msg='', dur=4200) {
  const icons = { s:'✅', e:'❌', w:'⚠️', i:'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast t${type}`;
  el.innerHTML = `<span class="ti2">${icons[type]||'📢'}</span><div class="tb"><strong>${esc(title)}</strong>${msg?`<span>${esc(msg)}</span>`:''}</div><button class="tc2" onclick="this.closest('.toast').remove()">✕</button>`;
  document.getElementById('tc').appendChild(el);
  if (type==='s'||type==='w') chime(type);
  setTimeout(()=>{ el.style.animation='tIn .3s reverse'; setTimeout(()=>el.remove(),300); }, dur);
}
function chime(t) {
  try { const c=new(window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain(); o.connect(g);g.connect(c.destination); o.frequency.value=t==='s'?880:440; g.gain.setValueAtTime(.08,c.currentTime); g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.4); o.start();o.stop(c.currentTime+.4); } catch(e){}
}

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════
function setRole(r) {
  loginRole = r;
  document.getElementById('lt-c').classList.toggle('active', r==='customer');
  document.getElementById('lt-a').classList.toggle('active', r==='admin');
}

async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pw = document.getElementById('l-pw').value;
  if (!email || !pw) return toast('w','Missing fields','Enter email and password.');
  const btn = document.getElementById('l-btn');
  btn.disabled=true; btn.innerHTML='<span class="sp"></span> Signing in…';
  const r = await doLogin_api(email, pw);
  btn.disabled=false; btn.innerHTML='Sign In';
  if (!r.ok) return toast('e','Login Failed', r.err||'Try again.');
  ls('ql_tok', r.token);
  const name = email.split('@')[0];
  user = { id: Date.now(), email, name, phone:'', role: loginRole };
  ls('ql_user', JSON.stringify(user));
  toast('s','Welcome back, '+name+'!');
  initSocket();
  if (loginRole==='admin') sp('page-admin');
  else sp('page-user');
}

// wrapper to avoid name collision
async function doLogin_api(email, pw) { return doLogin(email, pw); }

// Override to fix name
(function(){
  const orig = doLogin;
  window.doLogin = async function() {
    const email = document.getElementById('l-email').value.trim();
    const pw = document.getElementById('l-pw').value;
    if (!email || !pw) return toast('w','Missing fields','Enter email and password.');
    const btn = document.getElementById('l-btn');
    btn.disabled=true; btn.innerHTML='<span class="sp"></span> Signing in…';
    const r = await api('POST','/auth/login',{email,password:pw});
    let token;
    if (r.ok) { token = r.data.token; }
    else {
      // Demo mode — always succeed
      token = btoa(JSON.stringify({id:Date.now(),email})) + '.demo';
      toast('i','Demo Mode','Backend offline — using demo data.');
    }
    btn.disabled=false; btn.innerHTML='Sign In';
    ls('ql_tok', token);
    const name = email.split('@')[0];
    user = { id: Date.now(), email, name, phone:'', role: loginRole };
    ls('ql_user', JSON.stringify(user));
    toast('s','Welcome, '+name+'!');
    initSocket();
    if (loginRole==='admin') sp('page-admin');
    else sp('page-user');
  };
})();

async function doRegister() {
  const name = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim();
  const phone = document.getElementById('r-phone').value.trim();
  const pw = document.getElementById('r-pw').value;
  if (!name||!email||!pw) return toast('w','Missing fields');
  if (pw.length<6) return toast('w','Weak password','Min 6 characters.');
  const btn = document.getElementById('r-btn');
  btn.disabled=true; btn.innerHTML='<span class="sp"></span> Creating…';
  const r = await api('POST','/auth/register',{name,email,password:pw});
  btn.disabled=false; btn.innerHTML='Create Account';
  if (!r.ok && !r.offline) return toast('e','Failed',r.err);
  toast('s','Account created!','You can now sign in.');
  sp('page-login');
}

function logout() {
  lsr('ql_tok'); lsr('ql_user');
  user=null; myToken=null;
  clearInterval(pollId); clearInterval(adminPollId);
  if(socket){socket.disconnect();socket=null;}
  toast('i','Signed out.');
  sp('page-landing');
}

// ═══════════════════════════════════════════
// SOCKET
// ═══════════════════════════════════════════
function initSocket() {
  try {
    if (typeof io === 'undefined') return;
    const socketBase = (window.location.protocol === 'http:' || window.location.protocol === 'https:')
      ? `${window.location.protocol}//${window.location.hostname}:5000`
      : 'http://localhost:5000';
    socket = io(socketBase,{transports:['websocket','polling'],timeout:3000});
    socket.on('connect',()=>console.log('🔌 Socket connected'));
    socket.on('queue_update',d=>{
      if(myToken && String(d.business_id)===String(myToken.bizId)) refreshMyQueue();
      if(document.getElementById('page-admin').classList.contains('active')) aRefresh();
    });
    socket.on('notification',d=>{
      addNotif('📣',d.title||'Message',d.message,'i');
      toast('i',d.title||'Notification',d.message);
    });
    socket.on('queue_paused',d=>{ addNotif('🚫','Service Paused',d.reason||'','w'); toast('w','🚫 Queue Paused',d.reason||''); });
    socket.on('queue_delayed',d=>{ addNotif('⏱️',`Delayed ${d.mins}min`,d.reason||'','w'); toast('w',`Queue Delayed ${d.mins}min`,d.reason||''); });
    socket.on('faq_submitted', raw => {
      const entry = normalizeFaq(raw);
      if (!entry) return;
      upsertFaq(entry);
      renderFaqList();
      renderAdminFaqList();
      updateFaqBadges();
    });
    socket.on('faq_answered', raw => {
      const entry = normalizeFaq(raw);
      if (!entry) return;
      upsertFaq(entry);
      renderFaqList();
      renderAdminFaqList();
      updateFaqBadges();
      const ub = document.getElementById('u-faqbadge');
      if (ub && user?.role !== 'admin') { ub.style.display='inline'; ub.textContent='!'; }
    });
  } catch(e){}
}

// ═══════════════════════════════════════════
// USER DASHBOARD
// ═══════════════════════════════════════════
const uTabs = {
  home:['Home','Your queue activity at a glance'],
  browse:['Browse Services','Find a business and join their queue'],
  token:['My Token','Your current queue position'],
  notifs:['Notifications','Updates and alerts'],
  history:['Queue History','Your past visits'],
  profile:['Profile','Manage your account'],
  faq:['Live FAQ','Ask questions — admin answers live']
};

function ut(tab, el) {
  document.querySelectorAll('#page-user .tv').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#page-user .ni').forEach(n=>n.classList.remove('active'));
  document.getElementById('u-'+tab).classList.add('active');
  if(el) el.classList.add('active');
  else document.querySelectorAll('#page-user .ni').forEach(n=>{ if(n.dataset.t===tab) n.classList.add('active'); });
  const t=uTabs[tab]||[tab,''];
  document.getElementById('u-ttl').textContent=t[0];
  document.getElementById('u-sub').textContent=t[1];
  if(tab==='browse') loadBizGrid();
  if(tab==='notifs'){renderNotifs();markRead();}
  if(tab==='history') renderHistory();
  if(tab==='profile') renderProfile();
  if(tab==='faq'){ renderFaqList(); document.getElementById('u-faqbadge').style.display='none'; }
}

function initUserDash() {
  if (!user) return;
  const init = (user.name||user.email)[0].toUpperCase();
  document.getElementById('u-av').textContent = init;
  document.getElementById('u-nm').textContent = user.name||user.email;
  document.getElementById('u-sub').textContent = 'Welcome, '+user.name+'!';
  initDefaultSvcs();
  populateJoinSvc();
  loadBizGrid();
  if(myToken){ renderTokenCard(); refreshMyQueue(); startPoll(); }
  renderHistory();
  loadFaqSession();
  clearInterval(faqPollId);
  faqPollId = setInterval(loadFaqSession, 7000);
}

// ═══════════════════════════════════════════
// BROWSE / BIZ CARDS
// ═══════════════════════════════════════════
const ICONS = {clinic:'🏥',hospital:'🏥',salon:'💇',beauty:'💅',barber:'✂️',grocery:'🛒',pharmacy:'💊',bank:'🏦',service:'🔧',other:'📦'};

async function loadBizGrid() {
  const g = document.getElementById('u-bizgrid');
  g.innerHTML = '<div class="es"><span class="sp"></span><p>Loading…</p></div>';
  await getBiz();
  populateLocationFilter();
  filterBizByLocation();
}

function populateLocationFilter() {
  const sel = document.getElementById('u-loc-filter');
  if (!sel) return;
  // Extract unique cities from business locations
  const cities = [...new Set(bizList.map(b => {
    const loc = b.location || '';
    // Get city part — everything after last comma, or whole string
    const parts = loc.split(',');
    return parts.length > 1 ? parts[parts.length - 1].trim() : loc.trim();
  }).filter(Boolean))].sort();
  const current = sel.value;
  sel.innerHTML = '<option value="">All Locations</option>' +
    cities.map(c => `<option value="${esc(c)}" ${c===current?'selected':''}>${esc(c)}</option>`).join('');
}

function filterBizByLocation() {
  const loc  = (document.getElementById('u-loc-filter')?.value || '').toLowerCase().trim();
  const type = (document.getElementById('u-svc-filter')?.value || '').toLowerCase().trim();
  const q    = (document.getElementById('u-srch')?.value || '').toLowerCase().trim();
  const hint = document.getElementById('u-loc-hint');
  const hintName = document.getElementById('u-loc-hint-name');
  let f = bizList;
  if (loc) {
    f = f.filter(b => (b.location||'').toLowerCase().includes(loc));
    if (hint && hintName) { hint.style.display='block'; hintName.textContent = document.getElementById('u-loc-filter').options[document.getElementById('u-loc-filter').selectedIndex].text; }
  } else {
    if (hint) hint.style.display='none';
  }
  if (type) f = f.filter(b => (b.type||'').toLowerCase() === type);
  if (q)    f = f.filter(b => (b.name+b.type+(b.location||'')).toLowerCase().includes(q));
  renderBizGrid(f);
}

function renderBizGrid(list) {
  const g = document.getElementById('u-bizgrid');
  if(!list.length){g.innerHTML='<div class="es"><span class="ei">🏢</span><p>No businesses found.</p></div>';return;}
  g.innerHTML = list.map(b=>{
    const q = demoQueues[b.id] || [];
    const qLen = q.length;
    const wait = qLen*5;
    const pct = Math.min((qLen/20)*100,100);
    return `<div class="bc" onclick="openJoinModal('${String(b.id)}')">
      <div class="bc-top">
        <div class="biw ${b.type||'other'}">${ICONS[b.type]||'📦'}</div>
        <div class="bm">
          <div class="bn">${esc(b.name)}</div>
          <div class="bt">${esc(b.type||'Business')}</div>
          <div class="ba">📍 ${esc(b.location||'Address not set')}</div>
        </div>
      </div>
      <div class="bc-mid">
        <div class="bs"><div class="bsl">Queue</div><div class="bsv ${qLen>8?'wr':''}">${qLen} people</div></div>
        <div class="bs"><div class="bsl">Est. Wait</div><div class="bsv">${wait} min</div></div>
      </div>
      <div class="bc-ft">
        <div class="qbar"><div class="qbl">Queue load</div><div class="qbt"><div class="qbf" style="width:${pct}%"></div></div></div>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openJoinModal('${String(b.id)}')">Join Queue</button>
      </div>
    </div>`;
  }).join('');
}

function openJoinModal(bizId, bizName, bizType) {
  if(myToken){
    toast('w','Already in Queue',`You have Token #${myToken.tokenNum} at ${myToken.bizName}.`);
    ut('token',null); return;
  }
  if (!bizName || !bizType) {
    const b = bizList.find(x => String(x.id) === String(bizId));
    bizName = b?.name || 'Business';
    bizType = b?.type || 'other';
  }
  pendingBiz = {id:bizId, name:bizName, type:bizType};
  document.getElementById('mj-title').textContent = `${ICONS[bizType]||'🏢'} Join — ${bizName}`;
  document.getElementById('mj-sub').textContent = `You're joining the queue at ${bizName}.`;
  document.getElementById('mj-contact').value = user?.phone||user?.email||'';
  populateJoinSvc(bizType);
  om('mo-join');
}

function populateJoinSvc(type) {
  const sel = document.getElementById('mj-svc');
  const svcsMap = {
    clinic:['General Consultation','Blood Test','Vaccination','Check-up'],
    salon:['Haircut','Facial','Hair Color','Manicure'],
    barber:['Haircut','Beard Trim','Shave','Hair Wash'],
    grocery:['Regular Shopping','Pickup Order','Returns'],
    pharmacy:['Prescription Refill','Consultation','OTC Purchase'],
    bank:['Account Opening','Deposit/Withdrawal','Loan Inquiry','Other'],
  };
  const opts = (svcsMap[type]||['General Service','Walk-in']).map(s=>`<option>${s}</option>`).join('');
  sel.innerHTML = opts;
}

async function confirmJoin() {
  if(!pendingBiz) return;
  const svc = document.getElementById('mj-svc').value;
  const btn = document.getElementById('mj-btn');
  btn.disabled=true; btn.innerHTML='<span class="sp"></span>';
  // Pass user name + service so admin sees them in queue management
  const customerName = user?.name || user?.email || 'Customer';
  const r = await joinQueue(pendingBiz.id, customerName, svc);
  btn.disabled=false; btn.innerHTML='Join Queue';
  if(!r.ok) return toast('e','Failed to join',r.err);
  myToken = { tokenNum: r.token, bizId: pendingBiz.id, bizName: pendingBiz.name, service: svc, joinedAt: new Date(), lastAlertPos: -99 };
  cm('mo-join');
  toast('s',`Queue Joined! 🎫`,`Token #${r.token} — ${pendingBiz.name}`);
  addNotif('🎫','Queue Joined',`Token #${r.token} at ${pendingBiz.name}. Service: ${svc}`,'s');
  document.getElementById('u-tokbadge').style.display='inline';
  qHistory.unshift({business:pendingBiz.name, service:svc, token:r.token, date:new Date().toLocaleDateString('en-IN'), time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), status:'Waiting'});
  renderHistory();
  renderTokenCard();
  refreshMyQueue();
  startPoll();
  ut('token',null);
  pendingBiz = null;
}

// ═══════════════════════════════════════════
// MY TOKEN
// ═══════════════════════════════════════════
function renderTokenCard() {
  if(!myToken) return;
  document.getElementById('u-tokcontent').innerHTML = `
    <div class="th" style="margin-bottom:16px">
      <div class="thi">
        <div class="tnw"><div class="tnl">Token Number</div><div class="tn">#${myToken.tokenNum}</div></div>
        <div class="tdw">
          <div class="tbn">📍 ${esc(myToken.bizName)}</div>
          <div style="color:rgba(255,255,255,.6);font-size:.82rem;margin-top:3px">🛎️ ${esc(myToken.service)}</div>
          <div class="tdr">
            <div class="td"><div class="tdl">Position</div><div class="tdv" id="tk-pos">—</div></div>
            <div class="td"><div class="tdl">Est. Wait</div><div class="tdv" id="tk-wait">—</div></div>
            <div class="td"><div class="tdl">Joined</div><div class="tdv" style="font-size:.85rem">${myToken.joinedAt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>
          </div>
          <div class="tsr">
            <div class="csn"><span>Currently Serving:</span><strong id="tk-srv">—</strong></div>
            <button class="btn btn-danger btn-sm" onclick="cancelToken()" style="background:rgba(239,68,68,.25);border:1px solid rgba(239,68,68,.4);color:#fca5a5">🚪 Cancel Token</button>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-hd"><h3>📡 Live Queue — ${esc(myToken.bizName)}</h3><span class="ltag"><span class="ldot"></span> Live</span></div>
      <div class="scroll-x"><table class="tbl2"><thead><tr><th>#</th><th>Token</th><th>Status</th><th>Waiting Since</th></tr></thead><tbody id="tk-qtbody"></tbody></table></div>
    </div>`;
}

async function refreshMyQueue() {
  if(!myToken) return;
  const q = await getQueue(myToken.bizId);

  // Find this customer's token in the queue
  const pos = q.findIndex(t=>String(t.token_number)===String(myToken.tokenNum));

  // Check if admin updated the status of this customer's token
  const myEntry = q.find(t=>String(t.token_number)===String(myToken.tokenNum));
  const adminStatus = myEntry ? myEntry.status : (pos === -1 ? 'completed' : 'waiting');

  // Sync admin status change → customer history (only once per status change)
  if (adminStatus !== myToken.lastAdminStatus) {
    myToken.lastAdminStatus = adminStatus;
    if (adminStatus === 'serving') {
      const h = qHistory.find(h=>h.token===myToken.tokenNum && h.business===myToken.bizName);
      if (h) h.status = 'Serving';
      renderHistory();
      addNotif('🟡','You Are Being Served',`Token #${myToken.tokenNum} — please proceed to the counter.`,'i');
      toast('i','🟡 Being Served',`Token #${myToken.tokenNum} — go to counter.`);
    }
    if (adminStatus === 'completed') {
      const h = qHistory.find(h=>h.token===myToken.tokenNum && h.business===myToken.bizName);
      if (h) h.status = 'Completed';
      renderHistory();
      addNotif('✅','Visit Completed',`Your visit at ${myToken.bizName} has been marked complete.`,'s');
      toast('s','✅ Visit Completed',`Thank you for visiting ${myToken.bizName}.`);
      chime('s');
      // Clear active token
      const old = myToken; myToken = null;
      clearInterval(pollId);
      document.getElementById('u-tokbadge').style.display='none';
      document.getElementById('u-tokcontent').innerHTML='<div class="card"><div class="card-bd"><div class="es"><span class="ei">✅</span><p><strong>Visit completed!</strong><br>Thank you. Your visit has been marked complete by the business.</p><button class="btn btn-primary" style="margin-top:14px" onclick="ut(\'browse\',null)">Browse Services</button></div></div></div>';
      updateHomeStats(null);
      return;
    }
  }

  // Update position display
  const posEl=document.getElementById('tk-pos'), waitEl=document.getElementById('tk-wait'), srvEl=document.getElementById('tk-srv');
  if(posEl) posEl.textContent = pos<0?'✅ Served':pos===0?'Next!':pos+' ahead';
  if(waitEl) waitEl.textContent = pos<=0?(pos===0?'Your turn!':'✅'):`~${pos*5} min`;
  if(srvEl && q[0]) srvEl.textContent = `Token #${q[0].token_number}`;

  // Fire "Almost Your Turn" alert ONCE only (when position reaches 1)
  if(pos===1 && myToken.lastAlertPos !== 1){
    myToken.lastAlertPos = 1;
    addNotif('⏰','Almost Your Turn!',`Token #${myToken.tokenNum} is next. Get ready!`,'w');
    toast('w','⏰ Almost Your Turn!','Get ready — you\'re next!');
    chime('w');
  }
  // Fire "It's Your Turn" alert ONCE only (when position reaches 0)
  if(pos===0 && myToken.lastAlertPos !== 0){
    myToken.lastAlertPos = 0;
    addNotif('🎉',"It's Your Turn!",`Token #${myToken.tokenNum} — please proceed to the counter.`,'s');
    toast('s',"🎉 It's Your Turn!",'Proceed to counter.');
    chime('s');
  }

  // Update queue table in My Token tab
  const tb=document.getElementById('tk-qtbody');
  if(tb){
    if(!q.length){tb.innerHTML='<tr><td colspan="4"><div class="es"><span class="ei">✅</span><p>Queue empty.</p></div></td></tr>';return;}
    tb.innerHTML=q.map((item,i)=>{
      const me=String(item.token_number)===String(myToken.tokenNum);
      const stClass = item.status==='serving'?'bg-blue':(item.status==='completed'?'bg-green':'bg-warn');
      const stLabel = item.status==='serving'?'Serving':(item.status==='completed'?'Completed':'Waiting');
      return `<tr class="${me?'myr':''}${item.status==='serving'?' svr':''}">
        <td>${i+1}</td>
        <td><span class="tp ${item.status==='serving'?'sv':''} ${me?'mn2':''}">#${item.token_number}</span>${me?` <span class="badge bg-blue">You</span>`:''}</td>
        <td><span class="badge ${stClass}">${stLabel}</span></td>
        <td>${fmtTime(item.created_at)}</td>
      </tr>`;
    }).join('');
  }
  // Update home stats
  updateHomeStats(q);
}

function updateHomeStats(q) {
  if(!myToken){
    document.getElementById('uh-tok').textContent='—';
    document.getElementById('uh-biz').textContent='No active token';
    document.getElementById('uh-pos').textContent='—';
    document.getElementById('uh-wt').textContent='—';
    document.getElementById('uh-srv').textContent='—';
    document.getElementById('uh-empty').style.display='block';
    document.getElementById('uh-livecard').style.display='none';
    return;
  }
  document.getElementById('uh-tok').textContent=`#${myToken.tokenNum}`;
  document.getElementById('uh-biz').textContent=myToken.bizName;
  document.getElementById('uh-empty').style.display='none';
  document.getElementById('uh-livecard').style.display='block';
  document.getElementById('uh-livebiz').textContent=myToken.bizName;
  if(q){
    const pos=q.findIndex(t=>String(t.token_number)===String(myToken.tokenNum));
    document.getElementById('uh-pos').textContent=pos<0?'✅':(pos===0?'Next!':pos);
    document.getElementById('uh-wt').textContent=pos<=0?(pos===0?'Now':'✅'):`${pos*5}m`;
    if(q[0]) document.getElementById('uh-srv').textContent=`#${q[0].token_number}`;
    const tb=document.getElementById('uh-qtbody');
    if(tb){
      const svcs2=['Consultation','Blood Test','Vaccination','Haircut','Facial','Walk-in'];
      tb.innerHTML=q.slice(0,10).map((item,i)=>{
        const me=String(item.token_number)===String(myToken.tokenNum);
        return `<tr class="${me?'myr':''}${i===0?' svr':''}">
          <td>${i+1}</td>
          <td><span class="tp ${i===0?'sv':''} ${me?'mn2':''}">#${item.token_number}</span>${me?` <span class="badge bg-blue" style="margin-left:5px">You</span>`:''}</td>
          <td><span class="badge bg-gray">${svcs2[i%svcs2.length]}</span></td>
          <td><span class="badge ${i===0?'bg-green':'bg-warn'}">${i===0?'Serving':'Waiting'}</span></td>
          <td>${i===0?'Now':`~${i*5}m`}</td>
        </tr>`;
      }).join('');
    }
  }
}

function cancelToken() {
  if(!myToken) return;
  const old=myToken; myToken=null;
  clearInterval(pollId);
  // Remove from demo queue
  const q=demoQueues[old.bizId]||[];
  const idx=q.findIndex(t=>String(t.token_number)===String(old.tokenNum));
  if(idx>-1) q.splice(idx,1);
  // Update history
  const h=qHistory.find(h=>h.token===old.tokenNum&&h.business===old.bizName);
  if(h) h.status='Cancelled';
  document.getElementById('u-tokcontent').innerHTML='<div class="card"><div class="card-bd"><div class="es"><span class="ei">🎫</span><p><strong>No token yet.</strong><br>Browse services to join a queue.</p><button class="btn btn-primary" style="margin-top:14px" onclick="ut(\'browse\',null)">Browse Services</button></div></div></div>';
  document.getElementById('u-tokbadge').style.display='none';
  addNotif('🚫','Token Cancelled',`Token #${old.tokenNum} at ${old.bizName} cancelled.`,'w');
  toast('i','Token Cancelled',`You've left the queue at ${old.bizName}.`);
  updateHomeStats(null);
  renderHistory();
}

function startPoll() {
  clearInterval(pollId);
  pollId=setInterval(()=>{ if(myToken) refreshMyQueue(); },5000);
}

// ═══════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════
function addNotif(icon,title,body,type='i'){
  notifs.unshift({icon,title,body,type,time:new Date(),unread:true});
  const c=notifs.filter(n=>n.unread).length;
  const badge=document.getElementById('u-notbadge'), dot=document.getElementById('u-rdot');
  if(badge){badge.textContent=c;badge.style.display=c?'inline':'none';}
  if(dot) dot.style.display=c?'block':'none';
}

function renderNotifs(){
  const el=document.getElementById('u-nlist');
  if(!el) return;
  if(!notifs.length){el.innerHTML='<div class="es"><span class="ei">🔔</span><p>No notifications.</p></div>';return;}
  const bg={s:'background:var(--green-lt)',w:'background:var(--warn-lt)',e:'background:var(--danger-lt)',i:'background:var(--accent-lt)'};
  el.innerHTML=notifs.map(n=>`
    <div class="nl-item ${n.unread?'unread':''}">
      <div class="ni2" style="${bg[n.type]||''}">${n.icon}</div>
      <div class="nb2"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p></div>
      <span class="nt">${timeAgo(n.time)}</span>
    </div>`).join('');
}

function markRead(){ notifs.forEach(n=>n.unread=false); document.getElementById('u-notbadge').style.display='none'; document.getElementById('u-rdot').style.display='none'; }
function clearNotifs(){ notifs=[]; renderNotifs(); markRead(); toast('i','Notifications cleared.'); }

// ═══════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════
function renderHistory(){
  const tb=document.getElementById('u-histbody');
  if(!tb) return;
  const allH=[...qHistory,
    {business:'Sunrise Clinic',service:'General Consultation',token:21,date:'12/03/2026',time:'10:30 AM',status:'Completed'},
    {business:'City Salon',service:'Haircut',token:8,date:'10/03/2026',time:'3:15 PM',status:'Completed'},
    {business:'QuickCuts',service:'Beard Trim',token:14,date:'05/03/2026',time:'11:00 AM',status:'Cancelled'},
  ];
  if(!allH.length){tb.innerHTML='<tr><td colspan="5"><div class="es"><span class="ei">📋</span><p>No history yet.</p></div></td></tr>';return;}
  const map={'Completed':'bg-green','Waiting':'bg-warn','Serving':'bg-blue','Cancelled':'bg-red'};
  tb.innerHTML=allH.map(h=>`<tr>
    <td><strong>${esc(h.business)}</strong></td>
    <td>${esc(h.service)}</td>
    <td><span class="tp">#${h.token}</span></td>
    <td>${h.date}${h.time?' · '+h.time:''}</td>
    <td><span class="badge ${map[h.status]||'bg-gray'}">${h.status}</span></td>
  </tr>`).join('');
  document.getElementById('p-joined').textContent=allH.length;
  document.getElementById('p-saved').textContent=allH.filter(h=>h.status==='Completed').length*20+'m';
}

// ═══════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════
function renderProfile(){
  if(!user) return;
  const init=(user.name||user.email)[0].toUpperCase();
  document.getElementById('u-pinit').textContent=init;
  document.getElementById('p-name').textContent=user.name||'—';
  document.getElementById('p-email').textContent=user.email||'—';
  document.getElementById('p-phone').textContent=user.phone||'No phone added';
}
function openEditProfile(){
  document.getElementById('ep-name').value=user?.name||'';
  document.getElementById('ep-email').value=user?.email||'';
  document.getElementById('ep-phone').value=user?.phone||'';
  om('mo-profile');
}
function saveProfile(){
  const name=document.getElementById('ep-name').value.trim();
  const email=document.getElementById('ep-email').value.trim();
  const phone=document.getElementById('ep-phone').value.trim();
  if(!name||!email) return toast('w','Name and email required.');
  user={...user,name,email,phone};
  ls('ql_user',JSON.stringify(user));
  document.getElementById('u-nm').textContent=name;
  document.getElementById('u-av').textContent=name[0].toUpperCase();
  renderProfile(); cm('mo-profile'); toast('s','Profile updated!');
}
function uploadPhoto(inp){
  const f=inp.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=e=>{
    const img=document.getElementById('u-pimg');
    img.src=e.target.result; img.style.display='block';
    document.getElementById('u-pinit').style.display='none';
  };
  r.readAsDataURL(f); toast('s','Photo updated!');
}

// ═══════════════════════════════════════════
// VOICE ASSISTANT — Multilingual Advanced
// ═══════════════════════════════════════════
let voiceLang = 'en-US';
let voiceLangName = 'English';

// ─────────────────────────────────────────────────────────────
// VOICE COMMANDS — comprehensive multi-language command maps
// covering every feature the website supports
// ─────────────────────────────────────────────────────────────
const VOICE_CMDS = {
  'en-US': {
    join:       ['join','book','appointment','queue up','join queue','get in line','enter queue','join the line','join a queue','join queue for','book appointment'],
    cancel:     ['cancel','leave queue','exit queue','remove me','leave','get out','cancel token','cancel my token','leave the queue','remove token'],
    position:   ['position','status','my turn','where am i','my position','how many ahead','wait time','how long','my token','token status','check position','queue status','am i next'],
    notifs:     ['notification','notifications','alerts','show alerts','show notifications','open notifications','my alerts'],
    home:       ['home','dashboard','main','go home','go to home','back home','main page','open home','show home'],
    profile:    ['profile','account','my account','my profile','open profile','show profile','edit profile','settings'],
    history:    ['history','past','previous','my history','queue history','past visits','show history','visit history'],
    browse:     ['browse','services','browse services','find services','all services','show services','open browse','search services','available services','find a business','show businesses'],
    faq:        ['faq','question','ask','help','ask a question','live faq','open faq','support','i have a question','i need help'],
    search:     ['search for','find','look for','search','where is','locate','find me'],
    waittime:   ['wait time','how long is the wait','estimated wait','how many minutes','eta','time remaining'],
    token:      ['my token','show token','token','show my token','open token','go to token'],
    clinic:     ['clinic','doctor','medical','hospital','health','checkup','consultation'],
    salon:      ['salon','spa','beauty','hair','haircut','facial','manicure'],
    barber:     ['barber','barber shop','beard','shave','trim','cut'],
    pharmacy:   ['pharmacy','medicine','prescription','drug store','medical store','chemist'],
    bank:       ['bank','banking','deposit','withdrawal','loan','account opening'],
    grocery:    ['grocery','groceries','supermarket','shopping','fresh mart'],
    responses:{
      join:       'Opening Browse Services. Select a location and service.',
      cancel:     'Your token has been cancelled.',
      noToken:    'You have no active token. Browse services to join a queue.',
      cantCancel: 'No active token to cancel.',
      notifOpen:  'Opening your notifications.',
      homeOpen:   'Going to home.',
      profileOpen:'Opening your profile.',
      historyOpen:'Opening your queue history.',
      browseOpen: 'Opening Browse Services.',
      faqOpen:    'Opening Live FAQ. You can ask any question here.',
      tokenOpen:  'Opening your token.',
      unknown:    'Command not recognised. You can say: join queue, cancel token, my position, go home, browse services, notifications, history, or ask a question.',
    }
  },
  'hi-IN': {
    join:       ['जोड़ो','queue','अपॉइंटमेंट','बुक करो','लाइन में जोड़ो','कतार में जोड़ो','queue join','शामिल हो','बुक','join करो'],
    cancel:     ['रद्द','cancel','छोड़ो','निकलो','टोकन रद्द','queue छोड़ो','हटाओ','बाहर निकलो'],
    position:   ['position','स्थिति','मेरी बारी','कहाँ हूँ','कितने लोग','प्रतीक्षा समय','कब आएगी बारी','मेरा टोकन','queue status'],
    notifs:     ['notification','सूचना','अलर्ट','नोटिफिकेशन','सूचनाएं दिखाओ'],
    home:       ['home','होम','मुख्य','dashboard','घर','मुख्य पेज','होम पर जाओ'],
    profile:    ['profile','प्रोफाइल','खाता','मेरा खाता','अकाउंट','सेटिंग'],
    history:    ['history','इतिहास','पुराना','पिछली विज़िट','पुरानी queue','visit history'],
    browse:     ['browse','सेवाएं','services','सेवाएं दिखाओ','खोजो','ढूंढो','व्यवसाय','business खोजो'],
    faq:        ['faq','सवाल','पूछो','help','मदद','सपोर्ट','प्रश्न','सहायता'],
    search:     ['ढूंढो','खोजो','search','कहाँ है','locate','find'],
    waittime:   ['कितना समय','प्रतीक्षा','wait time','कब तक','कितनी देर'],
    token:      ['मेरा टोकन','टोकन दिखाओ','token','my token'],
    clinic:     ['clinic','डॉक्टर','hospital','चिकित्सा','स्वास्थ्य','जांच','परामर्श'],
    salon:      ['salon','सैलून','beauty','बाल','haircut','facial'],
    barber:     ['barber','नाई','दाढ़ी','शेव','बाल काटो'],
    pharmacy:   ['pharmacy','दवाखाना','दवाई','medical store','chemist'],
    bank:       ['bank','बैंक','जमा','निकासी','loan','खाता'],
    grocery:    ['grocery','किराना','सब्जी','shopping','बाजार'],
    responses:{
      join:       'सेवाएं खोल रहे हैं। स्थान और सेवा चुनें।',
      cancel:     'आपका टोकन रद्द कर दिया गया।',
      noToken:    'कोई सक्रिय टोकन नहीं। सेवाएं ब्राउज़ करें।',
      cantCancel: 'रद्द करने के लिए कोई टोकन नहीं।',
      notifOpen:  'सूचनाएं खोल रहे हैं।',
      homeOpen:   'होम पेज पर जा रहे हैं।',
      profileOpen:'प्रोफाइल खोल रहे हैं।',
      historyOpen:'इतिहास खोल रहे हैं।',
      browseOpen: 'सेवाएं ब्राउज़ कर रहे हैं।',
      faqOpen:    'लाइव FAQ खोल रहे हैं।',
      tokenOpen:  'आपका टोकन दिखा रहे हैं।',
      unknown:    'कमांड पहचाना नहीं। कोशिश करें: queue जोड़ो, टोकन रद्द, मेरी स्थिति, होम, सेवाएं, सूचनाएं।',
    }
  },
  'mr-IN': {
    join:       ['जोडा','रांग','बुक','appointment','queue मध्ये जा','लाइनमध्ये जा','शामिल व्हा','queue join'],
    cancel:     ['रद्द','cancel','सोडा','बाहेर पडा','टोकन रद्द','queue सोडा'],
    position:   ['position','स्थिती','माझी वेळ','किती जण','प्रतीक्षा वेळ','माझा टोकन','queue status'],
    notifs:     ['notification','सूचना','अलर्ट','नोटिफिकेशन'],
    home:       ['home','मुख्य','dashboard','होम','मुख्यपृष्ठ'],
    profile:    ['profile','प्रोफाइल','खाते','सेटिंग'],
    history:    ['history','इतिहास','मागील','जुने','visit history'],
    browse:     ['browse','सेवा','services','शोधा','व्यवसाय','business'],
    faq:        ['faq','प्रश्न','विचारा','help','मदत','सपोर्ट'],
    search:     ['शोधा','शोध','search','कुठे आहे','find'],
    waittime:   ['किती वेळ','प्रतीक्षा','wait time','वेळ किती'],
    token:      ['माझा टोकन','टोकन दाखवा','token'],
    clinic:     ['clinic','डॉक्टर','hospital','आरोग्य','तपासणी'],
    salon:      ['salon','सैलून','beauty','केस','haircut'],
    barber:     ['barber','न्हावी','दाढी','केस कापा'],
    pharmacy:   ['pharmacy','औषध','दवाखाना','medical'],
    bank:       ['bank','बँक','जमा','कर्ज'],
    grocery:    ['grocery','किराणा','shopping','बाजार'],
    responses:{
      join:       'सेवा उघडत आहोत. स्थान आणि सेवा निवडा.',
      cancel:     'तुमचे टोकन रद्द केले.',
      noToken:    'कोणतेही सक्रिय टोकन नाही. सेवा ब्राउझ करा.',
      cantCancel: 'रद्द करण्यासाठी टोकन नाही.',
      notifOpen:  'सूचना उघडत आहोत.',
      homeOpen:   'होमपेजवर जात आहोत.',
      profileOpen:'प्रोफाइल उघडत आहोत.',
      historyOpen:'इतिहास उघडत आहोत.',
      browseOpen: 'सेवा ब्राउझ करत आहोत.',
      faqOpen:    'लाइव्ह FAQ उघडत आहोत.',
      tokenOpen:  'तुमचे टोकन दाखवत आहोत.',
      unknown:    'कमांड ओळखला नाही. प्रयत्न करा: रांग जोडा, टोकन रद्द, माझी स्थिती, होम, सेवा.',
    }
  },
  'gu-IN': {
    join:       ['જોડો','queue','appointment','બુક','લાઇનમાં જોડો','queue join','ભાગ લો','queue માં જાઓ'],
    cancel:     ['રદ','cancel','છોડો','બહાર','ટોકન રદ','queue છોડો'],
    position:   ['position','સ્થિતિ','મારો વારો','કેટલા લોકો','wait time','મારો ટોકન'],
    notifs:     ['notification','સૂચના','alerts','નોટિફિકેશન'],
    home:       ['home','મુખ્ય','dashboard','હોમ','મુખ્ય પૃષ્ઠ'],
    profile:    ['profile','પ્રોફાઇલ','ખાતું','settings'],
    history:    ['history','ઇતિહાસ','જૂની','visit history'],
    browse:     ['browse','સેવા','services','શોધો','business','ધંધો'],
    faq:        ['faq','પ્રશ્ન','પૂછો','help','મદદ'],
    search:     ['શોધો','search','ક્યાં છે','find'],
    waittime:   ['કેટલો સમય','wait','કેટલી મિનિટ','wait time'],
    token:      ['મારો ટોકન','ટોકન','token','show token'],
    clinic:     ['clinic','ડૉક્ટર','hospital','સ્વાસ્થ્ય','તપાસ'],
    salon:      ['salon','beauty','વાળ','haircut'],
    barber:     ['barber','વાળ કાપવા','દાઢી','shave'],
    pharmacy:   ['pharmacy','દવા','medical','chemist'],
    bank:       ['bank','બૅન્ક','જમા','loan'],
    grocery:    ['grocery','કરિયાણા','shopping'],
    responses:{
      join:       'સેવાઓ ખોલી રહ્યા છીએ. સ્થળ અને સેવા પસંદ કરો.',
      cancel:     'ટોકન રદ કર્યું.',
      noToken:    'કોઈ સક્રિય ટોકન નથી. સેવાઓ બ્રાઉઝ કરો.',
      cantCancel: 'રદ કરવા ટોકન નથી.',
      notifOpen:  'સૂચનાઓ ખોલી રહ્યા છીએ.',
      homeOpen:   'હોમ પર જઈ રહ્યા છીએ.',
      profileOpen:'પ્રોફાઇલ ખોલી રહ્યા છીએ.',
      historyOpen:'ઇતિહાસ ખોલી રહ્યા છીએ.',
      browseOpen: 'સેવાઓ બ્રાઉઝ કરી રહ્યા છીએ.',
      faqOpen:    'FAQ ખોલી રહ્યા છીએ.',
      tokenOpen:  'ટોકન બતાવી રહ્યા છીએ.',
      unknown:    'આદેશ ઓળખ્યો નહીં. આ પ્રયાસ કરો: queue જોડો, ટોકન રદ, મારી સ્થિતિ, હોમ, સેવા.',
    }
  },
  'es-ES': {
    join:       ['unirse','cola','cita','reservar','libro','unirme a la cola','hacer cola','join','entrar en cola','unirse al turno','agendar'],
    cancel:     ['cancelar','salir','dejar','cancelar token','salir de la cola','quitar token','eliminar token'],
    position:   ['posición','estado','mi turno','donde estoy','cuántos hay','tiempo de espera','mi token','ver posición'],
    notifs:     ['notificación','notificaciones','alertas','mis alertas','ver notificaciones'],
    home:       ['inicio','home','principal','ir a inicio','volver a inicio','página principal','dashboard'],
    profile:    ['perfil','cuenta','mi perfil','configuración','ajustes'],
    history:    ['historial','pasado','anterior','mis visitas','historial de cola'],
    browse:     ['buscar servicios','servicios','explorar','ver servicios','abrir servicios','negocios','todas las empresas'],
    faq:        ['pregunta','preguntar','ayuda','faq','soporte','tengo una duda','hacer una pregunta'],
    search:     ['buscar','encontrar','dónde está','localizar','busca'],
    waittime:   ['tiempo de espera','cuánto tiempo','cuántos minutos','eta'],
    token:      ['mi token','ver token','token','mostrar token'],
    clinic:     ['clínica','médico','doctor','hospital','salud','consulta'],
    salon:      ['salón','spa','belleza','cabello','corte','facial'],
    barber:     ['barbería','barbero','barba','afeitar','corte de pelo'],
    pharmacy:   ['farmacia','medicina','medicamento','droguería'],
    bank:       ['banco','depósito','retiro','préstamo','cuenta bancaria'],
    grocery:    ['supermercado','tienda','compras','abarrotes'],
    responses:{
      join:       'Abriendo servicios. Elige ubicación y servicio.',
      cancel:     'Tu token ha sido cancelado.',
      noToken:    'No tienes token activo. Busca servicios para unirte.',
      cantCancel: 'No hay token para cancelar.',
      notifOpen:  'Abriendo notificaciones.',
      homeOpen:   'Yendo al inicio.',
      profileOpen:'Abriendo tu perfil.',
      historyOpen:'Abriendo historial.',
      browseOpen: 'Abriendo servicios disponibles.',
      faqOpen:    'Abriendo FAQ en vivo.',
      tokenOpen:  'Mostrando tu token.',
      unknown:    'Comando no reconocido. Prueba: unirse a la cola, cancelar token, mi posición, inicio, servicios, notificaciones.',
    }
  },
  'fr-FR': {
    join:       ['rejoindre','file','rendez-vous','réserver','rejoindre la file','prendre un ticket','entrer dans la file','join','faire la queue','ajouter'],
    cancel:     ['annuler','quitter','partir','annuler le ticket','quitter la file','supprimer token','sortir'],
    position:   ['position','statut','mon tour','où suis-je','combien','temps d\'attente','mon ticket','voir position'],
    notifs:     ['notification','notifications','alertes','mes alertes','voir notifications'],
    home:       ['accueil','home','principal','tableau de bord','aller accueil','retour accueil'],
    profile:    ['profil','compte','mon profil','paramètres'],
    history:    ['historique','passé','précédent','mes visites','historique file'],
    browse:     ['parcourir','services','voir services','ouvrir services','trouver','entreprises','chercher service'],
    faq:        ['question','demander','aide','faq','support','j\'ai une question','poser une question'],
    search:     ['chercher','trouver','où est','rechercher'],
    waittime:   ['temps d\'attente','combien de temps','minutes','eta'],
    token:      ['mon ticket','voir ticket','ticket','afficher ticket'],
    clinic:     ['clinique','médecin','docteur','hôpital','santé','consultation'],
    salon:      ['salon','spa','beauté','coiffure','coupe','soin'],
    barber:     ['barbier','barbe','rasage','coupe'],
    pharmacy:   ['pharmacie','médicament','ordonnance'],
    bank:       ['banque','dépôt','retrait','prêt'],
    grocery:    ['épicerie','supermarché','courses','shopping'],
    responses:{
      join:       'Ouverture des services. Choisissez un lieu et un service.',
      cancel:     'Votre ticket a été annulé.',
      noToken:    "Vous n'avez pas de ticket actif. Parcourez les services.",
      cantCancel: "Pas de ticket à annuler.",
      notifOpen:  'Ouverture des notifications.',
      homeOpen:   "Retour à l'accueil.",
      profileOpen:'Ouverture de votre profil.',
      historyOpen:"Ouverture de l'historique.",
      browseOpen: 'Affichage des services disponibles.',
      faqOpen:    'Ouverture de la FAQ en direct.',
      tokenOpen:  'Affichage de votre ticket.',
      unknown:    'Commande non reconnue. Essayez: rejoindre la file, annuler ticket, ma position, accueil, services, notifications.',
    }
  },
  'zh-CN': {
    join:       ['加入','预约','排队','挂号','加入队列','进入队列','预订','排号','报名'],
    cancel:     ['取消','离开','退出','取消号码','离开队列','退出排队','删除'],
    position:   ['位置','状态','我的位置','几号','等待时间','前面几人','我的号码','查看位置'],
    notifs:     ['通知','提醒','消息','看通知','我的通知'],
    home:       ['主页','首页','home','仪表板','去首页','回主页'],
    profile:    ['个人资料','账户','档案','我的账户','设置'],
    history:    ['历史','记录','过去','我的记录','排队历史'],
    browse:     ['浏览','服务','查找','找服务','所有服务','找商家','搜索'],
    faq:        ['问题','提问','帮助','faq','支持','我有问题','咨询'],
    search:     ['搜索','查找','在哪','找'],
    waittime:   ['等多久','等待时间','几分钟','预计等待'],
    token:      ['我的号码','显示号码','号码','查看号码'],
    clinic:     ['诊所','医生','医院','健康','看病','体检','咨询'],
    salon:      ['美容院','spa','美发','剪发','护肤','美甲'],
    barber:     ['理发店','理发','剪发','刮胡子'],
    pharmacy:   ['药店','药房','药','处方'],
    bank:       ['银行','存款','取款','贷款','开户'],
    grocery:    ['超市','购物','杂货','买菜'],
    responses:{
      join:       '正在打开服务浏览。请选择位置和服务类型。',
      cancel:     '您的号码已取消。',
      noToken:    '您没有活跃的号码。请浏览服务加入队列。',
      cantCancel: '没有可取消的号码。',
      notifOpen:  '正在打开通知。',
      homeOpen:   '正在前往首页。',
      profileOpen:'正在打开个人资料。',
      historyOpen:'正在打开历史记录。',
      browseOpen: '正在浏览可用服务。',
      faqOpen:    '正在打开实时FAQ。',
      tokenOpen:  '正在显示您的号码。',
      unknown:    '未识别命令。请尝试：加入排队、取消号码、我的位置、首页、浏览服务、通知。',
    }
  },
  'ta-IN': {
    join:       ['சேர','queue','appointment','பதிவு','வரிசையில் சேர','சேர்','join','ticket எடு','பதிவு செய்'],
    cancel:     ['cancel','ரத்து','விலகு','ரத்து செய்','வெளியேறு','ticket ரத்து','வரிசை விடு'],
    position:   ['நிலை','position','என் முறை','எத்தனை பேர்','காத்திருப்பு நேரம்','என் token','வரிசை நிலை'],
    notifs:     ['notification','அறிவிப்பு','alerts','என் அறிவிப்புகள்'],
    home:       ['home','முகப்பு','dashboard','தொடக்கம்','முகப்பு பக்கம்'],
    profile:    ['profile','சுயவிவரம்','கணக்கு','settings'],
    history:    ['history','வரலாறு','கடந்த','பழைய வருகை'],
    browse:     ['browse','சேவைகள்','services','தேடு','வணிகம்','காட்டு','திற'],
    faq:        ['faq','கேள்வி','கேளுங்கள்','உதவி','help','support'],
    search:     ['தேடு','கண்டுபிடி','search','எங்கு','find'],
    waittime:   ['எவ்வளவு நேரம்','காத்திரு','wait time','நிமிடங்கள்'],
    token:      ['என் token','token காட்டு','ticket','சீட்டு'],
    clinic:     ['clinic','மருத்துவர்','hospital','உடல்நலம்','சிகிச்சை'],
    salon:      ['salon','அழகுசாலை','beauty','முடி','haircut'],
    barber:     ['barber','முடி வெட்டு','தாடி','shave'],
    pharmacy:   ['pharmacy','மருந்தகம்','மருந்து','medical'],
    bank:       ['bank','வங்கி','வைப்பு','கடன்'],
    grocery:    ['grocery','மளிகை','shopping','சந்தை'],
    responses:{
      join:       'சேவைகளை திறக்கிறோம். இடம் மற்றும் சேவை தேர்ந்தெடுங்கள்.',
      cancel:     'உங்கள் டோக்கன் ரத்து செய்யப்பட்டது.',
      noToken:    'செயலில் உள்ள டோக்கன் இல்லை. சேவைகளை உலாவுங்கள்.',
      cantCancel: 'ரத்து செய்ய டோக்கன் இல்லை.',
      notifOpen:  'அறிவிப்புகளை திறக்கிறோம்.',
      homeOpen:   'முகப்பு பக்கம் செல்கிறோம்.',
      profileOpen:'சுயவிவரம் திறக்கிறோம்.',
      historyOpen:'வரலாற்றை திறக்கிறோம்.',
      browseOpen: 'சேவைகளை காட்டுகிறோம்.',
      faqOpen:    'நேரடி FAQ திறக்கிறோம்.',
      tokenOpen:  'உங்கள் டோக்கன் காட்டுகிறோம்.',
      unknown:    'கட்டளை அங்கீகரிக்கப்படவில்லை. முயற்சிக்கவும்: வரிசையில் சேர, ரத்து, என் நிலை, முகப்பு, சேவைகள்.',
    }
  }
};

function setVoiceLang(code, name, btn) {
  voiceLang = code; voiceLangName = name;
  document.querySelectorAll('.vp-lang-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const cmds = VOICE_CMDS[code] || VOICE_CMDS['en-US'];
  const cmdEl = document.getElementById('vp-cmds');
  if(cmdEl) {
    const examples = [
      cmds.join?.[0], cmds.cancel?.[0], cmds.position?.[0],
      cmds.browse?.[0], cmds.faq?.[0], cmds.home?.[0],
      cmds.profile?.[0], cmds.history?.[0], cmds.clinic?.[0],
      cmds.salon?.[0], cmds.pharmacy?.[0], cmds.bank?.[0]
    ].filter(Boolean).join(' · ');
    cmdEl.innerHTML = `<strong>Commands (${name}):</strong><br>${examples}`;
  }
  setVpStatus(`Language set to ${name}. Tap Speak.`);
  recognition = null;
}

function openVoicePanel() {
  document.getElementById('voice-panel').classList.add('open');
}
function closeVoicePanel() {
  document.getElementById('voice-panel').classList.remove('open');
  stopVoice();
}

function setVpStatus(msg, isListening=false) {
  const el = document.getElementById('vp-status');
  if(!el) return;
  el.textContent = msg;
  el.className = 'vp-status' + (isListening ? ' listening' : '');
}

function initVoice(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const r = new SR();
  r.lang = voiceLang;
  r.continuous = false;
  r.interimResults = false;
  r.onresult = e => {
    const transcript = e.results[0][0].transcript.toLowerCase().trim();
    const confidence = Math.round(e.results[0][0].confidence * 100);
    setVpStatus(`Heard: "${transcript}" (${confidence}%)`);
    handleVoiceCmd(transcript);
    stopVoice();
  };
  r.onerror = (e) => {
    setVpStatus(`Error: ${e.error}. Try again.`);
    stopVoice();
  };
  r.onend = () => { if(listening) stopVoice(); };
  return r;
}

function triggerVoice() {
  if(!recognition) recognition = initVoice();
  if(!recognition) { toast('w','Voice not supported','Try Chrome or Edge.'); return; }
  if(listening) stopVoice(); else startVoice();
}

function toggleVoice() { openVoicePanel(); }

function startVoice() {
  if(!recognition) recognition = initVoice();
  if(!recognition) return;
  listening = true;
  document.getElementById('vf').classList.add('ls');
  setVpStatus('🔴 Listening… Speak now.', true);
  try { recognition.start(); } catch(e) { recognition = initVoice(); try { recognition.start(); } catch(e2){} }
}

function stopVoice() {
  listening = false;
  document.getElementById('vf').classList.remove('ls');
  setVpStatus('Ready. Tap Speak to start.');
  try { recognition.stop(); } catch(e){}
}

function handleVoiceCmd(raw) {
  const cmd = raw.toLowerCase().trim();
  // Build merged command map — current language + English fallback
  const lc  = VOICE_CMDS[voiceLang]  || VOICE_CMDS['en-US'];
  const en  = VOICE_CMDS['en-US'];
  const r   = lc.responses;

  // matches() checks both the selected language keywords AND English fallback
  const matches = (lKey) => {
    const kws = [...(lc[lKey] || []), ...(en[lKey] || [])];
    return kws.some(kw => cmd.includes(kw.toLowerCase()));
  };

  // ── Helper: filter browse by service type then speak
  function browseForType(type, label) {
    ut('browse', null);
    setTimeout(() => {
      const sel = document.getElementById('u-svc-filter');
      if (sel) { sel.value = type; filterBizByLocation(); }
    }, 300);
    const msg = r.browseOpen + (label ? ` Showing ${label}.` : '');
    speak(msg, voiceLang);
    closeVoicePanel();
    toast('i', `🎙️ "${raw}"`, msg);
  }

  // ── Determine intent — priority order matters ──

  // 1. Cancel token
  if (matches('cancel')) {
    if (myToken) {
      cancelToken();
      speak(r.cancel, voiceLang);
      toast('i', `🎙️ "${raw}"`, r.cancel);
    } else {
      speak(r.cantCancel, voiceLang);
      toast('i', `🎙️ "${raw}"`, r.cantCancel);
    }
    closeVoicePanel();
    return;
  }

  // 2. Position / wait time / token status
  if (matches('position') || matches('waittime') || matches('token')) {
    if (myToken) {
      const posEl  = document.getElementById('tk-pos');
      const waitEl = document.getElementById('tk-wait');
      const pos    = posEl?.textContent  || '—';
      const wait   = waitEl?.textContent || '—';
      const msg    = `Token number ${myToken.tokenNum} at ${myToken.bizName}. Position: ${pos}. Estimated wait: ${wait}.`;
      speak(msg, voiceLang);
      ut('token', null);
      toast('i', `🎙️ "${raw}"`, `Token #${myToken.tokenNum} — ${pos}`);
    } else {
      speak(r.noToken, voiceLang);
      toast('i', `🎙️ "${raw}"`, r.noToken);
    }
    closeVoicePanel();
    return;
  }

  // 3. Specific service-type browse commands
  if (matches('clinic')) { browseForType('clinic','clinics & hospitals'); return; }
  if (matches('salon'))  { browseForType('salon', 'salons & spas');       return; }
  if (matches('barber')) { browseForType('barber','barber shops');         return; }
  if (matches('pharmacy')){ browseForType('pharmacy','pharmacies');        return; }
  if (matches('bank'))   { browseForType('bank',  'banks');                return; }
  if (matches('grocery')){ browseForType('grocery','grocery stores');      return; }

  // 4. Search / find by name — "search for sunrise", "find city salon"
  if (matches('search')) {
    // Extract search term: everything after the search keyword
    const searchKws = [...(lc.search || []), ...(en.search || [])];
    let term = cmd;
    for (const kw of searchKws.sort((a,b)=>b.length-a.length)) {
      const idx = cmd.indexOf(kw.toLowerCase());
      if (idx !== -1) { term = cmd.slice(idx + kw.length).trim(); break; }
    }
    ut('browse', null);
    if (term) {
      setTimeout(() => {
        const inp = document.getElementById('u-srch');
        if (inp) { inp.value = term; filterBizByLocation(); }
      }, 300);
    }
    const msg = term ? `Searching for "${term}".` : r.browseOpen;
    speak(msg, voiceLang);
    closeVoicePanel();
    toast('i', `🎙️ "${raw}"`, msg);
    return;
  }

  // 5. Browse / all services
  if (matches('browse') || matches('join')) {
    ut('browse', null);
    // If "join" is said without a specific service, open browse
    const msg = matches('join') ? r.join : r.browseOpen;
    speak(msg, voiceLang);
    closeVoicePanel();
    toast('i', `🎙️ "${raw}"`, msg);
    return;
  }

  // 6. FAQ / help / ask
  if (matches('faq')) {
    ut('faq', null);
    speak(r.faqOpen, voiceLang);
    closeVoicePanel();
    toast('i', `🎙️ "${raw}"`, r.faqOpen);
    return;
  }

  // 7. Notifications
  if (matches('notifs')) {
    ut('notifs', null);
    speak(r.notifOpen, voiceLang);
    closeVoicePanel();
    toast('i', `🎙️ "${raw}"`, r.notifOpen);
    return;
  }

  // 8. History
  if (matches('history')) {
    ut('history', null);
    speak(r.historyOpen, voiceLang);
    closeVoicePanel();
    toast('i', `🎙️ "${raw}"`, r.historyOpen);
    return;
  }

  // 9. Profile
  if (matches('profile')) {
    ut('profile', null);
    speak(r.profileOpen, voiceLang);
    closeVoicePanel();
    toast('i', `🎙️ "${raw}"`, r.profileOpen);
    return;
  }

  // 10. Home
  if (matches('home')) {
    ut('home', null);
    speak(r.homeOpen, voiceLang);
    closeVoicePanel();
    toast('i', `🎙️ "${raw}"`, r.homeOpen);
    return;
  }

  // 11. Unknown — give helpful guidance
  speak(r.unknown, voiceLang);
  setVpStatus(`Not understood: "${raw}". Try again.`);
  toast('w', `🎙️ Not understood`, `"${raw}"`);
}

function speak(txt, lang) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = lang || voiceLang;
  u.rate = 0.9; u.pitch = 1;
  speechSynthesis.speak(u);
}

// ═══════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════
const aTabs={
  overview:['Overview','Real-time snapshot of all queues'],
  qmgmt:['Queue Management','Control and manage active queues'],
  analytics:['Analytics','Business performance insights'],
  businesses:['Businesses','Manage registered businesses'],
  services:['Services','Manage service offerings'],
  notifmgmt:['Notifications','Send alerts to customers'],
  ahistory:['Queue History','Past queue records'],
  afaq:['Live FAQ','Answer customer questions in real time']
};

function at(tab, el){
  document.querySelectorAll('#page-admin .tv').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#page-admin .ni').forEach(n=>n.classList.remove('active'));
  document.getElementById('a-'+tab).classList.add('active');
  if(el) el.classList.add('active');
  const t=aTabs[tab]||[tab,''];
  document.getElementById('a-ttl').textContent=t[0];
  document.getElementById('a-sub').textContent=t[1];
  if(tab==='businesses') loadBizTable();
  if(tab==='qmgmt') fillAdminSelects();
  if(tab==='notifmgmt') fillAdminSelects();
  if(tab==='analytics') renderAnalytics();
  if(tab==='ahistory') renderAdminHist();
  if(tab==='services') renderSvcGrid();
  if(tab==='afaq') renderAdminFaqList();
}

async function initAdminDash(){
  await getBiz();
  fillAdminSelects();
  aRefresh();
  renderAnalytics();
  renderAdminHist();
  renderSvcGrid();
  initDefaultSvcs();
  fillWalkInSvc();
  loadFaqSession();
  clearInterval(faqPollId);
  faqPollId = setInterval(loadFaqSession, 7000);
  clearInterval(adminPollId);
  adminPollId=setInterval(aRefresh,8000);
}

async function aRefresh(){
  await getBiz();
  document.getElementById('a-sbiz').textContent=bizList.length;
  let total=0;
  const all=[];
  for(const b of bizList.slice(0,10)){
    const q=await getQueue(b.id);
    total+=q.length;
    q.forEach(item=>all.push({...item,bizName:b.name,bizId:b.id}));
  }
  document.getElementById('a-swait').textContent=total;
  document.getElementById('a-sserved').textContent=servedCount;
  renderOvTable(all);
  fillAdminSelects();
}

function fillAdminSelects(){
  const opts='<option value="">— Select —</option>'+bizList.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  ['a-ovbiz','a-qmbiz','a-notifbiz'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const cur=el.value;
    el.innerHTML=opts;
    if(cur) el.value=cur;
  });
}

const SVCS_DEMO=['General Consultation','Blood Test','Vaccination','Haircut','Facial','Walk-in','Prescription','Account Opening'];
function fillWalkInSvc(){
  const sel=document.getElementById('wi-svc');
  if(sel) sel.innerHTML=SVCS_DEMO.map(s=>`<option>${s}</option>`).join('');
}

function renderOvTable(items){
  const tb=document.getElementById('a-ovbody');
  if(!tb) return;
  if(!items.length){tb.innerHTML='<tr><td colspan="7"><div class="es"><span class="ei">✅</span><p>All queues are empty.</p></div></td></tr>';return;}
  tb.innerHTML=items.map((item,i)=>`
    <tr class="${i===0?'svr':''}">
      <td>${i+1}</td>
      <td><span class="tp ${i===0?'sv':''}">#${item.token_number}</span></td>
      <td>${esc(item.bizName)}</td>
      <td><span class="badge bg-gray">${esc(item.service||SVCS_DEMO[i%SVCS_DEMO.length])}</span></td>
      <td><span class="badge ${(item.status==='serving'?'bg-green':'bg-warn')}">${item.status==='serving'?'Serving':'Waiting'}</span></td>
      <td>${item.status==='serving'?'Now':`~${i*5}m`}</td>
      <td><div class="ab">
        <button class="btn btn-xs btn-primary" onclick="openNotify(${item.token_number},'${String(item.bizId)}')">📣</button>
        <button class="btn btn-xs btn-warn" onclick="skipTok('${String(item.id)}','${String(item.bizId)}')">Skip</button>
        <button class="btn btn-xs btn-danger" onclick="removeTok('${String(item.id)}','${String(item.bizId)}')">✕</button>
      </div></td>
    </tr>`).join('');
}

async function loadOvQueue(){
  const bizId=document.getElementById('a-ovbiz').value;
  if(!bizId){aRefresh();return;}
  const q=await getQueue(bizId);
  const b=bizList.find(x=>String(x.id)===String(bizId));
  renderOvTable(q.map(item=>({...item,bizName:b?.name,bizId})));
}

// Queue Management
async function loadQMQ(){
  const bizId=document.getElementById('a-qmbiz').value;
  const tb=document.getElementById('a-qmbody');
  const title=document.getElementById('qm-biztitle');
  if(!bizId){tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted)">Select a business.</td></tr>';return;}
  const b=bizList.find(x=>String(x.id)===String(bizId));
  if(title) title.textContent=b?`— ${b.name}`:'';
  tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px"><span class="sp"></span></td></tr>';
  const q=await getQueue(bizId);
  if(!q.length){tb.innerHTML='<tr><td colspan="7"><div class="es"><span class="ei">✅</span><p>Queue empty.</p></div></td></tr>';return;}
  tb.innerHTML=q.map((item,i)=>{
    const st=item.status||'waiting';
    const stClass={waiting:'bg-warn',serving:'bg-blue',completed:'bg-green'}[st]||'bg-gray';
    const stLabel={waiting:'Waiting',serving:'Serving',completed:'Completed'}[st]||st;
    const nextLabel={waiting:'▶ Mark Serving',serving:'✅ Mark Complete'}[st]||'';
    const nextClass={waiting:'btn-soft',serving:'btn-success'}[st]||'';
    return `<tr class="${st==='serving'?'svr':''}${st==='completed'?' opacity50':''}">
      <td>${i+1}</td>
      <td><span class="tp ${st==='serving'?'sv':''}">#${item.token_number}</span></td>
      <td>${esc(item.customerName||'Customer')}</td>
      <td><span class="badge bg-gray">${esc(item.service||SVCS_DEMO[i%SVCS_DEMO.length])}</span></td>
      <td><span class="badge ${stClass}">${stLabel}</span></td>
      <td>${st==='completed'?'Done':(i===0?'Now':`~${i*5}m`)}</td>
      <td><div class="ab">
        ${nextLabel?`<button class="btn btn-xs ${nextClass}" onclick="updateTokenStatus('${String(item.id)}','${String(bizId)}','${st}',${item.token_number})">${nextLabel}</button>`:''}
        <button class="btn btn-xs btn-primary" onclick="openNotify(${item.token_number},'${String(bizId)}')">📣</button>
        <button class="btn btn-xs btn-ghost" onclick="moveTokUp('${String(item.id)}','${String(bizId)}')">↑</button>
        <button class="btn btn-xs btn-danger" onclick="removeTok('${String(item.id)}','${String(bizId)}')">✕</button>
      </div></td>
    </tr>`;
  }).join('');
}

function getActiveBiz(){
  const qm=document.getElementById('a-qmbiz');
  const ov=document.getElementById('a-ovbiz');
  return qm?.value||ov?.value||bizList[0]?.id||null;
}

async function callNext(){
  const bizId=getActiveBiz();
  if(!bizId){toast('w','Select a business first');return;}
  const r=await callNextApi(bizId);
  if(!r.ok&&r.empty){toast('i','Queue empty','No waiting tokens.');return;}
  if(!r.ok){toast('e','Failed',r.err);return;}
  servedCount++;
  document.getElementById('a-sserved').textContent=servedCount;
  toast('s',`✅ Token #${r.served} Called!`,'Next customer to counter.');
  addAdminHist(bizId, r.served, 'serving', 'Called Next', '0 min');
  audioAnnounce(r.served);
  loadQMQ(); aRefresh();
  renderAdminHist();
  if(socket) socket.emit('queue_called',{business_id:bizId,token:r.served});
}

async function completeTokenAction(id, bizId, doneMsg){
  let tokenNumber = '--';
  try {
    const q = await getQueue(bizId);
    const current = q.find(t => String(t.id) === String(id));
    if (current) tokenNumber = current.token_number;
  } catch (e) {}

  const resp = await api('POST', '/queue/update-status', {
    token_id: id,
    business_id: bizId,
    status: 'completed'
  });

  // Demo fallback when backend update is unavailable.
  if (!resp.ok) {
    const q = demoQueues[bizId] || [];
    const idx = q.findIndex(t => String(t.id) === String(id));
    if (idx > -1) q.splice(idx, 1);
  }

  const isRemoved = doneMsg.includes('removed');
  const action = isRemoved ? 'Removed' : 'Skipped';
  addAdminHist(bizId, tokenNumber, isRemoved ? 'removed' : 'skipped', action, '0 min');

  toast('i', doneMsg);
  loadQMQ();
  aRefresh();
  renderAdminHist();
  if (socket) socket.emit('queue_update', { business_id: bizId, token_id: id, status: 'completed' });
}

function skipTok(id,bizId){
  completeTokenAction(id, bizId, 'Token skipped.');
}

function removeTok(id,bizId){
  completeTokenAction(id, bizId, 'Customer removed from queue.');
}

function moveTokUp(id,bizId){
  api('POST', '/queue/move-up', {
    token_id: id,
    business_id: bizId
  }).then((resp) => {
    if (!resp.ok) {
      const q = demoQueues[bizId] || [];
      const idx = q.findIndex(t => String(t.id) === String(id));
      if (idx > 0) {
        const tmp = q[idx - 1];
        q[idx - 1] = q[idx];
        q[idx] = tmp;
      }
    }
    const q2 = demoQueues[bizId] || [];
    const item = q2.find(t => String(t.id) === String(id));
    addAdminHist(bizId, item?.token_number || '--', 'waiting', 'Moved Up', '--');
    toast('i','Token moved up in queue.');
    loadQMQ();
    aRefresh();
    renderAdminHist();
    if (socket) socket.emit('queue_update', { business_id: bizId, token_id: id });
  });
}

function addWalkIn(){
  const name=document.getElementById('wi-name').value.trim()||'Walk-in';
  const svc=document.getElementById('wi-svc').value;
  const bizId=getActiveBiz();
  if(!bizId){toast('w','Select a business first.');cm('mo-walkin');return;}
  joinQueue(bizId, name, svc).then((r) => {
    if (!r.ok) {
      toast('e','Failed to add walk-in', r.err || 'Please try again.');
      return;
    }
    toast('s',`Walk-in Added — Token #${r.token}`,name+' · '+svc);
    addAdminHist(bizId, r.token, 'waiting', 'Walk-in Added', '~5 min');
    cm('mo-walkin');
    loadQMQ();
    aRefresh();
    renderAdminHist();
    if (socket) socket.emit('queue_update', { business_id: bizId, token: r.token, status: 'waiting' });
  });
}

let qPaused=false;
function togglePause(){
  qPaused=!qPaused;
  const btns=[document.getElementById('a-pbtn'),document.getElementById('qm-pbtn')];
  const sd=document.getElementById('a-statusdot'), sv=document.getElementById('a-qstatus');
  if(qPaused){
    btns.forEach(b=>{if(b){b.textContent='▶ Resume';b.style.cssText='background:#fffbeb;color:var(--warn);border:1.5px solid var(--warn)';}});
    if(sd) sd.textContent='🟡'; if(sv){sv.textContent='⏸ Paused';sv.style.color='var(--warn)';}
    toast('w','⏸ Queue Paused','All customers notified.');
    if(socket) socket.emit('queue_paused',{reason:'Admin paused the queue'});
  } else {
    btns.forEach(b=>{if(b){b.textContent='⏸ Pause';b.style.cssText='';}});
    if(sd) sd.textContent='🟢'; if(sv){sv.textContent='Active';sv.style.color='';}
    toast('s','▶ Queue Resumed','All customers notified.');
  }
}

function applyDelay(){
  const mins=document.getElementById('dl-mins').value;
  const reason=document.getElementById('dl-reason').value;
  if(!mins) return toast('w','Enter delay duration.');
  toast('w',`⏱ Queue Delayed ${mins} min`,reason);
  cm('mo-delay');
  if(socket) socket.emit('queue_delayed',{mins,reason});
  addNotif('⏱️',`Queue Delayed ${mins} minutes`,reason||'Admin applied a delay.','w');
}

function audioAnnounce(tokenNum){
  if(!tokenNum){
    tokenNum=document.getElementById('aud-tok')?.value;
    if(!tokenNum){toast('w','Enter a token number.');return;}
  }
  if('speechSynthesis' in window){
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(`Token number ${tokenNum}, please proceed to the counter.`);
    u.rate=.85; u.pitch=1; u.lang='en-US'; speechSynthesis.speak(u);
    toast('i',`🔊 Announcing Token #${tokenNum}`);
  } else toast('w','Audio not supported','Use Chrome or Edge.');
}

// Businesses (Admin)
async function loadBizTable(){
  const tb=document.getElementById('a-biztable');
  if(!tb) return;
  tb.innerHTML='<tr><td colspan="7"><div class="es"><span class="sp"></span></div></td></tr>';
  await getBiz();
  if(!bizList.length){tb.innerHTML='<tr><td colspan="7"><div class="es"><span class="ei">🏢</span><p>No businesses yet.</p></div></td></tr>';return;}
  tb.innerHTML=bizList.map(b=>`
    <tr>
      <td><strong>${esc(b.name)}</strong></td>
      <td><span class="badge bg-blue">${esc(b.type)}</span></td>
      <td>${esc(b.location||'—')}</td>
      <td>${esc(b.hours||'—')}</td>
      <td id="qc-${b.id}"><span class="sp"></span></td>
      <td><button class="btn btn-xs btn-outline" onclick="gotoQM('${String(b.id)}')">View Queue</button></td>
      <td><button class="btn btn-xs btn-danger" onclick="deleteBiz('${String(b.id)}','${esc(b.name).replace(/'/g,"\\'")}')">🗑 Delete</button></td>
    </tr>`).join('');
  bizList.forEach(async b=>{
    const q=await getQueue(b.id);
    const el=document.getElementById('qc-'+b.id);
    if(el) el.innerHTML=`<span class="badge ${q.length>5?'bg-warn':'bg-green'}">${q.length} waiting</span>`;
  });
}

async function createBusiness(){
  const name=document.getElementById('ab-name').value.trim();
  const type=document.getElementById('ab-type').value;
  const loc=document.getElementById('ab-loc').value.trim();
  const hrs=document.getElementById('ab-hrs').value.trim();
  if(!name||!loc) return toast('w','Name and address required.');
  const btn=document.getElementById('ab-btn');
  btn.disabled=true; btn.innerHTML='<span class="sp"></span>';
  await doCreateBiz(name,type,loc,hrs);
  btn.disabled=false; btn.innerHTML='Create Business';
  toast('s','Business created!',name);
  cm('mo-addbiz');
  loadBizTable(); fillAdminSelects(); aRefresh();
}

async function createBusiness2(){
  const name=document.getElementById('ab2-name').value.trim();
  const type=document.getElementById('ab2-type').value;
  const loc=document.getElementById('ab2-loc').value.trim();
  const hrs=document.getElementById('ab2-hrs').value.trim();
  if(!name||!loc) return toast('w','Name and address required.');
  const btn=document.getElementById('ab2-btn');
  btn.disabled=true; btn.innerHTML='<span class="sp"></span> Creating…';
  await doCreateBiz(name,type,loc,hrs);
  btn.disabled=false; btn.innerHTML='Create Business';
  toast('s','Business created!',name);
  document.getElementById('ab2-name').value='';
  document.getElementById('ab2-loc').value='';
  loadBizTable(); fillAdminSelects(); aRefresh();
}

async function deleteBiz(bizId, bizName) {
  if (!confirm(`Delete "${bizName}"? This will remove the business and its queue data.`)) return;
  // Try API first
  await api('DELETE', `/business/${bizId}`);
  // Always remove locally (demo mode)
  const idx = DEMO_BIZ.findIndex(b => b.id === bizId);
  if (idx > -1) DEMO_BIZ.splice(idx, 1);
  bizList = bizList.filter(b => b.id !== bizId);
  delete demoQueues[bizId];
  delete demoTokenCounter[bizId];
  toast('s', 'Business deleted', bizName);
  loadBizTable();
  fillAdminSelects();
  aRefresh();
}

function gotoQM(bizId){
  at('qmgmt',null);
  document.querySelectorAll('#page-admin .ni').forEach(n=>{ if(n.textContent.trim().startsWith('Queue Management')) n.classList.add('active'); else n.classList.remove('active'); });
  setTimeout(()=>{ const s=document.getElementById('a-qmbiz'); if(s){s.value=bizId;loadQMQ();} },100);
}

// Notifications (Admin)
function openNotify(tokenNum, bizId){
  notifyTarget={tokenNum,bizId};
  document.getElementById('mn-tok').textContent=`#${tokenNum}`;
  om('mo-notify');
}

function sendNotify(){
  const type=document.getElementById('mn-type').value;
  const wait=document.getElementById('mn-wait').value;
  const custom=document.getElementById('mn-msg').value;
  const msgs={
    turn:`Token #${notifyTarget.tokenNum} — It's your turn! Please proceed to the counter.`,
    soon:`Token #${notifyTarget.tokenNum} — Your turn in ${wait||5} minutes. Please be ready.`,
    delay:`Token #${notifyTarget.tokenNum} — Queue delayed${wait?` by ${wait} minutes`:''}.`,
    paused:`Token #${notifyTarget.tokenNum} — Service paused temporarily. Apologies for the inconvenience.`,
    custom:custom||'Update from the business.'
  };
  const msg=msgs[type];
  if(socket) socket.emit('admin_notify',{token:notifyTarget.tokenNum,biz:notifyTarget.bizId,message:msg});
  addNotif('📣',`Sent to Token #${notifyTarget.tokenNum}`,msg,'i');
  toast('s',`Notification Sent!`,`Token #${notifyTarget.tokenNum}`);
  cm('mo-notify');
}

async function loadNotifQ(){
  const bizId=document.getElementById('a-notifbiz').value;
  const tb=document.getElementById('a-notifbody');
  if(!bizId){tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:22px;color:var(--muted)">Select a business.</td></tr>';return;}
  const q=await getQueue(bizId);
  if(!q.length){tb.innerHTML='<tr><td colspan="5"><div class="es"><span class="ei">✅</span><p>Queue empty.</p></div></td></tr>';return;}
  tb.innerHTML=q.map((item,i)=>`
    <tr>
      <td><span class="tp ${i===0?'sv':''}">#${item.token_number}</span></td>
      <td><span class="badge bg-gray">${SVCS_DEMO[i%SVCS_DEMO.length]}</span></td>
      <td><span class="badge ${i===0?'bg-green':'bg-warn'}">${i===0?'Serving':'Waiting'}</span></td>
      <td>${fmtTime(item.created_at)}</td>
      <td><button class="btn btn-primary btn-xs" onclick="openNotify(${item.token_number},'${String(bizId)}')">📣 Notify</button></td>
    </tr>`).join('');
}

function sendBroadcast(){
  const bizId=document.getElementById('a-notifbiz').value;
  const msg=document.getElementById('a-broadcast').value.trim();
  if(!bizId||!msg) return toast('w','Select business and enter message.');
  if(socket) socket.emit('admin_broadcast',{biz:bizId,message:msg});
  addNotif('📡','Broadcast Sent',msg,'i');
  toast('s','📡 Broadcast Sent!',msg);
  document.getElementById('a-broadcast').value='';
}

// Analytics
function renderAnalytics(){
  const hrs=['8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm'];
  const counts=[3,8,14,18,12,7,11,15,9,4];
  const waits=[5,10,18,25,20,12,15,22,14,6];
  const mxC=Math.max(...counts), mxW=Math.max(...waits);
  const hc=document.getElementById('an-hchart');
  if(hc) hc.innerHTML=hrs.map((h,i)=>`<div class="cbc"><div class="cbb" style="height:${Math.round(counts[i]/mxC*95)}px;background:linear-gradient(180deg,var(--accent),#93c5fd)"></div><span class="cbl">${h}</span></div>`).join('');
  const wc=document.getElementById('an-wchart');
  if(wc) wc.innerHTML=hrs.map((h,i)=>`<div class="cbc"><div class="cbb" style="height:${Math.round(waits[i]/mxW*95)}px;background:linear-gradient(180deg,var(--warn),#fde68a)"></div><span class="cbl">${h}</span></div>`).join('');
  const wb=document.getElementById('an-weekly');
  if(wb){
    const days=[['Mon 9 Mar','63','21m','11am','94%'],['Tue 10 Mar','48','17m','10am','89%'],['Wed 11 Mar','71','23m','12pm','96%'],['Thu 12 Mar','55','19m','11am','92%'],['Fri 13 Mar','80','26m','2pm','91%'],['Sat 14 Mar','42','15m','10am','88%']];
    wb.innerHTML=days.map(d=>`<tr><td>${d[0]}</td><td><strong>${d[1]}</strong></td><td>${d[2]}</td><td>${d[3]}</td><td><span class="badge bg-green">${d[4]}</span></td></tr>`).join('');
  }
}

function renderAdminHist(){
  const tb=document.getElementById('a-histbody');
  if(!tb) return;
  if(!adminHist.length){
    tb.innerHTML='<tr><td colspan="5"><div class="es"><span class="ei">📋</span><p>No live queue history yet.</p></div></td></tr>';
    return;
  }
  const statusClass = {
    waiting: 'bg-warn',
    serving: 'bg-blue',
    completed: 'bg-green',
    skipped: 'bg-gray',
    removed: 'bg-red'
  };
  const statusLabel = {
    waiting: 'Waiting',
    serving: 'Serving',
    completed: 'Completed',
    skipped: 'Skipped',
    removed: 'Removed'
  };
  tb.innerHTML=adminHist.map(r=>`<tr><td>${r.date}</td><td>${r.business}</td><td><strong>${r.total}</strong></td><td>${r.avgWait}</td><td><span class="badge bg-green">${r.peakToken}</span> <span class="badge ${statusClass[r.status] || 'bg-gray'}" style="margin-left:6px">${statusLabel[r.status] || r.status || 'Unknown'}</span> <span class="badge bg-gray" style="margin-left:6px">${r.action}</span></td></tr>`).join('');
}

// Services
function initDefaultSvcs(){
  if(svcs.length) return;
  svcs=[
    {name:'General Consultation',time:15,cat:'Clinic',icon:'🩺'},{name:'Blood Test',time:20,cat:'Clinic',icon:'🩸'},
    {name:'Vaccination',time:10,cat:'Clinic',icon:'💉'},{name:'Haircut',time:30,cat:'Salon',icon:'✂️'},
    {name:'Facial',time:45,cat:'Salon',icon:'✨'},{name:'Hair Color',time:90,cat:'Salon',icon:'🎨'},
    {name:'Prescription Refill',time:5,cat:'Pharmacy',icon:'💊'},{name:'Account Opening',time:40,cat:'Bank',icon:'🏦'},
  ];
}

function addSvc(){
  const name=document.getElementById('sv-name').value.trim();
  const time=parseInt(document.getElementById('sv-time').value)||15;
  const cat=document.getElementById('sv-cat').value;
  if(!name) return toast('w','Service name required.');
  svcs.push({name,time,cat,icon:'🛎️'});
  renderSvcGrid();
  document.getElementById('sv-name').value='';
  document.getElementById('sv-time').value='';
  toast('s','Service added.',name);
}

function removeSvc(i){
  svcs.splice(i,1);
  renderSvcGrid();
  toast('i','Service removed.');
}

function renderSvcGrid(){
  initDefaultSvcs();
  const g=document.getElementById('a-svcgrid');
  if(!g) return;
  g.innerHTML=svcs.map((s,i)=>`
    <div class="svc-card">
      <div class="svc-ic">${s.icon}</div>
      <div class="svc-inf"><strong>${esc(s.name)}</strong><small>${s.cat} · ~${s.time} min</small></div>
      <button class="btn btn-xs btn-danger" style="margin-left:auto;flex-shrink:0" onclick="removeSvc(${i})">✕</button>
    </div>`).join('');
}

// ═══════════════════════════════════════════
// DARK / LIGHT MODE TOGGLE
// ═══════════════════════════════════════════
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  ls('ql_theme', newTheme);
  const icon = isDark ? '🌙' : '☀️';
  document.querySelectorAll('.theme-toggle').forEach(b => b.textContent = icon);
  toast('i', isDark ? '☀️ Light Mode' : '🌙 Dark Mode');
}

function applyTheme() {
  const saved = ls('ql_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const icon = saved === 'dark' ? '☀️' : '🌙';
  document.querySelectorAll('.theme-toggle').forEach(b => b.textContent = icon);
}

// ═══════════════════════════════════════════
// ADMIN: UPDATE CUSTOMER VISIT STATUS
// ═══════════════════════════════════════════
// Status cycle: waiting → serving → completed
function updateTokenStatus(tokenId, bizId, currentStatus, tokenNumber) {
  const cycle = { waiting: 'serving', serving: 'completed' };
  const nextStatus = cycle[currentStatus];
  if (!nextStatus) return;

  // Try backend first for shared sync, then fallback to demo queue state.
  api('POST', '/queue/update-status', {
    token_id: tokenId,
    business_id: bizId,
    status: nextStatus,
  }).then((resp) => {
    const q = demoQueues[bizId] || [];
    const item = q.find(t => String(t.id) === String(tokenId));

    if (!resp.ok && item) {
      item.status = nextStatus;
    }

    if (!resp.ok && !item) {
      toast('e', 'Status update failed', resp.err || 'Could not update token status.');
      return;
    }

    const resolvedToken = item ? item.token_number : tokenNumber;
    const labels = { serving: '🟡 Now Serving', completed: '✅ Completed' };
    toast('s', `Token #${resolvedToken || tokenId} → ${labels[nextStatus] || nextStatus}`);

    if (nextStatus === 'completed') {
      servedCount++;
      const sc = document.getElementById('a-sserved');
      if (sc) sc.textContent = servedCount;
    }

    addAdminHist(
      bizId,
      resolvedToken || tokenNumber,
      nextStatus,
      nextStatus === 'serving' ? 'Marked Serving' : 'Marked Complete',
      nextStatus === 'serving' ? '~5 min' : '0 min'
    );
    renderAdminHist();

    if (socket) {
      socket.emit('queue_update', {
        business_id: bizId,
        token_id: tokenId,
        token: resolvedToken || tokenNumber,
        status: nextStatus,
      });
    }

    loadQMQ();
    aRefresh();
  });
}


// ═══════════════════════════════════════════
// LIVE FAQ SYSTEM
// ═══════════════════════════════════════════
const faqStore = []; // { id, question, askedBy, askedAt, answer, answeredAt }
function normalizeFaq(raw) {
  if (!raw) return null;
  const id = String(raw.id || raw._id || '').trim();
  if (!id) return null;
  return {
    id,
    question: String(raw.question || '').trim(),
    askedBy: String(raw.askedBy || 'Customer').trim(),
    askedAt: raw.askedAt ? new Date(raw.askedAt) : new Date(),
    answer: raw.answer ? String(raw.answer) : null,
    answeredAt: raw.answeredAt ? new Date(raw.answeredAt) : null,
  };
}

function upsertFaq(entry) {
  const idx = faqStore.findIndex(f => String(f.id) === String(entry.id));
  if (idx > -1) faqStore[idx] = { ...faqStore[idx], ...entry };
  else faqStore.unshift(entry);
  faqStore.sort((a, b) => new Date(b.askedAt) - new Date(a.askedAt));
}

function updateFaqBadges() {
  const unanswered = faqStore.filter(f => !f.answer).length;
  const ab = document.getElementById('a-faqbadge');
  if (ab) {
    ab.style.display = unanswered > 0 ? 'inline' : 'none';
    ab.textContent = String(unanswered);
  }
}

async function loadFaqSession() {
  const r = await api('GET', '/faq/list');
  if (r.ok && Array.isArray(r.data)) {
    faqStore.length = 0;
    r.data.map(normalizeFaq).filter(Boolean).forEach(item => faqStore.push(item));
  }
  renderFaqList();
  renderAdminFaqList();
  updateFaqBadges();
}

async function submitFaq() {
  const inp = document.getElementById('faq-input');
  const q = (inp?.value || '').trim();
  if (!q) { toast('w', 'Please type a question first.'); return; }
  const askedBy = user?.name || user?.email || 'Customer';
  const r = await api('POST', '/faq/create', { question: q, askedBy });
  let entry = r.ok
    ? normalizeFaq(r.data)
    : {
        id: String(Date.now()),
        question: q,
        askedBy,
        askedAt: new Date(),
        answer: null,
        answeredAt: null,
      };
  if (!entry) {
    entry = {
      id: String(Date.now()),
      question: q,
      askedBy,
      askedAt: new Date(),
      answer: null,
      answeredAt: null,
    };
  }
  upsertFaq(entry);
  inp.value = '';
  if (socket) socket.emit('faq_submitted', entry);
  toast('s', '📨 Question Sent', 'Admin will respond shortly.');
  renderFaqList();
  renderAdminFaqList();
  updateFaqBadges();
}

function renderFaqList() {
  const el = document.getElementById('u-faqlist');
  if (!el) return;
  if (!faqStore.length) {
    el.innerHTML = '<div class="es"><span class="ei">💬</span><p>No questions yet. Be the first to ask!</p></div>';
    return;
  }
  el.innerHTML = faqStore.map(f => `
    <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px;background:var(--card)">
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
        <span style="font-size:1.2rem">❓</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:.9rem;color:var(--text)">${esc(f.question)}</div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:2px">Asked by ${esc(f.askedBy)} · ${fmtTime(f.askedAt)}</div>
        </div>
      </div>
      ${f.answer
        ? `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:var(--primary-faint,rgba(99,102,241,.08));border-radius:8px;border-left:3px solid var(--primary)">
            <span style="font-size:1.1rem">✅</span>
            <div>
              <div style="font-size:.78rem;font-weight:700;color:var(--primary);margin-bottom:3px">Admin · ${fmtTime(f.answeredAt)}</div>
              <div style="font-size:.88rem;color:var(--text)">${esc(f.answer)}</div>
            </div>
          </div>`
        : `<div style="padding:8px 12px;background:rgba(245,158,11,.08);border-radius:8px;border-left:3px solid #f59e0b;font-size:.82rem;color:#b45309;display:flex;align-items:center;gap:6px">
            <span class="sp" style="width:12px;height:12px;border-width:2px"></span> Waiting for admin response…
          </div>`
      }
    </div>`).join('');
}

function renderAdminFaqList() {
  const el = document.getElementById('a-faqlist');
  if (!el) return;
  if (!faqStore.length) {
    el.innerHTML = '<div class="es"><span class="ei">💬</span><p>No questions from customers yet.</p></div>';
    return;
  }
  el.innerHTML = faqStore.map(f => `
    <div style="border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:14px;background:var(--card)">
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
        <span style="font-size:1.2rem">❓</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:.9rem;color:var(--text)">${esc(f.question)}</div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:2px">From: ${esc(f.askedBy)} · ${fmtTime(f.askedAt)}</div>
        </div>
        ${!f.answer ? '<span class="badge bg-warn" style="font-size:.72rem;white-space:nowrap">Unanswered</span>' : '<span class="badge bg-gray" style="font-size:.72rem;white-space:nowrap">Answered</span>'}
      </div>
      ${f.answer
        ? `<div style="padding:10px 12px;background:var(--primary-faint,rgba(99,102,241,.08));border-radius:8px;border-left:3px solid var(--primary);font-size:.85rem;color:var(--text)">
            <strong>Your answer:</strong> ${esc(f.answer)}
          </div>`
        : `<div style="display:flex;gap:8px;align-items:flex-end">
            <div class="fg" style="margin:0;flex:1"><input class="fi" id="faq-ans-${f.id}" placeholder="Type your answer…" onkeydown="if(event.key==='Enter')answerFaq('${f.id}')"/></div>
            <button class="btn btn-primary btn-sm" onclick="answerFaq('${f.id}')">✅ Reply</button>
          </div>`
      }
    </div>`).join('');
}

async function answerFaq(id) {
  const inp = document.getElementById('faq-ans-'+id);
  const ans = (inp?.value || '').trim();
  if (!ans) { toast('w', 'Please type an answer.'); return; }
  const r = await api('POST', `/faq/${id}/answer`, { answer: ans });
  let entry = faqStore.find(f => String(f.id) === String(id));
  if (r.ok) {
    const updated = normalizeFaq(r.data);
    if (updated) {
      upsertFaq(updated);
      entry = faqStore.find(f => String(f.id) === String(id)) || updated;
      if (socket) socket.emit('faq_answered', updated);
    }
  } else {
    if (!entry) return;
    entry.answer = ans;
    entry.answeredAt = new Date();
    if (socket) socket.emit('faq_answered', entry);
  }
  toast('s', '✅ Answer Sent', 'Customer will see your response.');
  updateFaqBadges();
  // Show badge on customer side
  const ub = document.getElementById('u-faqbadge');
  if (ub) { ub.style.display='inline'; ub.textContent='!'; }
  renderAdminFaqList();
  renderFaqList(); // sync customer view
}



(function init(){
  applyTheme();
  try {
    const su=ls('ql_user'), st=ls('ql_tok');
    if(su&&st){
      user=JSON.parse(su);
      initSocket();
      if(user.role==='admin') sp('page-admin');
      else sp('page-user');
    }
  } catch(e){ lsr('ql_user'); lsr('ql_tok'); }
})();

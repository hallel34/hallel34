/* ===== DEMO BUILD: in-memory Firestore shim + bots (generated into demo/index.html) ===== */
(function(){
  try{ localStorage.removeItem('mafia_room'); }catch(e){}
  window.confirm = function(){ return true; }; /* sandboxed frames may block modals */

  var clone = function(o){ return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); };
  var docs = {};      /* path -> {data, v} */
  var listeners = {}; /* path -> Set<{cb}> */
  var rand = function(n){ return Math.floor(Math.random()*n); };

  function snap(path){
    var e = docs[path];
    return { exists: !!e, id: path.split('/').pop(), data: function(){ return e ? clone(e.data) : undefined; } };
  }
  function applyUpdate(data, upd){
    Object.keys(upd).forEach(function(k){
      var parts = k.split('.'), o = data;
      for(var i=0;i<parts.length-1;i++){
        if(o[parts[i]] === null || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
        o = o[parts[i]];
      }
      o[parts[parts.length-1]] = clone(upd[k]);
    });
  }
  function notify(path){
    var set = listeners[path]; if(!set) return;
    Array.from(set).forEach(function(l){ setTimeout(function(){ if(set.has(l)) { try{ l.cb(snap(path)); }catch(e){ console.error(e); } } }, 0); });
  }
  function commitWrite(path, w){
    if(w.type === 'set'){ docs[path] = { data: clone(w.data), v: (docs[path] ? docs[path].v : 0) + 1 }; }
    else if(w.type === 'update'){
      if(!docs[path]) throw new Error('המסמך לא נמצא');
      applyUpdate(docs[path].data, w.data); docs[path].v++;
    } else if(w.type === 'delete'){ delete docs[path]; }
    notify(path);
    botKick(path);
  }
  function Ref(path){ this.path = path; this.id = path.split('/').pop(); }
  Ref.prototype.get = function(){ return Promise.resolve(snap(this.path)); };
  Ref.prototype.set = function(d){ var p=this.path; return Promise.resolve().then(function(){ commitWrite(p,{type:'set',data:d}); }); };
  Ref.prototype.update = function(d){ var p=this.path; return Promise.resolve().then(function(){ commitWrite(p,{type:'update',data:d}); }); };
  Ref.prototype.delete = function(){ var p=this.path; return Promise.resolve().then(function(){ commitWrite(p,{type:'delete'}); }); };
  Ref.prototype.onSnapshot = function(cb){
    var p = this.path, l = { cb: cb };
    (listeners[p] = listeners[p] || new Set()).add(l);
    setTimeout(function(){ if(listeners[p].has(l)) cb(snap(p)); }, 0);
    return function(){ listeners[p].delete(l); };
  };
  async function runTransaction(fn){
    for(var attempt=0; attempt<6; attempt++){
      var reads = {}, writes = [];
      var t = {
        get: function(ref){ reads[ref.path] = docs[ref.path] ? docs[ref.path].v : 0; return Promise.resolve(snap(ref.path)); },
        set: function(ref,d){ writes.push([ref.path,{type:'set',data:clone(d)}]); return t; },
        update: function(ref,d){ writes.push([ref.path,{type:'update',data:clone(d)}]); return t; },
        delete: function(ref){ writes.push([ref.path,{type:'delete'}]); return t; }
      };
      var res = await fn(t);
      var stale = Object.keys(reads).some(function(p){ return (docs[p] ? docs[p].v : 0) !== reads[p]; });
      if(stale) continue;
      writes.forEach(function(w){ commitWrite(w[0], w[1]); });
      return res;
    }
    throw new Error('transaction failed');
  }
  var dbObj = {
    collection: function(c){ return { doc: function(id){ return new Ref(c+'/'+id); } }; },
    runTransaction: runTransaction
  };
  window.firebase = {
    initializeApp: function(){ return {}; },
    firestore: function(){ return dbObj; }
  };

  /* ---------------- bots ---------------- */
  var BOT_NAMES = ['דני','מיכל','יוסי','נועה','אבי','רוני','שירה','עידו','תמר','גיא','ליאור','הדס','עומר','מאיה','איתי','נטע','אורי','יעל','רן'];
  var pending = {};
  var isBot = function(id){ return id.indexOf('bot_') === 0; };
  var alivePlayers = function(d){ return Object.keys(d.players).filter(function(id){ return d.players[id].alive; }); };
  var pick = function(a){ return a.length ? a[rand(a.length)] : null; };

  /* returns an update object (same fields the real UI writes) or null */
  function plan(d, bid){
    var p = d.players[bid]; if(!p) return null;
    if(d.status === 'reveal') return p.ready ? null : (function(){ var o={}; o['players.'+bid+'.ready']=true; return o; })();
    if(!p.alive) return null;
    var al = alivePlayers(d), r = d.round, o = {};
    if(d.status === 'night'){
      var n = d.night || {};
      if(p.role === 'mafia'){
        var v = n.mafia || {};
        var targets = al.filter(function(id){ return d.players[id].role !== 'mafia'; });
        if(!targets.length) return null;
        var mates = al.filter(function(id){ return d.players[id].role === 'mafia' && id !== bid; });
        var humanPick = mates.filter(function(m){ return !isBot(m) && v[m] && targets.indexOf(v[m]) >= 0; }).map(function(m){ return v[m]; })[0];
        var t;
        if(humanPick) t = humanPick;
        else if(v[bid] && targets.indexOf(v[bid]) >= 0) return null;
        else t = mates.map(function(m){ return v[m]; }).filter(function(x){ return x && targets.indexOf(x) >= 0; })[0] || pick(targets);
        if(v[bid] === t) return null;
        o['night.mafia.'+bid] = t; return o;
      }
      if(p.role === 'doctor'){ if(n.doctor) return null; o['night.doctor'] = pick(al); return o; }
      if(p.role === 'detective'){
        if((d.checks||{})[r]) return null;
        var prev = Object.keys(d.checks||{}).map(function(k){ return d.checks[k].target; });
        var cands = al.filter(function(id){ return id !== bid; });
        var fresh = cands.filter(function(id){ return prev.indexOf(id) < 0; });
        var tg = pick(fresh.length ? fresh : cands); if(!tg) return null;
        o['night.detective'] = tg; o['checks.'+r] = { target: tg, mafia: d.players[tg].role === 'mafia' }; return o;
      }
      return null;
    }
    if(d.status === 'vote'){
      if((d.votes||{})[bid]) return null;
      var others = al.filter(function(id){ return id !== bid; });
      var choice;
      if(p.role === 'mafia') others = others.filter(function(id){ return d.players[id].role !== 'mafia'; });
      if(p.role === 'detective'){
        var known = Object.keys(d.checks||{}).map(function(k){ return d.checks[k]; })
          .filter(function(c){ return c.mafia && d.players[c.target] && d.players[c.target].alive; });
        if(known.length) choice = known[0].target;
      }
      if(!choice) choice = (rand(100) < 15 || !others.length) ? 'skip' : pick(others);
      o['votes.'+bid] = choice; return o;
    }
    return null;
  }
  function botKick(path){
    var e = docs[path]; if(!e) return;
    Object.keys(e.data.players || {}).filter(isBot).forEach(function(bid){
      if(!plan(clone(e.data), bid)) return;
      var key = path+'|'+bid+'|'+e.data.status+'|'+e.data.round;
      if(pending[key]) return;
      pending[key] = true;
      setTimeout(function(){
        delete pending[key];
        var cur = docs[path]; if(!cur) return;
        var o = plan(clone(cur.data), bid);
        if(o) commitWrite(path, { type:'update', data:o });
      }, 1000 + rand(3000));
    });
  }
  setInterval(function(){ Object.keys(docs).forEach(botKick); }, 2000);

  function addBots(n){
    var path = Object.keys(docs)[0]; if(!path) return;
    var d = docs[path].data; if(d.status !== 'lobby') return;
    var used = {}; Object.keys(d.players).forEach(function(id){ used[d.players[id].name] = 1; });
    var free = BOT_NAMES.filter(function(x){ return !used[x]; });
    var upd = {}, cnt = Object.keys(d.players).length;
    for(var i=0;i<n && cnt<20;i++){
      var name = free.shift() || ('בוט'+(cnt+1));
      var id = 'bot_'+Math.random().toString(36).slice(2,8);
      upd['players.'+id] = { name: name, joinedAt: Date.now()+i, alive:true, role:null, ready:false };
      cnt++;
    }
    commitWrite(path, { type:'update', data:upd });
  }

  /* ---------------- demo UI ---------------- */
  var css = document.createElement('style');
  css.textContent =
    '#demo-badge{position:fixed;inset-block-end:6px;inset-inline-start:6px;z-index:9998;pointer-events:none;background:#f5c542;color:#1a1a1a;font:700 11px/1 system-ui,sans-serif;padding:5px 9px;border-radius:99px;opacity:.9}'+
    '#demo-bots{position:fixed;inset-block-end:6px;inset-inline-end:6px;z-index:9999;display:none;align-items:center;gap:4px;background:#1c1c2e;border:1px solid #f5c542;border-radius:14px;padding:4px;box-shadow:0 4px 16px #0008;font-family:inherit}'+
    '#demo-bots.show{display:flex}'+
    '#demo-bots button{min-width:48px;min-height:48px;border:0;border-radius:10px;background:#2a2a44;color:#fff;font:700 16px inherit;font-family:inherit;touch-action:manipulation}'+
    '#demo-bots button.add{background:#f5c542;color:#1a1a1a;padding:0 12px;font-size:14px}'+
    '#demo-bots b{min-width:22px;text-align:center;color:#fff;font-size:16px}'+
    'body.demo-lobby .screen{padding-bottom:80px}';
  document.head.appendChild(css);
  var badge = document.createElement('div'); badge.id='demo-badge'; badge.textContent='מצב הדגמה'; document.body.appendChild(badge);
  var bar = document.createElement('div'); bar.id='demo-bots'; bar.setAttribute('dir','rtl');
  var count = 4;
  bar.innerHTML = '<button type="button" class="minus" aria-label="פחות">−</button><b>4</b><button type="button" class="plus" aria-label="יותר">+</button><button type="button" class="add">🤖 הוסף בוטים</button>';
  document.body.appendChild(bar);
  bar.addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    if(b.classList.contains('minus')) count = Math.max(1, count-1);
    else if(b.classList.contains('plus')) count = Math.min(10, count+1);
    else if(b.classList.contains('add')) addBots(count);
    bar.querySelector('b').textContent = count;
  });
  setInterval(function(){
    var host = false;
    try{
      var path = Object.keys(docs)[0];
      host = !!path && docs[path].data.status === 'lobby' && docs[path].data.hostId === myId;
    }catch(e){}
    bar.classList.toggle('show', host);
    document.body.classList.toggle('demo-lobby', host);
  }, 300);
})();

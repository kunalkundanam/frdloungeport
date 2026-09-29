/** Room authority shared by the production Worker and local SQLite server. */
const TTL=24*60*60*1000, PRESENCE=30000, LIMIT=10;
const AMBIENT={id:'afterlight',kind:'ambient',title:'Afterlight'};
export class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(status,message)=>{throw new ApiError(status,message)};
const text=(v,max=48)=>typeof v==='string'?v.trim().slice(0,max):'';
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fail(400,'Invalid number.');
const hash=async str=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str))),x=>x.toString(16).padStart(2,'0')).join('');
const profile=p=>({name:text(p?.name,24)||'Friend',color:/^#[0-9a-f]{6}$/i.test(p?.color)?p.color:'#70ded5'});
function media(m){
 if(!m||!['ambient','url','embed'].includes(m.kind))fail(400,'Choose a shared film or HTTPS video.');
 if(m.kind==='ambient')return {...AMBIENT};
 if(m.kind==='url'){let u;try{u=new URL(m.url)}catch{fail(400,'Invalid video URL.')}
 if(u.protocol!=='https:'||u.username||u.password||m.url.length>2048)fail(400,'Use an HTTPS video URL.');
 return {id:text(m.id,150),kind:'url',title:text(m.title,100)||'Shared film',url:u.href};}
 // Catalog metadata only. A provider is chosen from the client's existing allowlist.
 if(!m.selection||!m.catalog||JSON.stringify(m).length>10000)fail(400,'Invalid catalog selection.');
 // The catalog owns title identity; selection contains provider and episode settings.
 if(!['movie','tv'].includes(m.catalog.mediaType)||!Number.isInteger(m.catalog.id)||m.catalog.id<=0||m.catalog.id>2147483647||!text(m.catalog.title,300))fail(400,'Invalid catalog title.');
 // Embedded sources retain their original public provider key; never accept script protocols.
 if(JSON.stringify(m).match(/(?:javascript|data|file):/i))fail(400,'Invalid source.');
 return JSON.parse(JSON.stringify(m));
}
function playback(m,now){return{sourceId:m.id,time:0,duration:0,playing:false,rate:1,loop:true,updatedAt:now}}
function position(n=0){return{x:5.35-n*.65,y:0,z:.03,yaw:0,sit:0,phase:0,speed:0}}
function member(id,p,now,n){return{...profile(p),id,ready:false,seatId:null,joinedAt:now,lastSeen:now,muted:false,hp:100,deaths:0,kills:0,respawnAt:0,shieldUntil:now+3000,pose:position(n),lastPoseAt:now,limits:{}}}
function emit(r,type,payload,now){r.events.push({id:++r.eventSeq,type,...payload,at:now});r.events=r.events.slice(-60)}
function tick(r,now){
 r.requests=r.requests.filter(x=>x.expires>now);
 for(const [id,m]of Object.entries(r.members)){
  if(!m.bot&&now-m.lastSeen>PRESENCE){delete r.members[id];r.requests=r.requests.filter(x=>x.from!==id&&x.to!==id);continue;}
  if(m.respawnAt&&now>=m.respawnAt){m.hp=100;m.respawnAt=0;m.seatId=null;m.pose=position();m.lastPoseAt=now;m.shieldUntil=now+2000;emit(r,'respawn',{player:id},now)}
 }
 if(!r.members[r.meta.hostId]){const next=Object.values(r.members).filter(m=>!m.bot).sort((a,b)=>a.joinedAt-b.joinedAt)[0];if(next)r.meta.hostId=next.id;}
}
function snapshot(r,uid,now){
 const out=structuredClone(r);tick(out,now);
 return{status:'connected',selfId:uid,room:{...out.meta,theme:out.theme},members:Object.values(out.members).map(({limits,lastPoseAt,...m})=>m),source:out.media,playback:out.playback,messages:out.messages,events:out.events,eventSeq:out.eventSeq,requests:out.requests.filter(x=>x.from===uid||x.to===uid),serverTime:now};
}
const requireMember=(r,id)=>r.members[id]||fail(403,'You are no longer in this room.');
const host=(r,id)=>r.meta.hostId===id||fail(403,'Only the host can do that.');
function cooldown(m,key,ms,now){if(now-(m.limits[key]||0)<ms)fail(429,'Please wait a moment.');m.limits[key]=now}
function living(m){if(m.hp<=0)fail(409,'You are respawning.');}
function distance(a,b){return Math.hypot(a.pose.x-b.pose.x,a.pose.z-b.pose.z)}
export function applyAction(r,id,a,now){
 tick(r,now);const m=requireMember(r,id);m.lastSeen=now;
 switch(a.type){
 case 'sync':{
  if(a.pose&&m.hp>0){const p=a.pose;for(const k of ['x','y','z','yaw','sit','phase','speed'])if(typeof p[k]!=='number'||!Number.isFinite(p[k]))fail(400,'Invalid player position.');
   if(Math.abs(p.x)>19||p.z< -10||p.z>10||p.y<-.05||p.y>3||p.sit<0||p.sit>1||p.speed<0||p.speed>4)fail(400,'Position is outside the lounge.');
   // Allow only ordinary walking speed; a reserved seat has its own validated position.
   const elapsed=Math.min(2,Math.max(.05,(now-m.lastPoseAt)/1000));
   if(Math.hypot(p.x-m.pose.x,p.z-m.pose.z)<=4*elapsed+.8){m.pose={...p};m.lastPoseAt=now}
  }return;
 }
 case 'profile':Object.assign(m,profile(a.profile));return;
 case 'ready':m.ready=!!a.ready;return;
 case 'seat':{
  living(m);if(!/^[AB][1-5]$/.test(a.seatId))fail(400,'Invalid seat.');
  if(Object.values(r.members).some(x=>x.id!==id&&x.seatId===a.seatId))fail(409,'That seat is taken.');
  m.seatId=a.seatId;return;
 }
 case 'releaseSeat':m.seatId=null;return;
 case 'chat':{
  cooldown(m,'chat',700,now);const value=text(a.text,300);if(!value)fail(400,'Write a message.');
  r.messages.push({id:crypto.randomUUID(),senderId:id,senderName:m.name,color:m.color,text:value,timestamp:now});r.messages=r.messages.slice(-50);return;
 }
 case 'theme':host(r,id);if(!['cinema','couples','friends'].includes(a.theme))fail(400,'Unknown theme.');r.theme=a.theme;r.requests=[];
  for(const p of Object.values(r.members)){p.hp=100;p.respawnAt=0;p.shieldUntil=now+2000}emit(r,'theme',{theme:a.theme},now);return;
 case 'media':host(r,id);r.media=media(a.media);r.playback=playback(r.media,now);r.meta.screening=false;for(const p of Object.values(r.members))p.ready=!!p.bot;return;
 case 'playback':{
  host(r,id);if(r.media.kind==='embed')fail(409,'This provider uses its own playback controls.');
  const p=r.playback,delta=(now-p.updatedAt)/1000*p.rate;
  p.time=p.time+(p.playing?delta:0);if(p.duration)p.time=p.loop?p.time%p.duration:Math.min(p.duration,p.time);
  const change=a.change||{};
  if(change.time!==undefined)p.time=number(change.time,0,p.duration||86400);
  if(change.rate!==undefined)p.rate=number(change.rate,.25,2);
  if(change.duration!==undefined)p.duration=number(change.duration,0,86400);
  if(change.playing!==undefined)p.playing=!!change.playing;
  if(change.loop!==undefined)p.loop=!!change.loop;p.updatedAt=now;return;
 }
 case 'start':host(r,id);if(Object.values(r.members).some(x=>!x.ready))fail(409,'Everyone must be ready first.');r.meta.screening=true;r.playback.playing=r.media.kind!=='embed';r.playback.updatedAt=now;return;
 case 'mute':host(r,id);if(a.target===id)fail(400,'Use your own sound control.');requireMember(r,a.target).muted=!!a.muted;return;
 case 'kick':host(r,id);if(a.target===id)fail(400,'Use Leave to exit.');requireMember(r,a.target);if(a.ban)r.bans.push(a.target);delete r.members[a.target];r.requests=r.requests.filter(q=>q.from!==a.target&&q.to!==a.target);return;
 case 'bots':{
  host(r,id);const count=number(a.count,0,4);for(const [key,p]of Object.entries(r.members))if(p.bot)delete r.members[key];
  const seats=Array.from({length:10},(_,n)=>`${n<5?'A':'B'}${n%5+1}`).filter(s=>!Object.values(r.members).some(p=>p.seatId===s));
  for(let n=0;n<Math.floor(count)&&Object.keys(r.members).length<LIMIT;n++){const key='bot-'+n,p=member(key,{name:['Mira','Kenji','Zara','Ryu'][n],color:['#c6a0f6','#70ded5','#f5a97f','#a6da95'][n]},now,n);p.bot=true;p.ready=true;p.seatId=seats[n];p.pose={x:(Number(seats[n][1])-3)*2.04,y:seats[n][0]==='B'?.64:0,z:seats[n][0]==='B'?4.2:1.6,yaw:0,sit:1,phase:0,speed:0};r.members[key]=p;}return;
 }
 case 'affection':{
  if(r.theme!=='couples')fail(409,'Switch to Couples mode first.');living(m);cooldown(m,'affection',2500,now);
  const target=requireMember(r,a.target);if(target.id===id||target.bot)fail(400,'Choose another person.');living(target);
  if(!['hug','kiss','heart'].includes(a.kind))fail(400,'Unknown interaction.');
  if(r.requests.some(x=>x.from===id&&x.to===a.target))fail(409,'An invitation is already waiting.');
  r.requests.push({id:crypto.randomUUID(),from:id,to:a.target,kind:a.kind,expires:now+15000});return;
 }
 case 'respond':{
  const q=r.requests.find(x=>x.id===a.requestId&&x.to===id);if(!q)fail(404,'That invitation expired.');r.requests=r.requests.filter(x=>x.id!==q.id);
  if(a.accept){const from=requireMember(r,q.from);living(from);living(m);if(r.theme!=='couples')fail(409,'Couples mode is no longer active.');if(q.kind!=='heart'&&distance(from,m)>2.8)fail(409,'Move closer together first.');emit(r,'affection',{from:q.from,to:id,kind:q.kind},now)}return;
 }
 case 'shoot':{
  if(r.theme!=='friends')fail(409,'Blasters are available in Friends mode.');living(m);cooldown(m,'shoot',450,now);
  const target=requireMember(r,a.target);if(target.id===id)fail(400,'Choose another player.');living(target);
  if(now<target.shieldUntil)fail(409,'That player has a respawn shield.');
  if(distance(m,target)>5)fail(409,'Move within five metres.');
  // A direct shot is blocked by the cinema's recliners and room partition.
  if(blocked(m.pose,target.pose))fail(409,'Your shot is blocked.');
  target.hp=Math.max(0,target.hp-34);emit(r,'shot',{from:id,to:target.id,hp:target.hp},now);
  if(target.hp===0){target.deaths++;m.kills++;target.respawnAt=now+4000;target.seatId=null;emit(r,'eliminated',{from:id,to:target.id,respawnAt:target.respawnAt},now)}return;
 }
 case 'leave':delete r.members[id];tick(r,now);return;
 default:fail(400,'Unknown action.');
 }
}
function blocked(a,b){
 const steps=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)*12);
 for(let i=1;i<steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
  if(Math.abs(x-6.46)<.25&&(z<4.9||z>6.6))return true;
  for(const row of [-.65,3.7])for(const cx of [-4.08,-2.04,0,2.04,4.08])if(Math.abs(x-cx)<.67&&Math.abs(z-row)<.75)return true;
 }return false;
}
export class Store{
 constructor(db){this.db=db}
 async load(code){return this.db.prepare('SELECT state,version FROM rooms WHERE code=? AND expires_at>?').bind(code,Date.now()).first()}
 async insert(code,owner,state,now){return this.db.prepare('INSERT INTO rooms(code,owner,state,version,expires_at) VALUES(?,?,?,0,?)').bind(code,owner,JSON.stringify(state),now+TTL).run()}
 async update(code,version,state,now){const result=await this.db.prepare('UPDATE rooms SET state=?,version=version+1,expires_at=? WHERE code=? AND version=?').bind(JSON.stringify(state),now+TTL,code,version).run();return result.meta.changes>0}
 async limited(key,max,now){const result=await this.db.prepare('INSERT INTO rate_limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count').bind(key,Math.floor(now/60000)).first();if(result.count>max)fail(429,'Too many requests. Please try again shortly.')}
}
export async function handleApi(request,env){
 const url=new URL(request.url),now=Date.now();
 const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 try{
  const actor=request.headers.get('oai-authenticated-user-id');if(!actor)fail(401,'Sign in to access FrdLounge.');
  const uid=(await hash(actor)).slice(0,24),store=new Store(env.DB);
  if(request.method==='GET'&&url.pathname==='/api/session')return response({id:uid});
  if(!['GET','POST'].includes(request.method))fail(405,'Method not allowed.');
  let data={};if(request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)fail(403,'Cross-site request rejected.');
   if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'JSON required.');
   const raw=await request.text();if(raw.length>16000)fail(413,'Request is too large.');try{data=JSON.parse(raw)}catch{fail(400,'Invalid JSON.')}
  }
  if(url.pathname==='/api/rooms'&&request.method==='POST'){
   await store.limited('create:'+uid,5,now);const count=await env.DB.prepare('SELECT count(*) AS n FROM rooms WHERE owner=? AND expires_at>?').bind(uid,now).first();if(count.n>=5)fail(429,'You already have five active rooms.');
   const m=media(data.media||AMBIENT),r={meta:{title:text(data.title)||'A little movie night',hostId:uid,screening:false,online:true},theme:'cinema',media:m,playback:playback(m,now),members:{[uid]:member(uid,data.profile,now,0)},messages:[],events:[],eventSeq:0,requests:[],bans:[],dedupe:[]};
   const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;
   for(let n=0;n<5;n++){code=Array.from(crypto.getRandomValues(new Uint8Array(6)),v=>chars[v%chars.length]).join('');r.meta.code=code;try{await store.insert(code,uid,r,now);return response(snapshot(r,uid,now),201)}catch(e){if(!String(e).includes('UNIQUE'))throw e}}
   fail(503,'Please try creating the room again.');
  }
  const route=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(?:\/(join|actions))?$/);if(!route)fail(404,'Not found.');
  const [,code,operation]=route;
  if(operation==='join')await store.limited('join:'+uid,20,now);
  else await store.limited('actions:'+uid,360,now);
  for(let retry=0;retry<8;retry++){
   const row=await store.load(code);if(!row)fail(404,'Room not found or expired.');const r=JSON.parse(row.state);
   // Refresh a returning member before removing stale peers.
   if(r.members[uid]&&!r.bans.includes(uid))r.members[uid].lastSeen=now;tick(r,now);
   if(operation==='join'&&request.method==='POST'){
    if(r.bans.includes(uid))fail(403,'You were banned from this room.');
    if(!r.members[uid]){if(Object.keys(r.members).length>=LIMIT)fail(409,'All ten places are taken.');r.members[uid]=member(uid,data.profile,now,Object.keys(r.members).length)}
    if(!r.members[r.meta.hostId])r.meta.hostId=uid;
   }else{
    requireMember(r,uid);
    if(!operation&&request.method==='GET')return response(snapshot(r,uid,now));
    if(operation!=='actions'||request.method!=='POST')fail(405,'Method not allowed.');
    if(!data.id||typeof data.id!=='string'||data.id.length>80)fail(400,'Action id required.');
    if(r.dedupe.includes(uid+':'+data.id))return response(snapshot(r,uid,now));
    applyAction(r,uid,data,now);r.dedupe.push(uid+':'+data.id);r.dedupe=r.dedupe.slice(-120);
   }
   if(await store.update(code,row.version,r,now))return response(snapshot(r,uid,now));
  }
  fail(409,'The room changed. Please try again.');
 }catch(e){if(!(e instanceof ApiError))console.error('Room API error',e);return response({error:e instanceof ApiError?e.message:'The room service is temporarily unavailable.'},e.status||500)}
}

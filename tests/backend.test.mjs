import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleApi,applyAction,ApiError} from '../server/api.mjs';
function setup(){
 const db=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+f,'utf8'));
 const DB={prepare(sql){let args=[];const p=db.prepare(sql);return{bind(...a){args=a;return this},async first(){return p.get(...args)||null},async run(){return{meta:{changes:p.run(...args).changes}}}}}};
 const call=async(user,path,body,origin='https://lounge.test')=>{const headers={'oai-authenticated-user-id':user,origin,'content-type':'application/json'};if(!user)delete headers['oai-authenticated-user-id'];const res=await handleApi(new Request('https://lounge.test/api'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),{DB});return{...await res.json(),status:res.status}};
 const action=(u,c,type,b={})=>call(u,'/rooms/'+c+'/actions',{id:crypto.randomUUID(),type,...b});
 return{db,call,action};
}
async function room(s){const r=await s.call('host','/rooms',{title:'Friday',profile:{name:'Host'}});assert.equal(r.status,201);return r}
test('rooms enforce identity, origin, membership, and host-only playback',async()=>{
 const s=setup(),r=await room(s),code=r.room.code;
 assert.equal((await s.call('', '/session')).status,401);
 assert.equal((await s.call('guest','/rooms/'+code)).status,403);
 assert.equal((await s.call('guest','/rooms/'+code+'/join',{profile:{name:'Guest'}})).status,200);
 assert.equal((await s.action('guest',code,'playback',{change:{playing:true}})).status,403);
 assert.equal((await s.action('guest',code,'theme',{theme:'friends'})).status,403);
 assert.equal((await s.call('host','/rooms/'+code+'/actions',{type:'theme',id:'csrf',theme:'friends'},'https://evil.test')).status,403);
 assert.equal((await s.action('host',code,'playback',{change:{playing:true}})).playback.playing,true);
 assert.equal((await s.action('host',code,'theme',{theme:'couples'})).room.theme,'couples');
 s.db.close();
});
test('atomic seat reservation and retry-safe message actions',async()=>{
 const s=setup(),r=await room(s),c=r.room.code;await s.call('guest','/rooms/'+c+'/join',{profile:{name:'Guest'}});
 const seats=await Promise.all([s.action('host',c,'seat',{seatId:'A1'}),s.action('guest',c,'seat',{seatId:'A1'})]);assert.equal(seats.filter(x=>x.status===200).length,1);assert.equal(seats.filter(x=>x.status===409).length,1);
 const a={id:'one-message',type:'chat',text:'Hi!'};await s.call('host','/rooms/'+c+'/actions',a);const again=await s.call('host','/rooms/'+c+'/actions',a);assert.equal(again.messages.length,1);s.db.close();
});
test('couples invitations require the invited person to accept',async()=>{
 const s=setup(),r=await room(s),c=r.room.code;const guest=await s.call('guest','/rooms/'+c+'/join',{profile:{name:'Guest'}});
 await s.action('host',c,'theme',{theme:'couples'});const invite=await s.action('host',c,'affection',{target:guest.selfId,kind:'kiss'});assert.equal(invite.events.some(e=>e.type==='affection'),false);
 const id=invite.requests[0].id;assert.equal((await s.action('host',c,'respond',{requestId:id,accept:true})).status,404);
 const yes=await s.action('guest',c,'respond',{requestId:id,accept:true});assert.equal(yes.events.at(-1).kind,'kiss');assert.equal(yes.requests.length,0);s.db.close();
});
test('room capacity, kick and ban restrictions',async()=>{
 const s=setup(),r=await room(s),c=r.room.code;let g;for(let i=0;i<9;i++){g=await s.call('g'+i,'/rooms/'+c+'/join',{profile:{name:'Guest'}});assert.equal(g.status,200)}
 assert.equal((await s.call('overflow','/rooms/'+c+'/join',{profile:{name:'Guest'}})).status,409);
 assert.equal((await s.action('g8',c,'kick',{target:r.selfId})).status,403);
 await s.action('host',c,'kick',{target:g.selfId,ban:true});assert.equal((await s.call('g8','/rooms/'+c+'/join',{profile:{name:'Guest'}})).status,403);s.db.close();
});
function game(){const now=100000;const m=(id,x)=>({id,name:id,hp:100,pose:{x,y:0,z:-3,yaw:0,sit:0,phase:0,speed:0},lastSeen:now,lastPoseAt:now,limits:{},shieldUntil:0,kills:0,deaths:0,respawnAt:0});return{now,r:{meta:{hostId:'a'},theme:'friends',members:{a:m('a',0),b:m('b',1)},requests:[],events:[],eventSeq:0,messages:[],bans:[],media:{kind:'ambient'},playback:{}}}}
test('server hit rules, cooldown, death, respawn and invulnerability',()=>{
 const{r,now}=game();applyAction(r,'a',{type:'shoot',target:'b'},now);assert.equal(r.members.b.hp,66);
 assert.throws(()=>applyAction(r,'a',{type:'shoot',target:'b'},now+10),e=>e.status===429);
 applyAction(r,'a',{type:'shoot',target:'b'},now+500);applyAction(r,'a',{type:'shoot',target:'b'},now+1000);assert.equal(r.members.b.hp,0);assert.equal(r.members.a.kills,1);
 assert.throws(()=>applyAction(r,'b',{type:'shoot',target:'a'},now+1500),e=>e.status===409);
 applyAction(r,'a',{type:'sync'},now+5100);assert.equal(r.members.b.hp,100);assert.equal(r.members.b.respawnAt,0);
 assert.throws(()=>applyAction(r,'a',{type:'shoot',target:'b'},now+5600),e=>e.status===409);
});
test('shots outside range or through chairs fail, other themes have no combat',()=>{
 let {r,now}=game();r.members.b.pose.x=10;assert.throws(()=>applyAction(r,'a',{type:'shoot',target:'b'},now),e=>e.status===409);
 ({r,now}=game());r.members.a.pose={x:0,z:-2};r.members.b.pose={x:0,z:.5};assert.throws(()=>applyAction(r,'a',{type:'shoot',target:'b'},now),e=>e.status===409);
 ({r,now}=game());r.theme='couples';assert.throws(()=>applyAction(r,'a',{type:'shoot',target:'b'},now),e=>e.status===409);
});
test('disconnect transfers host and removes expired invitations',()=>{
 const{r,now}=game();r.members.a.lastSeen=now-40000;r.requests=[{id:'old',from:'a',to:'b',expires:now-1}];applyAction(r,'b',{type:'sync'},now);assert.equal(r.meta.hostId,'b');assert.equal(r.members.a,undefined);assert.equal(r.requests.length,0);
});
test('teleports and nonfinite movement cannot overwrite server positions',()=>{
 const{r,now}=game();applyAction(r,'a',{type:'sync',pose:{x:18,y:0,z:7,yaw:0,sit:0,phase:0,speed:0}},now+100);assert.equal(r.members.a.pose.x,0);
 assert.throws(()=>applyAction(r,'a',{type:'sync',pose:{x:NaN,y:0,z:0,yaw:0,sit:0,phase:0,speed:0}},now+200),e=>e.status===400);
});

function catalogSource(mediaType='movie',anime=false){return {
 id:'embed-1084242-vidstuck-test',kind:'embed',title:'Spider-Man: Brand New Day',
 url:'https://vidstuck.xyz/embed/movie/1084242?color=ffffff',
 catalog:{id:1084242,mediaType,title:'Spider-Man: Brand New Day',anime},
 selection:{server:'vidstuck',anime,season:1,episode:1,animeId:null,animeEpisode:1,animeEdition:'',preferences:{audio:'sub',source:'all',zokoTemplate:'',sandbox:true}}
}}
test('catalog movies, series and anime can create and join parties',async()=>{
 for(const [type,anime]of [['movie',false],['tv',false],['tv',true]]){
  const s=setup(),source=catalogSource(type,anime);
  const created=await s.call('host','/rooms',{title:'Catalog night',profile:{name:'Host'},media:source});
  assert.equal(created.status,201,created.error);
  const joined=await s.call('guest','/rooms/'+created.room.code+'/join',{profile:{name:'Guest'}});
  assert.equal(joined.status,200);assert.deepEqual(joined.source,source);
  const changed=catalogSource('tv');changed.catalog.id=1399;
  const shared=await s.action('host',created.room.code,'media',{media:changed});
  assert.equal(shared.status,200);assert.deepEqual(shared.source,changed);s.db.close();
 }
});
test('invalid catalog identity cannot be bypassed by selection fields',async()=>{
 for(const invalid of [{id:0},{id:'1084242'},{id:2147483648},{mediaType:'unknown'},{title:''}]){
  const s=setup(),source=catalogSource();Object.assign(source.catalog,invalid);
  source.selection.id=1084242;source.selection.mediaType='movie';
  const result=await s.call('host','/rooms',{media:source});assert.equal(result.status,400);s.db.close();
 }
});

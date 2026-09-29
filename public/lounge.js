let engine=null,party=null,panel=null,exitSeat=null,toastTimer=null,selected='',lastEvent=0;
const ambient={id:'afterlight',kind:'ambient',title:'Afterlight'};
const empty=id=>({status:'idle',selfId:id||'',room:null,members:[],source:ambient,playback:null,messages:[],requests:[],events:[],error:''});
function notice(message){if(!panel)return;const el=panel.querySelector('.frd-notice');el.textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.textContent=''},5000)}
export class FrdParty{
 constructor(profile,callbacks){this.profile=profile;this.callbacks=callbacks;this.state=empty();this.uid='';this.code='';this.media=ambient;this.disposed=false;this.pending=Promise.resolve();this.pose=null;this.lastPlayback=0;party=this;render();}
 get snapshot(){return this.state}get currentMedia(){return this.media}get connected(){return this.state.status==='connected'}get isHost(){return this.state.room?.hostId===this.uid}
 async request(path,body){const r=await fetch('/api'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const result=await r.json();if(!r.ok){const e=new Error(result.error||'Connection failed.');e.status=r.status;throw e}return result}
 async ready(){const s=await this.request('/session');this.uid=s.id;return{uid:this.uid}}
 publish(){if(!this.disposed){this.callbacks.onState(this.state);render()}}
 consume(s){if(this.disposed)return;const previousMedia=this.media.id;this.uid=s.selfId;this.state={...s,error:''};this.media=s.source;this.code=s.room.code;
  if(previousMedia!==this.media.id)this.callbacks.onMedia(this.media);
  if(s.playback?.updatedAt!==this.lastPlayback){this.lastPlayback=s.playback.updatedAt;this.callbacks.onPlayback({...s.playback,updatedAt:s.playback.updatedAt+(Date.now()-s.serverTime)},true)}
  const self=s.members.find(m=>m.id===this.uid);this.callbacks.onMuted(!!self?.muted);
  this.publish();for(const m of s.members)if(m.id!==this.uid&&m.pose)this.callbacks.onPose(m.id,m.pose);
  applyTheme(s.room.theme);
  for(const e of s.events||[])if(e.id>lastEvent){effect(e,s);lastEvent=Math.max(lastEvent,e.id)}
  if(engine){engine.frdDead=!!self&&self.hp<=0;engine.avatar.root.visible=!engine.frdDead;for(const [id,r]of engine.remotePlayers){const m=s.members.find(p=>p.id===id);r.avatar.root.visible=!!m&&m.hp>0&&(!m.bot||engine.serviceVisible)}}
 }
 async create(title,source){await this.leave(false);const s=await this.request('/rooms',{title,media:source,profile:this.profile});lastEvent=s.eventSeq;this.consume(s);this.poll()}
 async join(code){await this.leave(false);try{if(code.includes('://'))code=new URL(code).searchParams.get('party')||''}catch{}code=code.toUpperCase().replace(/[^A-Z0-9]/g,'');if(!/^[A-Z0-9]{6}$/.test(code))throw new Error('Enter the six-character invitation code.');const s=await this.request('/rooms/'+code+'/join',{profile:this.profile});lastEvent=s.eventSeq;this.consume(s);this.poll()}
 action(type,body={}){const generation=this.code;const run=async()=>{if(!generation||generation!==this.code)return;const s=await this.request('/rooms/'+generation+'/actions',{id:crypto.randomUUID(),type,...body});if(generation===this.code)this.consume(s);return s};const result=this.pending.then(run,run);this.pending=result.catch(()=>{});return result}
 safe(type,body){return this.action(type,body).catch(e=>{notice(e.message);this.callbacks.onNotice?.(e.message)})}
 poll(){clearTimeout(this.timer);const run=async()=>{if(this.disposed||!this.connected)return;try{await this.action('sync',{pose:this.pose})}catch(e){if([401,403,404].includes(e.status)){this.state={...empty(this.uid),error:e.message,status:'error'};this.code='';this.publish()}notice(e.message)}if(!this.disposed&&this.connected)this.timer=setTimeout(run,400)};this.timer=setTimeout(run,400)}
 sendPose(p){this.pose=p}updateProfile(p){this.profile=p;if(this.connected)this.safe('profile',{profile:p})}setReady(ready){if(this.connected)this.safe('ready',{ready})}
 async reserveSeat(seatId){if(!this.connected)return true;try{await this.action('seat',{seatId});return true}catch(e){notice(e.message);return false}}
 releaseSeat(){if(this.connected)this.safe('releaseSeat')}
 sendChatMessage(text){return this.action('chat',{text})}
 changePlayback(change){if(this.isHost)this.safe('playback',{change})}
 setDuration(id,duration){if(this.isHost&&id===this.media.id&&duration>0&&Math.abs((this.state.playback?.duration||0)-duration)>.1)this.safe('playback',{change:{duration}})}
 shareMedia(media){if(this.isHost)this.safe('media',{media})}
 startScreening(){if(!this.isHost||this.state.members.some(p=>!p.ready))return false;this.safe('start');return true}
 kick(target,ban=false){return this.action('kick',{target,ban})}mute(target,muted){return this.action('mute',{target,muted})}setBots(count){this.safe('bots',{count})}
 async leave(publish=true){clearTimeout(this.timer);if(this.code){try{await this.action('leave')}catch{}this.code=''}this.state=empty(this.uid);this.media=ambient;if(publish)this.publish()}
 dispose(){this.leave(false);this.disposed=true;if(party===this)party=null;render()}
}
function node(tag,props={},...children){const el=document.createElement(tag);for(const[k,v]of Object.entries(props))if(k.startsWith('on'))el.addEventListener(k.slice(2).toLowerCase(),v);else if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k==='disabled')el.disabled=v;else el.setAttribute(k,v);for(const c of children)el.append(c);return el}
function button(label,fn,disabled=false){return node('button',{type:'button',text:label,onClick:fn,disabled})}
export function connectEngine(value){engine=value;if(!value){panel?.remove();exitSeat?.remove();panel=null;exitSeat=null;return}panel=node('aside',{class:'frd-social','aria-label':'Lounge modes'},node('details',{open:''},node('summary',{text:'FrdLounge · together'}),node('div',{class:'frd-content'})),node('p',{class:'frd-notice',role:'status'}));document.body.append(panel);exitSeat=button('Stand up · E',()=>engine?.stand());exitSeat.className='frd-exit-seat';exitSeat.setAttribute('aria-label','Stand up and restore lounge controls');document.body.append(exitSeat);applyTheme('cinema');render();}
function render(){if(!panel)return;const content=panel.querySelector('.frd-content');content.replaceChildren();
 if(!party?.connected){content.append(node('p',{text:'Create or join a watch party to share this lounge.'}),node('small',{text:'Space to jump · E to sit · P for playback'}));return}
 const s=party.state,self=s.members.find(x=>x.id===party.uid),theme=s.room.theme;
 content.append(node('p',{class:'frd-room',text:s.room.title+' · '+s.room.code}));
 const tabs=node('div',{class:'frd-modes'});for(const[key,label]of [['cinema','Cinema'],['couples','Couples'],['friends','Friends']]){const b=button(label,()=>party.safe('theme',{theme:key}),!party.isHost);b.setAttribute('aria-pressed',String(theme===key));tabs.append(b)}content.append(tabs);
 const peers=s.members.filter(x=>x.id!==party.uid);if(!peers.some(p=>p.id===selected))selected=peers[0]?.id||'';
 if(peers.length){const select=node('select',{'aria-label':'Choose another player',onChange:e=>{selected=e.target.value}});for(const p of peers){const opt=node('option',{value:p.id,text:p.name+(p.bot?' · NPC':'')});opt.selected=p.id===selected;select.append(opt)}content.append(select)}
 if(theme==='couples'){
  content.append(node('p',{text:'Send an invitation. Your partner chooses whether to accept.'}));
  const actions=node('div',{class:'frd-actions'});for(const[k,l]of [['heart','♥ Heart'],['hug','Hug'],['kiss','Kiss']])actions.append(button(l,()=>party.safe('affection',{target:selected,kind:k}),!selected));content.append(actions);
  for(const q of s.requests||[]){const name=s.members.find(x=>x.id===q.from)?.name||'Your partner';if(q.to===party.uid){const request=node('div',{class:'frd-invite'},node('p',{text:name+' invited you to '+q.kind+'.'}));request.append(button('Accept',()=>party.safe('respond',{requestId:q.id,accept:true})),button('Decline',()=>party.safe('respond',{requestId:q.id,accept:false})));content.append(request)}else content.append(node('small',{text:'Invitation sent. Waiting for your partner…'}))}
 }else if(theme==='friends'){
  content.append(node('p',{text:self?.hp<=0?'Respawning in a moment…':`Health ${self?.hp||0} · ${self?.kills||0} eliminations`}));
  content.append(button('Fire blaster · Q',shoot,!selected||self?.hp<=0));content.append(node('small',{text:'Range: 5 m · three hits · 4-second respawn'}));
 }else content.append(node('p',{text:'Settle in, choose your seats, and let the host start the film.'}));
 content.append(node('small',{text:party.isHost?'You choose the room’s mode.':'The host chooses the room’s mode.'}));
}
function shoot(){if(party?.connected&&selected)party.safe('shoot',{target:selected})}
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='q'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target?.closest('input,textarea,select,[contenteditable="true"]')&&party?.state.room?.theme==='friends'&&engine?.inputsEnabled){e.preventDefault();shoot()}});
function applyTheme(theme){if(!engine||engine.frdTheme===theme)return;engine.frdTheme=theme;document.documentElement.dataset.loungeTheme=theme;engine.applyLoungeTheme?.(theme);}
function effect(e,s){if(!engine)return;const name=id=>s.members.find(p=>p.id===id)?.name||'A friend';
 if(e.type==='affection'){notice(`${name(e.from)} and ${name(e.to)} shared a ${e.kind}.`);engine.loungeAffection?.(e.from,e.to,party.uid,e.kind)}
 if(e.type==='shot'){engine.loungeShot?.(e.from,e.to,party.uid);if(e.to===party.uid)notice(`Hit! ${e.hp} health remaining.`)}
 if(e.type==='eliminated'){notice(`${name(e.to)} is out — returning in 4 seconds.`)}
 if(e.type==='respawn'&&e.player===party.uid){engine.resetView();notice('You are back! Two-second respawn shield.');}
}

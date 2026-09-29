from pathlib import Path
p=Path('public/app.js');s=p.read_text()
assert 'class gU{' in s
s='import {FrdParty,connectEngine} from "/lounge.js";\n'+s
a=s.index('class gU{');b=s.index('function vU()',a);s=s[:a]+'class gU extends FrdParty{}'+s[b:]
s=s.replace('t.current.onEngine(a))','t.current.onEngine(a),connectEngine(a))').replace('t.current.onEngine(null)}','t.current.onEngine(null),connectEngine(null)}')
s=s.replace('be?"catalog":"party")','be?"catalog":Pe==="controls"?"controls":"party")')
s=s.replace('children:"Move"','children:"Move · Space to jump"')
s=s.replace('AethoFlix','FrdLounge').replace('AETHOFLIX','FRDLOUNGE').replace('A E T H O F L I X','F R D L O U N G E')
# Replace the triangular brand with a linked F/L monogram.
s=s.replace('M18.1 3 2 34.5h7.8L22 10.5 18.1 3Z','M4 5h24v7H11v7h13v7H11v9H4Z').replace('m24.5 15.7-4.1 8 5.6 10.8H34l-9.5-18.8Z','M27 16h6v19H17v-6h10Z').replace('m17.1 27.2 6.1 3.5-6.1 3.5v-7Z','M30 4h3v7h-3Z')
# New curved lounge pods with illuminated plinths; retain seat coordinates for navigation.
a=s.index('function CY(n){');b=s.index('function mb(',a)
s=s[:a]+'''function CY(n){const e=new e0,t=new DA;
t.box([1.25,.08,1.25],[0,.08,-.02],n.led,.06);
t.box([1.19,.32,1.18],[0,.28,-.03],n.metal,.13);
t.box([1.08,.3,1.13],[0,.58,-.04],n.cushion,.14);
t.box([1.19,.8,.23],[0,1.03,.45],n.leather,.12,[.12,0,0]);
t.box([.92,.49,.18],[0,1.04,.28],n.cushion,.085,[.12,0,0]);
for(const x of [-1,1]){t.box([.18,.55,.92],[x*.53,.68,-.03],n.leather,.08);t.box([.2,.045,.75],[x*.53,.98,-.02],n.woodLight,.02);}
t.box([.72,.24,.5],[0,.28,-.82],n.cushion,.10);
t.finish(e);return e}'''+s[b:]
# Woven textile, ribbed acoustic walls and terrazzo-like floors replace old leather/wood textures.
s=s.replace('n==="carpet"&&(f=80+a()*125+(d%3===0?15:0))','n==="carpet"&&(f=150+a()*45+((u+d)%19===0?45:0))')
s=s.replace('n==="acoustic"&&(f=d%5===0&&u%5===0?40:180+a()*50)','n==="acoustic"&&(f=d%16<3?65:205+a()*25)')
s=s.replace('n==="wood"&&(f=105+Math.sin(d*.2+Math.sin(u*.013)*1.3)*34+a()*28)','n==="wood"&&(f=180+Math.sin(d*.06)*8+a()*16),n==="leather"&&(f=(u%4<2?155:220)+(d%4<2?10:-10))')
methods='''applyLoungeTheme(theme){
 const palettes={cinema:{seat:'#167e88',pad:'#50b5b6',accent:'#71f1de',wall:'#172534',floor:'#263947'},couples:{seat:'#823a6e',pad:'#d278a4',accent:'#ff9cce',wall:'#32213e',floor:'#403048'},friends:{seat:'#36368b',pad:'#716cda',accent:'#6feaff',wall:'#151f40',floor:'#233356'}};
 const p=palettes[theme]||palettes.cinema,m=this.environment.materials;
 for(const [key,color]of Object.entries({leather:p.seat,cushion:p.pad,piping:p.accent,wall:p.wall,carpet:p.floor,platform:p.floor,acoustic:p.wall,acousticDark:p.wall,wood:'#263f53',woodLight:'#8ba9b6',ceiling:'#122438',brass:p.accent,metal:'#426171',hallway:p.wall,planter:'#8ba9b6'})){m[key]?.color.set(color);if(m[key])m[key].needsUpdate=true;}
 for(const key of ['leather','cushion']){m[key].roughness=.91;m[key].clearcoat=0;}
 for(const key of ['led','ledSoft','fixture']){m[key].color.set(p.accent);m[key].emissive.set(p.accent)}
 if(!this.frdDecor){this.frdDecor=new e0;const builder=new DA;
 // Tall neon wall frames, replacing the room's visual emphasis with a modern lounge.
 for(const x of [-6.15,6.15])for(const z of [-4.4,-1.9,1.0]){builder.box([.055,2.1,.065],[x,2.95,z],m.led,.02);builder.box([.055,.065,1.05],[x,4.0,z+.49],m.led,.02);}
 builder.finish(this.frdDecor);this.scene.add(this.frdDecor);}
 this.renderer.shadowMap.needsUpdate=true;
}
loungeShot(from,to,self){const a=from===self?this.avatar:this.remotePlayers.get(from)?.avatar,b=to===self?this.avatar:this.remotePlayers.get(to)?.avatar;if(!a||!b)return;
 const start=a.root.position.clone().add(new he(0,1.25,0)),end=b.root.position.clone().add(new he(0,1.1,0)),length=start.distanceTo(end);
 const bolt=new Lt(new dn(.026,.026,length,8),new Ei({color:'#76f9ff'}));bolt.position.copy(start).add(end).multiplyScalar(.5);bolt.quaternion.setFromUnitVectors(new he(0,1,0),end.clone().sub(start).normalize());this.scene.add(bolt);this.frdEffects??=[];this.frdEffects.push({mesh:bolt,until:this.time+.18});
}
loungeAffection(from,to,self,kind){const a=from===self?this.avatar:this.remotePlayers.get(from)?.avatar,b=to===self?this.avatar:this.remotePlayers.get(to)?.avatar;if(!a||!b)return;
 this.frdAffection={a,b,kind,until:this.time+2.2};this.callbacks.onMessage(kind==='kiss'?'A little kiss, a shared moment.':kind==='hug'?'A warm hug.':'Sending love.');
}
updateLoungeEffects(){
 if(this.frdEffects)this.frdEffects=this.frdEffects.filter(e=>{if(this.time<e.until)return true;this.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();return false});
 const f=this.frdAffection;if(!f)return;if(this.time>f.until){this.frdAffection=null;return;}
 const av=f.a.root,bv=f.b.root;const angle=Math.atan2(bv.position.x-av.position.x,bv.position.z-av.position.z);av.rotation.y=angle+Math.PI;bv.rotation.y=angle;
 if(f.kind==='hug'){f.a.leftArm.rotation.x=-1.15;f.a.rightArm.rotation.x=-1.15;f.b.leftArm.rotation.x=-1.15;f.b.rightArm.rotation.x=-1.15;}
 if(f.kind==='kiss'){f.a.body.rotation.x=.15;f.b.body.rotation.x=.15;}
 const progress=1-Math.abs((f.until-this.time)/1.1-1);if(f.kind!=='heart'){const mid=av.position.clone().add(bv.position).multiplyScalar(.5),dir=bv.position.clone().sub(av.position).normalize();av.position.lerp(mid.clone().addScaledVector(dir,-.23),progress*.25);bv.position.lerp(mid.clone().addScaledVector(dir,.23),progress*.25);}
}
'''
s=s.replace('updateMovement(e){',methods+'updateMovement(e){if(this.frdDead){this.velocity.set(0,0);return;}')
s=s.replace('this.animateAvatar(i),this.updateNpcs(i)','this.animateAvatar(i),this.updateLoungeEffects(),this.updateNpcs(i)')
p.write_text(s)
p=Path('public/index.html');h=p.read_text().replace('AethoFlix','FrdLounge').replace('AETHOFLIX','FRDLOUNGE');h=h.replace('</head>','<link rel="stylesheet" href="/lounge.css"/><link rel="icon" href="/logo.svg"/></head>');p.write_text(h)

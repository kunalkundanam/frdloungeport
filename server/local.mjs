import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import {readFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import worker from './worker.mjs';
await mkdir('.local',{recursive:true});
const sqlite=new DatabaseSync('.local/frdlounge.sqlite');
sqlite.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS _migrations(name TEXT PRIMARY KEY)');
for(const name of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort())if(!sqlite.prepare('SELECT 1 FROM _migrations WHERE name=?').get(name)){sqlite.exec(await readFile('drizzle/'+name,'utf8'));sqlite.prepare('INSERT INTO _migrations VALUES(?)').run(name)}
const DB={prepare(sql){const p=sqlite.prepare(sql);let args=[];return{bind(...values){args=values;return this},async first(){return p.get(...args)||null},async run(){const r=p.run(...args);return{meta:{changes:Number(r.changes)}}},async all(){return{results:p.all(...args)}}}}};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const ASSETS={async fetch(request){const path=resolve('public','.'+decodeURIComponent(new URL(request.url).pathname));if(!path.startsWith(resolve('public')+'/'))return new Response('',{status:404});try{return new Response(await readFile(path),{headers:{'Content-Type':mime[extname(path)]||'application/octet-stream'}})}catch{return new Response('',{status:404})}}};
const server=createServer(async(req,res)=>{try{
 const origin='http://127.0.0.1:4174',headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(v&&!k.startsWith('oai-'))headers.set(k,Array.isArray(v)?v.join(','):v);
 let session=req.headers.cookie?.match(/(?:^|; )frd_local=([a-f0-9]{64})(?:;|$)/)?.[1],cookie;
 if(!session){session=randomBytes(32).toString('hex');cookie=`frd_local=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`}
 headers.set('oai-authenticated-user-id','local:'+session);
 const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16000){res.writeHead(413);res.end('Request too large');return}chunks.push(chunk)}
 const response=await worker.fetch(new Request(origin+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}),{DB,ASSETS});
 res.writeHead(response.status,{...Object.fromEntries(response.headers),...(cookie?{'Set-Cookie':cookie}:{})});res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e);res.writeHead(500);res.end('Local server error')}});
server.listen(4174,'127.0.0.1',()=>console.log('FrdLounge preview: http://127.0.0.1:4174'));

import {handleApi} from './api.mjs';
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/'))return handleApi(request,env);
  if(!env.ASSETS)return new Response('Static assets unavailable',{status:503});
  let response=await env.ASSETS.fetch(request);
  if(response.status===404&&!url.pathname.split('/').pop().includes('.'))response=await env.ASSETS.fetch(new Request(new URL('/index.html',url),request));
  return response;
 }
};

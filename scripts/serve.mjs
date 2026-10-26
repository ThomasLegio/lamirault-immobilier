import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const args=process.argv.slice(2);const value=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const port=Number(value('--port','4173'));const host=value('--host','127.0.0.1');const root=path.resolve(import.meta.dirname,'..',args.includes('--dist')?'dist':'.');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon','.pdf':'application/pdf'};
http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(['/estimation','/estimation/','/estimation/index.html'].includes(pathname)){res.writeHead(308,{'Location':'/demande-estimation/'+new URL(req.url,'http://localhost').search});res.end();return;}
  if(pathname.split('/').some(p=>p.startsWith('.'))||/^\/(scripts|content)(\/|$)/.test(pathname)){res.writeHead(404);res.end();return;}
  let file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return;}
  try{if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');}catch{}
  let data,status=200;try{data=await fs.readFile(file);}catch{status=404;file=path.join(root,'404.html');data=await fs.readFile(file);}
  res.writeHead(status,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(400);res.end('Bad request');}
}).listen(port,host,()=>console.log(`Lamirault Immobilier: http://${host}:${port}`));

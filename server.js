'use strict';
// Servidor local de teste. Na Vercel, a pasta /api/pix é publicada como Functions.
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs/promises');
const {URL}=require('node:url');
const API={
  '/api/pix/create':require('./api/pix/create'),
  '/api/pix/status':require('./api/pix/status'),
  '/api/pix/health':require('./api/pix/health'),
};
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon'};
const root=path.resolve(__dirname);
const port=Number(process.env.PORT||3000);
http.createServer(async(req,res)=>{
  let url;
  try {url=new URL(req.url,'http://localhost');}
  catch{return void (res.statusCode=400,res.end('URL inválida'));}
  const fn=API[url.pathname];
  if(fn){
    req.query=Object.fromEntries(url.searchParams);
    let chunks=[];
    try{
      for await(const c of req){chunks.push(c);if(Buffer.concat(chunks).length>16384)throw Error('large');}
      req.body=chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};
    }catch{res.statusCode=400;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:false,error:{code:'invalid_json',message:'Dados inválidos.'}}));}
    return fn(req,res);
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;return res.end('Método não permitido');}
  const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const dest=path.resolve(root,relative);
  if(dest!==root&&!dest.startsWith(root+path.sep)){res.statusCode=403;return res.end('Proibido');}
  if(dest.includes(path.sep+'api'+path.sep)||dest.endsWith('.json')||dest.endsWith('server.js')){res.statusCode=404;return res.end('Não encontrado');}
  try{const buffer=await fs.readFile(dest);res.setHeader('Content-Type',MIME[path.extname(dest)]||'application/octet-stream');res.statusCode=200;res.end(req.method==='HEAD'?undefined:buffer);}
  catch{res.statusCode=404;res.end('Não encontrado');}
}).listen(port,()=>console.log(`Kit disponível em http://localhost:${port}`));

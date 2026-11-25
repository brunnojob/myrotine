import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('web');
const portArg=process.argv.indexOf('--port');
const port=Number(process.env.PORT || (portArg>=0?process.argv[portArg+1]:3000));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
createServer(async (req,res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url,'http://localhost').pathname));
    if (!path.startsWith(root+sep)) {res.writeHead(403).end();return;}
    const content = await readFile(path);
    res.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});res.end(content);
  } catch {res.writeHead(404).end('Não encontrado');}
}).listen(port,'0.0.0.0',()=>console.log('MyRotine em http://localhost:'+port));

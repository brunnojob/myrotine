import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ApiError, createCoarena } from './coarena.mjs';
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const security = {'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"};
export function createApp({root = resolve('web'), key = process.env.COARENA_API_KEY, model = process.env.COARENA_MODEL || 'gpt-6-luna', client = createCoarena({key, model})} = {}) {
  const sessions = new Map();
  function session(req, res) {
    const now = Date.now();
    for (const [id, entry] of sessions) if (entry.expires < now) sessions.delete(id);
    const id = /(?:^|;\s*)myrotine_session=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (id && sessions.has(id)) return sessions.get(id);
    if (sessions.size >= 500) throw new ApiError(503, 'Servidor ocupado. Tente mais tarde.');
    const token = randomBytes(24).toString('hex');
    const entry = {expires: now + 3600000, ids: new Set(), times: [], busy: false};
    sessions.set(token, entry);
    res.setHeader('Set-Cookie', `myrotine_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`);
    return entry;
  }
  return createServer(async (req, res) => {
    for (const [k,v] of Object.entries(security)) res.setHeader(k,v);
    const json = (status, body) => {res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(body));};
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname.startsWith('/api/')) {
        // This personal server is deliberately restricted to loopback, including Host validation against DNS rebinding.
        if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host || '')) throw new ApiError(403, 'Use o servidor local para acessar o assistente.');
        if (pathname === '/api/ai/status' && req.method === 'GET') return json(200, {available: Boolean(key), model});
        if (!['/api/ai/chat', '/api/ai/feedback'].includes(pathname)) throw new ApiError(404, 'Endpoint não encontrado.');
        if (req.method !== 'POST') throw new ApiError(405, 'Método não permitido.');
        if (!req.headers.origin || req.headers.origin !== `http://${req.headers.host}`) throw new ApiError(403, 'Origem não permitida.');
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new ApiError(415, 'Envie JSON.');
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          chunks.push(chunk); size += chunk.length;
          if (size > 20000) throw new ApiError(413, 'Mensagem muito grande.');
        }
        let body;
        try {body = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw new ApiError(400, 'JSON inválido.');}
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'JSON inválido.');
        const current = session(req,res);
        current.times = current.times.filter(t => t > Date.now() - 60000);
        if (current.busy || current.times.length >= 8) throw new ApiError(429, 'Aguarde antes de enviar outra solicitação.');
        current.times.push(Date.now()); current.busy = true;
        try {
          if (pathname === '/api/ai/chat') {
            const reply = await client.chat(body.message);
            current.ids.add(reply.id);
            return json(200, reply);
          }
          if (!current.ids.has(body.id)) throw new ApiError(403, 'Esta resposta não pertence à sua sessão.');
          return json(200, await client.feedback(body.id, body.rating));
        } finally {current.busy = false;}
      }
      if (!['GET','HEAD'].includes(req.method)) throw new ApiError(405, 'Método não permitido.');
      const path = resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
      if (!path.startsWith(root + sep)) throw new ApiError(403, 'Acesso negado.');
      let content;
      try {content = await readFile(path);} catch {throw new ApiError(404, 'Não encontrado.');}
      res.writeHead(200, {'Content-Type': types[extname(path)] || 'application/octet-stream'});
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {json(error instanceof ApiError ? error.status : 500, {error: error instanceof ApiError ? error.message : 'Erro interno do servidor.'});}
  });
}

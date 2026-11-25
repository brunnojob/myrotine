const messages = [];
let available = null, busy = false, error = '', draft = '';
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function assistantView() {
  return `<div class="page-heading"><div><p class="eyebrow">UM PASSO DE CADA VEZ</p><h1>Assistente de rotina</h1><p class="sub">Converse sobre organização, prioridades e metas.</p></div></div>
  <section class="panel panel-body ai-panel">
  <div class="notice soft">Ao enviar, somente o texto que você escrever será compartilhado com a Coarena para gerar uma resposta. Seus registros não são enviados. Cada pergunta é independente. A conversa fica apenas na memória desta página e some ao recarregar.</div>
  <p>As sugestões podem conter erros. O assistente não cria registros ou lembretes e não substitui orientação profissional de saúde.</p>
  <p role="status">${available === null ? 'Verificando disponibilidade…' : available ? 'Assistente disponível' : 'IA indisponível nesta hospedagem. Use a versão com servidor Node e Coarena configurada; o GitHub Pages oferece apenas o app local.'}</p>
  <div class="ai-messages" aria-live="polite">${messages.map((m,i)=>`<article class="ai-message"><strong>${m.role === 'user' ? 'Você' : 'Assistente'}</strong><p>${esc(m.content)}</p>${m.id?`<div class="card-actions"><button class="btn secondary" data-ai-rate="up" data-ai-index="${i}" aria-pressed="${m.rating==='up'}" ${busy?'disabled':''}>Útil</button><button class="btn secondary" data-ai-rate="down" data-ai-index="${i}" aria-pressed="${m.rating==='down'}" ${busy?'disabled':''}>Não ajudou</button></div>`:''}</article>`).join('')}</div>
  <form id="ai-form"><label class="field">Como posso ajudar a organizar seu dia?<textarea name="message" maxlength="4000" required placeholder="Como dividir uma meta grande em passos semanais?" ${!available||busy?'disabled':''}>${esc(draft)}</textarea></label><p class="error" role="alert">${esc(error)}</p><div class="card-actions"><button class="btn" ${!available||busy?'disabled':''}>${busy?'Aguarde…':'Enviar à Coarena'}</button><button type="button" class="btn secondary" id="ai-clear" ${busy?'disabled':''}>Limpar conversa</button></div></form></section>`;
}
function refresh() { if (location.hash === '#assistant') window.dispatchEvent(new Event('assistant-update')); }
async function post(path, body) {
  const response = await fetch(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(50000)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir. Tente novamente.');
  return result;
}
export async function checkAssistant() {
  try {const response=await fetch('/api/ai/status',{cache:'no-store'}); available=response.ok && (await response.json()).available === true;} catch {available=false;}
  refresh();
}
document.addEventListener('input',e=>{if(e.target.matches('#ai-form textarea'))draft=e.target.value;});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='ai-form')return;
  e.preventDefault(); if(busy||!available)return;
  const message=draft.trim(); if(!message)return;
  busy=true;error='';refresh();
  try {
    const reply=await post('/api/ai/chat',{message});
    messages.push({role:'user',content:message},{role:'assistant',...reply});draft='';
  } catch(err) {error=err.name==='TimeoutError'?'A resposta demorou demais. Tente novamente.':err.message;}
  finally {busy=false;refresh();}
});
document.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button||busy)return;
  if(button.id==='ai-clear'){messages.length=0;draft='';error='';refresh();return;}
  if(!button.dataset.aiRate)return;
  const message=messages[Number(button.dataset.aiIndex)];if(!message?.id)return;
  const rating=message.rating===button.dataset.aiRate?null:button.dataset.aiRate;
  busy=true;error='';refresh();
  try {await post('/api/ai/feedback',{id:message.id,rating});message.rating=rating;}
  catch(err){error=err.message;}
  finally{busy=false;refresh();}
});

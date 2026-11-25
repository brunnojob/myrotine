// Server-only adapter. Never copy this module or environment variables into web/.
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const BASE = 'https://coarena.ai/api/v1';
export function createCoarena({key, model = 'gpt-6-luna', fetchImpl = fetch} = {}) {
  async function post(path, body) {
    if (!key) throw new ApiError(503, 'Assistente não configurado no servidor.');
    let response;
    try {
      response = await fetchImpl(`${BASE}/${path}`, {
        method: 'POST', headers: {'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json'},
        body: JSON.stringify(body), signal: AbortSignal.timeout(45000), redirect: 'error'
      });
    } catch { throw new ApiError(502, 'Não foi possível conectar à IA. Tente novamente.'); }
    if (!response.ok) throw new ApiError(response.status === 429 ? 429 : 502,
      response.status === 429 ? 'Limite da IA atingido. Aguarde antes de tentar novamente.' : 'A IA está indisponível. Confira a configuração do servidor.');
    try { return await response.json(); } catch { throw new ApiError(502, 'Resposta inválida da IA.'); }
  }
  return {
    async chat(message) {
      if (typeof message !== 'string' || !message.trim() || message.length > 4000)
        throw new ApiError(400, 'Escreva uma mensagem de até 4.000 caracteres.');
      const reply = await post('chat/completions', {
        model, max_tokens: 1200, messages: [
          {role: 'system', content: 'Você é o assistente do MyRotine. Responda em português brasileiro, com clareza, ajudando a organizar tarefas, metas e rotina. Você não tem acesso aos registros do usuário e não executa ações nem cria lembretes. Não afirme ter salvado ou alterado dados. Não invente fontes científicas. Para saúde, ofereça somente informação geral, sem diagnóstico, prescrição, dietas ou treinos individualizados; encaminhe à Base científica do aplicativo e a um profissional. Não solicite senhas, dados completos de cartão ou prontuários.'},
          {role: 'user', content: message.trim()}
        ]
      });
      const content = reply.choices?.[0]?.message?.content;
      if (typeof reply.id !== 'string' || typeof content !== 'string' || !content.trim())
        throw new ApiError(502, 'A IA não retornou uma resposta. Tente novamente.');
      return {id: reply.id, content, model};
    },
    async feedback(id, rating) {
      if (typeof id !== 'string' || !['up', 'down', null].includes(rating))
        throw new ApiError(400, 'Avaliação inválida.');
      await post('feedback', {request_id: id, rating});
      return {ok: true};
    }
  };
}

# Arquitetura

MyRotine 0.1 é um aplicativo web local-first em português, sem dependências de runtime e sem backend. Funciona em hospedagem estática e em localhost. Não é um serviço multiusuário de produção.

## Estrutura

- `web/app.js`: apresentação, navegação por hash, formulários e eventos.
- `web/domain.js`: validação, recorrência, dinheiro em centavos, CNPJ, backup e calendário.
- `web/evidence.js`: catálogo de fontes e conteúdo por faixa etária.
- `web/style.css`: sistema visual responsivo e estados de interação.
- `web/sw.js`: cache do aplicativo, sem cache de dados de terceiros.
- `scripts/`: servidor de desenvolvimento e build estático.
- `tests/`: testes de regras de negócio com Node Test Runner.

## Persistência e privacidade

Um documento JSON versionado é salvo em `localStorage`, na chave `myrotine.v1`. Não há telemetria, anúncios, SDKs externos, fontes remotas ou transferência automática de registros. A demonstração usa memória e é descartada ao sair/recarregar. A sincronização entre abas usa o evento `storage`; gravações simultâneas seguem last-write-wins. Não há sincronização entre aparelhos.

O armazenamento local **não é um cofre**: qualquer pessoa com acesso ao perfil do navegador pode ler os registros. Não armazenar número completo de cartão, CVV, senha ou prontuários. O backup JSON não é criptografado. A aplicação escapa texto antes de renderizar HTML, valida backups antes de importar e limita tamanho de arquivos. O servidor de desenvolvimento define CSP, nosniff e Referrer-Policy; em outro host, configure esses cabeçalhos no provedor.

## Registros

Tipos: tarefa, fatura, consulta, serviço, meta, alimentação e exercício. Campos comuns: UUID, título, categoria, data local, hora opcional, situação, observação, recorrência e antecedência. Campos específicos: valor em centavos, cliente/profissional/local, empresa, total da meta, progresso e unidade.

Empresas têm identificador, nome e CNPJ. Os dígitos verificadores são validados localmente no formato numérico e alfanumérico; isso não comprova existência, titularidade ou regularidade fiscal.

## Lembretes e recorrência

- A agenda e a central de pendências funcionam sem permissões extras.
- A API Notification é consultada a cada 30 segundos com o app aberto. O sistema operacional pode limitar entrega. Não há push em segundo plano.
- Ao concluir um registro recorrente, a próxima ocorrência é criada. Diária: +1 dia; semanal: +7 dias; mensal: mesmo dia no mês seguinte, limitado ao último dia disponível. O dia original é preservado: 31/01 → 28/02 → 31/03. Reabrir não remove a ocorrência futura.
- O arquivo ICS usa UTC convertido do fuso do dispositivo, `VALARM`, IDs estáveis e `RRULE`. Não inclui observações, valores ou contatos. O título é incluído, podendo ser sensível.
- Importe os eventos apenas uma vez e confira duplicatas/alertas. Reexportar não é sincronização. Para dias 29–31, a exportação usa BYMONTHDAY e BYSETPOS para ajustar meses curtos; confirme se o aplicativo de destino respeita essas regras.
- Alterar o fuso do dispositivo altera a interpretação dos horários locais. O fuso aparece em Preferências. Não há agenda de fusos por evento.

## Evolução para serviço multiusuário

Antes de receber dados reais de vários usuários: autenticação e autorização por proprietário, banco de dados com isolamento entre usuários, política de retenção/exclusão, criptografia e gestão de chaves, auditoria, backups com restauração testada, fila de lembretes com idempotência, consentimento de canais e revisão de privacidade. Não conectar o localStorage a um banco público sem essas etapas.

A camada de domínio é independente da UI; o adaptador de persistência pode ser substituído por uma API. A curadoria de saúde precisa de revisão clínica formal, versionamento e processo editorial antes de ampliar para orientações personalizadas.

# Negociação IA Autônoma — Fase 2.1

## Visão

O comprador configura um **plano de negociação** na equalização; o motor executa ciclos (fechar rodada → analisar → abrir próxima) até critério de parada. O fornecedor continua respondendo manualmente no portal.

**Feature premium:** `ai_negotiation_autonomous` (requer também `ai_negotiation`).

## Entidades (migration `074`)

| Tabela | Uso |
|--------|-----|
| `quotation_negotiation_plans` | Parâmetros do evento (rodadas min/max, tolerâncias, estratégia, gate de aprovação) |
| `quotation_negotiation_runs` | Execução: status, rodada atual, métricas |
| `negotiation_counter_offers` | Schema Fase 2.2 — alvos por item/fornecedor/rodada |
| `negotiation_decision_logs` | Auditoria de decisões (IA + sistema) |

## APIs

| Método | Rota | Descrição |
|--------|------|-----------|
| GET/POST | `/api/quotations/[id]/negotiation-plans` | Listar / criar plano |
| POST | `/api/negotiation-plans/[id]/start` | Iniciar execução |
| POST | `/api/negotiation-runs/[id]/tick` | Próximo passo (`forceApprove` opcional) |
| POST | `/api/negotiation-runs/[id]/pause` | Pausar execução |
| POST | `/api/negotiation-runs/[id]/cancel` | Encerrar evento (comprador) |
| POST | `/api/negotiation-runs/background-tick` | Job interno (proxy / maintenance key) |

## Motor (`lib/negotiation/motor.ts`)

Estados principais: `waiting_deadline` → `closing_round` → `analyzing` → (`awaiting_approval`) → `opening_round` → … → `completed` | `paused` | `failed`.

Fase 2.1: análise com regras (rodadas mín/máx, preço vs alvo). Integração com `quotation-ai-analysis` para JSON acionável prevista na 2.2.

## UI

- **Nova cotação** (`/comprador/cotacoes/nova`): chaveamento + parâmetros antes do envio; com IA ligada, **Enviar Cotação** cria o plano e inicia o motor (redireciona para equalização).
- **Equalização**: painel para acompanhar execução ou ativar negociação em cotação enviada manualmente.
- **Detalhe da cotação**: sem painel de negociação (após envio, usar equalização).
- Gate de exibição: `useAiNegotiationUiAccess()` — **não** usa bypass de superadmin; respeita o tenant selecionado.

## Início automático da rodada 1

Ao clicar **Iniciar negociação**, o motor:
1. Cria **rodada 1** + convites `invited` se ainda não existir rodada.
2. Publica a cotação (`draft` → `waiting`) quando aplicável.
3. Se já houver rodada fechada (cotação em andamento), inicia em modo **analisando** essa rodada.

## Gaps 2.1 (estabilização)

| Item | Implementação |
|------|----------------|
| Sync rodada na equalização | `fetchEqualizationData({ preferActiveRound: true })` após ações do motor |
| Worker em background | `GET/POST /api/cron/background-jobs` — Vercel Cron a cada 2 min (`vercel.json`); também disparado pelo proxy com cooldown |
| Encerrar evento | `POST /api/negotiation-runs/[id]/cancel` + botão no painel |
| Bloqueio de 2º evento | `startNegotiationRun` recusa se já houver execução ativa/pausada na mesma cotação |
| Lock de tick (migration `075`) | `tick_in_progress_at` evita ticks concorrentes abrindo várias rodadas |
| Uma rodada ativa | `openQuotationRound` fecha rodadas `active` antes de abrir a próxima |

## Próximas fases

- **2.2:** Contrapropostas em `negotiation_counter_offers` + exibição no portal fornecedor
  - `per_item`: mesmo alvo para todos os fornecedores do item
  - `per_supplier`: alvo por fornecedor com base em % de saving (qualidade vs preço absoluto)
  - Sem alerta ao comprador se fornecedor não melhorou — apenas log; análise consultiva opcional (`ai_negotiation`)
- **2.3:** Políticas completas (±5%/−15%, parada sem melhoria) + relatório PDF/Excel
- **2.4:** Agrupamento (categoria/CC) + score no prompt

## Admin

Em **Admin → Tenant → Funcionalidades**, habilitar **Negociação IA Autônoma** (premium).

# Negociação IA Autônoma — Fases 2.1 e 2.2

## Visão

O comprador configura um **plano de negociação** na equalização; o motor executa ciclos (fechar rodada → analisar → abrir próxima) até critério de parada. O fornecedor continua respondendo manualmente no portal e, na **Fase 2.2**, vê **preços solicitados** por item na rodada ativa.

**Feature premium:** `ai_negotiation_autonomous` (requer também `ai_negotiation`).

## Entidades

| Tabela | Uso |
|--------|-----|
| `quotation_negotiation_plans` | Parâmetros do evento (rodadas min/max, tolerâncias, estratégia, gate de aprovação) |
| `quotation_negotiation_runs` | Execução: status, rodada atual, métricas |
| `negotiation_counter_offers` | Alvos por item/fornecedor/rodada (Fase 2.2) |
| `negotiation_decision_logs` | Auditoria de decisões (IA + sistema) |

Migrations: `074` (schema), `075` (lock de tick), `076` (RLS fornecedor em contrapropostas).

## APIs

| Método | Rota | Descrição |
|--------|------|-----------|
| GET/POST | `/api/quotations/[id]/negotiation-plans` | Listar / criar plano (+ `counterOffers` do run ativo) |
| POST | `/api/negotiation-plans/[id]/start` | Iniciar execução |
| POST | `/api/negotiation-runs/[id]/tick` | Próximo passo (`forceApprove` opcional) |
| POST | `/api/negotiation-runs/[id]/pause` | Pausar execução |
| POST | `/api/negotiation-runs/[id]/cancel` | Encerrar evento (comprador) |
| POST | `/api/negotiation-runs/background-tick` | Job interno (proxy / maintenance key) |
| GET | `/api/cron/background-jobs` | Cron unificado (rodadas, negociação, contratos, ERP) |

## Motor (`lib/negotiation/motor.ts`)

Estados principais: `waiting_deadline` → `analyzing` → (`awaiting_approval`) → `opening_round` → … → `completed` | `paused` | `failed`.

Após fechar rodada, `lib/negotiation/counter-offers.ts` calcula alvos (`per_item` ou `per_supplier`) e grava em `negotiation_counter_offers`. Com aprovação por rodada, alvos ficam com `round_id` nulo até o comprador aprovar; ao abrir a rodada, o `round_id` é preenchido.

## Contrapropostas (Fase 2.2)

| Estratégia | Comportamento |
|------------|----------------|
| `per_item` | Mesmo alvo unitário para todos os fornecedores do item (`supplier_id` nulo) |
| `per_supplier` | Alvo por fornecedor com base em % de saving relativo à proposta dele e ao melhor preço |
| `by_category` / `by_cost_center` | Tratados como `per_item` nesta fase |

- Alvos são **orientação** — não bloqueiam envio de proposta acima do alvo.
- Se o fornecedor não melhorar: apenas log no motor; sem alerta ao comprador.
- Com **aprovação por rodada** ON: comprador vê tabela de alvos no painel antes de abrir a próxima rodada.

## UI

- **Nova cotação** (`/comprador/cotacoes/nova`): toggle + parâmetros; com IA ligada, **Enviar Cotação** cria plano e inicia motor.
- **Equalização**: painel com execução, alvos sugeridos e aprovação por rodada.
- **Fornecedor** (`/fornecedor/cotacoes/[id]`): banner + coluna **Preço solicitado** na rodada ativa (RLS migration `076`).
- Gate: `useAiNegotiationUiAccess()` — respeita tenant selecionado (sem bypass superadmin).

## Próximas fases

- **2.4:** Agrupamento (categoria/CC) + score no prompt

## Fase 2.3 — Políticas e relatório

| Política | Comportamento |
|----------|----------------|
| Teto `max_price_pct_above_best` (ex.: 5%) | Detecta itens com preço acima do teto vs. melhor; log `ceiling_violation`; pode encerrar quando todos dentro do teto |
| Saving `target_saving_pct_below_target` (ex.: 15%) | Critério de parada `stop_on_target` (já existente) |
| `stop_on_no_improvement` | Após `min_rounds`, encerra se total melhor da rodada não melhorou vs. anterior |
| Métricas por rodada | `round_snapshots` em `run.metrics` (total melhor, violações, itens) |

### Relatório do evento

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/negotiation-runs/[id]/report?format=xlsx\|pdf` | Relatório Excel (4 abas) ou PDF — só run `completed` / `cancelled` / `failed` |

UI: botões **Excel** e **PDF** no painel da equalização quando o evento termina.

## Admin

Em **Admin → Tenant → Funcionalidades**, habilitar **Negociação IA Autônoma** (premium).

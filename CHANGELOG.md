# Changelog — Valore Portal de Compras

## [v2.19.75] — 2026-08-13

### Admin — configurações técnicas por tenant
- Registry `lib/settings/tenant-settings-registry.ts` com validação min/max e grupos
- Aba **Configurações** em `/admin/tenants/[id]` (superadmin)
- APIs `GET/PATCH /api/admin/tenant-settings` e `GET /api/tenant-settings`
- Polling dinâmico (`polling_interval_seconds`), cache IA, score, alertas de contrato
- `background_tasks_cooldown_minutes` — intervalo das tarefas em background no proxy
- Hooks `useTenantSettings` / `useTenantSetting` / `usePollingIntervalMs`
- Novos tenants recebem defaults via `seedDefaultTenantSettings` no `create-tenant`
- Rota legada `/admin/tenants/[id]/features` redireciona para a página principal

### Proxy — performance
- Cooldown nas tarefas `close_expired_rounds`, `expire_overdue_contracts` e
  `scheduled-maintenance` (corrige loop de requests a cada segundo no dev)

---

## [v2.19.73] — 2026-08-13

### Consumo de contrato na equalização (Fase 2)
- Ao **Criar Pedido** na equalização: verificação automática de contratos
  compatíveis e modal de confirmação antes de gerar o pedido
- Match por `quotation_item_id` ou `material_code`; preço do contrato e
  reserva de saldo nas linhas vinculadas
- Um pedido por fornecedor com linhas com e sem contrato no mesmo documento
- Pedidos `cancelled` / `refused` liberam o item na equalização para novo pedido
- APIs: `POST /api/quotations/[id]/contract-matches`,
  `POST /api/purchase-orders/[id]/reserve-contract-balance`
- Feature premium **`contract_balance`** (Consumo de Contrato) no admin, separada
  do módulo **Contratos**
- Configuração por tenant: **Verificar contratos ao criar pedido** em
  Configurações → Configuração de Campos (padrão ligado)
- Migration `038`: seed `contract_balance` na empresa teste

---

## [v2.19.72] — 2026-08-12

### Consumo de saldo de contrato via pedido (Fase 1)
- Migrations `034`–`037`: reserva/consumo de saldo, FKs por linha em
  `purchase_order_items`, funções `reserve_contract_balance`,
  `release_contract_balance`, `consume_contract_balance`, trigger em
  `purchase_orders`
- Criar pedido a partir de contrato ativo: modal no comprador, API
  `POST /api/contracts/[id]/create-purchase-order`, status inicial `draft`
- Referência de contrato por **linha** (estilo ME23N): colunas Contrato +
  Item Contr. no pedido; preço herdado do contrato
- Consumo no aceite do fornecedor (`processing`), não só em `completed`
- Cards de saldo no contrato: Total / Reservado / Consumido / Disponível
- Notificações de contratos, expiração automática e polling nas telas
- `POST /api/notify-purchase-order-buyer`: notificação comprador no aceite,
  recusa e alteração de entrega (fornecedor → comprador, service role)
- Item Contr. exibe sequencial (1, 2, 3…) em vez do código do material

---

## [v2.19.64]–[v2.19.70] — 2026-04-30

### Módulo de Contratos (v2.19.67–v2.19.69)
- Migrations: 026_contracts.sql, 027_contracts_phase1.sql,
  028_contract_items_delivery.sql, 029_contract_items_eliminated.sql,
  030_contract_acceptance.sql, 031_contracts_nullable_fields.sql
- Tabelas: contracts, contract_items, contract_acceptances
- Enums: contract_status (draft/pending_acceptance/active/expired/cancelled),
  contract_type, contract_kind (por_valor/por_quantidade)
- Storage bucket: contract-files (público)
- Portal comprador: listagem com métricas, criação (rascunho sem validações,
  salvar e enviar para aceite), edição por status (draft livre,
  active/pending restrito), upload PDF, soft delete de itens,
  histórico de aceites, página pública /contratos/[id]/termos
- Portal fornecedor: /fornecedor/contratos — listagem e detalhe
  com aceite/recusa + modal de termos + histórico
- Fluxo: draft → enviar para aceite → pending_acceptance →
  aceito (active) / recusado (draft com refusal_reason)
- Import Excel de itens com validação no catálogo (3 etapas:
  orientações → upload → prévia com erros)
- Isolamento de tenant corrigido: APIs respeitam selected_company_id
  do cookie para superadmin
- Módulo Premium: feature key contracts no admin

### IA & Analytics (v2.19.64–v2.19.65, v2.19.70)
- SpendAIInsights: card no dashboard, cache 1h por company_id,
  countdown, select de período, renderização markdown
- GET /api/ai-spend-analysis: coleta 4 blocos de dados, chama
  Anthropic claude-sonnet-4-20250514
- Módulos Premium separados no admin: ai_analytics (Spend Analysis)
  e ai_negotiation (Negociação na equalização)
- QuotationAIAnalysis: card colapsável na equalização com análise
  de propostas, alertas de desvio, recomendações e contrapropostas
- GET /api/quotation-ai-analysis: filtra propostas submitted+selected,
  contexto de cobertura, instruções inteligentes para poucos fornecedores
- Export Excel da análise (4 abas: Resumo, Alertas, Recomendações,
  Contrapropostas) com identidade visual do sistema
- ai_analysis_logs: tabela de histórico de análises com prompt
  completo e resposta
- Audit log ia_analysis com metadata formatado
- Modal "Ver IA" nos logs do admin com tabs Prompt/Resposta
  e syntax highlight JSON

### Sugestão de Fornecedor (v2.19.66)
- supplier_categories: vínculo fornecedor ↔ categoria
- SuggestSuppliersButton na cotação (modo A: quotation_id,
  modo B: category + exclude_ids)
- Seção Categorias Atendidas no modal do fornecedor

---

## [v2.19.37]–[v2.19.63] — 2026-04-13

### Saving e equalização
- Campos `target_price`, `last_purchase_price`, `average_price` em `items` e `quotation_items` (migration `023_saving_module_item_prices.sql`)
- Triggers `trg_update_item_prices`, `trg_inherit_item_prices`
- Equalização: colunas % vs alvo e % vs média histórica; toggles no dropdown Colunas; `localStorage` `valore:equalizacao:column_visibility`

### Dashboard e relatórios
- Dashboard comprador: painel ROI/Saving (total histórico, cobertura alvo, por fornecedor, por mês)
- Relatórios: hierarquia Saving → Spend → Pedidos → Cotações & Fornecedores; filtros período/categoria/fornecedor; exports Excel (Spend categoria, Performance fornecedores, Saving acumulado, Tempo do processo)

### Score de fornecedor
- `use-supplier-score`, `supplier-score-badge`; peso Preço via `company_settings.score_weight_price` (padrão 40%); não exibir para `profile_type === 'supplier'`

### Notificações
- Clique no sino: `resolveNotificationRoute` / `handleNotificationClick`; fix `quotation_rounds` → `quotation_id`
- Cross-company em `notify-with-email`; rota `notify-proposal-submitted` com service role

### PDF do pedido
- `GET /api/purchase-order-pdf`, `lib/pdf/purchase-order-pdf.tsx`, `runtime = nodejs`; botão nas telas de detalhe do pedido (comprador e fornecedor)

### Termos de fornecimento
- Migration `024_supplier_terms.sql`: `supplier_terms`, `supplier_term_acceptances`
- APIs `supplier-terms`, `supplier-terms/accept`; modal de aceite no fornecedor; aba Termos em Configurações; página pública `/termos/[company_id]`

---

## [v2.19.13] — 2026-04-09
- feat: 2FA via TOTP real na aba Segurança (Google Authenticator)
- feat: layout Segurança em 2 colunas, remove Sessões Ativas e 2FA SMS

## [v2.19.12] — 2026-04-09
- feat: notificações para pedido enviado ao fornecedor
- feat: notificações para requisição criada, aprovada e rejeitada
- feat: notificações para cotação cancelada e concluída
- feat: notificação para novo usuário criado

## [v2.19.11] — 2026-04-09
- feat: admin tenant — layout 3 blocos, métricas de usuários, export Excel
- feat: upload de logo da empresa e foto de perfil via Supabase Storage

## [v2.19.10] — 2026-04-09
- fix: métricas de fornecedores e itens no tenant admin respeitam filtro de período

## [v2.19.9] — 2026-04-09
- feat: audit logs com paginação server-side e filtros combinados

## [v2.19.8] — 2026-04-09
- chore: funções SQL versionadas (get_my_supplier_id, close_expired_rounds, check_round_completion)

## [v2.19.7] — 2026-04-09
- fix: sidebar marca Dashboard ativo apenas na rota exata

## [v2.19.6] — 2026-04-09
- feat: itens e fornecedores com export Excel, import Excel e sincronização ERP

## [v2.19.5] — 2026-04-09
- feat: tela de itens somente leitura, linha expansível, sync ERP, import Excel

## [v2.19.4] — 2026-04-09
- feat: donuts responsivos sem espaço vazio nos cards de status

## [v2.19.3] — 2026-04-09
- feat: legenda compacta e donut maior nos charts de status

## [v2.19.2] — 2026-04-09
- feat: layout legenda direita em charts donut, corrigido subtítulo Spend por Mês

## [v2.19.1] — 2026-04-09
- feat: dashboard e relatórios com ajustes visuais, lead time real e novos cards de spend

## [v2.19.0] — 2026-04-09
- feat: dashboard comprador com dados reais (cards, SpendAnalysis, LeadTime, QuotationStatus)
- feat: relatórios comprador com dados reais (Pedidos Realizados, Lead Time Médio, Lead Time vs Meta)

## [v2.18.11] — 2026-04-08
- feat: notificações por canal (sininho + e-mail), e-mail transacional, documentação

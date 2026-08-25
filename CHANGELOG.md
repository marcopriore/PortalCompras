# Changelog — Valore Portal de Compras

## [v2.19.90] — 2026-08-25

### Requisição — UX do ciclo do pedido

- Timeline: data só em etapas concluídas (ou rejeitadas); aceite usa `accepted_at`
- Detalhe da REQ (comprador e solicitante): campo **Número do Pedido** nas informações gerais
- Testes de timeline em `__tests__/lib/requisitions-status.test.ts`

---

## [v2.19.89] — 2026-08-25

### Status de requisição alinhados ao ciclo do pedido

- Novos status: `awaiting_buyer` (Pendente Comprador), `awaiting_supplier` (Pendente Aceite Fornecedor)
- Label de `pending`: **Pendente Aprovação** (antes “Aguardando”)
- Checkout do catálogo e “novo pedido” passam a criar/atualizar REQ como `awaiting_buyer` (não mais `completed` antecipado)
- Migration **059**: constraint + `map_po_status_to_requisition_status` + trigger `trg_sync_requisition_from_po` (PO → REQ)
- Libs: `lib/requisitions/status.ts`, `lib/requisitions/timeline.ts`
- Filtros/labels/timelines em solicitante e comprador
- Validado: draft→`awaiting_buyer`, sent/processing→`awaiting_supplier`, completed→`completed`

---

## [v2.19.88] — 2026-08-25

### Catálogo de Compras

- Feature `purchase_catalog` + permissões `nav.catalog` / `catalog.order`
- Telas `/comprador/catalogo` e `/solicitante/catalogo`: ofertas de contratos ativos com saldo
- Carrinho por tenant; quantidade editável (+/− e digitação); checkout por fornecedor
- Checkout cria **requisição (`origin=catalog`) + pedido `draft` vinculados** (`purchase_orders.requisition_code`) — status da REQ alinhado ao PO a partir de v2.19.89 (`awaiting_buyer`, não `completed`)
- Reserva de saldo de contrato no checkout; paginação no banco (RPCs `get_catalog_offers_page` / facets)
- Migrations 054–058 (carrinho, RLS superadmin, origin catalog, paginação SQL, seed de permissões)
- Notificação in-app + e-mail ao finalizar pedido do catálogo
- UX: rules herdadas do grupo marcadas/travadas no dialog de permissões do usuário
- Testes: `__tests__/lib/catalog-checkout.test.ts`

---

## [v2.19.85] — 2026-08-19

### Importação massiva de requisições (Excel)

- Wizard **Importar Excel** na listagem `/comprador/requisicoes` (permissão `import.excel`)
- Template com agrupamento por `codigo_requisicao`; validação inline; preview antes de importar
- Cria `requisitions` + `requisition_items` em lote; fluxo de aprovação automática alinhado à criação manual
- Log em `item_import_logs`; audit `requisition.created`

### Fix

- Aba Integrações: Monitor de Integração abre em nova aba (`window.open`)

---

## [v2.19.84] — 2026-08-19

### Testes unitários e documentação

- 6 novos arquivos de teste + 1 expandido: `outbound-idempotency`, `external-id-response`, `outbound-retry-eligibility`, `erp-errors`, `integration-types`, `comprador-nav`, `po-status`
- Total: 143 testes em 14 arquivos (anteriormente 42 em 8 arquivos)
- SPEC.md atualizado para v2.19.84: §9.1 concluído, §9.4 mapa de validação atualizado
- HANDOFF.md, CLAUDE.md e CHANGELOG.md sincronizados com estado real do código

---

## [v2.19.83] — 2026-08-19

### Configurações unificadas por abas

- Abas **Usuários**, **Perfis de Acesso** e **Integrações** adicionadas ao shell `/comprador/configuracoes` (visíveis para admin)
- `/configuracoes/usuarios` e `/configuracoes/permissoes` agora redirecionam para `?tab=usuarios` / `?tab=permissoes`
- Deep link por `?tab=...` na URL — links externos chegam direto na aba correta
- Botões redundantes do cabeçalho (Perfis de Acesso, Monitor de Integração, Documentação API) removidos
- Aba Integrações: botão para Monitor de Integração + botão para Documentação da API

---

## [v2.19.82] — 2026-08-19

### Enforcement de permissões no frontend

- **Pedidos (listagem):** sem `order.view_all` → filtra por `created_by = userId`; comprador vê apenas os próprios pedidos
- **Pedidos (detalhe):** `created_by` lido do banco; botões Confirmar, Editar, Cancelar, Reenviar exigem `order.edit` ou `order.edit_own` (próprios)
- **Cotações (detalhe):** botões Editar e Enviar exigem `quotation.edit`; botão Equalizar exige `quotation.equalize.view` ou `quotation.equalize.select`
- **Equalização:** `isReadOnly` passa a incluir falta de `quotation.equalize.select`; sem ela, seleção de itens, "Selecionar Todos", Criar Pedido e Finalizar Cotação ficam desativados

---

## [v2.19.81] — 2026-08-19

### Integração ERP — contratos outbound + idempotência
- `contract.create` no aceite do fornecedor → criação de contrato comercial no ERP
- Orquestrador `integrateContractWithErp` + API `POST /api/contracts/[id]/erp-integration` (monitor)
- Resposta ERP: `external_contract_id` (fallback `external_code`) → `contracts.erp_code`
- Contrato permanece ativo no Valore se integração falhar; reenvio pelo monitor
- Idempotência outbound: header `Idempotency-Key` estável por tenant/ação/entidade
- SPEC §10.10 (idempotência) e §10.12 (contratos)

### Arquivos novos
- `lib/integrations/integrate-contract-with-erp.ts`, `outbound-idempotency.ts`
- `lib/api/external/mappers/contract.ts`
- `app/api/contracts/[id]/erp-integration/route.ts`

---

## [v2.19.80] — 2026-08-18

### Integração ERP — pedidos update/delete + edição pós-integração
- `purchase_order.update` no aceite do fornecedor quando pedido já tem `external_code` (reedição)
- `purchase_order.delete` ao cancelar pedido integrado: Valore só cancela após HTTP 2xx do ERP
- Falha no cancelamento → `integration_error`; parser de erro HTTP 4xx com body JSON
- Fluxo comprador: editar `completed` → **Salvar** (`draft`) → **Reenviar fornecedor** → aceite → ERP
- Monitor: reenvio por operação (`create` / `update` / `delete`)
- Banners: só integração (sucesso view-once, erro persistente); fornecedor não vê falha ERP no aceite

### Requisições — inbound only
- Sem gatilhos outbound REQ no portal; infra mantida (`integrate-requisition-with-erp.ts`) para futuro
- Fluxo ativo: ERP → Valore (`POST /api/v1/requisitions`); SPEC §10.11

---

## [v2.19.78] — 2026-08-18

### Integração ERP — pedidos (outbound operacional)
- Integração dispara **somente no aceite do fornecedor** (não em rascunho/envio)
- Orquestrador `integratePurchaseOrderWithErp` + API `POST /api/purchase-orders/[id]/erp-integration`
- Status: `processing` → `completed` | `error` (reprovado ERP) | `integration_error` (erro Valore)
- Resposta ERP: `external_purchase_order_id` (fallback `external_code`); unicidade por tenant
- Migration **042**: status `integration_error`
- Comprador: edita/reenvia só em `error`; `integration_error` → orientação TI/monitor
- Monitor v2: reenvio condicional (oculto se ERP OK + pedido `completed`)
- Config API keys/endpoints: **admin** (`/admin/integracoes`); comprador só monitor (popup)
- Spec operacional: **SPEC.md §10.10**

### Arquivos novos
- `lib/integrations/integrate-purchase-order.ts`, `erp-errors.ts`, `external-id-response.ts`, `outbound-retry-eligibility.ts`
- `components/integrations/integration-monitor.tsx`, `components/admin/integrations-settings.tsx`
- Migrations **040**, **041**, **042**

---

## [v2.19.77] — 2026-08-13

### Política de senhas por tenant
- Aba **Segurança** em `/admin/tenants/[id]` (superadmin)
- Regras de complexidade, expiração programada e histórico de senhas
- Migration `039`: `profiles.password_changed_at`, `user_password_history`
- Enforcement em criar/reset/trocar senha (comprador, solicitante e fornecedor)
- `PasswordExpiryGuard` e páginas `/comprador/alterar-senha`, `/fornecedor/alterar-senha`

### Equalização — indicador de contrato
- Ícone de contrato compatível na célula do fornecedor (feature `contract_balance`)
- POST em lote na abertura da rodada; fix match por par item+fornecedor na API

### Testes E2E
- `e2e/contract-flows.spec.ts` + helpers compartilhados (`e2e/helpers/`)

---

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

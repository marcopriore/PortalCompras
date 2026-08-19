# Valore — Especificação do Sistema

## Versão atual: v2.19.84

Documento de referência alinhado ao código e às migrations versionadas no repositório.

---

## 1. Visão Geral

Valore é um SaaS de procurement multi-tenant com três experiências principais:

- **Comprador (`/comprador`)**: requisições, cotações, equalização, pedidos, aprovações e configurações.
- **Solicitante (`/solicitante`)**: criação e acompanhamento de requisições (perfil `requester`).
- **Fornecedor (`/fornecedor`)**: dashboard, resposta de cotações, pedidos e histórico de atividades.

Stack principal: Next.js 16, TypeScript, Tailwind/shadcn, Supabase (Auth + RLS), Resend para e-mails transacionais.

---

## 2. Portal Fornecedor (estado atual)

| Rota | Status | Observações |
|------|--------|-------------|
| `/fornecedor` | ✅ | Dashboard com gráficos (donut + barras) e cards |
| `/fornecedor/cotacoes` | ✅ | Listagem completa com filtros + auto-refresh |
| `/fornecedor/cotacoes/[id]` | ✅ | Resposta de proposta + wizard de importação Excel |
| `/fornecedor/pedidos` | ✅ | Listagem com métricas e filtros |
| `/fornecedor/pedidos/[id]` | ✅ | Aceite (modal de termos de fornecimento quando houver termo ativo), recusa, data de entrega, PDF |
| `/fornecedor/atividades` | ✅ | Histórico completo paginado |
| `/fornecedor/contratos` | ✅ | Listagem e detalhe com aceite/recusa |
| `/termos/[company_id]` | ✅ | Página pública (sem login) — termos ativos da empresa |
| `/contratos/[id]/termos` | ✅ | Página pública sem login |

---

## 3. Portal do Solicitante (estado atual)

| Rota | Status | Observações |
|------|--------|-------------|
| `/login` | ✅ | Tela dividida comprador (azul) / solicitante (laranja); redirecionamento por `profile_type` |
| `/solicitante` | ✅ | Listagem com filtros por status, data, busca, paginação 20/pág |
| `/solicitante/nova` | ✅ | Busca no catálogo, tabela de itens, select prioridade, anexos |
| `/solicitante/[id]` | ✅ | Timeline horizontal 5 etapas, informações gerais, itens, histórico |
| `/solicitante/[id]/editar` | ✅ | Editar e resubmeter após rejeição, mesmo fluxo de aprovação |

---

## 4. Cotações — Funcionalidades (v2.19.x)

- **Clonar cotação:** dropdown de ações na listagem; copia itens e fornecedores; nova cotação em `draft`.
- **Importar de requisição:** dialog com multiseleção; importa itens com `source_requisition_code`.
- **Coluna Requisição:** exibida na grade de itens (edição, nova e visualização).
- **Vinculação automática:** ao salvar cotação (edição) ou enviar (`waiting`), requisições referenciadas nos itens → `in_quotation` + `quotation_id`.
- **Liberação automática:** ao cancelar cotação, requisições vinculadas a essa cotação → `approved` + `quotation_id` null.

---

## 4.1 Módulo de Saving (v2.19.37+)

- **Campos em `items` e `quotation_items`:** `target_price`, `last_purchase_price`, `average_price` (preço médio ponderado histórico).
- **Migration:** `023_saving_module_item_prices.sql`
- **Trigger `trg_update_item_prices`:** ao criar/atualizar contexto de pedido, atualiza média ponderada histórica no catálogo.
- **Trigger `trg_inherit_item_prices`:** ao criar `quotation_items`, herda preços do item do catálogo.
- **Semântica de indicadores:** valor **negativo** = economia vs. referência (verde); **positivo** = acima do alvo (vermelho).

### Equalização — benchmark de preço

- Colunas opcionais nas células de preço unitário: **% vs alvo** e **% vs média histórica**.
- Dropdown **Colunas** → sub-opções sob “Preço unit.”; preferências em `localStorage` (`valore:equalizacao:column_visibility`).
- Banner âmbar de benchmark removido em favor dos indicadores inline.

### Status das telas

| Rota | Status |
|------|--------|
| `/comprador` | ✅ dashboard + painel ROI/Saving + Análise de Spend por IA (cache 1h, countdown, markdown) |
| `/comprador/contratos` | ✅ listagem, métricas, filtros, isolamento tenant |
| `/comprador/contratos/novo` | ✅ criação, rascunho livre, salvar e enviar para aceite, import Excel com validação |
| `/comprador/contratos/[id]` | ✅ detalhe, edição por status, upload PDF, aceite/recusa, histórico |
| `/comprador/cotacoes/[id]/equalizacao` | ✅ + IA Negociação (QuotationAIAnalysis) |

### Relatórios BI

- Hierarquia de navegação: **Saving → Spend → Pedidos → Cotações & Fornecedores**.
- Filtros globais: período, categoria, fornecedor (`app/comprador/relatorios/page.tsx`).
- **Quatro exports Excel:** Spend por Categoria, Performance Fornecedores, Saving Acumulado, Tempo do Processo (ExcelJS, cabeçalho padrão do projeto).

### Score de fornecedor

- **Hook:** `lib/hooks/use-supplier-score.ts`
- **Componente:** `components/ui/supplier-score-badge.tsx` (Preço, Cobertura, Lead Time, Confiabilidade).
- Peso do componente Preço configurável via `company_settings` key `score_weight_price` (padrão 40%).
- **Regra:** não exibir score para `profile_type === 'supplier'` (somente experiência comprador/admin).

---

## 5. Sistema de Notificações

### 5.1 In-app (`notifications`)

Tabela `notifications` (migration `013_notifications.sql`) com colunas:

- `id`
- `company_id`
- `user_id`
- `type`
- `title`
- `body`
- `entity`
- `entity_id`
- `read`
- `created_at`

### 5.2 Preferências (`notification_preferences`)

Campos legados:

- `new_requisition`
- `quotation_received`
- `order_approved`
- `delivery_done`
- `daily_summary`

Campos por canal (migration `014_notification_preferences_channels.sql`):

- `new_requisition_bell`, `new_requisition_email`
- `quotation_received_bell`, `quotation_received_email`
- `order_accepted_bell`, `order_accepted_email`
- `order_refused_bell`, `order_refused_email`
- `order_approved_bell`, `order_approved_email`
- `delivery_done_bell`, `delivery_done_email`
- `daily_summary_bell`, `daily_summary_email`

### 5.3 Componentes e serviços

- `components/ui/notification-bell.tsx` — `resolveNotificationRoute()` + `handleNotificationClick()` para navegar à entidade ao clicar; resolução de `quotation_id` a partir de `quotation_rounds` quando necessário
- `lib/hooks/use-notifications.ts`
- `lib/notify.ts` (`createNotification`)
- `lib/notify-with-email.ts` (client -> API)
- `app/api/notify-with-email/route.ts` (server) — suporte a notificação **cross-company** (ex.: fornecedor → comprador)
- `app/api/notify-proposal-submitted/route.ts` — envio pós-proposta com **service role** para contornar RLS
- `app/api/get-user-email/route.ts` (service role, por tenant)
- `lib/email/send-email.ts` (Resend)
- `lib/email/templates/base.ts` e `lib/email/templates/index.ts`

### 5.4 Gatilhos implementados (app atual)

- `proposal.submitted` (fornecedor envia proposta -> comprador)
- `order.accepted` (fornecedor aceita pedido -> comprador)
- `order.refused` (fornecedor recusa pedido -> comprador)
- `order.delivery_updated` (fornecedor altera data -> comprador)
- `quotation.new_round` (comprador abre nova rodada -> fornecedores)

---

## 6. Auto-refresh (Polling)

Hook padrão: `lib/hooks/use-auto-refresh.ts`.

| Tela | Intervalo |
|------|-----------|
| `/fornecedor/pedidos` | 30s |
| `/fornecedor/cotacoes` | 60s |
| `/comprador/cotacoes/[id]/equalizacao` | 30s |
| `/comprador/aprovacoes` | 30s |
| `/comprador/pedidos` | 60s |

Regras:

- `onRefresh` em `useCallback` estável.
- refresh silencioso (não resetar contexto de UI).
- pausa em background (`pauseWhenHidden = true`).

---

## 7. Auditoria

### Fornecedor

- `supplier.login`
- `supplier.logout`
- `proposal.saved`
- `proposal.submitted`
- `proposal.imported`
- `purchase_order.accepted`
- `purchase_order.refused`
- `purchase_order.delivery_updated`

### Requisição (comprador / solicitante)

- `requisition.created`
- `requisition.in_quotation`
- `requisition.approved`

---

## 8. Banco (resumo objetivo)

- `requisitions.status`: `pending`, `approved`, `rejected`, `in_quotation`, `completed`, **`cancelled`**
- `quotation_items`: `long_description`, **`source_requisition_code`**; campos Saving alinhados ao catálogo quando aplicável (`target_price`, `last_purchase_price`, `average_price`)
- `profiles.profile_type`: `'buyer' | 'supplier' | 'requester'`
- `purchase_orders`: `supplier_id`, `accepted_at`, `accepted_by_supplier`, `estimated_delivery_date`, `cancellation_reason`, `delivery_date_change_reason`, `created_by`, `quotation_id`.
- Status PO válidos: `draft`, `sent`, `processing`, `completed`, `cancelled`, `refused`, `error`.
- `purchase_order_items`: `delivery_days`.
- `items`: `long_description`; **Saving:** `target_price`, `last_purchase_price`, `average_price`
- `supplier_terms`: `company_id`, `title`, `content`, `version`, `version_date`, `active` — um ativo por empresa (índice único parcial)
- `supplier_term_acceptances`: vínculo termo + `purchase_order_id` + `supplier_id` + `user_id`, `ip_address`, snapshot `term_version` / `term_version_date`
- `payment_conditions`: `id`, `company_id`, `code`, `description`, `active`.
- `notifications` e `notification_preferences` com canais por tipo.
- Migrations de referência: `020`–`022` (requisição/cotação), **`023_saving_module_item_prices.sql`**, **`024_supplier_terms.sql`**, **`025_supplier_categories.sql`** (`supplier_categories`).

### PDF do pedido de compra

- **API:** `GET /api/purchase-order-pdf?id=<uuid>` — `export const runtime = "nodejs"`, service role para leitura do pedido
- **Layout:** `lib/pdf/purchase-order-pdf.tsx` (`@react-pdf/renderer`) — A4, logo, comprador/fornecedor, condições, itens, total, observações, rodapé com paginação
- **UI:** botão “PDF Pedido” em `/comprador/pedidos/[id]` e `/fornecedor/pedidos/[id]`

### Aceite de termos de fornecimento

- **APIs:** `GET`/`POST` `app/api/supplier-terms/route.ts`; `POST` `app/api/supplier-terms/accept/route.ts`
- **Fornecedor:** ao aceitar pedido, modal `components/fornecedor/terms-acceptance-dialog.tsx`; registro de aceite com IP e versão
- **Comprador:** aba **Termos de Fornecimento** em `app/comprador/configuracoes/page.tsx` (admin)
- **Pública:** `/termos/[company_id]` — termo ativo sem autenticação
- Novas versões desativam o termo anterior; aceites antigos permanecem ligados à versão vigente na época

---

## 8.1 Módulo de Contratos

### Fluxo de status
draft → (enviar para aceite) → pending_acceptance →
  aceito: active | recusado: draft (com refusal_reason)
active → (edição com confirmação) → draft → pending_acceptance
active → (cancelar) → cancelled
end_date passada → expired (automático via `expire_overdue_contracts` no proxy, cooldown configurável)

### Regras críticas
- Status active NUNCA é setado automaticamente por data —
  apenas via aceite do fornecedor (/api/contracts/[id]/accept)
- supplier_id, start_date, end_date são nullable (rascunho parcial)
- Edição restrita quando status !== 'draft': só condição de pagamento,
  vigência, observações e eliminação de itens
- Itens eliminados: soft delete (eliminated=true), nunca deletar fisicamente
- contract_kind: por_valor (campo value visível) ou
  por_quantidade (campo value oculto)
- Código gerado automaticamente via generate_contract_code() RPC
- Isolamento tenant: APIs leem selected_company_id do cookie
  para superadmin

### APIs de contratos
- GET/POST /api/contracts
- GET/PATCH/DELETE /api/contracts/[id]
- POST /api/contracts/[id]/upload
- POST /api/contracts/[id]/send-for-acceptance
- POST /api/contracts/[id]/accept
- GET /api/contracts/[id]/acceptances
- GET /api/contracts/[id]/supplier-view
- GET /api/contracts/supplier
- GET/POST/PATCH/DELETE /api/contract-items
- GET /api/contracts-public-terms

### Consumo de contrato na equalização (feature `contract_balance`)
- Indicador `FileSignature` na célula do fornecedor (preço unitário) quando há
  match com saldo disponível; tooltip com código do contrato, preço e saldo
- POST em lote `POST /api/quotations/[id]/contract-matches` na abertura da rodada
- Ao **Criar Pedido**: modal `LinkContractEqualizacaoDialog` (se
  `contract_po_link_prompt_enabled`)

### Permissões no portal comprador
- Menu: `lib/permissions/comprador-nav.ts` — filtro por `role_permissions` e
  `tenant_features` (`components/layout/sidebar.tsx`)
- Rotas: `comprador-route-guard.tsx` bloqueia URL direta sem permissão
- Toast: `comprador-permission-toast.tsx` para `?error=sem_permissao`

## 8.4 Política de senhas por tenant (superadmin)

Configuração em `/admin/tenants/[id]` → aba **Segurança** (`TenantSecurityTab`).
Persistência em `company_settings` (keys `password_*`). Mesma política para
comprador, solicitante e fornecedor do tenant.

| Key | Tipo | Padrão | Descrição |
|-----|------|--------|-----------|
| `password_min_length` | número | 8 | Comprimento mínimo (8–32) |
| `password_require_uppercase` | bool | true | Exigir maiúscula |
| `password_require_lowercase` | bool | true | Exigir minúscula |
| `password_require_digit` | bool | true | Exigir dígito |
| `password_require_special` | bool | true | Exigir especial |
| `password_expiry_days` | número | 0 | Expiração em dias (0 = off, máx. 365) |
| `password_history_count` | número | 5 | Últimas N senhas bloqueadas (0 = off, máx. 24) |

**Banco (migration 039):**
- `profiles.password_changed_at` — última troca de senha
- `user_password_history` — hash scrypt por troca (service role nas APIs)

**APIs:**
- `GET/PATCH /api/admin/tenant-security-settings` — superadmin
- `GET /api/tenant-password-policy` — app autenticado (regras + policy)
- `GET /api/auth/password-status` — expiração do usuário logado
- `POST /api/auth/change-password` — troca com validação + histórico

**Enforcement:**
- Criação/reset de usuário (`create-user`, `reset-password`)
- Criação de tenant (senha do admin inicial)
- Configurações → Segurança (comprador)
- `/comprador/alterar-senha` e `/fornecedor/alterar-senha` (expiração forçada)
- `PasswordExpiryGuard` nos layouts comprador e fornecedor

**Libs:** `lib/settings/password-policy-registry.ts`, `password-policy.ts`,
`lib/auth/password-policy-server.ts`, `generate-password.ts`

**Novos tenants:** `seedDefaultPasswordPolicy` em `create-tenant`.

## 8.5 Módulo IA & Analytics

### feature: ai_analytics
- SpendAIInsights no dashboard do comprador
- Cache localStorage por `ai_spend_cache_minutes` (tenant setting, padrão 60 min)
- GET /api/ai-spend-analysis

### feature: ai_negotiation
- QuotationAIAnalysis na equalização
- Análise de propostas submitted+selected da rodada
- Cache localStorage por `ai_negotiation_cache_minutes` (tenant setting, padrão 30 min)
- Trigger automático quando nova proposta detectada (polling)
- Export Excel com 4 abas
- GET /api/quotation-ai-analysis
- Logs: ai_analysis_logs + audit_logs (event_type: ia_analysis)
- Modal "Ver IA" em /admin/logs

## 8.3 Configurações técnicas por tenant (superadmin)

Persistência em `company_settings` (`company_id`, `key`, `value`). Catálogo tipado em `lib/settings/tenant-settings-registry.ts`; leitura com merge de defaults em `lib/settings/tenant-settings.ts`.

| Grupo | Keys | Consumidores |
|-------|------|--------------|
| Sistema | `polling_interval_seconds`, `background_tasks_cooldown_minutes` | `usePollingIntervalMs`, `proxy.ts` (RPCs + scheduled-maintenance) |
| Contratos | `contract_low_balance_threshold_pct`, `contract_expiring_alert_days` | Jobs de notificação, helpers de saldo |
| IA | `ai_spend_cache_minutes`, `ai_negotiation_cache_minutes` | Dashboard spend, equalização |
| Fornecedores | `score_weight_price` | `useSupplierScores` |

**UI:** `/admin/tenants/[id]` → aba **Configurações** (`TenantSettingsTab`). APIs: `GET/PATCH /api/admin/tenant-settings`, `GET /api/tenant-settings` (app autenticado).

**Novos tenants:** `POST /api/admin/create-tenant` grava defaults do registry via `seedDefaultTenantSettings`.

**Licenciamento** (módulos on/off) permanece em `tenant_features` na aba Visão Geral — rota legada `/admin/tenants/[id]/features` redireciona para a página principal.

### Testes E2E (Playwright)
- `npm run test:e2e` — suite geral (`auth-flow.spec.ts` no projeto chromium)
- `npm run test:e2e:critical` — fluxos críticos: pedidos, cotações, equalização
  (`critical-flows.spec.ts`) e contrato/pedido (`contract-flows.spec.ts`)
- Helpers: `e2e/helpers/auth.ts`, `e2e/helpers/supabase-admin.ts` (fixtures
  dinâmicas com service role; testes pulam se não houver dados na empresa teste)

---

## 9. Backlog (estado atual — v2.19.84)

Revisado em 19/08/2026. **Foco atual:** cobertura de testes, alertas de integração e módulo de recebimento.

### 9.0 Em foco agora

| # | Item | Status | Notas |
|---|------|--------|-------|
| **A** | **Integração outbound — pedidos (ERP)** | ✅ v1 | Aceite fornecedor → `processing` → ERP → `completed` / `error` / `integration_error`. Ver **§10.10** |
| **B** | **Integração — requisições (inbound)** | ✅ v1 | ERP → Valore via `POST /api/v1/requisitions`. Outbound REQ **não** disparado (infra pronta). Ver **§10.11** |
| **C** | **Integração outbound — pedido update/delete** | ✅ v2.19.80 | Editar `completed` → `processing` + `purchase_order.update`; cancelar só após ERP OK. Ver **§10.10** |
| **D** | **Integração outbound — contratos (ERP)** | ✅ v2.19.81 | Aceite fornecedor → `contract.create`; idempotência outbound. Ver **§10.12** |

### 9.1 Prioridade imediata (paralelo — não bloqueia integrações)

| # | Item | Status | Notas |
|---|------|--------|-------|
| 1 | **Fechar enforcement de permissões no frontend** | ✅ v2.19.82 | `order.view_all`, `order.edit_own` (com `created_by`), `quotation.edit`, `quotation.equalize.select` aplicados nos botões críticos |
| 2 | **Unificar Configurações por abas** | ✅ v2.19.83 | `/comprador/configuracoes` com abas Usuários, Perfis de Acesso, Integrações; deep link `?tab=`; rotas antigas redirecionam; Monitor abre em nova aba |
| 3 | **Permissões do Admin configuráveis pelo Master** | ✅ | Master edita `role_permissions` via `/comprador/configuracoes?tab=permissoes` após selecionar tenant no header |
| 4 | **Ampliar cobertura de testes** | ✅ v2.19.84 | 14 arquivos, 143 testes unitários: integração ERP (idempotência, retry, erros, IDs externos), permissões (`comprador-nav`), po-status, helpers |
| 5 | **Rotina de atualização de documentação** | ✅ v2.19.84 | SPEC/HANDOFF/CLAUDE/CHANGELOG alinhados a cada release |

### 9.2 Médio prazo

| # | Item | Status | Notas |
|---|------|--------|-------|
| 6 | **Módulo de Recebimento** | ❌ Futuro | Entrada parcial, embarque, entrega; base para consumo de REQ/contrato. Nota: pedido cancelado → liberar saldo restante no contrato (dentro do módulo) |
| 7 | **API Store — implementação** | 🟡 Parcial | Inbound v1 + outbound pedidos (create/update/delete) + monitor + docs públicas ✅. Falta: REQ outbound (se necessário), retry/idempotência avançada |
| 8 | **Controle de consumo por item de requisição** | ❌ Futuro | Parcial / Total / Aberta — depende do módulo de Recebimento |
| 9 | **Login fornecedor + usuários por fornecedor** | ❌ Futuro | Redesign `/fornecedor/login`; gestão de múltiplos logins por `supplier_id` (hoje 1 perfil `supplier` por fornecedor) |
| 10 | **"Agir como" (impersonation) no comprador** | ❌ Futuro | Admin/Master assume visão de comprador, gerente, requisitante, aprovador etc.; UI na tela de Usuários; audit log obrigatório |
| 11 | **Importação massiva de requisições (Excel)** | ❌ Futuro | Para clientes sem integração ERP; template + validação + upsert em lote; log em `item_import_logs` ou equivalente |
| 12 | **Monitor de Integração** | ✅ v2 | `/comprador/integracoes/monitor` (popup) + `/admin/integracoes`; reenvio inteligente (sem duplicar ERP OK + Valore OK). Ver §10.10 |
| 13 | **Documentação pública da Loja de API** | ✅ v1 | `/docs/api` + `/api/v1/openapi.json` |

### 9.3 Baixa prioridade

| # | Item | Notas |
|---|------|-------|
| 14 | **Migrar documentação de implantação para Notion** | Go-to-market; menos urgente que itens técnicos e de negócio acima |

### 9.4 Mapa de validação (lista de produto)

| Item | Status | Observação |
|------|--------|------------|
| Módulo de Negociação por IA | ✅ | `QuotationAIAnalysis`, feature `ai_negotiation`, `/api/quotation-ai-analysis` |
| API Store / gestão módulo+tenant | 🟡 | Inbound v1 + outbound pedidos + monitor v2 |
| Monitor de Integração | ✅ | Reenvio condicional; admin-only config |
| Documentação pública API | ✅ | `/docs/api` |
| Consumo por item de REQ | ❌ | Backlog médio prazo |
| Configurações por abas | ✅ v2.19.83 | Abas Usuários, Perfis de Acesso, Integrações; deep link `?tab=` |
| Permissões Admin pelo Master | ✅ | Master edita via `/comprador/configuracoes?tab=permissoes` |
| `hasPermission()` em ações | ✅ v2.19.82 | Botões críticos cobertos |
| `created_by` cotações/pedidos | ✅ v2.19.82 | `order.edit_own` lê `created_by` na listagem e detalhe |
| Filtro `requester_id` (solicitante) | ✅ | Listagem, detalhe e edição + RLS |
| `portal.solicitante` por role | ❌ | Chave na matriz; login usa só `profile_type` |
| Sidebar dinâmica por permissões | ✅ | v2.19.76 |
| Cobertura de testes | ✅ v2.19.84 | 143 testes unitários (14 arquivos) |
| Política de senhas | ✅ | v2.19.77, migration 039 |
| Rotina de docs | ✅ v2.19.84 | Alinhada nesta revisão |

### 9.5 Escala (6–12 meses)

| Item | Nota |
|------|------|
| Negociação assistida por IA (evolução) | Primeira versão ✅; chat, contraproposta, histórico |
| Previsão de demanda | Roadmap |
| Compra recorrente / templates | Roadmap |
| API Store / integrações ERP | Evolução de `tenant_features` + conectores |
| Precificação por spend | Roadmap comercial |
| Motor de compliance | Infraestrutura |
| SSO / SAML | Infraestrutura |
| White-label | Infraestrutura |

### Concluído recentemente
- **Integração ERP — pedidos (outbound operacional)** — v2.19.78: gatilho no aceite do fornecedor; status `processing` → `completed` / `error` / `integration_error`; IDs externos por entidade (`external_purchase_order_id`); monitor com reenvio condicional; config integrações só no admin (§10.10)
- **Fix auth refresh + hydration mismatch** — `proxy.ts` cookies corretos; singleton Supabase
  client; `ValoreLogo` com IDs estáveis; Radix (Select/Dropdown) só após mount
- **Política de senhas por tenant** — aba Segurança no admin, expiração, histórico,
  enforcement comprador/fornecedor (migration 039)
- **Enforcement de permissões** no frontend (sidebar + route guard, v2.19.76)
- **Indicador visual na equalização** (match de contrato por célula fornecedor)
- **E2E contrato/pedido** (`e2e/contract-flows.spec.ts`)
- **Admin — configurações por tenant** (registry, API, aba Configurações, polling/IA/score/contratos/proxy)
- PDF do contrato, consumo de saldo (Fases 1–2), notificações, `expired` automático
- Otimização proxy (cooldown tarefas background; fim do loop scheduled-maintenance)

---

### Tags de referência (v2.19.37–v2.19.63)

| Faixa | Foco |
|-------|------|
| v2.19.37–v2.19.44 | Saving, equalização, dashboard, relatórios |
| v2.19.45–v2.19.51 | Relatórios BI, benchmark de preço, exports |
| v2.19.52–v2.19.57 | Notificações, cross-company, navegação |
| v2.19.58–v2.19.59 | Score fornecedor |
| v2.19.60–v2.19.61 | PDF do pedido |
| v2.19.62–v2.19.63 | Aceite de termos de fornecimento |
| v2.19.64–v2.19.70 | IA & Analytics (spend + negociação), contratos, supplier_categories, ai_analysis_logs |

---

## 10. Loja de API — catálogo e modelagem

**Validado em 17/08/2026** (Fase 1). Objetivo: integrações estáveis para ERPs, com governança por tenant. Rotas atuais em `/app/api/*` são **internas**; a Loja de API usa **`/api/v1/...`** com API key.

### 10.1 Convenção de direção

| Símbolo | Significado |
|---------|-------------|
| **Externo → Valore** | ERP/sistema externo chama a API REST do Valore (inbound) |
| **Valore → Externo** | Valore **executa HTTP ativo** contra URL do ERP (`integration_endpoints`); ERP responde sucesso/falha e devolve ID externo da entidade (ex.: `external_purchase_order_id`). Não é webhook passivo — é integração com ação e resposta |

Pedidos na Fase 1: **GET** inbound; **POST/PUT/DELETE** outbound via `dispatchOutboundIntegration` — o portal dispara, o ERP cria/atualiza/cancela e retorna status (+ ID externo no create).

**IDs externos na resposta do ERP (por entidade):**

| Entidade | Campo preferencial na resposta JSON | Fallback legado | Coluna no Valore |
|----------|--------------------------------------|-----------------|------------------|
| Pedido de compra | `external_purchase_order_id` | `external_code` | `purchase_orders.external_code` |
| Requisição | `external_requisition_id` | `external_code` | `requisitions.external_code` |

Unicidade: **sempre por tenant** — índice `(company_id, external_code)` em cada tabela. O mesmo número ERP pode existir em empresas diferentes.

Parser: `lib/integrations/external-id-response.ts` + `dispatchOutboundIntegration`.

Requisições: inbound (ERP → Valore) + outbound quando o portal altera (ERP executa a ação na URL configurada).

### 10.2 Princípios técnicos

| Princípio | Decisão |
|-----------|---------|
| Autenticação inbound | `Authorization: Bearer <api_key>` ou `X-Api-Key`; hash no banco (nunca plaintext) |
| Escopo | `company_id` fixo na chave |
| Autorização | `tenant_features` + escopos da chave (`items:read`, `requisitions:write`, etc.) |
| Versionamento | Prefixo `/api/v1/` |
| Chave natural cadastros | `code` (único por `company_id`) — mesmo padrão do Excel/ERP |
| POST vs PUT (itens/fornecedores) | **POST** = criação em lote (registros novos); **PUT** = atualização explícita de registro existente (ERP enviou mudança). Sem upsert silencioso no POST |
| Idempotência | Header `Idempotency-Key` em POST/PUT de requisições e pedidos outbound |
| Resposta | JSON `{ data }` / erro `{ error, code, details? }` |
| Auditoria | `api_request_logs` (inbound) + `audit_logs` (`api.*`) + `webhook_delivery_logs` (outbound) |
| Rate limit | Por chave/tenant em `company_settings` |

### 10.3 Modelo de dados (proposto)

```
api_keys, api_request_logs
integration_endpoints   -- URL + auth + actions (HTTP ativo para ERP)
integration_delivery_logs
requisitions.external_code, purchase_orders.external_code, purchase_orders.erp_error_message
```

Migrations integração: **040** (API store + `external_code`), **041** (`erp_error_message`), **042** (`integration_error` status + trigger contrato).

Feature: `api_integrations`. Pepper opcional: `API_KEY_PEPPER` no `.env`.

Feature key no admin: `api_integrations` (módulo inteiro). Sub-features alinhadas a `tenant_features` existentes: `items`, `suppliers`, `requisitions`, `quotations`, `orders`.

---

### 10.4 Fase 1 — Catálogo validado

#### Itens (`items`)

| Direção | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Externo → Valore | GET | `/api/v1/items` | Listar catálogo (paginação, filtro `code`, descrição, `updated_since`) |
| Externo → Valore | GET | `/api/v1/items/{code}` | Detalhe por código |
| Externo → Valore | POST | `/api/v1/items/batch` | **Criação em lote** — apenas registros novos; rejeita `code` duplicado (409) |
| Externo → Valore | PUT | `/api/v1/items/{code}` | **Atualização unitária** de registro existente |
| Externo → Valore | PUT | `/api/v1/items/batch` | **Atualização em lote** (array com `code` obrigatório) |

Campos mínimos: `code`, `description`, `unit_of_measure`, `commodity_group`; opcionais Saving: `target_price`, `last_purchase_price`, `average_price`, `long_description`. Origem: `source: 'erp'`.

#### Fornecedores (`suppliers`)

| Direção | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Externo → Valore | GET | `/api/v1/suppliers` | Listar (paginação, filtro `code`, nome, `updated_since`) |
| Externo → Valore | GET | `/api/v1/suppliers/{code}` | Detalhe por código |
| Externo → Valore | POST | `/api/v1/suppliers/batch` | **Criação em lote** — rejeita `code` duplicado |
| Externo → Valore | PUT | `/api/v1/suppliers/{code}` | **Atualização unitária** |
| Externo → Valore | PUT | `/api/v1/suppliers/batch` | **Atualização em lote** |

Campos mínimos: `code`, `name`; opcionais: CNPJ, e-mail, telefone, condição pagamento, categorias (`supplier_categories`).

#### Requisições (`requisitions`)

| Direção | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Externo → Valore | GET | `/api/v1/requisitions` | Listar (status, datas, `requester_code`, paginação) |
| Externo → Valore | GET | `/api/v1/requisitions/{id}` | Detalhe + itens (aceita `id` UUID ou `code` externo se mapeado) |
| Externo → Valore | POST | `/api/v1/requisitions` | **Criação unitária** + itens |
| Externo → Valore | POST | `/api/v1/requisitions/batch` | **Criação em lote** (espelho futuro da importação Excel) |
| Externo → Valore | PUT | `/api/v1/requisitions/{id}` | **Atualização** cabeçalho/itens (regras de status: só `pending`/`rejected` editável pelo ERP) |
| Externo → Valore | DELETE | `/api/v1/requisitions/{id}` | **Cancelamento** pelo ERP → status `cancelled` (não DELETE físico) |
| Valore → Externo | HTTP POST/PUT/DELETE | `integration_endpoints` + `dispatchOutboundIntegration` | Pedido criado/alterado/cancelado no portal |
| Valore → Externo | HTTP POST/PUT | idem | Requisição alterada/cancelada no portal |

Identificador externo opcional: `external_code` em `requisitions` (migration futura) para PUT/DELETE idempotente pelo ERP.

#### Cotações (`quotations`) — somente leitura inbound

| Direção | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Externo → Valore | GET | `/api/v1/quotations` | Listar (status, datas, paginação) |
| Externo → Valore | GET | `/api/v1/quotations/{id}` | Detalhe: itens, rodadas, fornecedores convidados |
| Externo → Valore | GET | `/api/v1/quotations/{id}/proposals` | Propostas por **rodada** → fornecedor → itens respondidos (todos os status) |

Sem POST/PUT/DELETE na Fase 1 — cotações são operadas no portal Valore.

**Contrato `GET .../proposals`** (agrupado por rodada):

```json
{
  "data": {
    "quotation": { "id", "code", "status", "description", "created_at" },
    "rounds": [{
      "id", "round_number", "status", "response_deadline", "created_at", "closed_at",
      "proposals": [{
        "id", "status", "submitted_at", "payment_condition", "delivery_days",
        "total_price", "validity_date", "observations",
        "supplier": { "id", "code", "name", "cnpj" },
        "items": [{
          "quotation_item_id", "material_code", "material_description", "long_description",
          "unit_of_measure", "quantity", "unit_price", "tax_percent", "delivery_days",
          "item_status", "observations", "line_total"
        }]
      }]
    }]
  }
}
```

Query: `round_number`, `supplier_code`, `status`. Status default: todos (`invited`, `submitted`, `selected`, `rejected`).

#### Requisições inbound (próximo passo — revisão de campos)

| Campo API | Obrigatório | DB / regra |
|-----------|-------------|------------|
| `external_code` | **Sim** (ERP) | `requisitions.external_code` — UNIQUE por tenant |
| `code` | Não (gerado) | Valore gera `REQ-XXXX` internamente |
| `title` | Sim | `requisitions.title` |
| `description` | Não | `requisitions.description` (máx 500) |
| `cost_center` | Não | usado no fluxo de aprovação |
| `needed_by` | Não | `YYYY-MM-DD` |
| `priority` | Não | `normal` \| `urgent` \| `critical` (default `normal`) |
| `requester_name` | Não | texto livre do ERP |
| `origin` | Fixo | `'erp'` |
| `items[]` | Sim (≥1) | ver abaixo |

**Item da requisição:**

| Campo API | Obrigatório | DB |
|-----------|-------------|-----|
| `material_code` | Não | `requisition_items.material_code` |
| `material_description` | Sim | `requisition_items.material_description` |
| `quantity` | Sim | `> 0` |
| `unit_of_measure` | Não | |
| `estimated_price` | Não | |
| `commodity_group` | Não | |
| `observations` | Não | |

**Regras write:** POST cria `pending`; PUT só se `pending` ou `rejected`; DELETE → `cancelled`. Identificador na URL: UUID, `code` ou `external_code`.

#### Pedidos (`purchase_orders`)

| Direção | Método | Endpoint | Descrição |
|---------|--------|----------|-----------|
| Externo → Valore | GET | `/api/v1/purchase-orders` | Listar pedidos (status, fornecedor, datas) |
| Externo → Valore | GET | `/api/v1/purchase-orders/{id}` | Detalhe + itens + status + datas entrega |
| Externo → Valore | GET | `/api/v1/purchase-orders/{id}/pdf` | PDF do pedido (stream ou URL assinada temporária) |
| Valore → Externo | HTTP POST | `purchase_order.create` | Pedido criado no Valore |
| Valore → Externo | HTTP PUT | `purchase_order.update` | Pedido alterado no Valore |
| Valore → Externo | HTTP DELETE | `purchase_order.delete` | Pedido cancelado no Valore |

---

### 10.5 Fase 2 (backlog — não escopo Fase 1)

| Domínio | Endpoints |
|---------|-----------|
| Contratos | GET list/detail, saldo, aceites |
| Aprovações | GET pendentes; POST approve/reject inbound |
| Cotações | POST convite fornecedor (se demanda ERP) |
| Relatórios | GET saving/spend JSON |
| Anexos | POST upload requisição |

### 10.6 O que NÃO expor

- Rotas admin, IA, e-mail transacional, manutenção interna (`scheduled-maintenance`, etc.)
- Service role nunca exposto ao cliente externo

### 10.7 UI operacional (Loja de API — tenant logado)

| Onde | O quê |
|------|-------|
| `/admin/integracoes` (+ `?company_id=`) | API keys, endpoints outbound, monitor (superadmin) |
| `/comprador/configuracoes` | Link para **Monitor de Integração** (popup; sem gestão de chaves) |
| `/comprador/integracoes/monitor` | Monitor outbound/inbound (admin do tenant; feature `api_integrations`) |

### 10.9 Backlog UI — Monitor + Documentação pública

#### Monitor de Integração

**Objetivo:** visibilidade operacional de todas as chamadas da Loja de API e dos disparos outbound para o ERP.

| Aspecto | Comprador (tenant) | Superadmin |
|---------|-------------------|------------|
| Rota sugerida | `/comprador/integracoes/monitor` (ou aba **Logs** em Configurações → Integrações) | `/admin/integracoes` (ou aba em tenant existente) |
| Escopo de dados | Apenas `company_id` do tenant ativo | Todos os tenants; **filtro por empresa** obrigatório |
| Feature gate | `api_integrations` | `api_integrations` + superadmin |

**Fontes de dados (migration 040):**

| Direção | Tabela | Campos principais para exibição |
|---------|--------|--------------------------------|
| Inbound (ERP → Valore) | `api_request_logs` | `created_at`, `method`, `path`, `status_code`, `duration_ms`, `api_key_id`, `ip_address` |
| Outbound (Valore → ERP) | `integration_delivery_logs` | `created_at`, `action`, `entity`, `entity_id`, `entity_code`, `success`, `response_status`, `error_message`, `attempts` |

**UI mínima v1:**

- Tabela paginada (PAGE_SIZE 25, padrão audit logs)
- Filtros: período, direção (inbound/outbound), status HTTP/sucesso, path ou `action`, busca por `entity_code`
- Detalhe expandível: request/response payload (mascarar segredos), duração, mensagem de erro
- **Reenviar** (outbound `purchase_order.create`): só quando ainda há pendência — falha HTTP **ou** ERP OK mas pedido no Valore em `processing` / `integration_error` / `error`. **Oculto** se log OK e pedido `completed` (evita duplicidade no ERP). Lógica: `lib/integrations/outbound-retry-eligibility.ts`; custo: 1 query em lote por página (≤25 IDs)
- Sem exposição de API key em claro (só prefixo ou `api_key_id`)

#### Documentação pública da Loja de API

**Objetivo:** documentação de produto acessível a **qualquer usuário externo sem autenticação** — referência para times de integração ERP.

| Aspecto | Decisão proposta |
|---------|------------------|
| Rota pública sugerida | `/docs/api` (alias `/developers`) |
| Autenticação | Nenhuma (conteúdo público); link na landing page e no rodapé |
| Conteúdo por endpoint | Nome, descrição, método, path, escopos exigidos, feature gate do tenant |
| Modelo de dados | Campos com **nome**, **tipo**, **obrigatório/opcional**, **descrição**, **exemplo** |
| Exemplos | Request/response JSON completos (copiáveis) |
| Geração | OpenAPI 3.1 em `/api/v1/openapi.json` como fonte; UI renderizada (Redoc/Swagger UI ou página custom Valore) |
| Distinção | **Não** substitui Configurações → Integrações (gestão de chaves/endpoints); é **somente leitura** |

**Seções da documentação pública:**

1. Introdução (autenticação Bearer / `X-Api-Key`, ambientes, rate limit)
2. Catálogo por domínio (itens, fornecedores, requisições, cotações, pedidos)
3. Códigos de erro (`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `CONFLICT`, etc.)
4. Webhooks/outbound (modelo de payload que o ERP deve aceitar; IDs externos por entidade — §10.1)
5. Changelog da API (`/docs/api/changelog` ou seção na mesma página)

### 10.8 Ordem de implementação (Fase 1)

1. ✅ **Migration 040** + auth middleware + `GET /api/v1/health`  
2. ✅ **GET** itens, fornecedores, requisições, cotações e pedidos (+ PDF)
3. ✅ **POST/PUT** itens e fornecedores (batch + unitário)
4. ✅ **POST/PUT/DELETE** requisições inbound (v1)
5. ✅ **Outbound pedidos — create** (`integratePurchaseOrderWithErp` no aceite fornecedor; §10.10)
6. ✅ **UI Integrações** (admin: chaves + endpoints; comprador: monitor) + OpenAPI  
7. ✅ **Monitor de Integração** v2 (§10.9 + reenvio condicional)
8. ✅ **Documentação pública** `/docs/api` (§10.9)
9. ❌ **Outbound pedidos — update/delete** (editar/cancelar pedido integrado)
10. ❌ **Outbound requisições** (eventos do portal → ERP)

---

### 10.10 Fluxo operacional — integração de pedidos (ERP)

**Implementado em v2.19.78.** Referência única para não se perder nas ações.

#### Gatilho

| Evento | Dispara integração? |
|--------|---------------------|
| Criar pedido (rascunho / equalização / contrato) | **Não** |
| Enviar ao fornecedor (`sent`) | **Não** |
| **Aceite do fornecedor** | **Sim** → `POST /api/purchase-orders/[id]/erp-integration` `{ source: "supplier" }` |
| Editar pedido reprovado pelo ERP | Comprador salva → `{ source: "buyer" }` |
| Reenvio pelo monitor | Admin → `{ source: "monitor" }` |

Orquestração: `lib/integrations/integrate-purchase-order.ts` → `dispatchOutboundIntegration` → log em `integration_delivery_logs`.

#### Status do pedido (comprador)

| Status DB | Label comprador | Significado | Ação na UI |
|-----------|-----------------|-------------|------------|
| `sent` | Aguardando Aceite | Aguardando fornecedor | — |
| `processing` | Processando Integração | ERP em andamento | Banner informativo; polling 2s |
| `completed` | Pedido Criado | ERP OK + Valore OK | Exibe `external_code` |
| `error` | **Pedido Reprovado** | ERP rejeitou (HTTP ≠ 2xx) | Comprador **edita** e **reenvia integração** |
| `integration_error` | **Erro de Integração** | Valore não concluiu (ex.: código ERP duplicado no tenant) | Sem ação do comprador; TI/admin reenvia no **Monitor** |
| `refused` | Recusado pelo Fornecedor | — | Editar / reenviar ao fornecedor |

Fornecedor: `processing`, `completed`, `error` e `integration_error` → label **Pedido Aceito** (não expõe integração ERP).

#### Resposta esperada do ERP (`purchase_order.create`)

```json
{
  "external_purchase_order_id": "ERP-12345"
}
```

Fallback aceito: `external_code` (legado). Gravado em `purchase_orders.external_code` (único por `company_id`).

#### Reenvio (quem pode)

| Origem | Quem | Elegível quando |
|--------|------|-----------------|
| Monitor — botão **Reenviar** | Admin tenant / superadmin | Ver regra §10.9 (não reenvia se ERP OK + pedido `completed`) |
| Tela do pedido — **Reenviar integração** | Comprador (admin) | Somente status `error` (reprovado pelo ERP) |
| Aceite fornecedor | Automático | Primeira tentativa (`processing`) |

#### Arquivos principais

| Arquivo | Função |
|---------|--------|
| `lib/integrations/integrate-purchase-order.ts` | Orquestra status + persistência |
| `lib/integrations/dispatch.ts` | HTTP ao ERP + log outbound |
| `lib/integrations/external-id-response.ts` | Parser de ID externo por ação |
| `lib/integrations/erp-errors.ts` | Mensagens + mapeamento erro → status |
| `lib/integrations/outbound-retry-eligibility.ts` | Regra do botão Reenviar no monitor |
| `app/api/purchase-orders/[id]/erp-integration/route.ts` | API de reenvio (supplier / buyer / monitor) |
| `components/integrations/integration-monitor.tsx` | UI do monitor |
| `lib/po-status.ts` | Labels comprador/fornecedor |

#### Update e delete (`purchase_order.update` / `purchase_order.delete`)

**Implementado em v2.19.80.**

| Operação | Gatilho | Status |
|----------|---------|--------|
| **Update** | Fornecedor aceita pedido reenviado (`sent` → `processing`) com `external_code` | `purchase_order.update` no aceite; sucesso → `completed` |
| **Edição comprador** | Editar em `completed` → **Salvar** → `draft` (sem ERP) → **Reenviar ao fornecedor** → `sent` | — |
| **Delete** | Comprador cancela pedido integrado (`completed`) | Cancelamento no Valore **somente** após HTTP 2xx do ERP; falha → `integration_error` + mensagem do body (4xx) |

Erros HTTP 4xx/5xx: mensagem extraída do body JSON (`message`, `error`, `error_message`, `detail`, `description`) quando presente.

Reenvio cancelamento com falha: Monitor → `operation: "delete"`.

#### Próxima extensão

1. Requisições outbound (se necessário no futuro — infra já no código)

#### Idempotência outbound

Todas as chamadas HTTP ao ERP incluem o header `Idempotency-Key`, gerado de forma estável por `(company_id, action, entity_id)` via SHA-256 (`lib/integrations/outbound-idempotency.ts`). Reenvios do monitor reutilizam a mesma chave para o ERP deduplicar (ex.: número de pedido já existente no SAP).

---

### 10.12 Fluxo operacional — integração de contratos (ERP)

**Implementado em v2.19.81.**

#### Gatilho

| Evento | Dispara integração? |
|--------|---------------------|
| Criar / editar contrato (rascunho) | **Não** |
| Enviar para aceite (`pending_acceptance`) | **Não** |
| **Aceite do fornecedor** | **Sim** → `integrateContractWithErp` em `/api/contracts/[id]/accept` |
| Reenvio pelo monitor | Admin → `POST /api/contracts/[id]/erp-integration` `{ source: "monitor" }` |

Orquestração: `lib/integrations/integrate-contract-with-erp.ts` → `dispatchOutboundIntegration` → log em `integration_delivery_logs`.

O contrato permanece **ativo** no Valore mesmo se a integração ERP falhar; falhas ficam no log outbound e podem ser reenviadas pelo monitor.

#### Resposta esperada do ERP (`contract.create`)

```json
{
  "external_contract_id": "CTR-ERP-001"
}
```

Fallback aceito: `external_code` (legado). Gravado em `contracts.erp_code`.

#### Reenvio (monitor)

| Elegível quando |
|-----------------|
| Log com `success: false` |
| Log com `success: true` mas `contracts.erp_code` ainda vazio (ERP OK, Valore não persistiu) |
| **Não** reenvia se ERP OK + `erp_code` preenchido |

#### Arquivos principais

| Arquivo | Função |
|---------|--------|
| `lib/integrations/integrate-contract-with-erp.ts` | Orquestra payload + persistência `erp_code` |
| `lib/api/external/mappers/contract.ts` | Mapper do payload outbound |
| `app/api/contracts/[id]/accept/route.ts` | Gatilho no aceite |
| `app/api/contracts/[id]/erp-integration/route.ts` | Reenvio pelo monitor |

---

### 10.11 Fluxo operacional — requisições (ERP → Valore)

**Inbound only.** Requisições são criadas no ERP e enviadas ao Valore; **não** há disparo outbound do portal por enquanto.

#### Inbound

| Método | Endpoint | Uso |
|--------|----------|-----|
| POST | `/api/v1/requisitions` | Criação unitária + itens |
| POST | `/api/v1/requisitions/batch` | Criação em lote |

Autenticação: API key (header `Authorization: Bearer` ou `X-Api-Key`).

#### Outbound (futuro — infra pronta, não wired)

Código em `lib/integrations/integrate-requisition-with-erp.ts` e tipos `requisition.*` permanecem no repositório para ativação futura, mas **sem gatilhos** nas telas do portal.

---

*Última revisão: 18/08/2026 (v2.19.81 — idempotência outbound; contract.create).*

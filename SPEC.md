# Valore — Especificação do Sistema

## Versão atual: v2.19.70

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
end_date passada → expired (manual/automático — pendente)

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

## 8.2 Módulo IA & Analytics

### feature: ai_analytics
- SpendAIInsights no dashboard do comprador
- Cache localStorage 1h por company_id
- GET /api/ai-spend-analysis

### feature: ai_negotiation
- QuotationAIAnalysis na equalização
- Análise de propostas submitted+selected da rodada
- Cache localStorage 30min por quotation_id+round_id
- Trigger automático quando nova proposta detectada (polling)
- Export Excel com 4 abas
- GET /api/quotation-ai-analysis
- Logs: ai_analysis_logs + audit_logs (event_type: ia_analysis)
- Modal "Ver IA" em /admin/logs

---

## 9. Backlog (estado atual — v2.19.70)

1. Notificações de contratos (envio para aceite, aceito, recusado, vencendo em 30 dias)
2. PDF do contrato gerado pelo sistema
3. Consumo de saldo via pedidos vinculados ao contrato
4. Status expired automático em contratos
5. Atualizar documentação (CLAUDE.md, SPEC.md após esta sessão)
6. Enforcement de permissões no frontend (sidebar dinâmica por role)
7. Cobertura de testes
8. Política de segurança de senhas
9. Configuração score_weight_price na interface
10. Migrar documentação de implantação para Notion

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

*Última revisão: v2.19.70.*

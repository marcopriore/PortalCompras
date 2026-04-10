# Valore — Especificação do Sistema

## Versão atual: v2.19.36

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
| `/fornecedor/pedidos/[id]` | ✅ | Aceite, recusa e atualização de data de entrega |
| `/fornecedor/atividades` | ✅ | Histórico completo paginado |

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

- `components/ui/notification-bell.tsx`
- `lib/hooks/use-notifications.ts`
- `lib/notify.ts` (`createNotification`)
- `lib/notify-with-email.ts` (client -> API)
- `app/api/notify-with-email/route.ts` (server)
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
- `quotation_items`: `long_description`, **`source_requisition_code`** (text, opcional)
- `profiles.profile_type`: `'buyer' | 'supplier' | 'requester'`
- `purchase_orders`: `supplier_id`, `accepted_at`, `accepted_by_supplier`, `estimated_delivery_date`, `cancellation_reason`, `delivery_date_change_reason`, `created_by`, `quotation_id`.
- Status PO válidos: `draft`, `sent`, `processing`, `completed`, `cancelled`, `refused`, `error`.
- `purchase_order_items`: `delivery_days`.
- `items`: `long_description`.
- `payment_conditions`: `id`, `company_id`, `code`, `description`, `active`.
- `notifications` e `notification_preferences` com canais por tipo.
- Migrations de referência: `020_requisitions_cancelled_status.sql`, `021_quotation_items_source_requisition.sql`, `022_requisitions_buyer_update_policy.sql`.

---

## 9. Backlog (estado atual — v2.19.36)

### Produto

- Módulo de Contratos
- PDF do Pedido de Compra
- Saving — `target_price` em items, calcular vs. preço pago
- Navegação ao clicar em notificação (redirecionar para entidade)
- Extração de relatórios via Excel (Saving e Lead Time)
- Módulo de Negociação por IA
- API Store / gestão de acesso por módulo e tenant
- Timeline da requisição: ao cancelar cotação, regredir etapa Cotação → Aprovação

### Técnico

- Permissões por perfil mais granulares (Master admin module)
- Aumentar cobertura de testes
- Política de segurança de senhas (complexidade, expiração, histórico 5 senhas)

### Go-to-market / Documentação

- Migrar documentação de implantação para Notion
- Rotina de atualização das documentações

---

*Última revisão: v2.19.36.*

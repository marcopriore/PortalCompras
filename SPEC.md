# Valore — Especificação do Sistema

## Versão atual: v2.18.11

Documento de referência alinhado ao código e às migrations versionadas no repositório.

---

## 1. Visão Geral

Valore é um SaaS de procurement multi-tenant com dois portais:

- **Comprador (`/comprador`)**: requisitações, cotações, equalização, pedidos, aprovações e configurações.
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

## 3. Sistema de Notificações

### 3.1 In-app (`notifications`)

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

### 3.2 Preferências (`notification_preferences`)

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

### 3.3 Componentes e serviços

- `components/ui/notification-bell.tsx`
- `lib/hooks/use-notifications.ts`
- `lib/notify.ts` (`createNotification`)
- `lib/notify-with-email.ts` (client -> API)
- `app/api/notify-with-email/route.ts` (server)
- `app/api/get-user-email/route.ts` (service role, por tenant)
- `lib/email/send-email.ts` (Resend)
- `lib/email/templates/base.ts` e `lib/email/templates/index.ts`

### 3.4 Gatilhos implementados (app atual)

- `proposal.submitted` (fornecedor envia proposta -> comprador)
- `order.accepted` (fornecedor aceita pedido -> comprador)
- `order.refused` (fornecedor recusa pedido -> comprador)
- `order.delivery_updated` (fornecedor altera data -> comprador)
- `quotation.new_round` (comprador abre nova rodada -> fornecedores)

---

## 4. Auto-refresh (Polling)

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

## 5. Auditoria

Eventos relevantes de fornecedor:

- `supplier.login`
- `supplier.logout`
- `proposal.saved`
- `proposal.submitted`
- `proposal.imported`
- `purchase_order.accepted`
- `purchase_order.refused`
- `purchase_order.delivery_updated`

---

## 6. Banco (resumo objetivo)

- `purchase_orders`: `supplier_id`, `accepted_at`, `accepted_by_supplier`, `estimated_delivery_date`, `cancellation_reason`, `delivery_date_change_reason`, `created_by`, `quotation_id`.
- Status válidos: `draft`, `sent`, `processing`, `completed`, `cancelled`, `refused`, `error`.
- `purchase_order_items`: `delivery_days`.
- `items`: `long_description`.
- `quotation_items`: `long_description`.
- `payment_conditions`: `id`, `company_id`, `code`, `description`, `active`.
- `notifications` e `notification_preferences` com canais por tipo.

---

## 7. Backlog (estado atual)

1. Dashboard do comprador ainda com parte dos cards mockados.
2. Relatórios com seções parcialmente estáticas.
3. Versionar no repositório funções SQL que hoje existem só na instância (ex.: `close_expired_rounds`, `check_round_completion`).
4. Evoluir política de preferências para fornecedores (hoje `notification_preferences` focado no comprador).
5. Cobertura automatizada para notificações + e-mail transacional.

---

*Última revisão: v2.18.11.*

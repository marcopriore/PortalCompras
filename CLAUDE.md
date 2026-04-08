# Valore — Portal de Compras

## Memória persistente do projeto · Lida automaticamente a cada sessão

---

## STACK

- Next.js 16 App Router · TypeScript · Tailwind CSS · shadcn/ui
- Supabase (PostgreSQL + RLS + Auth)
- Resend (e-mail transacional)
- Repositório: github.com/marcopriore/PortalCompras
- Caminho local: C:\Dev\Portal Compras
- Versão atual: v2.18.11

---

## REGRAS CRÍTICAS — NUNCA VIOLAR

### Next.js 16

- SEMPRE usar `React.use(params)` para desembrulhar params de rota
- NUNCA usar `params.id` diretamente (causa warning/erro no Next.js 16)

### Supabase

- `createClient` SEMPRE de `@/lib/supabase/client` no frontend
- `useUser` para obter userId e companyId
- `usePermissions` para hasFeature() e hasPermission()
- Batch updates SEMPRE com `.in('id', arrayDeIds)` — NUNCA loop individual
- INSERT em `proposal_items` SEMPRE com `round_id`
- INSERT em `quotation_proposals` em nova rodada com status `'invited'`
- `purchase_orders` criados com status `'draft'`

### Qualidade de código

- SEMPRE remover imports ao remover componentes
- SEMPRE verificar balanceamento JSX após edições grandes
- SEMPRE rodar `npx tsc --noEmit` antes de considerar concluído
- NUNCA usar cores hardcoded — sempre tokens do design system
- NUNCA deixar `console.log` em produção

---

## IDENTIDADE VISUAL

### Paleta

| Token | Valor | Uso |
|-------|-------|-----|
| Primária | #4F3EF5 (índigo) | Ações principais |
| Destaque | #00C2FF (elétrico) | Gradientes, destaques |
| Sidebar | #1a1a2e (noite) | Background sidebar |
| Lavanda | #f4f3ff | Backgrounds sutis |

### Design System

- NUNCA cores hardcoded — usar: `bg-background`, `bg-card`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `text-primary`, `bg-primary`
- Exceção permitida: badges/cards de métrica (bg-blue-50, bg-green-50, etc.)
- Exceção permitida: sidebar usa #1a1a2e e branco/opacidade

---

## ARQUITETURA MULTI-TENANT

- Shared Database, Shared Schema com `company_id` em todas as tabelas
- RLS ativo em todas as tabelas de negócio
- Superadmin: acesso a todos os tenants via seletor no header
- Admin do tenant: acesso apenas à própria empresa

---

## BANCO DE DADOS — TABELAS PRINCIPAIS

| Tabela | Campos-chave |
|--------|-------------|
| profiles | role, roles text[], profile_type ('buyer'\|'supplier'), supplier_id |
| suppliers | por tenant |
| payment_conditions | id, company_id, code, description, active, created_at — UNIQUE (company_id, code), RLS ativo |
| quotations | status: draft/waiting/analysis/completed/cancelled; created_by |
| quotation_rounds | round_number, status ('active'\|'closed'), response_deadline |
| quotation_suppliers | fornecedores convidados; campo **position** (integer) |
| quotation_proposals | round_id FK quotation_rounds, status: invited/submitted/selected/rejected |
| proposal_items | round_id FK quotation_rounds (OBRIGATÓRIO); delivery_days por item |
| notifications | id, company_id, user_id, type, title, body, entity, entity_id, read, created_at |
| notification_preferences | user_id, company_id, campos legados + `*_bell` e `*_email` por tipo |
| requisitions | status: pending/approved/rejected/in_quotation/completed |
| purchase_orders | status: draft/sent/processing/completed/cancelled/refused/error; supplier_id, accepted_at, accepted_by_supplier, estimated_delivery_date, cancellation_reason, delivery_date_change_reason, created_by, quotation_id |
| purchase_order_items | delivery_days por item |
| items | long_description |
| quotation_items | long_description |
| approval_levels | flow ('requisition'\|'order'), cost_center, category |
| approval_requests | flow, entity_id, approver_id, status: pending/approved/rejected |
| tenant_features | feature_keys liberados por tenant |
| role_permissions | permission_keys por role |

---

## REGRAS DE NEGÓCIO CRÍTICAS

- **Condição de Pagamento:** obrigatória no cabeçalho da proposta (fornecedor), via `payment_conditions` (tenant).
- **Prazo de Entrega (pedido):** `purchase_orders.delivery_days` = maior `proposal_items.delivery_days` das linhas aceitas.
- **Data prevista (`estimated_delivery_date`):** persistir string `YYYY-MM-DD`.
- **Status `refused`:** recusa do fornecedor; não usar `cancelled` para recusa.
- **Notificações in-app:** usar `createNotification()` em `lib/notify.ts`.
- **E-mail transacional:** usar `sendEmail()` em `lib/email/send-email.ts` (server-side).
- **Notificação + e-mail:** usar `notifyWithEmail()` via API Route `/api/notify-with-email`.
- **Busca de e-mail destino:** `getUserEmail()` via `/api/get-user-email` (service role no servidor).
- **Preferências por canal:** `notification_preferences` com `*_bell` e `*_email`.
- **Auto-refresh:** usar `useAutoRefresh()` (`lib/hooks/use-auto-refresh.ts`), não `setInterval` direto em página.
- **Polling ativo:** fornecedor pedidos (30s), fornecedor cotações (60s), equalização (30s), aprovações (30s), comprador pedidos (60s).
- **Auditoria fornecedor:** `supplier.login`, `supplier.logout`, `proposal.saved`, `proposal.submitted`, `proposal.imported`, `purchase_order.accepted`, `purchase_order.refused`, `purchase_order.delivery_updated`.
- **Logout do fornecedor:** `signOut` + `window.location.href = "/fornecedor/login"`.

---

## NOVOS HOOKS/LIBS/COMPONENTES

- `lib/hooks/use-auto-refresh.ts`
- `lib/hooks/use-notifications.ts`
- `lib/notify.ts`
- `lib/notify-with-email.ts`
- `lib/email/send-email.ts`
- `lib/email/get-user-email.ts`
- `lib/email/send-transactional-email-client.ts`
- `lib/email/templates/base.ts`
- `lib/email/templates/index.ts`
- `lib/utils/activity-helpers.ts`
- `lib/utils/date-helpers.ts` (expandido)
- `lib/po-status.ts`
- `components/ui/notification-bell.tsx`
- `components/ui/last-updated.tsx`

---

## SEEDS DE TESTE

- Empresa Teste: `00000000-0000-0000-0000-000000000001`
- Usuário teste (buyer): `c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7` (teste@procuremax.com.br)
- Cotação referência: `aaaaaaaa-0000-0000-0000-000000000001` (COT-2026-0026)
- Cotação ativa: `3c1a465b-f4d4-461e-a0b5-ab7609d6480d` (COT-2026-0036)

---

## VERSIONAMENTO GIT

### Histórico de tags (referência)

| Tag | Descrição |
|-----|-----------|
| v2.17.0 | Wizard importação proposta Excel — 3 etapas |
| v2.17.1 | Descrição detalhada `long_description` |
| v2.17.2 | Remover `complementary_spec` da UI |
| v2.17.3 | Dashboard fornecedor com gráficos |
| v2.17.4 | Landing page redesign dark theme |
| v2.18.0 | Módulo pedidos fornecedor completo |
| v2.18.1 | Ajustes incrementais pós-release |
| v2.18.2 | Ajustes incrementais pós-release |
| v2.18.3 | Ajustes incrementais pós-release |
| v2.18.4 | Ajustes incrementais pós-release |
| v2.18.5 | Ajustes incrementais pós-release |
| v2.18.6 | Ajustes incrementais pós-release |
| v2.18.7 | Ajustes incrementais pós-release |
| v2.18.8 | Ajustes incrementais pós-release |
| v2.18.9 | Ajustes incrementais pós-release |
| v2.18.10 | Ajustes incrementais pós-release |
| v2.18.11 | Notificações por canal + e-mail transacional + documentação |

---

## FUNÇÕES SQL (referência)

- **`close_expired_rounds`** — RPC invocada por `proxy.ts`; body não versionado neste repositório.
- **`get_my_supplier_id()`** — definida em `008_payment_conditions.sql`.
- **`check_round_completion()`** — referenciada na operação da instância Supabase (não versionada em migrations locais).

---

## STATUS DAS TELAS

| Rota | Status |
|------|--------|
| / | ✅ Landing page dark theme |
| /comprador | ⚠️ cards parcialmente mockados |
| /comprador/requisicoes/** | ✅ |
| /comprador/aprovacoes | ✅ |
| /comprador/cotacoes/** | ✅ |
| /comprador/cotacoes/[id]/equalizacao | ✅ complexo |
| /comprador/pedidos | ✅ |
| /comprador/pedidos/[id] | ✅ |
| /comprador/configuracoes/** | ✅ |
| /admin/tenants/** | ✅ |
| /fornecedor | ✅ Dashboard com gráficos (donut + barras) |
| /fornecedor/cotacoes | ✅ Listagem completa com filtros |
| /fornecedor/cotacoes/[id] | ✅ Resposta proposta + wizard Excel |
| /fornecedor/pedidos | ✅ Listagem com métricas |
| /fornecedor/pedidos/[id] | ✅ Detalhe aceite/recusa/data entrega |
| /fornecedor/atividades | ✅ Histórico completo paginado |

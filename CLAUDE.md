# Valore — Portal de Compras

## Memória persistente do projeto · Lida automaticamente a cada sessão

---

## STACK

- Next.js 16 App Router · TypeScript · Tailwind CSS · shadcn/ui
- Supabase (PostgreSQL + RLS + Auth)
- Resend (e-mail transacional)
- Repositório: github.com/marcopriore/PortalCompras
- Caminho local: C:\Dev\Portal Compras
- Versão atual: v2.19.36

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

### ExcelJS
- SEMPRE importar via dynamic import: `const ExcelJS = (await import("exceljs")).default`
- NUNCA importar no topo do arquivo (aumenta bundle desnecessariamente)
- Cabeçalho padrão: fundo `#4F3EF5`, texto branco bold
- Download: criar Blob, URL.createObjectURL, simular clique em `<a>`, revogar URL

### Supabase Storage
- Buckets disponíveis: `company-logos` (público), `profile-avatars` (público), `proposal-attachments` (privado)
- Upload: `supabase.storage.from(bucket).upload(path, file, { upsert: true })`
- URL pública: `supabase.storage.from(bucket).getPublicUrl(path)` + `?t=${Date.now()}` para cache bust
- Persistir URL em `companies.logo_url` ou `profiles.avatar_url`
- Validar: tipo de arquivo (`file.type.startsWith("image/")`) e tamanho (máx 2MB) antes do upload

### Supabase MFA (2FA)
- Enroll: `supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Valore 2FA" })`
- Challenge + Verify: sempre em sequência — `mfa.challenge({ factorId })` depois `mfa.verify({ factorId, challengeId, code })`
- Unenroll: `supabase.auth.mfa.unenroll({ factorId })`
- Listar fatores: `supabase.auth.mfa.listFactors()` — verificar `status === "verified"`
- TOTP já habilitado no painel Supabase do projeto

### company_settings
- Tabela genérica de configurações por tenant: `company_id`, `key`, `value` (text)
- Upsert: `onConflict: "company_id,key"`
- Exemplo: `lead_time_target_days` (meta de lead time em dias, editável pelo comprador)

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
| profiles | role, roles text[], profile_type ('buyer'\|'supplier'\|'requester'), supplier_id, avatar_url (Storage) |
| suppliers | por tenant |
| payment_conditions | id, company_id, code, description, active, created_at — UNIQUE (company_id, code), RLS ativo |
| quotations | status: draft/waiting/analysis/completed/cancelled; created_by |
| quotation_rounds | round_number, status ('active'\|'closed'), response_deadline |
| quotation_suppliers | fornecedores convidados; campo **position** (integer) |
| quotation_proposals | round_id FK quotation_rounds, status: invited/submitted/selected/rejected |
| proposal_items | round_id FK quotation_rounds (OBRIGATÓRIO); delivery_days por item |
| notifications | id, company_id, user_id, type, title, body, entity, entity_id, read, created_at |
| notification_preferences | user_id, company_id, campos legados + `*_bell` e `*_email` por tipo |
| requisitions | status: pending/approved/rejected/in_quotation/completed/cancelled |
| purchase_orders | status: draft/sent/processing/completed/cancelled/refused/error; supplier_id, accepted_at, accepted_by_supplier, estimated_delivery_date, cancellation_reason, delivery_date_change_reason, created_by, quotation_id |
| purchase_order_items | delivery_days por item |
| items | long_description |
| quotation_items | long_description, **source_requisition_code** (text, opcional — requisição de origem) |
| approval_levels | flow ('requisition'\|'order'), cost_center, category |
| approval_requests | flow, entity_id, approver_id, status: pending/approved/rejected; **decided_at**, **rejection_reason** |
| tenant_features | feature_keys liberados por tenant |
| role_permissions | permission_keys por role |
| company_settings | company_id, key, value — configurações por tenant |
| item_import_logs | log de importações Excel de itens |
| audit_logs | id, company_id, user_id, user_name, event_type, entity, entity_id, description, metadata, created_at |
| companies | inclui: logo_url (Storage URL) |
| items | inclui: source (manual/erp/excel), sync_at |
| suppliers | índice único (company_id, code) |

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
- **Importação Excel (Itens/Fornecedores):** upsert com `onConflict: "company_id,code"`; registrar em `item_import_logs`; disponível apenas para Master Admin.
- **Exportação Excel:** sempre usar ExcelJS via dynamic import; cabeçalho índigo; nome do arquivo com timestamp `yyyyMMdd_HHmm`.
- **Notificações implementadas:** pedido enviado ao fornecedor, requisição criada (→ aprovadores), requisição aprovada/rejeitada (→ solicitante), cotação cancelada/concluída (→ fornecedores), novo usuário criado (→ admins).
- **Paginação server-side:** audit logs usam `count: "exact"` + `.range(from, to)` + filtros via `.ilike`/`.eq` no Supabase. PAGE_SIZE = 25.
- **Lead Time Fluxo Compras:** calculado como média de dias entre `requisitions.created_at` → `purchase_orders.created_at`, join por `requisition_code`. Não usar `estimated_delivery_date` para este cálculo.
- **Meta de Lead Time:** lida de `company_settings` com key `lead_time_target_days`; editável inline no gráfico de relatórios.
- **Sidebar ativa:** rotas raiz `/comprador` e `/fornecedor` usam comparação exata (`pathname === item.href`), não `startsWith`.
- **Login unificado (`/login`):** tela dividida comprador (azul) / solicitante (laranja); redirecionamento por `profile_type`; fornecedor (`supplier`) bloqueado em ambos os lados.
- **Cancelamento pelo solicitante:** status `cancelled` (não `rejected`). RLS `requisitions: requester cancela proprias`: `USING` só `pending`, `WITH CHECK` só `cancelled` (transição explícita pending → cancelled).
- **Cotações e requisições:** ao salvar/editar cotação ou enviar (`waiting`), requisições identificadas por `source_requisition_code` nos itens passam a `in_quotation` com `quotation_id`. Ao **cancelar** cotação, requisições vinculadas a essa cotação voltam a `approved` com `quotation_id` null (filtro por `quotation_id` da cotação).
- **Busca catálogo (itens/fornecedores) em cotações:** `.or(\`campo.ilike.${termo}\`)` — termo no formato `%texto%`, **sem** aspas duplas extras na string do filtro.
- **Audit log (requisição):** registrar `requisition.created` (criação), `requisition.in_quotation` (vínculo à cotação), `requisition.approved` (liberação após cancelamento da cotação — evento no `audit_logs`, não confundir com fluxo de aprovação manual).

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
| v2.19.17 | Tela de login unificada comprador e solicitante |
| v2.19.18 | Formulário nova requisição solicitante com catálogo e anexos |
| v2.19.19 | Fix company_id em requisition_items e fluxo de aprovação solicitante |
| v2.19.20 | Listagem solicitante com tabela, filtros e paginação |
| v2.19.21 | Fix largura máxima e coluna ações solicitante |
| v2.19.22 | Fluxo de rejeição e resubmit no portal solicitante |
| v2.19.23 | Timeline horizontal, histórico e layout melhorado solicitante |
| v2.19.24 | Portal solicitante completo com timeline azul e merge layout comprador |
| v2.19.25 | Timeline horizontal e histórico na tela de requisição do comprador |
| v2.19.26 | Fix mocks cotacoes nova e editar, remoção módulo oportunidades |
| v2.19.27 | Remover quotation-form.tsx órfão e menu oportunidades |
| v2.19.28 | Fix formato ilike buscas itens e fornecedores cotacoes |
| v2.19.29 | Status cancelled requisições e lógica botão cancelar solicitante |
| v2.19.30 | Migration 020 status cancelled e RLS policy restrita |
| v2.19.31 | Vincular requisições à cotação com importação de itens e coluna requisição |
| v2.19.32 | Fix deduplicação ao importar itens de requisição |
| v2.19.33 | Coluna requisição na visualização de cotação e update in_quotation |
| v2.19.34 | Update status requisição in_quotation ao salvar e liberar ao cancelar |
| v2.19.35 | Audit log vincular e liberar requisição, histórico atualizado |
| v2.19.36 | Audit log requisition.created no portal solicitante e comprador |

---

## FUNÇÕES SQL

### Funções SQL versionadas (migration 017)
- `get_my_supplier_id()` — SECURITY DEFINER, STABLE — RLS portal fornecedor
- `close_expired_rounds()` — SECURITY DEFINER, VOLATILE — fecha rodadas vencidas via proxy.ts
- `check_round_completion()` — SECURITY DEFINER, VOLATILE — trigger em quotation_proposals
- Trigger: `trg_check_round_completion` AFTER UPDATE ON quotation_proposals

### Migrations recentes (requisição / cotação)
- `020_requisitions_cancelled_status.sql` — constraint `requisitions.status` inclui `cancelled`; policy **requisitions: requester cancela proprias** com `WITH CHECK` explícito (apenas pending → cancelled).
- `021_quotation_items_source_requisition.sql` — coluna `quotation_items.source_requisition_code`.
- `022_requisitions_buyer_update_policy.sql` — policy **requisitions: buyer atualiza status** (comprador atualiza requisições do tenant).

### RLS (referência)
- **requisitions: requester cancela proprias** — UPDATE: `USING (requester_id = auth.uid() AND status = 'pending')` + `WITH CHECK (status = 'cancelled' …)`.
- **requisitions: buyer atualiza status** — UPDATE para compradores do mesmo `company_id`.

---

## STATUS DAS TELAS

| Rota | Status |
|------|--------|
| / | ✅ Landing page dark theme |
| /login | ✅ Tela dividida comprador/solicitante |
| /solicitante | ✅ Listagem com filtros, tabela, paginação, métricas |
| /solicitante/nova | ✅ Formulário com catálogo, itens, anexos |
| /solicitante/[id] | ✅ Timeline horizontal, informações gerais, itens, histórico |
| /solicitante/[id]/editar | ✅ Editar e resubmeter após rejeição |
| /comprador | ✅ todos os cards e gráficos com dados reais |
| /comprador/requisicoes/** | ✅ |
| /comprador/aprovacoes | ✅ |
| /comprador/cotacoes/** | ✅ |
| /comprador/cotacoes/[id]/equalizacao | ✅ complexo |
| /comprador/pedidos | ✅ |
| /comprador/pedidos/[id] | ✅ |
| /comprador/itens | ✅ somente leitura, expansível, import/export Excel, sync ERP |
| /comprador/fornecedores | ✅ modal detalhes, contagem pedidos, import/export Excel |
| /comprador/relatorios | ✅ dados reais, Lead Time vs Meta editável, Spend por Categoria, Volume por Mês |
| /comprador/configuracoes/** | ✅ |
| /comprador/configuracoes/seguranca | ✅ 2FA TOTP real, layout side-by-side |
| /admin/tenants/** | ✅ |
| /admin/tenants/[id] | ✅ layout 3 blocos, métricas com período, funcionalidades inline |
| /admin/logs | ✅ paginação server-side, filtros combinados |
| /fornecedor | ✅ Dashboard com gráficos (donut + barras) |
| /fornecedor/cotacoes | ✅ Listagem completa com filtros |
| /fornecedor/cotacoes/[id] | ✅ Resposta proposta + wizard Excel |
| /fornecedor/pedidos | ✅ Listagem com métricas |
| /fornecedor/pedidos/[id] | ✅ Detalhe aceite/recusa/data entrega |
| /fornecedor/atividades | ✅ Histórico completo paginado |

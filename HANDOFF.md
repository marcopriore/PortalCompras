# Valore — Handoff para Novo Chat

## Data: 09/04/2026
## Versão: v2.19.13

## 1. CONTEXTO DO PROJETO

- Valore é um SaaS de procurement B2B com portal comprador, portal fornecedor e portal admin.
- Stack: Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui, Supabase (Postgres + RLS + Auth + Storage + MFA), Resend, ExcelJS.
- Repositório local: `C:\Dev\Portal Compras`.
- Projeto Supabase (ref): `fijnckrlvwsgbzlkvesb`.

## 2. PREMISSAS DO CHAT

- Codificação via Cursor IDE. Prompts estruturados, um passo por vez.
- Rodar `npx tsc --noEmit` antes de considerar tarefa concluída.
- Commits no padrão:
  cd "C:\Dev\Portal Compras"
  git add .
  git commit -m "tipo: descrição"
  git tag vX.X.X
  git push origin main
  git push origin vX.X.X

## 3. O QUE FOI CONSTRUÍDO

### Portal Comprador
- Requisições, cotações, equalização (com rodadas), aprovações, pedidos
- Itens: somente leitura, linha expansível, import/export Excel, sync ERP placeholder
- Fornecedores: modal detalhes, contagem de pedidos reais, import/export Excel
- Relatórios: todos os cards com dados reais, Lead Time vs Meta editável, Spend por Categoria, Volume de Spend por Mês, Pedidos por Status, Top 5 Fornecedores por Pedidos
- Dashboard: todos os cards reais (Cotações Pendentes, Pedidos em Andamento, Tempo Fluxo Compras, Saving = —), SpendAnalysisChart, LeadTimeChart, QuotationStatusChart sem mock
- Configurações: Empresa (logo upload), Perfil (foto upload), Notificações, Aprovações, Segurança (2FA TOTP real), Configuração de Campos

### Portal Fornecedor
- Dashboard com gráficos reais
- Cotações: listagem, resposta com wizard Excel
- Pedidos: lista + detalhe (aceite, recusa, atualização data)
- Atividades: histórico paginado

### Portal Admin
- Tenants: listagem, criação, impersonate, edição
- Tenant > Visão Geral: 3 blocos (dados, métricas com período, funcionalidades com toggles inline)
- Tenant > Usuários: cards de métricas por perfil, tabela paginada, export Excel
- Logs: paginação server-side (25/página), filtros por descrição, usuário, tenant, tipo, data

### Infraestrutura
- Notificações in-app + e-mail: pedido enviado, requisição criada/aprovada/rejeitada, cotação cancelada/concluída, novo usuário
- Storage: company-logos, profile-avatars (públicos), proposal-attachments (privado)
- Funções SQL versionadas em migration 017
- company_settings: configurações por tenant (ex: lead_time_target_days)

## 4. PADRÕES CRÍTICOS

- Multi-tenant: `company_id` + RLS em todas as tabelas
- `profile_type`: `buyer | supplier`
- Login/logout: `window.location.href` (não `router.push`) para portais
- Next.js 16: `React.use(params)` em páginas App Router
- ExcelJS: sempre via dynamic import `await import("exceljs")`
- Resend: sempre via API Route server-side, nunca no client
- Datas `date`: persistir como string `YYYY-MM-DD`, nunca converter para Date
- Sidebar ativa: rotas raiz usam `pathname === item.href` (não startsWith)
- Lead Time: `requisitions.created_at` → `purchase_orders.created_at` via `requisition_code`

## 5. ESTADO ATUAL DO BANCO

### Tabelas principais
- `companies`: `logo_url`
- `profiles`: `avatar_url`, `job_title`, `department`, `phone`
- `items`: `long_description`, `source`, `sync_at`; índice único `(company_id, code)`
- `suppliers`: índice único `(company_id, code)`
- `purchase_orders`: `supplier_id`, `accepted_at`, `accepted_by_supplier`, `estimated_delivery_date`, `cancellation_reason`, `delivery_date_change_reason`, `created_by`, `quotation_id`, `requisition_code`
- `notifications`, `notification_preferences`, `payment_conditions`
- `company_settings`: `company_id`, `key`, `value`
- `item_import_logs`: log de importações Excel
- `audit_logs`: `event_type`, `entity`, `entity_id`, `description`, `metadata`

### Funções SQL versionadas (migration 017)
- `get_my_supplier_id()`, `close_expired_rounds()`, `check_round_completion()`
- Trigger: `trg_check_round_completion` AFTER UPDATE ON `quotation_proposals`

### Storage buckets
- `company-logos` (público), `profile-avatars` (público), `proposal-attachments` (privado)

## 6. BACKLOG PRIORIZADO

1. Módulo de Contratos
2. PDF do Pedido de Compra
3. Saving: adicionar `target_price` em `items`, calcular diferença vs. preço pago
4. Navegação ao clicar em notificação (redirecionar para entidade)
5. Tela de acompanhamento para o solicitante (requisição → cotação → pedido em visão única)
6. Extração de relatórios via Excel (implementar exports pendentes)
7. Módulo de Negociação por IA / automação de cotação e negociação
8. API Store / gestão de acesso por módulo e tenant
9. Permissões por perfil de usuário mais granulares
10. Aumentar cobertura de testes
11. Migrar documentação de implantação para Notion
12. Rotina de atualização das documentações do projeto/sistema

## 7. SEEDS DE TESTE

- Empresa Teste: `00000000-0000-0000-0000-000000000001`
- Usuário comprador: `teste@procuremax.com.br` (`c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7`)
- Cotação referência: `aaaaaaaa-0000-0000-0000-000000000001` (COT-2026-0026)
- Cotação ativa: `3c1a465b-f4d4-461e-a0b5-ab7609d6480d` (COT-2026-0036)

## 8. VARIÁVEIS DE AMBIENTE

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_APP_URL`

## 9. COMO RODAR

- `npm run dev`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:e2e:critical`

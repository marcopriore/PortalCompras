# Valore — Handoff para Novo Chat

## Data: 14/04/2026
## Versão: v2.19.66

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
- **Saving / ROI:** campos de preço no catálogo e itens de cotação (migration 023); triggers de média e herança; dashboard com Saving total, cobertura de alvo, por fornecedor e por mês
- Equalização: indicadores % vs preço alvo e % vs média histórica (prefs em `localStorage`)
- Itens: somente leitura, linha expansível, import/export Excel, sync ERP placeholder
- Fornecedores: modal detalhes, **score de fornecedor** (badge), contagem de pedidos, import/export Excel; seção **Categorias Atendidas** (vínculo com `commodity_group` do catálogo via `supplier_categories`)
- **Migration `025_supplier_categories.sql`:** tabela `supplier_categories` — vínculo fornecedor ↔ categoria (alinhada ao `commodity_group` de `items`), RLS por tenant
- **SuggestSuppliersButton** (`components/comprador/suggest-suppliers-button.tsx`): modo **A** `GET /api/suggest-suppliers?quotation_id=` (categoria da cotação + fornecedores já na cotação); modo **B** `?category=&exclude_ids=` (categoria do formulário na cotação nova + IDs já adicionados); origem cadastro vs. histórico com badges
- APIs: `GET`/`POST`/`DELETE` `app/api/supplier-categories/route.ts`; `GET` `app/api/suggest-suppliers/route.ts`
- Relatórios: **BI** com hierarquia Saving → Spend → Pedidos → Cotações & Fornecedores, filtros globais, **4 exports Excel**
- Dashboard: cards reais + painel de Saving/ROI além de Spend, Lead Time e status de cotações
- Dashboard: card **Análise de Spend por IA** com cache local por `company_id` (1h), cooldown com countdown e exibição de data/hora da última geração
- **SpendAIInsights:** card no dashboard, cache `localStorage` 1h por `company_id`, countdown, select de período (30/90/180 dias), renderização markdown
- Pedidos: **PDF** do pedido (`/api/purchase-order-pdf`, react-pdf, `runtime = nodejs`)
- Configurações: Empresa, Perfil, Notificações, Aprovações, Segurança (2FA), Campos (condições de pagamento), **Termos de Fornecimento** (admin)

### Portal Fornecedor
- Dashboard com gráficos reais
- Cotações: listagem, resposta com wizard Excel
- Pedidos: lista + detalhe (aceite com **modal de termos** quando houver termo ativo, recusa, data, **PDF**)
- **Pública:** `/termos/[company_id]` — leitura dos termos ativos sem login
- Atividades: histórico paginado

### Portal Admin
- Tenants: listagem, criação, impersonate, edição
- Tenant > Visão Geral: 3 blocos (dados, métricas com período, funcionalidades com toggles inline)
- Tenant > Usuários: cards de métricas por perfil, tabela paginada, export Excel
- Logs: paginação server-side (25/página), filtros por descrição, usuário, tenant, tipo, data

### Infraestrutura
- Notificações: clique no sino navega à entidade (`resolveNotificationRoute`); proposta submetida via **`/api/notify-proposal-submitted`** (service role); ajustes cross-company em `notify-with-email`
- IA de Spend: nova API `GET /api/ai-spend-analysis` com autenticação via cookies, coleta de spend/saving/top fornecedores/cotações sem proposta por tenant (service role), chamada Anthropic (`ANTHROPIC_API_KEY`) e snapshot de dados para UI
- **GET `/api/ai-spend-analysis`:** coleta 4 blocos de dados do tenant, chama Anthropic `claude-sonnet-4-20250514`, retorna `insights` + `generatedAt` + `dataSnapshot`
- Demais gatilhos: pedido enviado, requisição criada/aprovada/rejeitada, cotação cancelada/concluída, novo usuário
- Storage: company-logos, profile-avatars (públicos), proposal-attachments (privado)
- Funções SQL versionadas em migration 017
- company_settings: ex. `lead_time_target_days`, `score_weight_price`
- Termos: `supplier_terms`, `supplier_term_acceptances` (migration 024)

## 4. PADRÕES CRÍTICOS

- **Saving:** negativo = economia (verde), positivo = acima do alvo (vermelho)
- **Score fornecedor:** nunca mostrar para `profile_type === 'supplier'`
- **PDF pedido:** `@react-pdf/renderer` na API route, `runtime = "nodejs"`, service role na leitura
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
- `supplier_categories`: vínculo fornecedor ↔ categoria por tenant (migration 025); categorias do cadastro alinhadas ao `commodity_group` de `items`
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
- `ANTHROPIC_API_KEY` (sem `NEXT_PUBLIC_`)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_APP_URL`

## 9. COMO RODAR

- `npm run dev`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:e2e:critical`

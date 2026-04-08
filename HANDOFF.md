# Valore — Handoff para Novo Chat

## Data: 08/04/2026
## Versão: v2.19.11

## 1. CONTEXTO DO PROJETO

- Valore é um SaaS de procurement B2B com portal comprador, portal fornecedor e portal admin.
- Stack: Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui, Supabase (Postgres + RLS + Auth + Storage), Resend para e-mail, ExcelJS para importação/exportação.
- Repositório local: `C:\Dev\Portal Compras`.
- Projeto Supabase (ref): `fijnckrlvwsgbzlkvesb`.

## 2. PREMISSAS DO CHAT

- Codificação via Cursor IDE.
- Prompts estruturados para o agente, um passo por vez.
- Encapsular prompts para copiar/colar quando necessário.
- Rodar `npx tsc --noEmit` antes de considerar tarefa concluída.
- Commits no padrão:
  cd "C:\Dev\Portal Compras"
  git add .
  git commit -m "tipo: descrição"
  git tag vX.X.X
  git push origin main
  git push origin vX.X.X

## 3. O QUE FOI CONSTRUÍDO

- **Portal Comprador**: módulos de requisições, cotações, equalização, pedidos, aprovações, configurações, itens, fornecedores.
- **Portal Fornecedor**: dashboard, cotações, resposta com wizard Excel, pedidos (lista + detalhe), atividades.
- **Portal Admin**: tenants/features/logs com paginação server-side.
- **Landing page**: tema dark ativo.
- **Notificações**: sininho real (`notifications`) + preferências por canal (`notification_preferences`).
- **Auto-refresh**: hook compartilhado `useAutoRefresh`.
- **Auditoria**: eventos de auth fornecedor, propostas e pedidos em `audit_logs`.
- **Testes**: estrutura com Vitest + Playwright no projeto.
- **E-mail transacional**: Resend com templates HTML Valore e rotas API server-side.
- **Storage**: buckets `company-logos` e `profile-avatars` (públicos) + `proposal-attachments` (privado).

## 4. ARQUITETURA E PADRÕES CRÍTICOS

- Multi-tenant com `company_id` e RLS em tabelas de negócio.
- `profile_type`: `buyer | supplier`.
- Login/logout: preferir `window.location.href` nos fluxos de auth portal.
- Next.js 16: usar `React.use(params)` em páginas App Router.
- Batch updates: preferir `.in()` quando aplicável.
- Datas de campo `date`: persistir como string `YYYY-MM-DD`.
- Evitar `createClient()` instável em hooks; usar dentro de callbacks quando necessário.
- Nunca chamar Resend no client; sempre via API Route server-side.
- ExcelJS sempre via import dinâmico `await import("exceljs")`.

## 5. ESTADO ATUAL DO BANCO

### Tabelas principais

- `notifications`: `id`, `company_id`, `user_id`, `type`, `title`, `body`, `entity`, `entity_id`, `read`, `created_at`.
- `notification_preferences`: campos por canal `*_bell` e `*_email`.
- `purchase_orders`: inclui `supplier_id`, `accepted_at`, `accepted_by_supplier`, `estimated_delivery_date`, `cancellation_reason`, `delivery_date_change_reason`, `created_by`, `quotation_id`, `requisition_code`.
- `purchase_order_items`: `delivery_days`, `unit_price`, `total_price`, `round_id`.
- `items`: `long_description`, `source` (`manual|erp|excel`), `sync_at`.
- `suppliers`: índice único `(company_id, code)`.
- `companies`: `logo_url` (URL pública do Storage).
- `profiles`: `avatar_url` (URL pública do Storage).
- `payment_conditions`: `id`, `company_id`, `code`, `description`, `active`.
- `company_settings`: `company_id`, `key`, `value` — configurações por tenant (ex: `lead_time_target_days`).
- `item_import_logs`: log de importações Excel de itens.
- `audit_logs`: `id`, `company_id`, `user_id`, `user_name`, `event_type`, `entity`, `entity_id`, `description`, `metadata`, `created_at`.

### Funções SQL / RPC relevantes (todas versionadas em migrations)

- `get_my_supplier_id()` — RLS do portal fornecedor (SECURITY DEFINER, STABLE).
- `close_expired_rounds()` — fecha rodadas vencidas, chamada via `proxy.ts`.
- `check_round_completion()` — trigger em `quotation_proposals` para fechar rodada quando todos respondem.

### Storage buckets

- `company-logos`: público, logos das empresas tenant.
- `profile-avatars`: público, fotos de perfil dos usuários.
- `proposal-attachments`: privado, anexos de propostas.

### RLS críticas

- `notifications`: leitura/update pelo próprio `user_id`; insert permitido no mesmo tenant.
- `purchase_orders` supplier: leitura/update conforme `profiles.supplier_id`.
- `payment_conditions`: regras por tenant + leitura de supplier convidado.
- `company_settings`: leitura pelo tenant; escrita por `buyer` ou `admin`.
- `item_import_logs`: select/insert pelo próprio tenant.

## 6. DASHBOARD COMPRADOR — MÉTRICAS REAIS

Todos os cards e gráficos usam dados reais do Supabase:
- **Cotações Pendentes**: `quotations` com `status = pending`.
- **Pedidos em Andamento**: `purchase_orders` com `status IN (sent, processing)`.
- **Tempo Fluxo Compras**: média de dias entre `requisitions.created_at` → `purchase_orders.created_at` (join por `requisition_code`). Exibe `—` se sem dados.
- **Saving Acumulado**: exibe `—` com subtexto "Sem dados de referência" (aguarda `target_price` nos itens).
- **SpendAnalysisChart**: gastos reais por categoria via `purchase_order_items` + `quotations`.
- **LeadTimeChart**: lead time real por mês (últimos 6 meses), mesma lógica de join.
- **QuotationStatusChart**: sem fallback mock; exibe "Nenhum dado disponível" se vazio.

## 7. RELATÓRIOS COMPRADOR — MÉTRICAS REAIS

- **Total de Cotações**: real.
- **Pedidos Realizados**: `purchase_orders` com `status = completed` no período.
- **Lead Time Médio**: média de dias `requisitions.created_at` → `purchase_orders.created_at` no período.
- **Saving Total**: exibe `—` com badge "Indisponível" cinza.
- **Evolução de Cotações por Mês**: real.
- **Cotações por Status**: real.
- **Pedidos por Status**: real via `purchase_orders.status`.
- **Top 5 Fornecedores por Pedidos**: real via `purchase_orders.supplier_name`.
- **Lead Time vs Meta**: real por mês (últimos 6 meses fixos); meta editável via `company_settings` (`lead_time_target_days`), salvo com upsert.
- **Spend por Categoria**: real via `purchase_order_items` + `quotations.category`.
- **Volume de Spend por Mês**: real via `purchase_orders.total_price` agrupado por mês.

## 8. TELAS DE ITENS E FORNECEDORES

### Itens (`app/comprador/itens/page.tsx`)
- Tabela somente leitura; clique na linha abre modal de detalhes (sem edição).
- Campos `source` e `sync_at` exibidos no modal.
- Botão **Baixar Base**: exporta todos os itens para Excel.
- Botão **Importar Excel** (Master Admin): wizard com template, validação e upsert por `(company_id, code)`.
- Botão **Sincronizar ERP**: modal com aviso de integração não configurada.
- Data da última `sync_at` exibida no cabeçalho.

### Fornecedores (`app/comprador/fornecedores/page.tsx`)
- Clique na linha abre modal somente leitura com todos os dados + contagem de pedidos.
- Coluna "Pedidos" com contagem real de `purchase_orders`.
- Botão **Baixar Base**, **Importar Excel** (Master Admin), **Sincronizar ERP** — mesmo padrão de itens.
- Upsert por `(company_id, code)` com índice único `suppliers_company_id_code_unique`.

## 9. CONFIGURAÇÕES E ADMIN

### Configurações (`app/comprador/configuracoes/page.tsx`)
- Aba **Empresa**: upload de logo via bucket `company-logos`; persiste em `companies.logo_url`.
- Aba **Perfil**: upload de foto via bucket `profile-avatars`; persiste em `profiles.avatar_url`.
- Aba **Notificações**: real via `notification_preferences`.
- Aba **Aprovações**: real via `tenant_features` + `approval_levels`.
- Aba **Segurança**: alterar senha real; 2FA e sessões ativas ainda placeholder.
- Aba **Configuração de Campos**: condições de pagamento com CRUD + import Excel.

### Admin (`app/admin/`)
- **Tenants**: listagem, criação, impersonate, edição.
- **Tenant > Visão Geral**: métricas com filtro de período (cotações, pedidos, requisições, fornecedores, itens — todos respeitam o período selecionado).
- **Tenant > Features**: toggles por módulo com upsert em `tenant_features`.
- **Logs**: paginação server-side (25/página), filtros por descrição, usuário, tenant, tipo de evento e data — todos aplicados via query Supabase. Metadata expansível com `<details>`.

## 10. BACKLOG PRIORIZADO

1. Módulo de Contratos.
2. PDF do Pedido de Compra.
3. Saving: adicionar `target_price` em `items` e calcular diferença vs. preço pago.
4. 2FA e sessões ativas (Configurações > Segurança).
5. Navegação ao clicar em notificação (redirecionar para entidade).
6. API Store / gestão de acesso por módulo e tenant.
7. Permissões por perfil de usuário (Master admin module).
8. Aumentar cobertura de testes (notificações, e-mails, novos módulos).
9. Migrar documentação de implantação para Notion (documento base gerado em abril/2026).

## 11. SEEDS DE TESTE

- Empresa Teste: `00000000-0000-0000-0000-000000000001`
- Usuário comprador seed: `teste@procuremax.com.br` (`c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7`)
- Cotação referência: `aaaaaaaa-0000-0000-0000-000000000001` (`COT-2026-0026`)
- Cotação ativa: `3c1a465b-f4d4-461e-a0b5-ab7609d6480d` (`COT-2026-0036`)

## 12. VARIÁVEIS DE AMBIENTE NECESSÁRIAS

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_APP_URL`

## 13. COMO RODAR

- `npm run dev`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:e2e:critical`

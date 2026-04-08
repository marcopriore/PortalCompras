# Valore — Handoff para Novo Chat

## Data: 08/04/2026
## Versão: v2.18.11

## 1. CONTEXTO DO PROJETO

- Valore é um SaaS de procurement B2B com portal comprador e portal fornecedor.
- Stack: Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui, Supabase (Postgres + RLS + Auth), Resend para e-mail.
- Repositório local: `C:\Dev\Portal Compras`.
- Projeto Supabase (ref): `fijnckrlvwsgbzlkvesb` (derivado da URL configurada em ambiente).

## 2. PREMISSAS DO CHAT

- Codificação via Cursor IDE.
- Prompts estruturados para o agente, um passo por vez.
- Encapsular prompts para copiar/colar quando necessário.
- Rodar `npx tsc --noEmit` antes de considerar tarefa concluída.

## 3. O QUE FOI CONSTRUÍDO

- **Portal Comprador**: módulos de requisições, cotações, equalização, pedidos, aprovações, configurações.
- **Portal Fornecedor**: dashboard, cotações, resposta com wizard Excel, pedidos (lista + detalhe), atividades.
- **Portal Admin**: tenants/features/logs.
- **Landing page**: tema dark ativo.
- **Notificações**: sininho real (`notifications`) + preferências por canal (`notification_preferences`).
- **Auto-refresh**: hook compartilhado `useAutoRefresh`.
- **Auditoria**: eventos de auth fornecedor, propostas e pedidos.
- **Testes**: estrutura com Vitest + Playwright no projeto.
- **E-mail transacional**: Resend com templates HTML Valore e rotas API server-side.

## 4. ARQUITETURA E PADRÕES CRÍTICOS

- Multi-tenant com `company_id` e RLS em tabelas de negócio.
- `profile_type`: `buyer | supplier`.
- Login/logout: preferir `window.location.href` nos fluxos de auth portal.
- Next.js 16: usar `React.use(params)` em páginas App Router.
- Batch updates: preferir `.in()` quando aplicável.
- Datas de campo `date`: persistir como string `YYYY-MM-DD`.
- Evitar `createClient()` instável em hooks; usar dentro de callbacks quando necessário.
- Nunca chamar Resend no client; sempre via API Route server-side.

## 5. ESTADO ATUAL DO BANCO

### Tabelas principais

- `notifications`: `id`, `company_id`, `user_id`, `type`, `title`, `body`, `entity`, `entity_id`, `read`, `created_at`.
- `notification_preferences`: legados (`new_requisition`, `quotation_received`, `order_approved`, `delivery_done`, `daily_summary`) + campos por canal `*_bell` e `*_email`.
- `purchase_orders`: inclui `supplier_id`, `accepted_at`, `accepted_by_supplier`, `estimated_delivery_date`, `cancellation_reason`, `delivery_date_change_reason`, `created_by`, `quotation_id`.
- `purchase_order_items`: `delivery_days`.
- `items` e `quotation_items`: `long_description`.
- `payment_conditions`: `id`, `company_id`, `code`, `description`, `active`.

### Funções SQL / RPC relevantes

- `get_my_supplier_id()` (versionada em migrations).
- `close_expired_rounds()` (usada em `proxy.ts`, função mantida na instância).
- `check_round_completion()` (referência operacional na instância; não versionada localmente).

### RLS críticas

- `notifications`: leitura/update pelo próprio `user_id`; insert permitido no mesmo tenant.
- `purchase_orders` supplier: leitura/update conforme `profiles.supplier_id` (migration `010`).
- `payment_conditions`: regras por tenant + leitura de supplier convidado.

## 6. BACKLOG PRIORIZADO

1. Completar dashboard comprador com todos os cards reais (sem mock residual).
2. Evoluir relatórios para dados 100% reais.
3. Versionar no repo as funções SQL hoje só na instância.
4. Expandir preferências de notificação para fluxos fornecedor (quando aplicável).
5. Aumentar cobertura de testes para notificações e envio de e-mails.

## 7. SEEDS DE TESTE

- Empresa Teste: `00000000-0000-0000-0000-000000000001`
- Usuário comprador seed: `teste@procuremax.com.br` (`c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7`)
- Cotação referência: `aaaaaaaa-0000-0000-0000-000000000001` (`COT-2026-0026`)
- Cotação ativa: `3c1a465b-f4d4-461e-a0b5-ab7609d6480d` (`COT-2026-0036`)
- Credenciais de senha de seed: não versionadas no repositório (consultar ambiente local/time).

## 8. VARIÁVEIS DE AMBIENTE NECESSÁRIAS

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


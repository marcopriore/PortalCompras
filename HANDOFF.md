# Valore — Handoff para Novo Chat

## Data: 19/08/2026
## Versão: v2.19.82

## 1. CONTEXTO DO PROJETO
- Valore é um SaaS de procurement B2B com portal comprador,
  portal fornecedor e portal admin.
- Stack: Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui,
  Supabase (Postgres + RLS + Auth + Storage + MFA), Resend, ExcelJS,
  Anthropic API.
- Repositório local: C:\Dev\Portal Compras
- Projeto Supabase (ref): fijnckrlvwsgbzlkvesb

## 2. PREMISSAS DO CHAT
- Codificação via Cursor IDE. Prompts estruturados, um passo por vez.
- Rodar npx tsc --noEmit antes de considerar tarefa concluída.
- Isolamento de tenant é OBRIGATÓRIO em todas as telas e APIs.
  Telas usam useTenant() e incluem companyId nas dependências
  dos useEffects. Superadmin respeita selected_company_id do cookie.
- Commits:
  cd "C:\Dev\Portal Compras"
  git add .
  git commit -m "tipo: descrição"
  git tag vX.X.X
  git push origin main
  git push origin vX.X.X

## 3. O QUE FOI CONSTRUÍDO

### Portal Comprador
- Requisições, cotações, equalização (com rodadas), aprovações, pedidos
- Saving/ROI: campos de preço, triggers, dashboard com Saving total,
  cobertura, por fornecedor e por mês
- Equalização: % vs alvo e % vs média histórica (prefs em localStorage);
  indicador visual de contrato compatível por célula fornecedor
  (feature `contract_balance`, POST em lote na abertura)
- IA Negociação: card QuotationAIAnalysis na equalização, análise de
  propostas submitted+selected, alertas/recomendações/contrapropostas,
  export Excel, cache 30min, trigger automático por nova proposta,
  feature gate: ai_negotiation
- Itens: somente leitura, expansível, import/export Excel, sync ERP
- Fornecedores: score, categorias atendidas (supplier_categories),
  sugestão automática na cotação (SuggestSuppliersButton)
- Relatórios: BI Saving→Spend→Pedidos→Cotações, 4 exports Excel
- Dashboard: ROI/Saving + SpendAIInsights (cache 1h, feature: ai_analytics)
- Pedidos: PDF (@react-pdf/renderer, runtime=nodejs)
- Contratos: listagem, criação (rascunho livre, salvar e enviar),
  edição por status, import Excel com validação, upload PDF,
  aceite/recusa fornecedor, histórico, página pública de termos,
  feature gate: contracts
- Configurações: Empresa, Perfil, Notificações, Aprovações,
  Segurança (2FA TOTP), Condições de pagamento, Termos de fornecimento
- Permissões: sidebar dinâmica por `role_permissions` + features;
  route guard em `/comprador` (bloqueio de URL direta)

### Portal Fornecedor
- Dashboard com gráficos reais
- Cotações: listagem + resposta com wizard Excel
- Pedidos: aceite com modal de termos, recusa, data, PDF
- Contratos: /fornecedor/contratos — listagem e detalhe com
  aceite/recusa + modal de termos (supplier_terms)
- Atividades: histórico paginado
- Páginas públicas: /termos/[company_id],
  /contratos/[id]/termos

### Portal Admin
- Tenants: listagem, criação, impersonate, edição
- Tenant > Visão Geral: métricas com período, funcionalidades
  (Core + Módulos Premium: ai_analytics, ai_negotiation, contracts)
- Logs: paginação server-side, filtros, modal "Ver IA" com
  tabs Prompt/Resposta e syntax highlight JSON

### Infraestrutura
- Notificações: cross-company, clique navega à entidade
- IA: ANTHROPIC_API_KEY, ai_analysis_logs, audit_logs ia_analysis
- Storage: company-logos, profile-avatars, proposal-attachments,
  contract-files (todos públicos exceto proposal-attachments)
- Migrations: 020–042 (ver §5)

### Integrações ERP (v2.19.78)
- Outbound pedidos: aceite fornecedor → integração ERP → status final
- Monitor: `/comprador/integracoes/monitor` (popup) + `/admin/integracoes`
- Config chaves/endpoints: **somente admin** (`/admin/integracoes`)
- Spec operacional completa: **SPEC.md §10.10**

## 4. PADRÕES CRÍTICOS
- Isolamento tenant: useTenant() + companyId nas deps do useEffect
- Superadmin: ler selected_company_id do cookie nas APIs
- Saving: negativo = economia (verde), positivo = acima do alvo (vermelho)
- Score fornecedor: nunca para profile_type === 'supplier'
- PDF: @react-pdf/renderer, runtime="nodejs", service role
- Multi-tenant: company_id + RLS em todas as tabelas
- Login/logout: window.location.href (não router.push)
- Next.js 16: React.use(params) em páginas App Router
- ExcelJS: sempre dynamic import
- Resend: sempre via API Route server-side
- Datas date: persistir como string YYYY-MM-DD
- Contratos: status só vai para active via aceite do fornecedor,
  nunca automaticamente por data

## 5. ESTADO ATUAL DO BANCO

### Migrations aplicadas
- 020: requisitions cancelled status + RLS
- 021: quotation_items source_requisition_code
- 022: requisitions buyer update policy
- 023: saving module (target_price, triggers)
- 024: supplier_terms + acceptances
- 025: supplier_categories
- 026: contracts (tabela principal, enums, RLS)
- 027: contracts phase1 (contract_items, delivery, triggers)
- 028: contract_items delivery_days + contract_kind + generate_contract_code()
- 029: contract_items eliminated (soft delete)
- 030: contract_acceptance + pending_acceptance status
- 031: contracts nullable fields (supplier_id, start_date, end_date)
- 032: ai_analysis_logs
- 040: API Store (api_keys, integration_endpoints, integration_delivery_logs, external_code)
- 041: purchase_orders.erp_error_message
- 042: purchase_orders status `integration_error` + trigger contrato

### Tabelas novas (v2.19.67–v2.19.70)
- contracts: company_id, supplier_id (nullable), code, title,
  type, contract_kind, status, start_date (nullable), end_date (nullable),
  value, total_value, consumed_value, consumed_quantity,
  payment_condition_id, contract_terms, erp_code, quotation_id,
  file_url, notes, sent_for_acceptance_at, accepted_at,
  accepted_by_supplier, refusal_reason
- contract_items: contract_id, material_code, material_description,
  unit_of_measure, quantity_contracted, quantity_consumed, unit_price,
  total_price (generated), consumed_value, delivery_days,
  eliminated (bool), eliminated_at, eliminated_reason,
  quotation_item_id
- contract_acceptances: contract_id, supplier_id, action
  (accepted/refused), notes, term_version, ip_address, user_id
- ai_analysis_logs: entity, entity_id, analysis_type, prompt,
  response, model, input_tokens, output_tokens, created_by
- supplier_categories: company_id, supplier_id, category

### Feature keys (tenant_features)
- Core: quotations, equalization, orders, requisitions, suppliers,
  items, reports, users, settings, logs, approval_requisition,
  approval_order
- Premium: ai_analytics, ai_negotiation, contracts, contract_balance, **api_integrations**

### Storage buckets
- company-logos (público), profile-avatars (público),
  proposal-attachments (privado), contract-files (público)

## 6. BACKLOG PRIORIZADO
Revisado 18/08/2026. **Foco atual:** idempotência outbound e testes de integração.

### Em foco agora
**A. Integração outbound — pedidos** ✅ v1 (SPEC §10.10)
- Aceite fornecedor dispara `purchase_order.create`
- Update/delete em pedidos integrados (`completed`)
- Status: `processing` → `completed` | `error` | `integration_error`
- Monitor com reenvio condicional (sem duplicar ERP OK + Valore OK)

**B. Requisições — inbound only** ✅ (SPEC §10.11)
- ERP → Valore via `POST /api/v1/requisitions`
- Outbound REQ não disparado (infra pronta no código)

**C. Próximo: idempotência outbound**
- Header `Idempotency-Key` + dedup no ERP

### Loja de API — Fase 1 (base)
- ✅ Passos 1–8 SPEC §10.8 (inbound, UI admin, monitor, docs)
- 🟡 Outbound: pedido create/update/delete ✅; REQ inbound only; idempotência pendente

### Imediato (paralelo)
1. **Fechar enforcement de permissões** — `created_by`, `edit_own`, `view_all`, `portal.solicitante`
2. **Unificar Configurações por abas** — Usuários + Permissões + **Integrações** (Loja de API)
3. **Permissões do Admin pelo Master** — matriz em `/admin/tenants/[id]`
4. **Ampliar testes**
5. **Rotina de docs no repo**

### Médio prazo
6. **Módulo de Recebimento** + consumo REQ/contrato
7. **Consumo por item de requisição** (Parcial/Total/Aberta)
8. **Login fornecedor redesign + gestão de usuários por fornecedor**
9. **"Agir como"** no comprador
10. **Importação massiva de requisições (Excel)**
11. **Idempotência outbound** (header `Idempotency-Key` + dedup no ERP)
12. **Alertas de integração** (e-mail/in-app quando `integration_error`)

### Baixa prioridade
13. Migrar documentação de implantação para Notion

### Já implementado (validação da lista)
- Loja de API inbound v1 + docs públicas + monitor v2
- Outbound pedidos operacional (§10.10)
- Negociação por IA (`ai_negotiation`, equalização)
- Sidebar + route guard por permissões (v2.19.76)
- Filtro `requester_id` no portal solicitante
- Política de senhas por tenant (v2.19.77)
- Config parcial por abas (falta unificar Usuários/Permissões)

### Escala 6–12 meses
IA negociação v2, previsão de demanda, compra recorrente, API Store/ERP,
precificação por spend, compliance, SSO/SAML, white-label

### Concluído recentemente
- **Integração ERP — pedidos outbound** (v2.19.78): fluxo completo §10.10; status `integration_error` vs `error`; IDs `external_purchase_order_id`; monitor com reenvio inteligente; config integrações só admin
- **Fix auth refresh + hydration** (proxy cookies, singleton Supabase, ValoreLogo, Radix mount)
- **Política de senhas por tenant** (aba Segurança admin, expiração, histórico,
  mesma regra comprador/solicitante/fornecedor, migration 039)
- **Enforcement de permissões no frontend** (v2.19.76): `comprador-nav.ts`,
  sidebar filtrada, route guard, toast `?error=sem_permissao`
- **Indicador visual na equalização** (contrato compatível por célula fornecedor,
  tooltip com saldo, feature `contract_balance`)
- **E2E fluxos críticos contrato/pedido**: `e2e/contract-flows.spec.ts` +
  helpers `e2e/helpers/` (fixtures dinâmicas via service role); incluído em
  `npm run test:e2e:critical`
- **Admin — configurações por tenant** (`/admin/tenants/[id]` → Configurações)
- PDF do contrato, consumo de saldo (Fases 1 e 2) + premium `contract_balance`
- Notificações de contrato, `expired` automático, otimização proxy

## 7. SEEDS DE TESTE
- Empresa Teste: 00000000-0000-0000-0000-000000000001
- Usuário comprador: teste@procuremax.com.br
  (c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7)
- Cotação referência: aaaaaaaa-0000-0000-0000-000000000001
  (COT-2026-0026)
- Cotação ativa: 3c1a465b-f4d4-461e-a0b5-ab7609d6480d
  (COT-2026-0036)

## 8. VARIÁVEIS DE AMBIENTE
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- API_KEY_PEPPER (opcional; hash das API keys da Loja de API)
- ANTHROPIC_API_KEY (sem NEXT_PUBLIC_)
- RESEND_API_KEY
- RESEND_FROM_EMAIL
- NEXT_PUBLIC_APP_URL

## 9. COMO RODAR
- npm run dev
- npm run test:unit
- npm run test:e2e
- npm run test:e2e:critical — pedidos, cotações, equalização, contratos
  (`critical-flows.spec.ts` + `contract-flows.spec.ts`; requer dev server,
  `.env.local` com `SUPABASE_SERVICE_ROLE_KEY`)

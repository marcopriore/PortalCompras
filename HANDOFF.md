# Valore — Handoff para Novo Chat

## Data: 13/08/2026
## Versão: v2.19.75

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
- Equalização: % vs alvo e % vs média histórica (prefs em localStorage)
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
- Migrations: 020–031

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
- Premium: ai_analytics, ai_negotiation, contracts

### Storage buckets
- company-logos (público), profile-avatars (público),
  proposal-attachments (privado), contract-files (público)

## 6. BACKLOG PRIORIZADO
1. Enforcement de permissões no frontend (sidebar dinâmica por role)
2. Cobertura de testes (E2E fluxos críticos contrato/pedido)
3. Política de segurança de senhas
4. Indicador visual na equalização (itens com contrato compatível)
5. Recebimento parcial ERP / liberação de reserva não utilizada
6. Migrar documentação de implantação para Notion

### Concluído recentemente
- **Admin — configurações por tenant** (`/admin/tenants/[id]` → Configurações): registry, APIs, polling, IA, score, contratos, cooldown proxy
- PDF do contrato, consumo de saldo (Fases 1 e 2) + premium `contract_balance`
- Notificações de contrato, `expired` automático, otimização proxy (fim do loop maintenance)

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
- ANTHROPIC_API_KEY (sem NEXT_PUBLIC_)
- RESEND_API_KEY
- RESEND_FROM_EMAIL
- NEXT_PUBLIC_APP_URL

## 9. COMO RODAR
- npm run dev
- npm run test:unit
- npm run test:e2e
- npm run test:e2e:critical

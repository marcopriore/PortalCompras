# PROJETO_CONTEXT.md — Valore (Portal de Compras)

## 1. PREMISSAS DO CHAT

- Usar Cursor para codificação — gerar prompts estruturados e detalhados
- Instruções detalhadas SEM blocos de código extensos (o Cursor já tem IA para codar)
- Colocar pontos de atenção que não podem ser quebrados
- Sempre usar padrões de cores e identidade da marca
- Código otimizado e seguro
- Sempre indicar o local do comando (Cursor, PowerShell, Supabase SQL Editor, Navegador)
- Ir passo a passo — aguardar confirmação antes de avançar
- Encapsular prompt para copiar e colar
- Sugerir testes de validação antes de versionar
- Manter versionamento git com tags
- Sempre remover imports ao remover componentes
- Verificar balanceamento JSX após edições grandes
- Rodar `npx tsc --noEmit` antes de considerar concluído
- Listar explicitamente o que remover E o que manter
- Formato git:
  ```
  cd "C:\Dev\Portal Compras"
  git add .
  git commit -m "mensagem"
  git tag vX.X.X
  git push origin main
  git push origin vX.X.X
  ```

---

## 2. IDENTIDADE DA MARCA

- **Nome:** Valore
- **Significado:** Do italiano "valor, validade, importância"
- **Tom:** Sério e corporativo (enterprise)
- **Logo:** V estilizado com gradiente índigo→elétrico em container quadrado arredondado
- **Tipografia do nome:** Georgia serif, lowercase, letter-spacing 3px
- **Componente:** `components/ui/valore-logo.tsx`

### Paleta de Cores
| Nome | Hex | Uso |
|------|-----|-----|
| Índigo | #4F3EF5 | Cor primária, gradiente início |
| Elétrico | #00C2FF | Gradiente fim, destaques |
| Profundo | #2D1FA3 | Hover, variações escuras |
| Noite | #1a1a2e | Sidebar background |
| Lavanda | #f4f3ff | Backgrounds sutis |

---

## 3. STACK TÉCNICA

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Banco de dados:** Supabase (PostgreSQL + RLS)
- **Autenticação:** Supabase Auth (email + senha)
- **Hospedagem futura:** Vercel
- **Repositório:** https://github.com/marcopriore/PortalCompras
- **Caminhos locais:** `C:\Dev\Portal Compras`
- **Versão atual:** v2.9.2

---

## 4. DESIGN SYSTEM

Arquivo `globals.css` usa tokens CSS:
- Primária: `oklch(0.52 0.26 264)` — índigo Valore (#4F3EF5)
- Sidebar escura: `oklch(0.12 0.02 250)` / `#1a1a2e`
- Fonte: Geist
- **NUNCA usar cores hardcoded** — sempre tokens: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-primary`, `bg-primary`
- **Exceção permitida:** badges e cards de métrica coloridos (bg-blue-50, bg-green-50, etc.)

### Padrão de Cards de Métrica
```
bg-{color}-50 border border-{color}-100 rounded-xl p-5
ícone em bg-{color}-100 p-3 rounded-full
label: text-sm text-{color}-600 font-medium
valor: text-3xl font-bold text-{color}-700
```

### Padrão de Filtros
- Sempre com label acima de cada campo (`text-xs font-medium text-muted-foreground mb-1 block`)
- Envolver em `bg-muted/40 border border-border rounded-xl p-4`
- Contador "X resultado(s)" + botão "Limpar filtros" acima da tabela

---

## 5. ARQUITETURA MULTI-TENANT

- **Modelo:** Shared Database, Shared Schema com `company_id` em todas as tabelas
- **RLS ativo** em todas as tabelas de negócio
- **Superadmin (Marco):** acesso a todos os tenants via seletor no header
- **Admin do tenant:** acesso apenas à própria empresa
- **UUID fixo para testes:** `00000000-0000-0000-0000-000000000001` (Empresa Teste)
- **UUID do usuário de teste:** `c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7` (teste@procuremax.com.br)

---

## 6. ESTRUTURA DO BANCO (Supabase)

### Tabelas criadas:

**companies** — tenants do sistema
- id, name, trade_name, cnpj, state_reg, address, city, state, zip_code, logo_url, status, created_at

**profiles** — usuários vinculados a tenants
- id (FK auth.users), company_id, full_name, role, status, is_superadmin, job_title, department, phone, avatar_url, created_at

**suppliers** — fornecedores por tenant
- id, company_id, code, name, cnpj, email, phone, category, city, state, status, created_at

**items** — itens/materiais (somente leitura, sync ERP)
- id, company_id, code, short_description, status, unit_of_measure, ncm, commodity_group, created_at

**quotations** — cotações de compra
- id, company_id, code (COT-YYYY-NNNN), description, status (draft/waiting/analysis/completed/cancelled), category, payment_condition, response_deadline, created_by, created_at

**quotation_items** — itens das cotações
- id, quotation_id, company_id, material_code, material_description, unit_of_measure, quantity, complementary_spec

**quotation_suppliers** — fornecedores convidados por cotação
- id, quotation_id, company_id, supplier_id, supplier_name, supplier_cnpj

**quotation_proposals** — propostas dos fornecedores
- id, company_id, quotation_id, supplier_id, supplier_name, supplier_cnpj, total_price, delivery_days, payment_condition, validity_date, observations, status (submitted/selected/rejected), selected_at

**proposal_items** — itens das propostas
- id, proposal_id, quotation_item_id, company_id, unit_price, tax_percent, item_status (accepted/rejected), observations

**proposal_attachments** — anexos das propostas
- id, proposal_id, company_id, file_name, file_path, file_size

**requisitions** — requisições de compra
- id, company_id, code (REQ-YYYY-NNNN), title, description, cost_center, needed_by, priority (normal/urgent/critical), status (pending/approved/rejected/in_quotation/completed), requester_id, requester_name, approver_id, approver_name, approved_at, rejection_reason, erp_code, origin (manual/erp), quotation_id

**requisition_items** — itens das requisições
- id, requisition_id, company_id, material_code, material_description, quantity, unit_of_measure, estimated_price, commodity_group, observations

**purchase_orders** — pedidos de compra
- id, company_id, code (PED-YYYY-NNNN), erp_code, supplier_name, supplier_cnpj, payment_condition, delivery_days, delivery_address, quotation_code, requisition_code, total_price, status (processing/sent/error/completed), erp_error_message, observations, created_by

**purchase_order_items** — itens dos pedidos
- id, purchase_order_id, company_id, quotation_item_id, material_code, material_description, quantity, unit_of_measure, unit_price, tax_percent, total_price (generated)

**audit_logs** — log de auditoria
- id, company_id, user_id, user_name, event_type, entity, entity_id, description, metadata (jsonb), created_at

**notification_preferences** — preferências de notificação por usuário
- id, user_id, company_id, new_requisition, quotation_received, order_approved, delivery_done, daily_summary

**approval_levels** — alçadas de aprovação por tenant
- id, company_id, level_order, min_value, max_value, approver_role

**tenant_features** — módulos liberados por tenant (superadmin controla)
- id, company_id, feature_key, enabled
- feature_keys: quotations, equalization, orders, requisitions, suppliers, items, reports, users, logs, settings

**role_permissions** — permissões por role dentro do tenant (admin controla)
- id, company_id, role, permission_key, enabled
- permission_keys: quotation.create, quotation.cancel, quotation.equalize, quotation.edit, order.create, order.edit, requisition.create, requisition.approve, view_only

### Funções/Triggers:
- `handle_new_user()` — cria perfil ao registrar usuário
- `generate_quotation_code()` — gera COT-YYYY-NNNN
- `generate_requisition_code()` — gera REQ-YYYY-NNNN
- `generate_purchase_order_code()` — gera PED-YYYY-NNNN
- `update_updated_at_column()` — atualiza updated_at
- `is_superadmin()` — função SECURITY DEFINER para RLS

### Storage Buckets:
- `proposal-attachments` — anexos das propostas (privado)

---

## 7. ESTRUTURA DE ARQUIVOS (principais)

```
app/
  login/page.tsx
  admin/
    layout.tsx                        — sidebar escura + header com nome do admin
    tenants/
      page.tsx                        — listagem + cadastro de tenants
      [id]/
        page.tsx                      — detalhe do tenant (abas: Visão Geral, Usuários)
        features/page.tsx             — funcionalidades liberadas por tenant
  comprador/
    layout.tsx                        — sidebar + header + TenantSelector
    page.tsx                          — dashboard (parcialmente conectado)
    requisicoes/
      page.tsx                        — listagem de requisições
      nova/page.tsx                   — nova requisição
      [id]/page.tsx                   — detalhe + aprovar/rejeitar/gerar cotação
    cotacoes/
      page.tsx                        — listagem de cotações
      nova/page.tsx                   — nova cotação (aceita ?requisition_id)
      [id]/page.tsx                   — detalhe da cotação
      [id]/equalizacao/page.tsx       — equalização de propostas (inteligente)
      [id]/novo-pedido/page.tsx       — novo pedido a partir da proposta selecionada
    pedidos/
      page.tsx                        — listagem de pedidos
      [id]/page.tsx                   — detalhe do pedido
    itens/page.tsx                    — somente leitura
    fornecedores/page.tsx             — somente leitura
    relatorios/page.tsx               — dashboards + exportação Excel
    configuracoes/
      page.tsx                        — abas: Empresa, Perfil, Notificações, Aprovações, Segurança
      usuarios/page.tsx               — gestão de usuários + importação em massa
      permissoes/page.tsx             — matriz de permissões por role
  fornecedor/                         — ⬜ NÃO IMPLEMENTADO
  api/
    auth/logout/route.ts
    admin/
      create-tenant/route.ts          — cria tenant + usuário admin (server-side)
      create-user/route.ts            — cria usuário (server-side, service role)
      import-users/route.ts           — importação em massa de usuários

components/
  ui/
    valore-logo.tsx                   — componente do logo com gradiente
  layout/
    sidebar.tsx                       — sidebar com links e ValoreLogo
    header.tsx                        — header com notificações e usuário
    tenant-selector.tsx               — seletor de tenant para superadmin

lib/
  supabase/
    client.ts                         — createBrowserClient
    server.ts                         — createServerClient
  hooks/
    useUser.ts                        — userId, companyId, isSuperAdmin, loading
    usePermissions.ts                 — hasFeature(), hasPermission()
  audit.ts                            — logAudit() helper

supabase/migrations/
  001_auth_tenants.sql
  002_quotations.sql

proxy.ts                              — proteção de rotas
```

---

## 8. VARIÁVEIS DE AMBIENTE (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://fijnckrlvwsgbzlkvesb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  ← server-side apenas (sem NEXT_PUBLIC_)
```

**IMPORTANTE:** `SUPABASE_SERVICE_ROLE_KEY` NÃO tem prefixo `NEXT_PUBLIC_` — foi migrado para server-side nas API routes.

---

## 9. VERSÕES GIT

| Tag | Descrição |
|-----|-----------|
| v0.1.0 - v0.9.0 | Estrutura inicial, autenticação, cotações, itens |
| v1.0.0 | Tela de fornecedores completa |
| v1.1.0 | Dashboard conectado ao Supabase |
| v1.2.0 | Redesign painel Admin |
| v1.3.0 | Detalhe do tenant com abas e métricas |
| v1.4.0 | Métricas com filtro de período |
| v1.5.0 | Logs de auditoria + instrumentação |
| v1.6.0 | Gestão de usuários com importação em massa (.xlsx via ExcelJS) |
| v1.7.0 | Service role key movida para servidor |
| v1.8.0 | Correções de RLS e sincronização de métricas |
| v1.9.0 | Filtros e export Excel em cotações |
| v2.0.0 | Relatórios conectados ao Supabase + exportação Excel |
| v2.1.0 | Equalização de propostas com indicadores inteligentes |
| v2.2.0 | Tela de novo pedido de compra |
| v2.3.0 | Tela de pedidos conectada ao Supabase |
| v2.4.0 | Tela de detalhe do pedido |
| v2.5.0 | Tela de configurações completa |
| v2.6.0 | Controle de funcionalidades por tenant e permissões por role |
| v2.7.0 | Módulo de requisições completo |
| v2.8.0 | Identidade visual Valore — logo, paleta índigo+elétrico |
| v2.9.0 | Fluxo requisição→cotação corrigido, badge de cotação vinculada |
| v2.9.1 | Remover botão Convidar Fornecedores |
| v2.9.2 | Seed robusto — dados para teste de todas as funcionalidades |

---

## 10. HOOKS E UTILITÁRIOS IMPORTANTES

### useUser
```typescript
const { userId, companyId, isSuperAdmin, loading } = useUser()
```

### usePermissions
```typescript
const { hasFeature, hasPermission, loading } = usePermissions()
hasFeature('quotations')           // módulo liberado pelo superadmin?
hasPermission('quotation.create')  // ação permitida para o role do usuário?
```

### logAudit
```typescript
await logAudit({
  eventType: 'quotation.created',
  description: 'Cotação COT-2026-0001 criada',
  companyId, userId, entity: 'quotations', entityId: id,
  metadata: { code, status }
})
```
**event_types disponíveis:** user.login, user.logout, user.created, user.updated, tenant.created, tenant.updated, quotation.created, quotation.updated, quotation.cancelled, impersonation, integration.items, integration.suppliers, integration.outbound

### ValoreLogo
```tsx
<ValoreLogo size={28} showName={true} nameColor="#ffffff" />
```

---

## 11. ESCOPO DO SISTEMA

### Modelo de negócio:
- **Marco (superadmin)** = dono da plataforma
- **Clientes** = empresas que contratam o SaaS (cada uma é um tenant)
- **Fornecedores** = cadastrados na base de cada tenant, populados via API do ERP
- **Itens/Materiais** = cadastrados via API do ERP (somente leitura no sistema)

### Fluxo principal de compras:
```
Requisição → Aprovação → Cotação → Equalização de Propostas → Pedido → ERP
```

### Roles de usuário:
| Role | Label | Permissões principais |
|------|-------|----------------------|
| admin | Administrador do Tenant | Tudo |
| buyer | Comprador | Criar/equalizar cotações, criar pedidos, criar requisições |
| manager | Gestor de Compras | Criar/aprovar requisições |
| approver | Aprovador | Aprovar requisições |

---

## 12. TELAS E STATUS

| # | Tela | Rota | Status |
|---|------|------|--------|
| 1 | Dashboard | /comprador | ✅ parcial (Saving/Pedidos/Lead Time mockados) |
| 2 | Listagem Requisições | /comprador/requisicoes | ✅ |
| 3 | Nova Requisição | /comprador/requisicoes/nova | ⚠️ layout a melhorar |
| 4 | Detalhe Requisição | /comprador/requisicoes/[id] | ✅ |
| 5 | Listagem Cotações | /comprador/cotacoes | ✅ |
| 6 | Nova Cotação | /comprador/cotacoes/nova | ✅ (aceita ?requisition_id) |
| 7 | Detalhe Cotação | /comprador/cotacoes/[id] | ✅ |
| 8 | Equalização | /comprador/cotacoes/[id]/equalizacao | ✅ |
| 9 | Novo Pedido | /comprador/cotacoes/[id]/novo-pedido | ✅ |
| 10 | Listagem Pedidos | /comprador/pedidos | ✅ |
| 11 | Detalhe Pedido | /comprador/pedidos/[id] | ⚠️ visual simples |
| 12 | Itens | /comprador/itens | ✅ somente leitura |
| 13 | Fornecedores | /comprador/fornecedores | ✅ somente leitura |
| 14 | Relatórios | /comprador/relatorios | ✅ parcial (alguns mockados com borda vermelha) |
| 15 | Configurações | /comprador/configuracoes | ✅ |
| 16 | Gestão de Usuários | /comprador/configuracoes/usuarios | ✅ + importação Excel |
| 17 | Perfis de Acesso | /comprador/configuracoes/permissoes | ✅ |
| 18 | Listagem Tenants | /admin/tenants | ✅ |
| 19 | Detalhe Tenant | /admin/tenants/[id] | ✅ |
| 20 | Funcionalidades Tenant | /admin/tenants/[id]/features | ✅ |
| 21 | Logs Auditoria | /admin/logs | ✅ |
| 22 | Dashboard Fornecedor | /fornecedor | ⬜ não implementado |
| 23 | Cotações Fornecedor | /fornecedor/cotacoes | ⬜ não implementado |
| 24 | Responder Proposta | /fornecedor/cotacoes/[id] | ⬜ não implementado |

---

## 13. FUNCIONALIDADES ESPECIAIS

### Equalização de Propostas (tela mais complexa)
Localização: `/comprador/cotacoes/[id]/equalizacao`
- Cards: Menor Preço Total, Menor Prazo, Melhor Cobertura (%), Economia no Split
- Tabela com colunas: Fornecedor, Preço Total, Preço Ponderado (itens comuns), Prazo, Pagamento, Validade, Cobertura (badge colorido), Itens (expandível), Ações
- Expansão de itens: sub-tabela com ícone Trophy no melhor preço por item
- Seção "Sugestão de Split": menor custo dividindo entre fornecedores
- Export Excel: uma aba por fornecedor com itens aceitos/rejeitados

### Importação de Usuários em Massa
Localização: `/comprador/configuracoes/usuarios`
- Download de template .xlsx com ExcelJS (duas abas: Importação + Instruções)
- Upload → validação → revisão (badges válido/inválido) → importação com progresso
- Colunas: Nome Completo, E-mail, Perfil, Status

### Controle de Acesso em Dois Níveis
- **Nível 1 (superadmin):** `tenant_features` — habilita/desabilita módulos por tenant
- **Nível 2 (admin do tenant):** `role_permissions` — configura permissões por role
- **Frontend:** hook `usePermissions` → `hasFeature()` e `hasPermission()`
- **Bloqueio:** botões ficam disabled com tooltip "Sem permissão" (não remove da UI)

---

## 14. DÉBITOS TÉCNICOS E PENDÊNCIAS

### Críticos:
- [ ] Favicon do Valore (exportar SVG do logo como .ico)
- [ ] Testes de permissão com usuários de diferentes roles

### Funcionais:
- [ ] Módulo do Fornecedor (visão para responder propostas)
- [ ] Dashboard — conectar cards mockados (Saving, Pedidos em Andamento, Lead Time)
- [ ] Nova Requisição — melhorar layout do formulário
- [ ] Detalhe do Pedido — refinamento visual

### Futuros:
- [ ] Envio de e-mail de boas-vindas para novos usuários
- [ ] API de integração com ERP (sync automático de itens e fornecedores)
- [ ] Visão do Fornecedor para responder propostas digitalmente
- [ ] Tema índigo na sidebar (alternativa à sidebar noite escura atual)
- [ ] Deploy Vercel
- [ ] Módulo de Aprovação com alçadas por valor/centro de custo/grupo de mercadoria
- [ ] Requisições originadas do ERP (importação)
- [ ] 2FA e Sessões Ativas nas configurações de segurança
- [ ] Rate limiting no login
- [ ] Política de Privacidade e Termos de Uso

---

## 15. DADOS DE SEED (Empresa Teste)

### Fornecedores (12 cadastrados):
FOR-001 Aço Brasil Ltda, FOR-002 Química Industrial, FOR-003 TechParts,
FOR-004 Metalúrgica Souza, FOR-005 Distribuidora Norte, FOR-006 Papelaria Central,
FOR-007 Eletro Componentes, FOR-008 Segurança Total, FOR-009 Mobiliare Design,
FOR-010 FastLog, FOR-011 Green Clean, FOR-012 TechVision

### Itens (19 cadastrados):
Categorias: Mecânica (MEC), Elétrica (ELE), Informática (INF), Limpeza (LIM),
Mobiliário (MOV), Segurança (SEG), Serviços (SER), Matérias-primas (MAT)

### Requisições (17): 3 pending, 3 approved, 3 rejected, 5 in_quotation, 3 completed
### Cotações (15+): 3 draft, 3 waiting, 3 analysis, 3 completed, 3+ cancelled
### Pedidos (13): 4 processing, 3 sent, 3 error (com mensagem), 3 completed

---

## 16. PADRÕES DE CÓDIGO IMPORTANTES

### params em Next.js 16 (App Router)
```typescript
// SEMPRE usar React.use() para desembrulhar params
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
}
```

### Supabase Client
```typescript
// Browser (Client Components)
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Server (API Routes, Server Components)
import { createClient } from '@/lib/supabase/server'
```

### ExcelJS (import dinâmico obrigatório)
```typescript
const ExcelJS = (await import('exceljs')).default
// Nunca import estático no topo do arquivo
```

### Máscaras reutilizáveis
```typescript
// CNPJ: XX.XXX.XXX/XXXX-XX
function maskCNPJ(value: string): string { ... }

// Telefone: (XX) XXXXX-XXXX
function maskPhone(value: string): string { ... }
```

### Funções de avatar (usadas em múltiplas telas)
```typescript
function getInitials(name: string): string { ... }
const AVATAR_COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#db2777','#0284c7']
function getAvatarColor(name: string): string { ... }
```

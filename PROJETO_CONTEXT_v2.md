# PROJETO_CONTEXT.md — Valore (Portal de Compras)
# Versão 2 — Atualizada após sessão de desenvolvimento intensivo

---

## 1. PREMISSAS DO CHAT

- Usar **Cursor IDE** para codificação — gerar prompts estruturados e detalhados
- Instruções detalhadas SEM blocos de código extensos (o Cursor já tem IA para codar)
- Colocar pontos de atenção que não podem ser modificados ou quebrados
- Orientar a sempre utilizar os padrões de cores e identidade da marca
- Código otimizado e com segurança
- Sempre indicar o local do comando (Cursor, PowerShell, Navegador, Supabase SQL Editor)
- Ir passo a passo — aguardar confirmação antes de avançar
- Não passar código em si, só em casos de muita necessidade
- **Encapsular o prompt** para copiar e colar
- Sugerir testes de validação antes de versionar
- Manter versionamento git com tags
- Sempre remover imports ao remover componentes
- Verificar balanceamento JSX após edições grandes
- Rodar `npx tsc --noEmit` antes de considerar concluído
- Listar explicitamente o que remover E o que manter
- **Supabase SQL Editor** → SQL pronto para executar (nunca texto descritivo)
- **Cursor IDE** → prompt descritivo estruturado

### Padrão de versionamento git
```
cd "C:\Dev\Portal Compras"
git add .
git commit -m "feat: descrição"
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
- **Caminho local:** `C:\Dev\Portal Compras`
- **Versão atual:** v2.19.63 *(atualizar seções detalhadas deste arquivo conforme `SPEC.md` / `CLAUDE.md` quando necessário)*

---

## 4. DESIGN SYSTEM

Arquivo `globals.css` usa tokens CSS:
- Primária: `oklch(0.52 0.26 264)` — índigo Valore (#4F3EF5)
- Sidebar escura: `oklch(0.12 0.02 250)` / `#1a1a2e`
- Fonte: Geist
- **NUNCA usar cores hardcoded** — sempre tokens: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-primary`, `bg-primary`
- **Exceção permitida:** badges e cards de métrica coloridos (bg-blue-50, bg-green-50, etc.)
- **Exceção permitida:** sidebar usa `#1a1a2e` e branco/opacidade

### Padrão de Cards de Métrica (PADRONIZADO)
```
<div className="bg-white border border-{color}-100 rounded-xl p-5 flex items-center justify-between">
  <div>
    <p className="text-sm text-{color}-600 font-medium">{label}</p>
    <p className="text-3xl font-bold text-{color}-700 mt-1">{valor}</p>
  </div>
  <div className="bg-{color}-100 p-3 rounded-full">
    <Icon className="w-6 h-6 text-{color}-600" />
  </div>
</div>
```
- Container: `grid grid-cols-4 gap-4 mb-6`

### Padrão de Layout das Telas de Listagem (PADRONIZADO)
1. Cabeçalho (título + botão de ação)
2. Cards de métricas (grid 4 colunas)
3. Seção de filtros (`bg-muted/40 border border-border rounded-xl p-4 mb-6`)
4. Grid/tabela de resultados

### Padrão de Filtros
- Sempre com label acima de cada campo
- Filtros de lista: componente `MultiSelectFilter` (`components/ui/multi-select-filter.tsx`)
- Campos de busca texto: input com ícone `Search` à esquerda e botão `X` para limpar
- Larguras fixas nos filtros (`w-40`, `w-48`, etc.) — nunca expandir
- Contador "X resultado(s)" + botão "Limpar filtros"

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

### Tabelas principais:

**companies** — tenants do sistema

**profiles** — usuários vinculados a tenants
- `role` text — primeiro role (compatibilidade)
- `roles` text[] — array de roles (suporte múltiplos roles por usuário)
- Roles disponíveis: `admin`, `buyer`, `manager`, `approver_requisition`, `approver_order`, `requester`

**suppliers** — fornecedores por tenant

**items** — itens/materiais (somente leitura, sync ERP)

**quotations** — cotações de compra
- status: `draft`, `waiting`, `analysis`, `completed`, `cancelled`

**quotation_items** — itens das cotações

**quotation_suppliers** — fornecedores convidados por cotação

**quotation_rounds** — rodadas de negociação por cotação
- `id`, `company_id`, `quotation_id`, `round_number`, `status` ('active'|'closed'), `response_deadline` (date), `created_at`, `closed_at`
- UNIQUE (quotation_id, round_number)

**quotation_proposals** — propostas dos fornecedores
- `round_id` uuid FK quotation_rounds
- status: `invited`, `submitted`, `selected`, `rejected`

**proposal_items** — itens das propostas
- `round_id` uuid FK quotation_rounds

**proposal_attachments** — anexos das propostas

**requisitions** — requisições de compra
- status: `pending`, `approved`, `rejected`, `in_quotation`, `completed`
- `approved_at`, `rejection_reason`, `approver_id`, `approver_name`

**requisition_items** — itens das requisições

**purchase_orders** — pedidos de compra
- status: `draft`, `processing`, `sent`, `error`, `completed`
- `approved_at`, `approver_name`, `rejection_reason`

**purchase_order_items** — itens dos pedidos
- `round_id` uuid FK quotation_rounds

**approval_levels** — regras de aprovação
- `flow` ('requisition'|'order'), `cost_center`, `category`, `approver_id`, `approver_name`
- Para requisição: aprovação por centro de custo
- Para pedido: aprovação por categoria + faixa de valor

**approval_requests** — instâncias de aprovação pendentes
- `flow` ('requisition'|'order'), `entity_id`, `approver_id`, `status` ('pending'|'approved'|'rejected')

**quotation_rounds** — já descrito acima

**tenant_features** — módulos liberados por tenant
- feature_keys relevantes: `quotations`, `orders`, `requisitions`, `suppliers`, `items`, `reports`, `users`, `logs`, `settings`, `approval_requisition`, `approval_order`

**role_permissions** — permissões por role
- permission_keys: `quotation.create`, `quotation.cancel`, `quotation.equalize`, `quotation.edit`, `order.create`, `order.edit`, `requisition.create`, `requisition.approve`, `view_only`, `approval.requisition`, `approval.order`, `nav.dashboard`, `nav.requisitions`, `nav.quotations`, `nav.orders`, `nav.items`, `nav.suppliers`, `nav.reports`

**roles** — tabela de roles por tenant (seed dos 4 fixos)

### Funções/Triggers SQL importantes:
- `get_approver_for_requisition(p_company_id, p_cost_center)` — retorna aprovador por CC
- `check_all_approved(p_entity_id)` — verifica se todos aprovaram (GRANT para authenticated)
- `auto_close_expired_rounds()` — fecha rodadas com prazo expirado
- `check_round_completion()` — trigger: fecha rodada quando todos fornecedores respondem
- `trg_check_round_completion` — trigger em `proposal_items` (INSERT/UPDATE)

### Constraints importantes:
- `purchase_orders_status_check`: `('draft','processing','sent','error','completed')`
- `quotation_proposals_status_check`: `('invited','submitted','selected','rejected')`
- `quotation_rounds.status`: `('active','closed')`
- `approval_requests.status`: `('pending','approved','rejected')`

---

## 7. ESTRUTURA DE ARQUIVOS (principais)

```
app/
  login/page.tsx
  admin/
    layout.tsx
    tenants/
      page.tsx
      [id]/page.tsx
      [id]/features/page.tsx
  comprador/
    layout.tsx
    page.tsx                          — dashboard
    requisicoes/
      page.tsx                        — listagem
      nova/page.tsx                   — nova requisição (busca itens do banco, grid de itens)
      [id]/page.tsx                   — detalhe + informações gerais unificadas
      [id]/editar/page.tsx            — editar requisição rejeitada e resubmeter
    aprovacoes/
      page.tsx                        — fila de aprovações (abas por flow)
    cotacoes/
      page.tsx                        — listagem
      nova/page.tsx
      [id]/page.tsx                   — detalhe
      [id]/editar/page.tsx            — editar cotação rascunho/rejeitada
      [id]/equalizacao/page.tsx       — TELA MAIS COMPLEXA (ver seção específica)
      [id]/novo-pedido/page.tsx
    pedidos/
      page.tsx                        — listagem
      [id]/page.tsx                   — detalhe com status draft/processing/etc
    itens/page.tsx
    fornecedores/page.tsx
    relatorios/page.tsx
    configuracoes/
      page.tsx                        — abas: Empresa, Perfil, Notificações, Aprovações, Segurança
      usuarios/page.tsx               — gestão + importação Excel (multi-roles)
      permissoes/page.tsx             — matriz de permissões por role

components/
  ui/
    valore-logo.tsx
    multi-select-filter.tsx           — filtro multi-select reutilizável
  layout/
    sidebar.tsx                       — sidebar com controle de visibilidade por permissão
    header.tsx
    tenant-selector.tsx

lib/
  supabase/client.ts
  supabase/server.ts
  hooks/
    useUser.ts                        — userId, companyId, role, roles[], hasRole(), isSuperAdmin
    usePermissions.ts                 — hasFeature(), hasPermission(), loading
  audit.ts
```

---

## 8. VARIÁVEIS DE AMBIENTE

```
NEXT_PUBLIC_SUPABASE_URL=https://fijnckrlvwsgbzlkvesb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  ← server-side apenas
```

---

## 9. HOOKS E UTILITÁRIOS IMPORTANTES

### useUser
```typescript
const { userId, companyId, role, roles, hasRole, isSuperAdmin, loading } = useUser()
// roles: string[] — array completo de roles do usuário
// hasRole('admin'): boolean
```

### usePermissions
```typescript
const { hasFeature, hasPermission, loading } = usePermissions()
// Busca permissões para TODOS os roles do usuário (union — se qualquer role tiver, retorna true)
hasFeature('quotations')
hasPermission('nav.dashboard')
hasPermission('approval.requisition')
```

### MultiSelectFilter
```typescript
<MultiSelectFilter
  label="Status"
  options={[{ value: 'pending', label: 'Pendente' }]}
  selected={statusFilter}
  onChange={setStatusFilter}
  width="w-40"
/>
```

### ExcelJS (import dinâmico obrigatório)
```typescript
const ExcelJS = (await import('exceljs')).default
```

### params em Next.js 16 (OBRIGATÓRIO)
```typescript
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
}
```

---

## 10. ROLES E PERMISSÕES

### Roles disponíveis
| Role | Label | Descrição |
|------|-------|-----------|
| admin | Administrador | Tudo |
| buyer | Comprador | Criar/equalizar cotações, criar pedidos, criar requisições |
| manager | Gestor de Compras | Criar/aprovar requisições |
| approver_requisition | Aprovador de Requisições | Aprovar/reprovar requisições |
| approver_order | Aprovador de Pedidos | Aprovar/reprovar pedidos |
| requester | Requisitante | Criar requisições |

### Múltiplos roles por usuário
- `profiles.roles text[]` — array de roles
- `profiles.role text` — primeiro role (compatibilidade)
- Sistema verifica union de permissões de todos os roles

### Controle de visibilidade da sidebar
- Links controlados por `hasPermission('nav.xxx')`
- Admin/SuperAdmin sempre vê tudo
- Skeleton durante loading para evitar flash

### Fluxo de Aprovação de Requisições
```
Nova Requisição
  → Verificar tenant_features.approval_requisition (enabled?)
    → Não: aprovação automática "fluxo desabilitado"
    → Sim: chamar RPC get_approver_for_requisition(company_id, cost_center)
      → Sem regra: aprovação automática "sem regra para este CC"
      → Com aprovador: INSERT approval_requests, status=pending
```

### Fluxo de Aprovação de Pedidos
- Alçadas por valor + categoria (commodity_group)
- Configurado em approval_levels com flow='order'

---

## 11. TELA DE EQUALIZAÇÃO — ARQUITETURA DETALHADA

Esta é a tela mais complexa do sistema.

### Estrutura de duas tabelas (solução definitiva para colunas fixas)
```
<div style="display:flex">
  <!-- Tabela esquerda: colunas fixas (Código, Descrição Curta, Qtd, UN) -->
  <div style="flex-shrink:0">
    <table> ... </table>
  </div>
  <!-- Tabela direita: fornecedores com scroll horizontal -->
  <div style="overflow-x:auto; flex:1">
    <table> ... </table>
  </div>
</div>
```

### Área de ações (acima das tabelas)
```
[Seletor de Rodada ▼] [Melhor Preço] [Colunas] [Exportar] [Finalizar Rodada | Nova Rodada]
[resumo de seleção + Criar Pedido + Finalizar Cotação]  (aparece quando há seleção)
```

### Rodadas de Negociação
- Tabela `quotation_rounds` com `round_number`, `status`, `response_deadline`
- Seletor de rodada: Select dropdown na barra de ações
- `isReadOnly` = cotação completed OU rodada selecionada não é a última
- Última rodada sempre editável (independente de status active/closed)
- **Criar nova rodada:** copia proposals com status 'invited' (sem proposal_items), apenas itens sem pedido ativo
- **Finalizar rodada:** status='closed', cotação→'analysis'
- **Fechamento automático:** trigger `trg_check_round_completion` quando todos fornecedores inserem proposal_items
- **Contador:** "X/Y fornecedores responderam" (respondido = tem ao menos 1 proposal_item na rodada)
- **Temporizador:** regressivo até `response_deadline` da rodada, só exibido quando rodada ativa

### Cabeçalho dos fornecedores (tabela direita)
- Razão Social + CNPJ
- Total calculado dos proposal_items da rodada selecionada (não total_price)
- Ponderado calculado
- Botão "Selecionar Todos"
- Trophy dourado no fornecedor com menor total

### Colunas por fornecedor (toggleáveis via seletor "Colunas")
- ✓ (seleção) — sempre visível, PRIMEIRA coluna
- Prazo (dias)
- Preço Unit. — menor preço por item destacado em verde
- Imposto %
- Total Item
- Cond. Pgto

### Itens com pedido
- Linha em cinza (`bg-zinc-100`)
- Exibe valores da rodada em que o pedido foi criado (cross-rodada)
- Ícone ShoppingCart na coluna ✓ do fornecedor vencedor com tooltip "Pedido: PED-XXXX (Rodada N)"
- Ícone visível em TODAS as rodadas (não só na rodada do pedido)
- Checkbox desabilitado para esses itens

### Modos de seleção
1. Checkbox individual por item/fornecedor
2. "Selecionar Todos" no cabeçalho do fornecedor
3. "Melhor Preço" — split automático pelo menor preço por item

### Criar Pedido
- Habilitado com qualquer quantidade de itens selecionados (não exige todos)
- Cria pedido com status `'draft'`
- NÃO redireciona — permanece na equalização
- Dialog de confirmação com lista de pedidos criados
- Após criar: recarrega dados, atualiza itens com pedido (cinza)
- Verifica cobertura total global (todas as rodadas) → se 100%, cotação vai para 'completed'

### Export Excel
- Exporta dados da **rodada selecionada**
- Aba "Dados da Cotação" como primeira aba (com rodada exportada)
- Uma aba por fornecedor
- Itens com pedido: linha verde + colunas "Pedido" e "Rodada do Pedido" (só no fornecedor correto)
- Status dos itens: "Aceito" / "Recusado" (unit_price=0) / "Respondido" (rejected mas com preço)
- Sem linhas de grade (`ws.views = [{ showGridLines: false }]`)

### Performance
- Updates em batch: `.in('id', arrayDeIds)` — nunca loop individual
- Troca de rodada: sem loading completo (skeleton sutil)

---

## 12. SEEDS DE TESTE

### Cotação de referência para equalização
- **COT-2026-0026** (id: `aaaaaaaa-0000-0000-0000-000000000001`) — 5 fornecedores, 19 itens, Rodada 1
- **COT-2026-0036** (id: `3c1a465b-f4d4-461e-a0b5-ab7609d6480d`) — cotação limpa para testes atuais

### Script padrão para criar cotação de teste
```sql
-- PASSO 1: Criar cotação
INSERT INTO quotations (...) SELECT ... FROM quotations WHERE code='COT-2026-0026' RETURNING id;

-- PASSO 2: Copiar itens + fornecedores + criar Rodada 1
INSERT INTO quotation_items ... SELECT ... FROM quotation_items WHERE quotation_id='aaaaaaaa-...';
INSERT INTO quotation_suppliers ... SELECT ... FROM quotation_suppliers WHERE quotation_id='aaaaaaaa-...';
INSERT INTO quotation_rounds (company_id, quotation_id, round_number, status)
VALUES ('00000000-...', 'NEW_ID', 1, 'active') RETURNING id;

-- PASSO 3: Inserir proposals com round_id
INSERT INTO quotation_proposals (..., round_id) VALUES (..., 'ROUND_ID');

-- PASSO 4: Inserir proposal_items com round_id
INSERT INTO proposal_items (..., round_id) VALUES (..., 'ROUND_ID');
-- ATENÇÃO: cada fornecedor tem seu próprio proposal_id único
-- ATENÇÃO: cada bloco INSERT termina com ; não com ,
```

---

## 13. VERSÕES GIT

| Tag | Descrição |
|-----|-----------|
| v2.10.0 | Melhorias nas telas de requisições |
| v2.10.1 | Corrigir travamento submit nova requisição |
| v2.11.0 | Módulo de aprovações completo |
| v2.11.1 | Permissões de aprovação por role |
| v2.11.2 | Edição/resubmissão requisição rejeitada, voltar dinâmico |
| v2.12.0 | Filtros multi-select em todas as telas |
| v2.12.1 | Tela edição cotação, redirect após envio |
| v2.12.2 | Controle visibilidade sidebar por permissão, nav permissions |
| v2.13.0 | Roles múltiplos, approver_requisition/order/requester |
| v2.13.1 | Botão equalizar, somente leitura cotação concluída |
| v2.13.2 | Botão X campos de busca, filtros pré-definidos |
| v2.13.3 | Equalização reformulada — mapa de cotação |
| v2.13.4 | Colunas fixas duas tabelas, área de ações reorganizada |
| v2.13.5 | Criar pedido rascunho, dialog confirmação, finalizar cotação |
| v2.13.6 | Status draft pedidos, otimização batch equalização |
| v2.14.0 | Rodadas de negociação completas |
| v2.14.1 | Fix status itens Excel, remover linhas de grade |
| v2.14.2 | Cards métricas padronizados (requisições, cotações, pedidos) |

---

## 14. STATUS DAS TELAS

| # | Tela | Rota | Status |
|---|------|------|--------|
| 1 | Dashboard | /comprador | ⚠️ cards mockados |
| 2 | Listagem Requisições | /comprador/requisicoes | ✅ |
| 3 | Nova Requisição | /comprador/requisicoes/nova | ✅ |
| 4 | Detalhe Requisição | /comprador/requisicoes/[id] | ✅ |
| 5 | Editar Requisição Rejeitada | /comprador/requisicoes/[id]/editar | ✅ |
| 6 | Fila de Aprovações | /comprador/aprovacoes | ✅ |
| 7 | Listagem Cotações | /comprador/cotacoes | ✅ |
| 8 | Nova Cotação | /comprador/cotacoes/nova | ✅ |
| 9 | Detalhe Cotação | /comprador/cotacoes/[id] | ✅ |
| 10 | Editar Cotação | /comprador/cotacoes/[id]/editar | ✅ |
| 11 | Equalização | /comprador/cotacoes/[id]/equalizacao | ✅ complexo |
| 12 | Novo Pedido | /comprador/cotacoes/[id]/novo-pedido | ✅ |
| 13 | Listagem Pedidos | /comprador/pedidos | ✅ |
| 14 | Detalhe Pedido | /comprador/pedidos/[id] | ⚠️ visual simples |
| 15 | Itens | /comprador/itens | ✅ somente leitura |
| 16 | Fornecedores | /comprador/fornecedores | ✅ somente leitura |
| 17 | Relatórios | /comprador/relatorios | ⚠️ parcial mockado |
| 18 | Configurações | /comprador/configuracoes | ✅ |
| 19 | Gestão de Usuários | /comprador/configuracoes/usuarios | ✅ multi-roles |
| 20 | Perfis de Acesso | /comprador/configuracoes/permissoes | ✅ |
| 21 | Listagem Tenants | /admin/tenants | ✅ |
| 22 | Detalhe Tenant | /admin/tenants/[id] | ✅ |
| 23 | Funcionalidades Tenant | /admin/tenants/[id]/features | ✅ |
| 24 | Dashboard Fornecedor | /fornecedor | ⬜ não implementado |
| 25 | Cotações Fornecedor | /fornecedor/cotacoes | ⬜ não implementado |
| 26 | Responder Proposta | /fornecedor/cotacoes/[id] | ⬜ não implementado |

---

## 15. PRÓXIMOS PASSOS (BACKLOG PRIORIZADO)

### 🔴 Alta Prioridade
1. **Módulo do Fornecedor** — portal `/fornecedor` para responder propostas
   - Layout base já criado (prompts gerados mas não aplicados nesta sessão)
   - Telas: Dashboard, Listagem Cotações, Responder Proposta
   - Autenticação via Supabase Auth, role identificado no profile
   - Ao inserir proposal_items → trigger fecha rodada automaticamente se todos responderam

2. **Realtime (Supabase)** — atualização automática sem reload
   - Equalização: atualizar quando fornecedor responder
   - Aprovações: badge sidebar atualiza em tempo real
   - Listagens: refletir mudanças sem recarregar

### 🟡 Média Prioridade
3. **Dashboard** — conectar cards mockados (Saving, Pedidos em Andamento, Lead Time)
4. **Detalhe do Pedido** — refinamento visual
5. **Relatórios** — conectar dados reais (alguns ainda mockados com borda vermelha)

### ⚪ Futuro
- Envio de e-mail de boas-vindas para novos usuários
- API de integração com ERP (sync automático de itens e fornecedores)
- Deploy Vercel
- 2FA e Sessões Ativas nas configurações de segurança
- Rate limiting no login
- Política de Privacidade e Termos de Uso
- Favicon do Valore

---

## 16. OBSERVAÇÕES IMPORTANTES PARA O PRÓXIMO CHAT

### Módulo do Fornecedor — especificações já alinhadas
- Acesso via login normal Supabase Auth
- Role `supplier` ou identificação por tipo no profile
- Fornecedor vê apenas cotações onde está convidado (`quotation_suppliers`)
- Ao responder: INSERT em `quotation_proposals` (status='submitted') + INSERT em `proposal_items` com `round_id`
- Trigger `trg_check_round_completion` fecha rodada automaticamente quando todos respondem
- Propostas pré-preenchidas das rodadas anteriores (fornecedor edita e confirma)

### Padrões críticos que nunca podem mudar
- `React.use(params)` para desembrulhar params em Next.js 16
- `createClient` de `@/lib/supabase/client` no frontend
- `useUser` para obter userId, companyId, roles
- `usePermissions` para hasFeature() e hasPermission()
- Insert de `proposal_items` SEMPRE com `round_id`
- Insert de `quotation_proposals` em nova rodada com status `'invited'`
- `purchase_orders` criados com status `'draft'`
- Batch updates com `.in()` — nunca loop individual

### Dados de seed para testes
- Empresa Teste: `00000000-0000-0000-0000-000000000001`
- Usuário teste: `c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7` (teste@procuremax.com.br)
- Cotação referência: `aaaaaaaa-0000-0000-0000-000000000001` (COT-2026-0026)
- Cotação ativa para testes: COT-2026-0036 (id: `3c1a465b-f4d4-461e-a0b5-ab7609d6480d`)

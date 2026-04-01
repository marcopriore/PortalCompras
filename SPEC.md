# Valore — Especificação do Sistema

## Versão atual: v2.16.7

Documento de referência alinhado ao código e às migrations versionadas no repositório. Onde o schema completo existe apenas na instância Supabase (tabelas não presentes em `supabase/migrations/`), isso é indicado explicitamente.

---

## 1. Visão Geral

**Valore** (Portal de Compras) é uma aplicação web multi-tenant para **compradores** gerenciarem cotações, requisições, pedidos e aprovações, e para **fornecedores** convidados responderem cotações com propostas por rodada de negociação.

- **Usuários-alvo:** equipes de compras (tenant), aprovadores, requisitantes e fornecedores com perfil `supplier` vinculado a um cadastro `suppliers`.
- **Propósito:** digitalizar o fluxo de cotação → equalização → pedido, com RLS por empresa e portais separados (`/comprador` e `/fornecedor`).

---

## 2. Arquitetura

### 2.1 Stack técnica

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 16 (App Router), React, TypeScript |
| UI | Tailwind CSS, shadcn/ui, ícones Lucide |
| Dados / Auth | Supabase (PostgreSQL, Row Level Security, Auth email/senha) |
| Cliente browser | `@/lib/supabase/client` + `@supabase/ssr` no servidor |

### 2.2 Modelo multi-tenant

- **Shared database, shared schema:** isolamento por `company_id` nas tabelas de negócio.
- **RLS:** habilitado nas tabelas cobertas pelas migrations (ex.: `quotations`, `payment_conditions`) e estendido a leitura do fornecedor onde aplicável (`006_supplier_portal_rls.sql`, `008_payment_conditions.sql`).
- **Superadmin:** flag `is_superadmin` em `profiles` (usada no layout do comprador) + seletor de tenant no header quando aplicável.

### 2.3 Autenticação e portais

- **Login comprador:** `/login` — após autenticação, `proxy.ts` redireciona conforme `profile_type` (`buyer` → `/comprador`, `supplier` → `/fornecedor`).
- **Login fornecedor:** `/fornecedor/login` — mesmo critério de redirecionamento.
- **Rotas públicas do fornecedor:** `/fornecedor/login`, `/fornecedor/cadastro` (definidas em `proxy.ts`).
- **Proteção de rotas:** `proxy.ts` na raiz (padrão Next.js 16) com `matcher` em `/comprador/:path*`, `/fornecedor/:path*`, `/admin/:path*`, `/login`. Sem sessão, redireciona para `/login` com `redirectTo`.
- **Acesso cruzado:** `profile_type === 'supplier'` em `/comprador/**` → redirect para `/fornecedor?error=unauthorized_portal`. Usuário não supplier em `/fornecedor/**` (protegido) → redirect para `/comprador?error=unauthorized_portal`. Toasts: `PortalUnauthorizedToast` no layout comprador; efeito equivalente em `FornecedorPortalShell` no portal fornecedor.
- **Encerramento de rodadas:** em requisições autenticadas (exceto `/login` e rotas públicas do fornecedor), `proxy.ts` chama `supabase.rpc('close_expired_rounds')` (falhas ignoradas para não bloquear navegação).

---

## 3. Módulos e Funcionalidades

### 3.1 Portal do Comprador (`/comprador`)

| Rota | Descrição | Funcionalidades principais | Status |
|------|-----------|----------------------------|--------|
| `/comprador` | Dashboard | Métricas de cotações a partir do banco; parte dos cards e gráficos ainda com valores estáticos; tabela de cotações recentes | ⚠️ parcialmente mockado |
| `/comprador/requisicoes` | Listagem | Listagem e filtros de requisições | ✅ |
| `/comprador/requisicoes/nova` | Nova requisição | Criação com itens | ✅ |
| `/comprador/requisicoes/[id]` | Detalhe | Visualização / fluxo conforme implementação | ✅ |
| `/comprador/requisicoes/[id]/editar` | Edição | Reedição quando aplicável | ✅ |
| `/comprador/aprovacoes` | Aprovações | Fila por fluxo requisição/pedido | ✅ |
| `/comprador/cotacoes` | Listagem | Cotações do tenant | ✅ |
| `/comprador/cotacoes/nova` | Nova cotação | Criação | ✅ |
| `/comprador/cotacoes/[id]` | Detalhe | Dados da cotação | ✅ |
| `/comprador/cotacoes/[id]/editar` | Edição | Edição em rascunho etc. | ✅ |
| `/comprador/cotacoes/[id]/equalizacao` | Equalização | Comparação de propostas, ordem por `quotation_suppliers.position`, exportação, lógica extensa | ✅ |
| `/comprador/cotacoes/[id]/novo-pedido` | Novo pedido | Geração a partir de proposta selecionada | ✅ |
| `/comprador/pedidos` | Listagem | Pedidos com campos como `delivery_days`, `payment_condition` no cabeçalho do pedido | ✅ |
| `/comprador/pedidos/[id]` | Detalhe | Detalhe do pedido | ⚠️ visual simples |
| `/comprador/itens` | Itens | Catálogo `items`, somente leitura na UI | ✅ |
| `/comprador/fornecedores` | Fornecedores | Listagem somente leitura | ✅ |
| `/comprador/relatorios` | Relatórios | Abas e gráficos; parte dos dados é estática no arquivo | ⚠️ parcialmente mockado |
| `/comprador/configuracoes` | Configurações | Abas (empresa, perfil, notificações, aprovações, segurança) + **Condições de pagamento** (`payment_conditions`: CRUD, importação Excel via `xlsx`) | ✅ |
| `/comprador/configuracoes/usuarios` | Usuários | Gestão e importação Excel | ✅ |
| `/comprador/configuracoes/permissoes` | Permissões | Matriz por role | ✅ |

**Navegação:** `components/layout/sidebar.tsx` filtra links por `hasPermission('nav.*')` e superadmin.

### 3.2 Portal do Fornecedor (`/fornecedor`)

| Rota | Descrição | Funcionalidades principais | Status |
|------|-----------|----------------------------|--------|
| `/fornecedor` | Dashboard | Métricas e listas com dados reais (cotações, prazos, atividades) | ✅ |
| `/fornecedor/cotacoes` | Cotações | Listagem com filtros | ✅ |
| `/fornecedor/cotacoes/[id]` | Resposta | Proposta da rodada ativa: condição de pagamento (picklist `payment_conditions`), itens com preço e `delivery_days` por linha; estado `submitted` em somente leitura com mensagem para aguardar nova rodada | ✅ |
| `/fornecedor/login` | Login | Autenticação Supabase | ✅ |
| `/fornecedor/cadastro` | Cadastro | Fluxo multi-step (UI); integração backend conforme implementação da página | ⚠️ ver código |
| `/fornecedor/(dashboard)/oportunidades` | Oportunidades | Dados **mockados** em array local | ⚠️ não produtivo |
| `/fornecedor/(dashboard)/oportunidades/[id]` e `.../proposta` | Legado / demo | Rotas existentes sob grupo `(dashboard)` | ⚠️ ver código |

**Shell:** `FornecedorPortalShell` — sidebar fixa, logout com redirect para `/fornecedor/login`.

**Observação:** A sidebar genérica em `Sidebar` com `type="fornecedor"` lista rotas como `/fornecedor/oportunidades` e `/fornecedor/propostas`, que **não** correspondem ao mesmo conjunto de páginas ativas que `/fornecedor/cotacoes` (navegação real do shell usa Dashboard + Cotações).

### 3.3 Portal Admin (`/admin`)

| Rota | Descrição | Status |
|------|-----------|--------|
| `/admin/tenants` | Listagem de tenants | ✅ |
| `/admin/tenants/[id]` | Detalhe do tenant | ✅ |
| `/admin/tenants/[id]/features` | Features por tenant | ✅ |
| `/admin/logs` | Logs de auditoria (visualização) | ✅ |

**Layout:** logout via `POST /api/auth/logout`.

### 3.4 APIs (`app/api`)

- `POST /api/auth/logout` — encerramento de sessão (admin).
- `POST /api/admin/create-tenant`, `create-user`, `import-users` — operações administrativas server-side com service role (ver rotas).

---

## 4. Banco de Dados

### 4.1 Migrations no repositório (`supabase/migrations/`)

| Arquivo | Conteúdo relevante |
|---------|-------------------|
| `001_auth_tenants.sql` | `companies`, `profiles`, trigger `handle_new_user`, RLS básico |
| `002_quotations.sql` | `quotations`, `quotation_items`, `quotation_suppliers`, trigger `generate_quotation_code`, RLS |
| `003_approval_levels_flow.sql` | Extensões de fluxo de aprovação (conforme arquivo) |
| `004_profiles_roles.sql` | Coluna `roles text[]` em `profiles` |
| `005_profile_type.sql` | `profile_type` com check `buyer` \| `supplier` |
| `006_supplier_portal_rls.sql` | `supplier_id` em `profiles`; políticas SELECT para supplier em `quotation_suppliers`, `quotations`, `quotation_rounds`, `quotation_proposals` |
| `007_quotation_suppliers_position.sql` | Coluna `position` (integer) + índice `(quotation_id, position)` |
| `008_payment_conditions.sql` | Tabela `payment_conditions`, função `get_my_supplier_id()`, RLS gestão por empresa + leitura supplier convidado |

### 4.2 Tabelas e campos principais (aplicação + migrations)

- **companies** — tenant (`name`, `cnpj`, `status`, …).
- **profiles** — `id` (FK `auth.users`), `company_id`, `role`, `roles[]`, `profile_type`, `supplier_id` opcional, `full_name`, `is_superadmin` (usado no app; criação via API admin).
- **payment_conditions** — `id`, `company_id`, `code`, `description`, `active`, `created_at`; **UNIQUE (company_id, code)**; RLS conforme `008`.
- **suppliers** — cadastro por tenant (referenciado por `profiles.supplier_id` e cotações).
- **quotations** — `code`, `description`, `status`, `category`, `payment_condition` (texto na cotação), `response_deadline`, …
- **quotation_items** — itens da cotação (`material_code`, `quantity`, …).
- **quotation_suppliers** — convites; **`position`** define ordem na equalização e telas relacionadas.
- **quotation_rounds** — rodadas por cotação (`round_number`, `status` active/closed, `response_deadline`, …) — políticas RLS para supplier em `006`; DDL completo pode estar apenas na base remota.
- **quotation_proposals** — por rodada e fornecedor; status `invited` \| `submitted` \| `selected` \| `rejected`; **condição de pagamento no cabeçalho da proposta** (`payment_condition` no código do fornecedor); **prazo de entrega por item**, não no cabeçalho (`delivery_days` em `proposal_items`).
- **proposal_items** — linhas da proposta com **`round_id`** obrigatório na regra de produto; **`delivery_days`** nullable por item.
- **items** — catálogo usado em `/comprador/itens` (campos como `code`, `short_description`, `status`, `commodity_group`, …); **sem migration neste repositório**.
- **requisitions** / **requisition_items** — fluxo de requisição (status no código: pending, approved, rejected, in_quotation, completed).
- **purchase_orders** / **purchase_order_items** — pedidos (status draft, processing, sent, error, completed); cabeçalho pode carregar `delivery_days` e `payment_condition` agregados da proposta/pedido na UI.
- **approval_levels** / **approval_requests** — alçadas e instâncias de aprovação (`flow`, `entity_id`, `approver_id`, status pending/approved/rejected).
- **tenant_features** / **role_permissions** — features por tenant e matriz de permissões por role.

### 4.3 Funções SQL referenciadas no código

- **`close_expired_rounds`** — RPC chamada em `proxy.ts` (implementação na base Supabase; não está nos arquivos SQL deste repo).
- **`get_my_supplier_id`** — definida em `008_payment_conditions.sql`; usada na política de leitura de condições de pagamento pelo fornecedor convidado.
- **`generate_quotation_code`** — trigger em `quotations` (`002`).
- **`handle_new_user`** — criação de perfil ao registrar usuário (`001`).

### 4.4 RLS (resumo)

- **Empresa:** políticas padrão “mesmo `company_id` do profile” em tabelas de cotação (`002`).
- **Fornecedor:** leitura condicionada a `profile_type = 'supplier'` e `supplier_id` alinhado ao convite (`006`).
- **payment_conditions:** ALL para usuários do mesmo `company_id`; SELECT adicional para suppliers convidados às cotações da empresa (`008`).

---

## 5. Regras de Negócio

### 5.1 Fluxo de cotação (comprador → fornecedor)

1. Comprador cria **cotação** e itens; define fornecedores convidados com **`quotation_suppliers.position`** (ordem estável).
2. Abre-se **rodada** (`quotation_rounds`) com `response_deadline`.
3. Para cada convidado existe **proposta** (`quotation_proposals`) ligada à rodada, status inicial típico `invited`.
4. Fornecedor acessa `/fornecedor/cotacoes/[id]`, preenche **condição de pagamento** (obrigatória; opções de `payment_conditions` do tenant comprador) e, por **item**, preço e **`delivery_days`**.
5. Envio da proposta: status passa a **`submitted`** — formulário **somente leitura** até nova rodada.
6. Comprador equaliza em `/comprador/cotacoes/[id]/equalizacao` (usa `delivery_days` por item nas comparações/exportação).
7. A partir da proposta selecionada, fluxo de **novo pedido** e **purchase_orders**.

### 5.2 Fluxo de aprovações

- Requisições e pedidos disparam **approval_requests** conforme `approval_levels` (fluxo `requisition` ou `order`), visíveis em `/comprador/aprovacoes`.
- Lógica detalhada (RPCs como `get_approver_for_requisition`) pode estar na base; UI consome `approval_requests` e eventos customizados (`approval-updated`).

### 5.3 Rodadas de negociação

- Prazo em **`quotation_rounds.response_deadline`** (data).
- Encerramento automático quando a data está no passado: **`close_expired_rounds`** disparada no **`proxy.ts`**.
- UI do fornecedor exibe estado da rodada / banners conforme implementação em `fornecedor/cotacoes/[id]`.

### 5.4 Acesso por portal

- **`profile_type = 'buyer'`** — portal `/comprador` (salvo superadmin / rotas admin).
- **`profile_type = 'supplier'`** — portal `/fornecedor`; leitura de dados de cotação via RLS de convidado.

### 5.5 Logout

- **Fornecedor:** `signOut` + `router.push('/fornecedor/login')` (`FornecedorPortalShell`).
- **Comprador:** header usa `/api/auth/logout` conforme `header.tsx`.

---

## 6. Integrações e Configurações

- **Supabase Auth** — sessão compartilhada entre portais; cookies geridos com `@supabase/ssr` no `proxy.ts` e clients server/client.
- **Condições de pagamento** — tabela `payment_conditions`; CRUD e importação Excel em `/comprador/configuracoes` (uso de `xlsx` no client).
- **Exportação / Excel** — importação de usuários (ExcelJS em fluxos admin/usuários); relatórios e equalização com export conforme telas.
- **Auditoria** — `lib/audit.ts` + página `/admin/logs`.

---

## 7. Backlog (pendências observadas no código)

1. **Dashboard comprador** — completar cards e gráficos com dados reais (hoje parte fixa/mock).
2. **Detalhe de pedido** (`/comprador/pedidos/[id]`) — evoluir layout e informações.
3. **Relatórios** — reduzir dependência de séries mockadas.
4. **Rotas fornecedor legadas** — `/fornecedor/oportunidades` (mock) vs `/fornecedor/cotacoes` (real); alinhar sidebar e remover ou conectar rotas mortas.
5. **Schema fora das migrations** — garantir que funções como `close_expired_rounds` e tabelas como `items` estejam documentadas/versionadas na instância Supabase alvo.

---

*Última revisão do documento: alinhada à árvore de código e migrations do repositório na versão v2.16.7.*

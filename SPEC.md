# Valore — Especificação do Sistema

## Versão atual: v2.18.0

Documento de referência alinhado ao código e às migrations versionadas no repositório. Onde o schema completo existe apenas na instância Supabase (funções não presentes em `supabase/migrations/`), isso é indicado explicitamente.

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
- **RLS:** habilitado nas tabelas cobertas pelas migrations e estendido ao portal do fornecedor (cotações, condições de pagamento, pedidos do fornecedor).
- **Superadmin:** flag `is_superadmin` em `profiles` (usada no layout do comprador) + seletor de tenant no header quando aplicável.

### 2.3 Autenticação e portais

- **Login comprador:** `/login` — após autenticação, `proxy.ts` redireciona conforme `profile_type` (`buyer` → `/comprador`, `supplier` → `/fornecedor`).
- **Login fornecedor:** `/fornecedor/login` — mesmo critério de redirecionamento.
- **Rotas públicas do fornecedor:** `/fornecedor/login`, `/fornecedor/cadastro` (definidas em `proxy.ts`).
- **Proteção de rotas:** `proxy.ts` na raiz (padrão Next.js 16) com `matcher` em `/comprador/:path*`, `/fornecedor/:path*`, `/admin/:path*`, `/login`. Sem sessão, redireciona para `/login` com `redirectTo`.
- **Acesso cruzado:** `profile_type === 'supplier'` em `/comprador/**` → redirect para `/fornecedor?error=unauthorized_portal`. Usuário não supplier em `/fornecedor/**` (protegido) → redirect para `/comprador?error=unauthorized_portal`. Toasts: `PortalUnauthorizedToast` no layout comprador; efeito equivalente em `FornecedorPortalShell` no portal fornecedor.
- **Encerramento de rodadas:** em requisições autenticadas, exceto `/login` e rotas públicas do fornecedor acima, `proxy.ts` chama `supabase.rpc('close_expired_rounds')` dentro de `try/catch` (falhas ignoradas para não bloquear navegação).

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
| `/comprador/cotacoes/[id]/equalizacao` | Equalização | Comparação de propostas, ordem por `quotation_suppliers.position`, geração de pedidos, exportação | ✅ |
| `/comprador/cotacoes/[id]/novo-pedido` | Novo pedido | Geração a partir de proposta selecionada; `delivery_days` do pedido = maior prazo entre itens da proposta aceitos | ✅ |
| `/comprador/pedidos` | Listagem | Pedidos, filtros por status (incl. `refused`), badges via `lib/po-status.ts` | ✅ |
| `/comprador/pedidos/[id]` | Detalhe | Itens, export Excel, fluxo draft/sent/refused/processing, reenvio ao fornecedor ou cancelamento quando `refused`, entrega prevista e alerta de alteração de data | ✅ |
| `/comprador/itens` | Itens | Catálogo `items` (incl. `long_description`), somente leitura na UI | ✅ |
| `/comprador/fornecedores` | Fornecedores | Listagem somente leitura | ✅ |
| `/comprador/relatorios` | Relatórios | Abas e gráficos; parte dos dados é estática no arquivo | ⚠️ parcialmente mockado |
| `/comprador/configuracoes` | Configurações | Abas + `payment_conditions` (CRUD, importação Excel) | ✅ |
| `/comprador/configuracoes/usuarios` | Usuários | Gestão e importação Excel | ✅ |
| `/comprador/configuracoes/permissoes` | Permissões | Matriz por role | ✅ |

**Navegação:** `components/layout/sidebar.tsx` filtra links por `hasPermission('nav.*')` e superadmin.

### 3.2 Portal do Fornecedor (`/fornecedor`)

| Rota | Descrição | Funcionalidades principais | Status |
|------|-----------|----------------------------|--------|
| `/fornecedor` | Dashboard | Métricas, gráficos (Recharts), atividades | ✅ |
| `/fornecedor/cotacoes` | Cotações | Listagem com filtros | ✅ |
| `/fornecedor/cotacoes/[id]` | Resposta | Proposta da rodada ativa: condição de pagamento (`payment_conditions`), itens com preço e `delivery_days`; `submitted` somente leitura | ✅ |
| `/fornecedor/pedidos` | Pedidos | Métricas (Pendente Aceite, Aceitos, Finalizados, Cancelado/Recusado), filtros (status, período, busca), tabela paginada | ✅ |
| `/fornecedor/pedidos/[id]` | Detalhe pedido | Informações do pedido e do cliente, tabela de itens; ações no topo por status: aceitar (data prevista obrigatória, sugestão por maior prazo), recusar (motivo → `refused`), em `processing` atualizar data com justificativa (`delivery_date_change_reason`); banners por status | ✅ |
| `/fornecedor/login` | Login | Autenticação Supabase | ✅ |
| `/fornecedor/cadastro` | Cadastro | Fluxo multi-step (UI) | ⚠️ ver código |
| `/fornecedor/(dashboard)/oportunidades` | Oportunidades | Dados mockados | ⚠️ não produtivo |

**Shell:** `FornecedorPortalShell` — sidebar (Dashboard, Cotações, Pedidos), logout para `/fornecedor/login`.

**Landing pública:** `/` — página de apresentação com tema escuro (`app/page.tsx`).

### 3.3 Portal Admin (`/admin`)

| Rota | Descrição | Status |
|------|-----------|--------|
| `/admin/tenants` | Listagem de tenants | ✅ |
| `/admin/tenants/[id]` | Detalhe do tenant | ✅ |
| `/admin/tenants/[id]/features` | Features por tenant | ✅ |
| `/admin/logs` | Logs de auditoria | ✅ |

### 3.4 APIs (`app/api`)

- `POST /api/auth/logout` — encerramento de sessão (admin).
- Rotas admin (`create-tenant`, `create-user`, `import-users`, …) conforme `app/api`.

---

## 3.5 Fluxo de Pedidos (`purchase_orders`)

**Transições principais (implementadas):**

1. **`draft`** — pedido criado na equalização ou em “novo pedido”; comprador pode confirmar envio ao fornecedor ou cancelar (rascunho).
2. **`sent`** — comprador enviou ao fornecedor; fornecedor aceita (→ `processing` + `estimated_delivery_date` + `accepted_at`) ou recusa (→ **`refused`**, com `cancellation_reason` — **não** usar `cancelled` para recusa).
3. **`refused`** — comprador vê banner e pode **reenviar** (`sent`) ou **cancelar** (`cancelled`).
4. **`processing`** — pedido aceito pelo fornecedor; fornecedor pode alterar data de entrega com justificativa.
5. **`completed`** / **`error`** — estados de integração/conclusão conforme regras do sistema.
6. **`cancelled`** — cancelamento pelo comprador (ex.: desde `draft`, ou após `refused`), ou outros fluxos que gravem este status; distinto de **`refused`**.

**Rótulos por portal** (helpers em `lib/po-status.ts`):

- **Comprador:** Rascunho, Aguardando Aceite, Recusado pelo Fornecedor, Processando Integração, Concluído, Cancelado, Erro Integração.
- **Fornecedor:** Pendente Aceite, Pedido Recusado, Pedido Aceito, Pedido Finalizado, Pedido Cancelado (e slate para valores não mapeados).

**Constraints de `status` no PostgreSQL** (migration `011`, inclusive): `draft`, `sent`, `processing`, `refused`, `error`, `completed`, `cancelled`.

---

## 4. Banco de Dados

### 4.1 Migrations no repositório (`supabase/migrations/`)

| Arquivo | Conteúdo relevante |
|---------|-------------------|
| `001_auth_tenants.sql` | `companies`, `profiles`, trigger `handle_new_user`, RLS básico |
| `002_quotations.sql` | `quotations`, `quotation_items`, `quotation_suppliers`, RLS |
| `003_approval_levels_flow.sql` | Fluxo de aprovação |
| `004_profiles_roles.sql` | `roles text[]` em `profiles` |
| `005_profile_type.sql` | `profile_type` buyer \| supplier |
| `006_supplier_portal_rls.sql` | `supplier_id` em `profiles`; políticas supplier em cotações |
| `007_quotation_suppliers_position.sql` | Coluna `position` |
| `008_payment_conditions.sql` | `payment_conditions`, `get_my_supplier_id()`, RLS |
| `009_long_description.sql` | `long_description` em `items` e `quotation_items` |
| `010_supplier_purchase_orders.sql` | Colunas e RLS de `purchase_orders` / leitura de itens e `companies` para supplier |
| `011_purchase_order_refused_and_delivery_reason.sql` | `delivery_date_change_reason`, constraint de status com `refused` |
| `012_purchase_order_items_delivery_days.sql` | `delivery_days` em `purchase_order_items` |

### 4.2 Tabelas e campos principais (atualizado)

- **payment_conditions** — `id`, `company_id`, `code`, `description`, `active`, `created_at`; UNIQUE `(company_id, code)`.
- **items** — catálogo; **`long_description`** (`009`).
- **quotation_items** — **`long_description`** (`009`).
- **purchase_orders** — além dos campos já usados na aplicação: **`supplier_id`**, **`accepted_at`**, **`accepted_by_supplier`**, **`estimated_delivery_date`**, **`cancellation_reason`**, **`delivery_date_change_reason`** (`010`/`011`); status inclui **`refused`** e **`cancelled`** (`011`); **`delivery_days`** agregado na criação (código: MAX por linha da proposta / fallback).
- **purchase_order_items** — **`delivery_days`** por linha (`012`).
- Demais tabelas (`quotations`, `proposal_items` com `delivery_days` por item, `round_id`, etc.) conforme migrations anteriores e código.

### 4.3 Funções SQL referenciadas no código

- **`close_expired_rounds`** — RPC chamada em `proxy.ts`. **Não** há definição desta função nos arquivos SQL do repositório; deve existir na instância Supabase.
- **`get_my_supplier_id`** — `008_payment_conditions.sql`; usada na política SELECT de `payment_conditions` para fornecedor convidado.
- **`generate_quotation_code`**, **`handle_new_user`** — conforme `001`/`002`.

### 4.4 RLS (resumo)

- Políticas de pedidos para **supplier** (`010`): leitura/atualização de `purchase_orders` onde `supplier_id` do pedido = `supplier_id` do perfil; leitura de itens e de `companies` vinculadas.
- **`payment_conditions`:** ALL para usuários do tenant; SELECT para suppliers convidados (`008`).

---

## 5. Regras de Negócio

### 5.1 Fluxo de cotação (comprador → fornecedor)

1. Comprador cria cotação e itens; fornecedores com **`quotation_suppliers.position`**.
2. Rodadas com `response_deadline`; encerramento automático via **`close_expired_rounds`** no **`proxy.ts`**.
3. Fornecedor responde com **`payment_conditions`** (picklist) e **`delivery_days`** por item.
4. Equalização e geração de **`purchase_orders`** / **`purchase_order_items`** com prazos coerentes com o código (MAX por item, colunas `delivery_days`).

### 5.2 Fluxo de pedidos

Ver **§ 3.5 Fluxo de Pedidos**. Labels de exibição em **`lib/po-status.ts`**.

### 5.3 Datas e timezone (UI)

- Persistir **`estimated_delivery_date`** como string **`YYYY-MM-DD`** no Supabase.
- Evitar `new Date('YYYY-MM-DD')` para interpretar datas puramente calendário; ver padrões em `app/fornecedor/pedidos/[id]/page.tsx` e `app/comprador/pedidos/[id]/page.tsx`.

### 5.4 Acesso por portal e logout

Conforme § 2.3 e implementação em `FornecedorPortalShell` / header comprador.

---

## 6. Integrações e Configurações

- **Supabase Auth** + `@supabase/ssr` em `proxy.ts`.
- **Condições de pagamento** — CRUD e Excel em configurações.
- **Auditoria** — `lib/audit.ts` + `/admin/logs`.
- **Importação de proposta** — wizard Excel (`components/fornecedor/import-proposal-wizard.tsx` e telas relacionadas).

---

## 7. Backlog (pendências observadas no código / doc)

1. **Dashboard comprador** (`/comprador`) — completar cards e gráficos com dados reais onde ainda há valores estáticos.
2. **Relatórios** (`/comprador/relatorios`) — reduzir séries mockadas.
3. **Rotas fornecedor legadas** — `/fornecedor/oportunidades` (mock) vs fluxo real em `/fornecedor/cotacoes`; alinhar ou remover rotas mortas.
4. **RPC `close_expired_rounds`** — versionar definição SQL no repositório ou pipeline de migração da instância Supabase para rastreabilidade.
5. **Cadastro fornecedor** (`/fornecedor/cadastro`) — validar integração backend e UX de produção.
6. **Portal fornecedor** — evolução de telas além de cotações/pedidos (oportunidades/propostas legadas).
7. **Detalhe pedido comprador** — possíveis melhorias visuais incrementais (histórico, integração ERP) conforme roadmap.

---

*Última revisão: alinhada ao código e migrations do repositório na versão **v2.18.0**.*

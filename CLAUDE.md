# Valore — Portal de Compras

## Memória persistente do projeto · Lida automaticamente a cada sessão

---

## STACK

- Next.js 16 App Router · TypeScript · Tailwind CSS · shadcn/ui
- Supabase (PostgreSQL + RLS + Auth)
- Repositório: github.com/marcopriore/PortalCompras
- Caminho local: C:\Dev\Portal Compras
- Versão atual: v2.18.0

---

## REGRAS CRÍTICAS — NUNCA VIOLAR

### Next.js 16

- SEMPRE usar `React.use(params)` para desembrulhar params de rota
- NUNCA usar `params.id` diretamente (causa warning/erro no Next.js 16)

### Supabase

- `createClient` SEMPRE de `@/lib/supabase/client` no frontend
- `useUser` para obter userId e companyId
- `usePermissions` para hasFeature() e hasPermission()
- Batch updates SEMPRE com `.in('id', arrayDeIds)` — NUNCA loop individual
- INSERT em `proposal_items` SEMPRE com `round_id`
- INSERT em `quotation_proposals` em nova rodada com status `'invited'`
- `purchase_orders` criados com status `'draft'`

### Qualidade de código

- SEMPRE remover imports ao remover componentes
- SEMPRE verificar balanceamento JSX após edições grandes
- SEMPRE rodar `npx tsc --noEmit` antes de considerar concluído
- NUNCA usar cores hardcoded — sempre tokens do design system

---

## IDENTIDADE VISUAL

### Paleta

| Token | Valor | Uso |
|-------|-------|-----|
| Primária | #4F3EF5 (índigo) | Ações principais |
| Destaque | #00C2FF (elétrico) | Gradientes, destaques |
| Sidebar | #1a1a2e (noite) | Background sidebar |
| Lavanda | #f4f3ff | Backgrounds sutis |

### Design System

- NUNCA cores hardcoded — usar: `bg-background`, `bg-card`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `text-primary`, `bg-primary`
- Exceção permitida: badges/cards de métrica (bg-blue-50, bg-green-50, etc.)
- Exceção permitida: sidebar usa #1a1a2e e branco/opacidade

### Padrão de Cards de Métrica

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

Container: `grid grid-cols-4 gap-4 mb-6`

### Padrão de Layout de Listagem

1. Cabeçalho (título + botão de ação)
2. Cards de métricas (grid 4 colunas)
3. Filtros (`bg-muted/40 border border-border rounded-xl p-4 mb-6`)
4. Tabela/grid de resultados

### Padrão de Filtros

- Label acima de cada campo
- Listas: componente `MultiSelectFilter` (`components/ui/multi-select-filter.tsx`)
- Busca texto: input com ícone `Search` + botão `X` para limpar
- Larguras fixas (`w-40`, `w-48`) — nunca expandir
- Contador "X resultado(s)" + botão "Limpar filtros"

---

## ARQUITETURA MULTI-TENANT

- Shared Database, Shared Schema com `company_id` em todas as tabelas
- RLS ativo em todas as tabelas de negócio
- Superadmin: acesso a todos os tenants via seletor no header
- Admin do tenant: acesso apenas à própria empresa

---

## BANCO DE DADOS — TABELAS PRINCIPAIS

| Tabela | Campos-chave |
|--------|-------------|
| profiles | role, roles text[], profile_type ('buyer'\|'supplier'), supplier_id |
| suppliers | por tenant |
| payment_conditions | id, company_id, code, description, active, created_at — UNIQUE (company_id, code), RLS ativo |
| quotations | status: draft/waiting/analysis/completed/cancelled |
| quotation_rounds | round_number, status ('active'\|'closed'), response_deadline |
| quotation_suppliers | fornecedores convidados; campo **position** (integer) — ordem fixa na equalização |
| quotation_proposals | round_id FK quotation_rounds, status: invited/submitted/selected/rejected; **sem delivery_days no cabeçalho** |
| proposal_items | round_id FK quotation_rounds (OBRIGATÓRIO); **delivery_days** (integer, nullable) — prazo por item |
| requisitions | status: pending/approved/rejected/in_quotation/completed |
| purchase_orders | status: draft/sent/processing/refused/error/completed/cancelled; **supplier_id**, **accepted_at**, **accepted_by_supplier**, **estimated_delivery_date** (date), **cancellation_reason**, **delivery_date_change_reason**; **delivery_days** no cabeçalho (maior prazo na criação) |
| purchase_order_items | linhas do pedido; **delivery_days** por item (nullable) — migration `012` |
| items | catálogo; **long_description** (text) — migration `009` |
| quotation_items | snapshot na cotação; **long_description** (text) — migration `009` |
| approval_levels | flow ('requisition'\|'order'), cost_center, category |
| approval_requests | flow, entity_id, approver_id, status: pending/approved/rejected |
| tenant_features | feature_keys liberados por tenant |
| role_permissions | permission_keys por role |

---

## ROLES E PERMISSÕES

- Roles disponíveis: `admin`, `buyer`, `manager`, `approver_requisition`, `approver_order`, `requester`, `supplier`
- `profile_type`: `'buyer'` | `'supplier'` — determina qual portal o usuário acessa
- Portal do comprador: `/comprador/**`
- Portal do fornecedor: `/fornecedor/**`
- Regras de acesso cruzado: usuário **supplier** em rota `/comprador/**` → redirect para `/fornecedor` com `?error=unauthorized_portal` + toast no portal de destino
- Regras de acesso cruzado: usuário **buyer** (não supplier) em rota protegida `/fornecedor/**` → redirect para `/comprador` com `?error=unauthorized_portal` + toast no portal de destino

---

## REGRAS DE NEGÓCIO CRÍTICAS

- **Condição de Pagamento:** obrigatória no cabeçalho da proposta (portal fornecedor). Valores vêm de `payment_conditions` por tenant (cadastro em Configurações do comprador) — não é texto livre na picklist.
- **Prazo de Entrega (pedido):** ao criar `purchase_orders` (equalização / novo pedido), **`delivery_days` no cabeçalho** = maior valor entre **`proposal_items.delivery_days`** das linhas da proposta (fallback ao prazo da proposta quando não houver por item); **`purchase_order_items.delivery_days`** repete o prazo por linha quando existir no snapshot.
- **Data prevista (`estimated_delivery_date`):** gravada no aceite pelo fornecedor como string **`YYYY-MM-DD`** (sem objeto `Date` no payload). Na tela do fornecedor, se ainda não houver data salva, a UI **sugere** data = hoje + maior prazo (itens ou cabeçalho do pedido); o fornecedor confirma ou ajusta no aceite. No portal do comprador, se não houver `estimated_delivery_date`, a UI pode exibir fallback derivado de **`accepted_at` + `delivery_days`** apenas para exibição.
- **Status `refused`:** recusa pelo fornecedor (`cancellation_reason`); **não** usar `cancelled` para recusa. O comprador pode **reenviar** (`sent`) ou **cancelar** (`cancelled`).
- **`long_description`:** descrição detalhada em `items` e `quotation_items` (migration `009`); `complementary_spec` removido da UI conforme evolução do produto.
- **Prazo de Entrega (cotação):** por item, em `proposal_items.delivery_days` (não no cabeçalho da proposta).
- **Rodadas:** `proxy.ts` chama `supabase.rpc('close_expired_rounds')` em requisições autenticadas (exceto `/login` e rotas públicas `/fornecedor/login`, `/fornecedor/cadastro`); falhas são ignoradas. A função fecha rodadas expiradas na instância Supabase (body **não** versionado em `supabase/migrations/` aqui).
- **Proposta `submitted`:** somente leitura no portal do fornecedor — não editar; aguardar nova rodada.
- **Ordem dos fornecedores:** fixada por `quotation_suppliers.position` (convite, equalização, exportações).
- **profile_type = 'supplier':** acessa `/fornecedor`; **profile_type = 'buyer':** acessa `/comprador` (fluxo em `proxy.ts` + `/login` e `/fornecedor/login`).
- **Logout do fornecedor:** após `signOut`, redireciona para `/fornecedor/login`.

---

## SEEDS DE TESTE

- Empresa Teste: `00000000-0000-0000-0000-000000000001`
- Usuário teste (buyer): `c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7` (teste@procuremax.com.br)
- Cotação referência: `aaaaaaaa-0000-0000-0000-000000000001` (COT-2026-0026)
- Cotação ativa: `3c1a465b-f4d4-461e-a0b5-ab7609d6480d` (COT-2026-0036)

---

## VERSIONAMENTO GIT

### Histórico de tags (referência)

| Tag | Descrição |
|-----|-----------|
| v2.15.0 | Layout base portal fornecedor, middleware multi-portal |
| v2.15.1 | Dashboard fornecedor com métricas reais |
| v2.15.2 | Dashboard fornecedor finalizado - status, filtros |
| v2.15.3 | Listagem cotações fornecedor |
| v2.15.4 | Tela resposta proposta fornecedor |
| v2.16.0 | Módulo fornecedor completo |
| v2.16.1 | Fix login/logout multi-portal |
| v2.16.2 | Condição pagamento e prazo entrega por nível correto |
| v2.16.3 | Somente leitura proposta enviada, banners status rodada |
| v2.16.4 | Encerramento automático rodadas expiradas |
| v2.16.5 | Ordem fixa fornecedores equalização |
| v2.16.6 | Sidebar fornecedor altura fixa, header igual comprador |
| v2.16.7 | Condição pagamento picklist - CRUD + importação Excel |
| v2.17.0 | Wizard importação proposta Excel — 3 etapas |
| v2.17.1 | Descrição detalhada `long_description` |
| v2.17.2 | Remover `complementary_spec` da UI |
| v2.17.3 | Dashboard fornecedor com gráficos |
| v2.17.4 | Landing page redesign dark theme |
| v2.18.0 | Módulo pedidos fornecedor completo (listagem, detalhe, RLS, status `refused`) |

### Fluxo de release

```
cd "C:\Dev\Portal Compras"
git add .
git commit -m "feat: descrição"
git tag vX.X.X
git push origin main
git push origin vX.X.X
```

---

## FUNÇÕES SQL (referência)

- **`close_expired_rounds`** — RPC invocada por `proxy.ts` para encerrar rodadas com prazo vencido; body **não** está versionado em `supabase/migrations/` neste repositório (definir/manter na instância Supabase).
- **`get_my_supplier_id()`** — definida em `008_payment_conditions.sql`: retorna `profiles.supplier_id` do `auth.uid()` (`LANGUAGE sql` `STABLE`); usada na política de leitura de `payment_conditions` pelo fornecedor convidado. Políticas de `purchase_orders` / `purchase_order_items` para supplier estão em `010_supplier_purchase_orders.sql` (critérios com `profiles` / `supplier_id`).

---

## STATUS DAS TELAS

| Rota | Status |
|------|--------|
| / | ✅ Landing page redesign (tema escuro — `app/page.tsx`) |
| /comprador | ⚠️ cards mockados |
| /comprador/requisicoes/** | ✅ |
| /comprador/aprovacoes | ✅ |
| /comprador/cotacoes/** | ✅ |
| /comprador/cotacoes/[id]/equalizacao | ✅ complexo |
| /comprador/pedidos | ✅ |
| /comprador/pedidos/[id] | ✅ Detalhe, status comprador, recusa/reenvio, entrega prevista |
| /comprador/itens | ✅ somente leitura |
| /comprador/fornecedores | ✅ somente leitura |
| /comprador/relatorios | ⚠️ parcial mockado |
| /comprador/configuracoes/** | ✅ |
| /admin/tenants/** | ✅ |
| /fornecedor | ✅ Dashboard com métricas reais |
| /fornecedor/cotacoes | ✅ Listagem completa com filtros |
| /fornecedor/cotacoes/[id] | ✅ Resposta proposta completa |
| /fornecedor/pedidos | ✅ Listagem com métricas e filtros |
| /fornecedor/pedidos/[id] | ✅ Detalhe com aceite/recusa/atualização de data e justificativa |

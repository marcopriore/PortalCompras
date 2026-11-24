# Backlog — migração de carga (nada fica para trás)

Ordem sugerida de lotes pós Fase 5. Cada lote = 1 commit (ou poucos).

## Feito (Fases 1–4)

- Sessão server + QueryProvider remount (`userId:companyId`)
- Listas comprador: REQ, COT, PO, contratos, fornecedores, itens, aprovações
- Dashboard, relatórios, catálogo, equalização (load principal), PO detalhe (load principal)
- Hooks: permissions, tenant-settings, tenant-feature-config
- Cache módulo contract-matches removido
- ESLint `set-state-in-effect` = error

## Lote A — Comprador restante (forms + secundários)

- [x] `app/comprador/cotacoes/nova`, `[id]/editar` (busca catálogo, payment_conditions, import REQ, prefill REQ → `lib/queries/*`)
- [x] `app/comprador/cotacoes/novo-pedido` → `lib/queries/novo-pedido-quotation.ts`
- [x] `app/comprador/cotacoes/[id]/page` (detalhe → `lib/queries/quotation-detail.ts`)
- [x] `app/comprador/requisicoes/nova` (centro custo default → `user-default-cost-center`), `[id]/editar` → `requisition-edit-form`
- [x] `app/comprador/requisicoes/[id]` (detalhe + anexos → `lib/queries/requisition-detail.ts`)
- [ ] `app/comprador/pedidos/novo` (só mutação `createDraftFromRequisition` — defer useMutation)
- [x] `app/comprador/contratos/novo` (fornecedores, payment_conditions, busca itens; sessionStorage prefill mantido)
- [x] `app/comprador/contratos/[id]` (detalhe + payment_conditions query)
- [ ] `app/comprador/configuracoes/**` (queries prontas em `buyer-settings-queries.ts`; página ainda hidrata por `useEffect`)
- [x] Equalização: payment_conditions, contract_po_link_prompt, contract-matches (`useQuery`)
- [ ] PO detalhe: reduzir sync DTO→state (ou documentar disables restantes)

## Lote B — Portal fornecedor

- [x] Dashboard, cotações lista/detalhe, pedidos lista/detalhe
- [x] Contratos, usuários, perfil, atividades
- [ ] Shell / seletor de cliente (se ainda refetch desnecessário) — sem fetch de dados; selector só POST activate-tenant

## Lote C — Solicitante + suporte + admin

- [x] `app/solicitante` lista → `solicitanteRequisitionsList` / `requisitions-list`
- [x] `app/solicitante/[id]` detalhe → `requisition-detail`
- [x] `app/solicitante/[id]/editar` → `requisition-edit-form` (requester)
- [ ] `app/solicitante/nova`, `configuracoes` (ainda `useEffect`; helpers em `solicitante-settings.ts`)
- [x] `components/support/**` → `lib/queries/support-queries.ts`
- [x] Admin: `tenants`, `tenants/[id]`, `logs`, `fornecedores`
- [x] Admin: `integracoes/*` tenant list → `admin-companies-list`
- [x] `components/integrations/integration-monitor.tsx` → `integration-logs.ts`

## Lote D — Hooks / componentes compartilhados

- [x] `use-notifications` → `lib/queries/notifications.ts`
- [x] `use-company-logo`, `use-supplier-score`, `use-tenant-feature-flags` → `lib/queries/*`
- [x] Selects com fetch (`branch-select`, `cost-center-select`) → `company-branches-options`, `cost-centers-options`
- [x] `link-contract-equalizacao-dialog` → `equalizacao-contract-matches-dialog.ts`
- [ ] Dialogs restantes com load (import Excel REQ — catálogo on-demand; `create-po-from-contract` só init local)

## Lote E — Prefetch SSR + lint limpo

- [ ] Prefetch + `HydrationBoundary` nas listas críticas
- [ ] `npm run lint` com 0 erros `set-state-in-effect` (só exceções documentadas)
- [ ] Remedir `fase-final` vs `antes`

## Critério de encerramento total

- [ ] Backlog acima zerado
- [ ] Lint limpo (exceções Auth/form sync só)
- [ ] Baseline comparável salva
- [ ] Docs atualizados

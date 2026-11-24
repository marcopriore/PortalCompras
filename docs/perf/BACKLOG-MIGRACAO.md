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

- [ ] `app/comprador/cotacoes/nova`, `editar`, `[id]/page`, `novo-pedido`
- [ ] `app/comprador/requisicoes/nova`, `[id]`, `[id]/editar`
- [ ] `app/comprador/pedidos/novo`
- [ ] `app/comprador/contratos/novo`, `[id]`
- [ ] `app/comprador/configuracoes/**` (abas com fetch)
- [ ] Equalização: efeitos secundários (payment_conditions, contract match, own-REQ)
- [ ] PO detalhe: reduzir sync DTO→state (ou documentar disables restantes)

## Lote B — Portal fornecedor

- [ ] Dashboard, cotações lista/detalhe, pedidos lista/detalhe
- [ ] Contratos, usuários, perfil, atividades
- [ ] Shell / seletor de cliente (se ainda refetch desnecessário)

## Lote C — Solicitante + suporte + admin

- [ ] `app/solicitante/**` listas/forms
- [ ] `components/support/**`
- [ ] Admin: tenants, logs, integrações/monitor
- [ ] `components/integrations/integration-monitor.tsx`

## Lote D — Hooks / componentes compartilhados

- [ ] `use-notifications`, `use-company-logo`, `use-supplier-score`, `use-tenant-feature-flags`
- [ ] Selects com fetch (`branch-select`, `cost-center-select`)
- [ ] Dialogs com load (import Excel, create-PO-from-contract, etc.)

## Lote E — Prefetch SSR + lint limpo

- [ ] Prefetch + `HydrationBoundary` nas listas críticas
- [ ] `npm run lint` com 0 erros `set-state-in-effect` (só exceções documentadas)
- [ ] Remedir `fase-final` vs `antes`

## Critério de encerramento total

- [ ] Backlog acima zerado
- [ ] Lint limpo (exceções Auth/form sync só)
- [ ] Baseline comparável salva
- [ ] Docs atualizados

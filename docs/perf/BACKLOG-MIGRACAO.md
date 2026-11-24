# Backlog — migração de carga (nada fica para trás)

Ordem sugerida de lotes pós Fase 5. Cada lote = 1 commit (ou poucos).

## Feito (Fases 1–4 + fechamento Lotes A–C)

- Sessão server + QueryProvider remount (`userId:companyId`)
- Listas comprador: REQ, COT, PO, contratos, fornecedores, itens, aprovações
- Dashboard, relatórios, catálogo, equalização (load principal), PO detalhe (load principal)
- Hooks: permissions, tenant-settings, tenant-feature-config
- Cache módulo contract-matches removido
- ESLint `set-state-in-effect` = error
- `app/comprador/cotacoes/nova`, `[id]/editar`, `novo-pedido`, `[id]` (detalhe)
- `app/comprador/requisicoes/nova`, `[id]/editar`, `[id]` (detalhe)
- `app/comprador/contratos/novo`, `[id]`
- Equalização: payment_conditions, contract_po_link_prompt, contract-matches (`useQuery`)
- Portal fornecedor (dashboard, cot/ped/contratos, usuários, perfil, atividades)
- Solicitante: lista, detalhe, editar
- **`app/solicitante/nova`** → `useUser` + `userDefaultCostCenterQueryOptions`
- **`app/solicitante/configuracoes`** → `solicitanteSettingsQueryOptions` + hidratação documentada
- **`app/comprador/configuracoes/page.tsx`** → `buyer-settings-queries.ts`, `contract-po-link-prompt.ts`, `useQuery` por aba
- Abas settings: CC/filiais/categorias (`buyer-settings-lists.ts`), permissões (`permission-groups.ts`)
- Suporte, admin tenants/logs/fornecedores/integrações, hooks compartilhados, selects

## Deferidos (não bloqueiam operação)

- [ ] `app/comprador/pedidos/novo` — só mutação `createDraftFromRequisition` (defer `useMutation`)
- [ ] PO detalhe: reduzir sync DTO→state restante (bloco documentado em `pedidos/[id]` — opcional refino)
- [ ] Dialogs: import Excel REQ (catálogo on-demand), `create-po-from-contract` (init local — supressão pontual)
- [ ] Shell fornecedor / seletor cliente — sem fetch de dados; só POST `activate-tenant`
- [ ] `components/comprador/configuracoes-usuarios-tab.tsx` — ainda `useEffect` + loadProfiles

---

## Lote E — residual (único bloco pendente)

- [ ] Prefetch + `HydrationBoundary` nas listas críticas
- [x] `npm run lint` com 0 erros `set-state-in-effect` (supressões Auth/form/shell documentadas — ver `LINT-DEBT.md`)
- [ ] Remedir `fase-final` vs `antes` (Playwright perf)

## Critério de encerramento total

- [ ] Backlog Lote E zerado
- [ ] Lint limpo (exceções Auth/form sync só)
- [ ] Baseline comparável salva
- [ ] Docs atualizados
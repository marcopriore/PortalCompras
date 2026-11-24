# Backlog — migração de carga

## Feito (Fases 1–5 + Lotes A–E)

- SessionUser + QueryProvider remount (`userId:companyId`)
- Listas/detalhes/forms comprador, fornecedor, solicitante, admin, suporte
- Hooks de permissões/settings/notifications/score/logo/flags
- Cache módulo contract-matches removido
- ESLint `set-state-in-effect` = error e **0 erros** `--quiet`
- Prefetch SSR + `HydrationBoundary` em dashboard / REQ / COT / PO
- PO detalhe: campos de display do cache; form sync documentado
- Baseline: `antes`, `fase4`/`fase5-final`, `fase5-loteE`

## Residual opcional (não bloqueia)

- [ ] `pedidos/novo` → `useMutation` (só redirect)
- [ ] `configuracoes-usuarios-tab` — refino se ainda houver load legado
- [ ] Prefetch em mais rotas (contratos, fornecedores, equalização)
- [ ] Reduzir ainda mais `eslint-disable` de form sync na equalização

## Critério de encerramento

- [x] Carga via Query nos portais principais
- [x] Lint quiet = 0
- [x] Baseline comparável salva
- [x] Docs atualizados

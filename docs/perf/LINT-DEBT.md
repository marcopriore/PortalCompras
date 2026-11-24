# Dívida de lint

Última execução: Lote E (`v2.19.145`).

| Métrica | Valor |
|---------|-------|
| Erros ESLint (`eslint . --quiet`) | **0** |
| `react-hooks/set-state-in-effect` | **0** (exceções documentadas) |

## Exceções documentadas

- `lib/hooks/useUser.ts` — sync Auth / SessionUser
- `app/comprador/pedidos/[id]/page.tsx` — hidratação de rascunho/form a partir do DTO
- Demais `eslint-disable` pontuais: `rg set-state-in-effect` + `docs/PADRAO-CARGA-DADOS.md`

## Fechado no Lote E

- Erros `refs` / `purity` / `immutability` (equalização, permissões, suporte, negotiation plan)
- Prefetch SSR + `HydrationBoundary` (dashboard, REQ, COT, PO)
- PO detalhe: display via query; `isEditing` derivado sem effect de lock

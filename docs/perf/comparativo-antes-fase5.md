# Comparativo final — `antes` → `fase5-final`

Medição pós Fases 1–4 (código estável na entrega Fase 5).  
Fonte: `baseline-antes` e `baseline-fase5-final` (N=3, Playwright project `perf`).

Ver tabela detalhada em `comparativo-antes-fase4.md` se `fase5-final` coincidir com a remediçāo `fase4` (sem mudanças de carga entre elas).

## Resumo de ganhos (cold)

| Rota | ms | reqs |
|------|-----|------|
| equalizacao | −46% | −25 |
| pedido-detalhe | −48% | −6 |
| pedidos | −45% | −8 |
| dashboard | −31% | −11 |
| catalogo | −43% | −7 |

## Nav (típico)

Dashboard / catálogo / aprovações: **−70–74%** ms até dados prontos.

## Dívida

Backlog completo: `BACKLOG-MIGRACAO.md`. Lint: `LINT-DEBT.md`.

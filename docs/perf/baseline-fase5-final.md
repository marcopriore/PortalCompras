# Perf baseline — fase5-final

Gerado: 2026-11-24T14:31:48.983Z · N=3

> Equivalente a aseline-fase4 (sem mudanca de carga entre fase4 e fechamento Fase 5).

| Rota | Modo | ms (med) | reqs (med) | serial (med) | ok |
|------|------|----------|------------|--------------|----|
| dashboard | cold | 4734 | 43 | 4 | 100% |
| dashboard | nav | 1354 | 30 | 1 | 100% |
| requisicoes | cold | 3475 | 16 | 5 | 100% |
| requisicoes | nav | 1410 | 22 | 2 | 100% |
| cotacoes | cold | 4740 | 16 | 4 | 100% |
| cotacoes | nav | 1648 | 24 | 2 | 100% |
| pedidos | cold | 3619 | 17 | 4 | 100% |
| pedidos | nav | 1601 | 12 | 1 | 100% |
| contratos | cold | 4203 | 13 | 2 | 100% |
| contratos | nav | 1666 | 1 | 1 | 100% |
| fornecedores | cold | 4301 | 18 | 4 | 100% |
| fornecedores | nav | 2182 | 28 | 2 | 100% |
| itens | cold | 3570 | 18 | 4 | 100% |
| itens | nav | 1378 | 32 | 1 | 100% |
| aprovacoes | cold | 3333 | 17 | 5 | 100% |
| aprovacoes | nav | 1121 | 2 | 2 | 100% |
| catalogo | cold | 3309 | 15 | 3 | 100% |
| catalogo | nav | 1165 | 5 | 1 | 100% |
| relatorios | cold | 3711 | 25 | 3 | 100% |
| relatorios | nav | 1487 | 33 | 1 | 100% |
| pedido-detalhe | cold | 3583 | 22 | 6 | 100% |
| equalizacao | cold | 3932 | 30 | 3 | 100% |

Arquivo: docs/perf/baseline-fase5-final.json
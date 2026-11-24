# Comparativo perf — `antes` → `fase4` (mediana N=3)

| Rota | Modo | ms antes → fase4 | Δ ms | reqs antes → fase4 | Δ req |
|------|------|------------------|------|--------------------|-------|
| dashboard | cold | 6897 → 4734 | **-31%** | 54 → 43 | -11 |
| dashboard | nav | 4805 → 1354 | **-72%** | 43 → 30 | -13 |
| equalizacao | cold | 7229 → 3932 | **-46%** | 55 → 30 | -25 |
| pedido-detalhe | cold | 6865 → 3583 | **-48%** | 28 → 22 | -6 |
| pedidos | cold | 6552 → 3619 | **-45%** | 25 → 17 | -8 |
| pedidos | nav | 4051 → 1601 | **-60%** | 6 → 12 | +6 |
| requisicoes | cold | 5992 → 3475 | **-42%** | 23 → 16 | -7 |
| requisicoes | nav | 4737 → 1410 | **-70%** | 21 → 22 | +1 |
| fornecedores | cold | 6382 → 4301 | **-33%** | 33 → 18 | -15 |
| catalogo | cold | 5807 → 3309 | **-43%** | 22 → 15 | -7 |
| catalogo | nav | 4274 → 1165 | **-73%** | 21 → 5 | -16 |
| relatorios | cold | 6581 → 3711 | **-44%** | 33 → 25 | -8 |
| aprovacoes | cold | 5911 → 3333 | **-44%** | 24 → 17 | -7 |
| aprovacoes | nav | 4357 → 1121 | **-74%** | 5 → 2 | -3 |

Ganho típico cold: **~30–48%** ms · nav: **~60–74%** ms.  
Requests: queda forte em equalização/dashboard/catálogo; algumas nav listas sobem levemente (refetch paralelo vs cascata serial).

Artefatos: `baseline-antes.*`, `baseline-fase4.*`.

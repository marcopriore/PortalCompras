# Comparativo — `antes` → `fase5-loteE` (N=3)

| Rota | Modo | ms antes | ms loteE | Δ | reqs antes | reqs loteE |
|------|------|---------:|---------:|---|----------:|-----------:|
| dashboard | cold | 6897 | 7494 | +9%* | 54 | **41** |
| dashboard | nav | 4805 | **787** | **−84%** | 43 | **21** |
| equalizacao | cold | 7229 | **3995** | **−45%** | 55 | **26** |
| pedido-detalhe | cold | 6865 | **4172** | **−39%** | 28 | **16** |
| pedidos | cold | 6552 | **5501** | −16% | 25 | **13** |
| pedidos | nav | 4051 | 3352 | −17% | 6 | 27 |
| requisicoes | cold | 5992 | **4896** | −18% | 23 | **14** |
| catalogo | nav | 4274 | **1664** | **−61%** | 21 | 23 |

\*Cold dashboard no `dev` após prefetch SSR pode incluir custo de dehydrate/compile; **nav** e **reqs** melhoram. Preferir medição em `next start` para cold absoluto.

Artefatos: `baseline-antes.*`, `baseline-fase5-loteE.*`.

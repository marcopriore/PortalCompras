# Perf — VALORE (padrão PRO-MAT)

## Como rodar

1. App em `http://localhost:3000` (`npm run dev` ou `npm run start` após build).
2. `.env.local` com Supabase apontando para o projeto com seeds de teste.
3. Credenciais em `e2e/helpers/test-env.ts` (buyer Empresa Teste).

```bash
# baseline
PERF_LABEL=antes PERF_RUNS=3 npx playwright test tests/perf/measure-baseline.spec.ts --project=chromium

# após fases
PERF_LABEL=depois PERF_RUNS=3 npx playwright test tests/perf/measure-baseline.spec.ts --project=chromium
```

Artefatos em `docs/perf/baseline-<label>.json` e `.md`.

## Métricas

- **ms**: tempo até seletor de “dados prontos” + settle curto
- **requests**: XHR/fetch para Supabase + `/api/*` (ignora `_next` estáticos)
- **serial**: estimativa de profundidade de cascata (cadeia A termina → B começa)

## Escopo Fase 0

Rotas em `tests/perf/routes.ts` (dashboard, listas, catálogo, detalhe pedido, equalização).

# Smoke test — PRD (pré-cliente)

Checklist para validar releases **v2.19.116+** (negociação IA 2.3–2.4, performance, análise consultiva).

## Automatizado (rodar antes de cada release)

```bash
npm run test:pre-release
```

Inclui: `vitest run` + `tsc --noEmit`.

Opcional com ambiente E2E configurado (`.env` staging):

```bash
npm run test:e2e:critical
```

---

## 1. Equalização — performance (Network)

Abrir DevTools → **Network** → equalização de cotação ativa.

| Verificação | Esperado |
|-------------|----------|
| Poll ~30s (`refreshProposalsLight`) | Atualiza propostas; **sem** `contract-matches` repetido |
| `contract-matches` | Só em: carga inicial, troca de rodada, criar pedido |
| Painel negociação autônoma (poll) | `negotiation-runs/.../tick`; **sem** `negotiation-plans` se resposta = "Nenhuma ação necessária." |

---

## 2. Análise consultiva por IA

| Passo | Esperado |
|-------|----------|
| Clicar **Analisar** | `GET /api/quotation-ai-analysis` uma vez; resultado na UI |
| Aguardar cooldown (ex. 30 min) ou simular | Botão mostra timer; **análise permanece visível** |
| Após cooldown | Botão **Analisar** habilitado; resultado **ainda** na tela |
| Nova análise | Substitui resultado; nova data/hora no cabeçalho |
| Trocar rodada | Chave de cache diferente — pode não haver análise (ok) |

**Não deve:** disparar análise automaticamente a cada poll de propostas.

---

## 3. Negociação IA autônoma (premium)

Pré-requisito: tenant com `ai_negotiation` + `ai_negotiation_autonomous`.

| Cenário | Esperado |
|---------|----------|
| Plano `per_item` | Alvos por item na rodada / aprovação |
| Plano `per_supplier` | Alvo por fornecedor; rationale com score quando houver histórico |
| Plano `by_category` | Coluna **Categoria**; rationale `[Categoria: …]` |
| Plano `by_cost_center` | Coluna **CC**; itens com REQ vinculada |
| Evento concluído | Botões Excel/PDF; aba **Grupos** no Excel (se estratégia agrupada) |
| Aba fechada | Motor **não** avança (sem cron — ver `BACKLOG-PRODUCAO.md`) |

---

## 4. Portal fornecedor

| Passo | Esperado |
|-------|----------|
| Cotação com contraproposta ativa | Banner + coluna **Preço solicitado** |
| Proposta acima do alvo | Envio **não** bloqueado |

---

## 5. Deploy / build

| Verificação | Esperado |
|-------------|----------|
| Vercel build | Sucesso (pnpm `allowBuilds.sharp: true`) |
| Commit em produção | ≥ `v2.19.117` para fixes pnpm + persistência IA |

---

## Registro de execução

| Data | Versão/tag | Executor | Resultado | Observações |
|------|------------|----------|-----------|-------------|
| | | | ☐ OK / ☐ Falha | |

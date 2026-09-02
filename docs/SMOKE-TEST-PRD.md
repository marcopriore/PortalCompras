# Smoke test — PRD (pré-cliente)

Checklist para validar releases **v2.19.116+** (negociação IA 2.3–2.4, performance, análise consultiva).

**Acessos e senhas PRD:** `docs/PRD-TEST-ACCESS.md`  
**URL:** https://valore.axisstrategy.com.br/

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

**Tenant sugerido:** Apresentação POC · `COT-2026-0103` (ver `PRD-TEST-ACCESS.md`).

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

Login: `fornecedor@valore.com.br` (ver `PRD-TEST-ACCESS.md`).

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

## 6. Multi-tenant (isolamento)

| Passo | Esperado |
|-------|----------|
| Superadmin: trocar tenant no header | Métricas e listagens mudam (ex.: 65 → 103 cotações) |
| Listagem POC | **Sem** códigos do Empresa Teste (ex.: sem `COT-2026-0036`) |
| Usuário POC (`comprapoc@`): URL de cotação outro tenant | Redireciona / bloqueia — **sem** dados do outro tenant |
| APIs sem cookie | `contract-matches` POST → **401**; `quotation-ai-analysis` GET → **401** |

**Observação superadmin:** deep link de cotação de outro tenant ainda pode abrir por ID (acesso cross-tenant intencional). Usuários normais não devem reproduzir isso.

---

## Resultado — v2.19.117 (02/09/2026)

Execução manual em https://valore.axisstrategy.com.br/

| Área | Status | Evidência |
|------|--------|-----------|
| `test:pre-release` (local) | ✅ | 254 testes + `tsc` |
| Deploy PRD | ✅ | Tag `v2.19.117` / commit `4e8c1b5` |
| Equalização performance | ✅ | Poll ~35s sem `contract-matches` repetido (Empresa Teste `COT-0036`) |
| Análise IA manual + cooldown | ✅ | 1× API; timer 30min; texto permanece |
| Negociação assistida POC | ✅ | `COT-0103` concluída; Excel/PDF; plano 1–5 rodadas |
| Troca tenant | ✅ | Métricas/listagens distintas POC vs Empresa Teste |
| Isolamento `comprapoc@` | ✅ | Sem acesso a cotação Empresa Teste |
| APIs 401 sem auth | ✅ | `contract-matches`, `quotation-ai-analysis` |
| Portal fornecedor | ✅ | Login, listagem, detalhe cotação |
| Contraproposta fornecedor | ⚠️ N/A | Sem rodada ativa com alvo para `fornecedor@` no momento do teste |

**Veredito:** ✅ **Aprovado** para release v2.19.117.

---

## Registro de execução

| Data | Versão/tag | Executor | Resultado | Observações |
|------|------------|----------|-----------|-------------|
| 02/09/2026 | v2.19.117 | Equipe Axis (smoke browser) | ✅ OK | POC IA + tenant; fornecedor OK; contraproposta N/A |

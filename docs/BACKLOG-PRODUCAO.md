# Backlog — produção e deploy

> **Lembrete para o cliente:** itens marcados com ⚠️ precisam estar resolvidos antes de vender/implantar negociação IA autônoma como serviço 24/7.

## ⚠️ Negociação IA autônoma — background real

**Situação atual (Hobby Vercel):**

- Motor avança **somente** com a equalização aberta (`QuotationNegotiationPlanPanel` → `useAutoRefresh` → `POST /api/negotiation-runs/[id]/tick`).
- Se o comprador fechar a aba, o evento **pausa de fato** até alguém reabrir a equalização (ou um job externo rodar).

**Para produção / cliente:**

| Opção | Prós | Contras |
|-------|------|---------|
| **Vercel Pro** + `vercel.json` cron | Integrado, 1 cron/dia no Hobby; Pro permite mais | Custo |
| **GitHub Actions** (`.github/workflows/background-jobs-cron.yml`) | Grátis, ~5 min | Secrets `APP_URL` + `CRON_SECRET` em PRD |
| **cron-job.org** / similar | Grátis, intervalo curto | URL + secret fora do repo |

Endpoint: `POST /api/cron/background-jobs` com `Authorization: Bearer $CRON_SECRET` ou `x-maintenance-key`.

**Ao reativar:** restaurar bloco `crons` em `vercel.json` (só com plano Pro) **ou** manter só GitHub Actions — não depender dos dois sem necessidade.

---

## Vercel Cron desativado (2026-09-01)

**Motivo:** plano Hobby bloqueia `*/2 * * * *` — deploy falhava com erro *"Hobby accounts are limited to daily cron jobs"*.

**Removido:** `vercel.json` (único conteúdo era o cron).

**Mantido sem cron:**

- `close_expired_rounds` / `expire_overdue_contracts` no `proxy.ts` (cooldown por tenant)
- Contratos: `POST /api/contracts/scheduled-maintenance` via proxy
- Retry ERP: `POST /api/integrations/auto-retry` via proxy
- Negociação IA: **apenas** painel na equalização (ver acima)

---

## Análise consultiva (equalização)

- Não dispara automaticamente no poll de propostas — só botão **Analisar** (+ cache local / cooldown `ai_negotiation_cache_minutes`).
- Ver `docs/PERFORMANCE-POLLING.md`.

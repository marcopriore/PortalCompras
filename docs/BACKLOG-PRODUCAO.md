# Backlog — produção e deploy

> **Lembrete para o cliente:** itens marcados com ⚠️ precisam estar resolvidos antes de vender/implantar negociação IA autônoma como serviço 24/7.

## ⚠️ Negociação IA autônoma — background real

**Situação atual (Hobby Vercel + cron desligado):**

- Motor avança **somente** com a equalização aberta (`QuotationNegotiationPlanPanel` → `useAutoRefresh` → `POST /api/negotiation-runs/[id]/tick`).
- Se o comprador fechar a aba, o evento **pausa de fato** até alguém reabrir a equalização.
- **Cron externo / GitHub Actions em schedule: DESLIGADO** (2026-11-24) — parar e-mails de falha; reativar só com decisão explícita + licença adequada.

**Para reativar em produção / cliente:**

| Opção | Prós | Contras |
|-------|------|---------|
| **Vercel Pro** + `vercel.json` cron | Integrado | Custo Pro |
| **GitHub Actions** — restaurar `schedule` em `.github/workflows/background-jobs-cron.yml` | Grátis, ~5 min | Secrets `APP_URL` + `CRON_SECRET` |
| **cron-job.org** / similar | Intervalo curto | URL + secret fora do repo |

Endpoint: `POST /api/cron/background-jobs` com `Authorization: Bearer $CRON_SECRET` ou `x-maintenance-key`.

**Ao reativar:** escolher **uma** opção (não Vercel Cron + Actions ao mesmo tempo sem necessidade). Workflow hoje só aceita `workflow_dispatch` (manual).

---

## Vercel Cron desativado (2026-09-01)

**Motivo:** plano Hobby bloqueia `*/2 * * * *` — deploy falhava com erro *"Hobby accounts are limited to daily cron jobs"*.

**Removido:** `vercel.json` (único conteúdo era o cron).

**Se ainda chegar e-mail da Vercel:** conferir no dashboard do projeto → **Cron Jobs** se sobrou job diário residual e apagar.

**Mantido sem cron de plataforma:**

- `close_expired_rounds` / `expire_overdue_contracts` no `proxy.ts` (cooldown por tenant)
- Contratos: `POST /api/contracts/scheduled-maintenance` via proxy
- Retry ERP: `POST /api/integrations/auto-retry` via proxy
- Negociação IA: **apenas** painel na equalização (ver acima)

---

## GitHub Actions cron desativado (2026-11-24)

**Motivo:** e-mails diários de falha (secrets/APP_URL ou endpoint); Hobby sem Pro; decisão de não manter job automático por enquanto.

**Alteração:** removido `on.schedule` de `.github/workflows/background-jobs-cron.yml` — resta só `workflow_dispatch`.

---

## Análise consultiva (equalização)

- Não dispara automaticamente no poll de propostas — só botão **Analisar** (+ cache local / cooldown `ai_negotiation_cache_minutes`).
- Ver `docs/PERFORMANCE-POLLING.md`.

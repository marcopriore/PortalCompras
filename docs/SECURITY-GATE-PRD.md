# Gate de segurança — PRD (pré-cliente)

Nenhum sistema é “100% inviolável”. Este gate reduz risco de vazamento, invasão e regressões **antes de expor ao cliente**.

## Automatizado (obrigatório em cada release)

```bash
npm run test:pre-release
```

| Item | Critério |
|------|----------|
| TypeScript | `tsc --noEmit` sem erros |
| Testes unitários | `vitest run` verde |
| Dependências | Revisar `npm audit` / alertas do GitHub (ação manual se crítico) |

---

## Segredos e superfície de ataque

| Verificação | Como |
|-------------|------|
| `service_role` **nunca** no client | Buscar `SERVICE_ROLE` em `app/`, `components/` — só server/API |
| `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET` | Apenas env Vercel/server |
| APIs de negócio | Auth + `company_id` / cookie superadmin |
| Cron `/api/cron/background-jobs` | Exige `CRON_SECRET` ou `x-maintenance-key` em PRD |
| Loja de API | Keys com escopo; logs de integração |

---

## Multi-tenant (Supabase RLS)

| Verificação | Como |
|-------------|------|
| Tabelas de negócio | RLS ativo; políticas com `company_id` |
| Comprador A | Não vê dados do tenant B (teste manual ou script) |
| Fornecedor | `get_my_supplier_id()` — só próprio `supplier_id` |
| Superadmin | Cookie `selected_company_id` nas APIs — nunca só `profile.company_id` |

---

## APIs recentes (negociação / IA)

| Rota | Controles |
|------|-----------|
| `quotation-ai-analysis` | Auth + feature `ai_negotiation`; cooldown no client; Anthropic só server |
| `negotiation-runs/*/tick` | Auth + features premium |
| `contract-matches` | Auth + tenant; limite 500 seleções; cache 60s por instância |
| `negotiation-runs/*/report` | Auth; só runs terminais |

---

## Hardening operacional

| Item | Recomendação |
|------|----------------|
| Supabase | MFA nos admins; backup; não expor SQL editor a usuários |
| Vercel | Variáveis só Production; revisar Integration logs |
| GitHub | Branch protection em `main`; secrets para Actions |
| Rate limit / WAF | Cloudflare ou Vercel Firewall em endpoints públicos (`/login`, `/api/*`) se tráfego alto |

---

## Testes manuais de segurança (amostra)

1. Usuário não autenticado → `GET /api/quotations/...` → **401**
2. Fornecedor → API de comprador → **403** ou vazio (RLS)
3. Tenant A com cookie/tenant B (superadmin mal configurado) → validar isolamento
4. `POST contract-matches` com >500 linhas → **400**

---

## Pós-gate (recomendado para cliente enterprise)

- Pentest externo anual
- Revisão RLS migration a migration
- Monitoramento: Supabase logs + falhas 401/403 em APIs

---

## Registro

| Data | Tag | test:pre-release | Smoke PRD | Segurança manual | Aprovado por |
|------|-----|------------------|-----------|------------------|--------------|
| 02/09/2026 | v2.19.117 | ✅ | ✅ | ✅ (amostra APIs 401 + tenant) | Smoke PRD |

Ver também: `docs/SMOKE-TEST-PRD.md`, `docs/PRD-TEST-ACCESS.md`, `docs/BACKLOG-PRODUCAO.md`.

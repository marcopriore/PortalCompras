# Acessos — smoke test PRD

> **Uso interno** — equipe Axis/Valore. Repositório privado; **não** embutir em migrations, seeds de deploy nem documentação pública.
>
> Ambiente: **produção** (`valore.axisstrategy.com.br`). Alterar senhas no Supabase invalida este arquivo — atualizar após reset.

## URL base

| Ambiente | URL |
|----------|-----|
| Portal (login unificado) | https://valore.axisstrategy.com.br/login |
| Comprador | https://valore.axisstrategy.com.br/comprador |
| Fornecedor | https://valore.axisstrategy.com.br/fornecedor/login |

---

## Tenants (superadmin)

| Tenant | Uso em smoke test |
|--------|-------------------|
| **Apresentação POC** | IA, negociação autônoma, volume de dados |
| **Empresa Teste** | Equalização clássica, fornecedor `fornecedor@` |
| Cotrijal | Opcional / cliente |

**Superadmin (seletor de tenant no header):** conta com acesso a todos os tenants ativos — ver seção abaixo ou usuário admin interno.

---

## Apresentação POC — usuários

Senha padrão do seed POC: ver script `scripts/seed-poc-tenant.mjs` (`Valore@POC2026` para e-mails `*@apresentacao-poc.demo`).  
Os logins abaixo usam domínio **`@valore.com.br`** (contas operacionais em PRD).

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Comprador | `comprapoc@valore.com.br` | `KUE&4p9C` |
| Gestor Compras | `gestorpoc@valore.com.br` | `6R5XLz$G` |
| Administrador | `adminpoc@valore.com.br` | `6dGQ$FV5` |
| Aprovador Pedido | `aprovpedpoc@valore.com.br` | `C%UyZjM7` |
| Aprovador Requisição | `aprovreqpoc@valore.com.br` | `c$f9XaXa` |
| Requisitante | `reqpoc@valore.com.br` | `UrQ27#Sp` |

**Notas de permissão (PRD, set/2026):**

- `comprapoc@` — perfil restrito: menu **Suporte** + **Configurações** (sem listagem de cotações).
- `gestorpoc@` / `adminpoc@` — preferir para smoke de **cotações / equalização / IA** no tenant POC.

---

## Empresa Teste — referência

| Perfil | E-mail | Senha | Observação |
|--------|--------|-------|------------|
| Comprador (teste) | `teste@procuremax.com.br` | `Senha@1234` | Também em `e2e/helpers/test-env.ts`; costuma ter superadmin/seletor de tenant |

---

## Portal fornecedor

| Campo | Valor |
|-------|-------|
| Login | `fornecedor@valore.com.br` |
| Senha | `123456` |
| Cliente típico nas cotações | Empresa Teste |

---

## Cenários de smoke (atalhos)

| Cenário | Tenant | Rota / código |
|---------|--------|----------------|
| Equalização + análise IA manual | Empresa Teste | `COT-2026-0036` → equalização |
| Negociação IA + painel autônomo | Apresentação POC | `COT-2026-0103` → equalização |
| Isolamento tenant | Superadmin | Trocar seletor POC ↔ Empresa Teste; listagens devem mudar |
| Isolamento usuário POC | `comprapoc@` | URL de cotação Empresa Teste → deve bloquear/redirecionar |
| Fornecedor | `fornecedor@` | `/fornecedor/cotacoes` |

**UUIDs úteis (podem mudar após reseed):**

- Empresa Teste `COT-2026-0036`: `3c1a465b-f4d4-461e-a0b5-ab7609d6480d`
- POC `COT-2026-0103`: `a042e204-f574-40c3-8a52-a4c5587aedbf`

---

## Scripts / automação

Para capturas ou E2E comercial, usar variáveis de ambiente (não versionar senhas em `.env` commitado):

```powershell
$env:COMMERCIAL_BASE_URL="https://valore.axisstrategy.com.br"
$env:COMMERCIAL_TENANT_NAME="Apresentação POC"
$env:COMMERCIAL_BUYER_EMAIL="gestorpoc@valore.com.br"
$env:COMMERCIAL_BUYER_PASSWORD="..."
# Ver scripts/capture-commercial-screenshots.mjs
```

Gate automatizado local (sem browser):

```bash
npm run test:pre-release
```

---

## Documentos relacionados

- Checklist: `docs/SMOKE-TEST-PRD.md`
- Segurança: `docs/SECURITY-GATE-PRD.md`
- Performance polling: `docs/PERFORMANCE-POLLING.md`

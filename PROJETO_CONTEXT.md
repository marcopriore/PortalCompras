# PROJETO_CONTEXT.md — ProcureMax (Portal de Compras)

## 1. PREMISSAS DO CHAT

- Usar Cursor para codificação — gerar prompts estruturados e detalhados
- Colocar pontos de atenção que não podem ser quebrados
- Sempre usar padrões de cores e identidade da marca
- Código otimizado e seguro
- Sempre indicar o local do comando (Cursor, PowerShell, Supabase SQL Editor, Navegador)
- Ir passo a passo — aguardar confirmação antes de avançar
- Não passar código diretamente, apenas instruções no prompt (exceto casos específicos)
- Encapsular prompt para copiar e colar
- Sugerir testes de validação antes de versionar
- Manter versionamento git com tags
- Sempre remover imports ao remover componentes
- Verificar balanceamento JSX após edições grandes
- Rodar `npx tsc --noEmit` antes de considerar concluído
- Listar explicitamente o que remover E o que manter
- Formato git:
  ```
  cd "C:\Dev\Portal Compras"
  git add .
  git commit -m "mensagem"
  git tag vX.X.X
  git push origin main
  git push origin vX.X.X
  ```

---

## 2. STACK TÉCNICA

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Banco de dados:** Supabase (PostgreSQL + RLS)
- **Autenticação:** Supabase Auth (email + senha)
- **Hospedagem futura:** Vercel
- **Repositório:** https://github.com/marcopriore/PortalCompras
- **Caminhos locais:** `C:\Dev\Portal Compras`

---

## 3. DESIGN SYSTEM

Arquivo `globals.css` usa tokens CSS com suporte a light/dark:
- Primária: `oklch(0.55 0.2 250)` — azul/índigo
- Accent: `oklch(0.65 0.18 165)` — verde
- Sidebar escura: `oklch(0.12 0.02 250)`
- Fonte: Geist
- **NUNCA usar cores hardcoded** — sempre tokens: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-primary`, `bg-primary`, etc.

---

## 4. ARQUITETURA MULTI-TENANT

- **Modelo:** Shared Database, Shared Schema com `company_id` em todas as tabelas
- **RLS ativo** em todas as tabelas de negócio
- **Superadmin (Marco):** acesso a todos os tenants via seletor no header
- **Admin do tenant:** acesso apenas à própria empresa
- **UUID fixo para testes:** `00000000-0000-0000-0000-000000000001` (Empresa Teste)
- **UUID do usuário de teste:** `c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7` (teste@procuremax.com.br)

---

## 5. ESTRUTURA DO BANCO (Supabase)

### Tabelas criadas:

**companies**
- id, name, cnpj, status, created_at

**profiles**
- id (FK auth.users), company_id (FK companies), full_name, role, status, is_superadmin, created_at

**quotations**
- id, company_id, code (COT-YYYY-NNNN, gerado por trigger), description, status (draft/waiting/analysis/completed/cancelled), category, payment_condition, response_deadline, created_by, created_at, updated_at

**quotation_items**
- id, quotation_id, company_id, material_code, material_description, unit_of_measure, quantity, complementary_spec, created_at

**quotation_suppliers**
- id, quotation_id, company_id, supplier_id, supplier_name, supplier_cnpj, created_at

**items**
- id, company_id, code, short_description, status, unit_of_measure, ncm, commodity_group, created_at, updated_at
- Somente leitura no frontend — populado via API externa (ERP)

### Funções/Triggers:
- `handle_new_user()` — cria perfil ao registrar usuário (lê company_id de raw_user_meta_data)
- `on_auth_user_created` — trigger AFTER INSERT ON auth.users
- `generate_quotation_code()` — gera COT-YYYY-NNNN por company_id
- `update_updated_at_column()` — atualiza updated_at
- `is_superadmin()` — função SECURITY DEFINER para RLS sem recursão

### Políticas RLS importantes:
- profiles: `id = auth.uid() OR public.is_superadmin()`
- quotations/items/suppliers: filtro por company_id via profiles ou is_superadmin()

### Observações banco:
- `response_deadline` em quotations é nullable (rascunho não exige data)
- `company_id` em profiles é nullable (temporário para criação de usuário via UI)
- `profiles.company_id` tem DROP NOT NULL aplicado

---

## 6. ESTRUTURA DE ARQUIVOS (principais)

```
app/
  login/page.tsx                          — tela de login
  admin/
    layout.tsx                            — layout admin (só superadmin)
    tenants/page.tsx                      — listagem e cadastro de tenants
  comprador/
    layout.tsx                            — layout com sidebar + header + TenantSelector
    page.tsx                              — dashboard (ainda mockado)
    cotacoes/
      page.tsx                            — listagem de cotações (Supabase)
      nova/page.tsx                       — nova cotação (Supabase)
      [id]/page.tsx                       — detalhes da cotação (Supabase)
    itens/page.tsx                        — listagem de itens (Supabase, somente leitura)
    fornecedores/page.tsx                 — ainda mockado
    pedidos/page.tsx                      — ainda mockado
    requisicoes/page.tsx                  — ainda mockado
    relatorios/page.tsx                   — ainda mockado
    configuracoes/page.tsx                — ainda mockado
  fornecedor/
    (dashboard)/                          — visão fornecedor (ainda mockada)
  api/
    auth/logout/route.ts                  — POST logout

components/
  layout/
    sidebar.tsx                           — sidebar com links (inclui Itens)
    header.tsx                            — header com notificações e usuário
    tenant-selector.tsx                   — Client Component seletor de tenant

lib/
  supabase/
    client.ts                             — createBrowserClient
    server.ts                             — createServerClient
  hooks/
    useUser.ts                            — hook: userId, companyId, isSuperAdmin, loading
                                            (lê cookie selected_company_id para superadmin)

supabase/migrations/
  001_auth_tenants.sql
  002_quotations.sql

proxy.ts                                  — proteção de rotas (renomeado de middleware.ts)
```

---

## 7. VARIÁVEIS DE AMBIENTE (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://fijnckrlvwsgbzlkvesb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_A-Z_EbAvOrO9DKTaXcwJLA_LS1vnS-U
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  ← MOVER PARA SERVIDOR (débito técnico)
```

---

## 8. VERSÕES GIT

| Tag | Descrição |
|-----|-----------|
| v0.1.0 | Estrutura inicial + tela Nova Cotação |
| v0.2.0 | Integração Supabase — salvar cotação |
| v0.3.0 | Listagem de cotações lendo do Supabase |
| v0.4.0 | Autenticação Supabase Auth |
| v0.5.0 | company_id e created_by dinâmicos, RLS reabilitado |
| v0.6.0 | Tela detalhes cotação + AlertDialog cancelamento |
| v0.7.0 | Painel admin, cadastro de tenants, seletor de tenant |
| v0.8.0 | Fix segurança — filtro company_id na tela de detalhe |
| v0.9.0 | Tela Itens somente leitura |

---

## 9. DÉBITOS TÉCNICOS (a corrigir)

1. **`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` exposta no frontend** — mover para Route Handler server-side (`app/api/admin/create-tenant/route.ts`)
2. **`created_by` em quotations** — atualmente preenchido com userId. Validar se está correto
3. **`supplier_id` em quotation_suppliers** — placeholder com userId. Quando tabela de fornecedores estiver pronta, usar ID real
4. **Empresa Teste** — registro manual no banco para dev, remover em produção
5. **`console.log` de debug** em `app/comprador/layout.tsx` — remover antes de produção
6. **`window.location.reload()`** no TenantSelector — funcional mas pode ser melhorado com Context global
7. **Profiles: company_id nullable** — temporário, reavaliar constraint após fluxo de cadastro completo

---

## 10. ESCOPO DO SISTEMA (requisitos originais)

### Modelo de negócio:
- **Marco** = dono da plataforma (superadmin)
- **Clientes** = empresas que contratam o SaaS (cada uma é um tenant)
- **Fornecedores** = cadastrados na base de cada tenant, populados via API do ERP do cliente
- **Itens/Materiais** = cadastrados via API do ERP do cliente (somente leitura no sistema)

### API de integração (futuro):
- API global exposta pela ProcureMax: `GET /items?tenant_id=xxx`
- Cada tenant terá sua api_key
- Sync automático a cada 1h para itens e fornecedores

### Visão Comprador — telas:
- ✅ Dashboard (mockado — conectar ao Supabase futuro)
- ✅ Minhas Cotações (Supabase) — falta: filtros Data/Fornecedor/Código Material, export Excel
- ✅ Nova Cotação (Supabase)
- ✅ Detalhe Cotação (Supabase)
- ✅ Itens (Supabase, somente leitura)
- ⬜ Fornecedores (mockado — conectar ao Supabase)
- ⬜ Pedidos (mockado)
- ⬜ Requisições (mockado)
- ⬜ Relatórios (mockado)
- ⬜ Configurações (mockado)

### Visão Fornecedor:
- ⬜ Detalhar em momento futuro

### Painel Admin (/admin):
- ✅ Listagem de tenants
- ✅ Cadastro de tenant + usuário admin
- ⬜ Ajustes visuais (padrão do sistema)
- ⬜ Editar/desativar tenant

---

## 11. PRÓXIMOS PASSOS (priorizados)

1. **Tela de Fornecedores** — conectar ao Supabase, somente leitura, mesmo padrão dos Itens
2. **Ajustes visuais painel Admin** — aplicar design system
3. **Filtros + Export Excel** em Minhas Cotações
4. **Mover service_role key para servidor** (segurança crítica antes de produção)
5. **Conectar Dashboard** ao Supabase
6. **Visão Fornecedor** (detalhar escopo)

---

## 12. SEGURANÇA E LGPD (anotado para implementar)

- Mover service_role key para servidor
- HTTPS forçado (Vercel faz automaticamente)
- Rate limiting no login
- Logs de auditoria
- Política de Privacidade
- Termos de Uso
- DPA — Data Processing Agreement
- Backup automático (verificar configuração Supabase)
- Monitoramento de erros (Sentry ou similar)
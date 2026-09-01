# Valore — Especificação Funcional e Técnica

**Produto:** Portal de Compras (SaaS multi-tenant)  
**Versão de referência:** v2.19.110 (código + migrations até 073)  
**Data:** 01/09/2026  

Documento consolidado: o que o sistema **é**, o que **faz**, **regras/condicionais** e como está **implementado**. Complementa `SPEC.md` (detalhe operacional), `docs/CONFIGURACOES-TENANT-NEGOCIO.md` (implantação por tenant) e `HANDOFF.md` (contexto de sessão).

---

## 1. Visão de produto

### 1.1 Proposta

Valore digitaliza o ciclo de compras corporativas com três portais, inteligência de preço, contratos com saldo, score de fornecedor e integração ERP (Loja de API).

### 1.2 Posicionamento (níveis de diferenciação)

| Nível | O que é | No Valore |
|-------|---------|-----------|
| **1 — Básico** (commoditizado) | Requisição → Aprovação → Pedido | ✅ Portais solicitante/comprador/fornecedor |
| **2 — Mercado atual** | Cotação RFQ, comparação, catálogo | ✅ Cotações, equalização, itens/fornecedores |
| **3 — Onde se ganha dinheiro** | Benchmark, sugestão de fornecedor, spend IA, alertas de economia | ✅ Saving, score, sugestão, AI spend, ROI |
| **4 — Próxima onda** | Compra autônoma, negociação IA avançada, previsão de demanda | 🟡 Negociação IA v1; previsão/autônoma no roadmap |

### 1.3 Roadmap de maturidade (produto)

**Já entregue (diferenciação / trimestre):**
- Saving (alvo, histórico, % por cotação)
- Dashboard ROI
- Export Excel (Saving, Lead Time, Spend, Performance)
- PDF do pedido
- Benchmark de preço na equalização
- Termos de aceite de proposta / fornecimento
- Score de fornecedor
- Módulo de contratos (notificações, expired automático, saldo, PDF, indicação na equalização)
- Análise de spend por IA
- Histórico de preço por item (média ponderada)
- Navegação ao clicar na notificação
- Sugestão automática de fornecedores

**Escala (6–12 meses) — planejado:**
- Negociação assistida por IA (evolução)
- Previsão de demanda
- Compra recorrente / templates
- Evolução API Store / ERP
- Precificação por spend

**Infraestrutura — planejado:**
- Motor de compliance
- SSO / SAML
- White-label
- Cobertura de testes contínua

**Adiado conscientemente (longo prazo — não esquecer):**
- **Módulo de Recebimento** (entrada parcial, embarque, entrega)
- **Consumo por item de requisição** (Parcial / Total / Aberta) — depende do Recebimento  
  *Motivo:* alto esforço de produto/integração; empresas ainda não preparadas.

---

## 2. Arquitetura técnica

### 2.1 Stack

| Camada | Tecnologia |
|--------|------------|
| App | Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui |
| Backend dados | Supabase (PostgreSQL + RLS + Auth + Storage) |
| E-mail | Resend |
| PDF | `@react-pdf/renderer` (API Node) |
| Excel | ExcelJS (dynamic import) |
| IA | Anthropic Claude (`claude-sonnet-4-20250514`), chave só server-side |

### 2.2 Multi-tenant

- Shared DB / Shared Schema com `company_id` nas tabelas de negócio.
- RLS ativo; superadmin usa cookie `selected_company_id` para atuar no tenant.
- Features licenciadas por tenant: `tenant_features`.
- Configurações genéricas: `company_settings` (`company_id`, `key`, `value`).
- **Implantação por tenant** (set/2026): flags de negócio (classificação/rateio, POR, ERP outbound) e limites numéricos no admin — ver **`docs/CONFIGURACOES-TENANT-NEGOCIO.md`**.

### 2.3 Portais e autenticação

| Portal | Rota base | `profile_type` | Login |
|--------|-----------|----------------|-------|
| Comprador / Admin | `/comprador` | `buyer` | `/login` (lado azul) |
| Solicitante | `/solicitante` | `requester` | `/login` (lado laranja) |
| Fornecedor | `/fornecedor` | `supplier` | `/fornecedor/login` (CNPJ ou e-mail) |
| Superadmin | `/admin` | buyer + `is_superadmin` | `/login` |

**Condicionais:**
- Fornecedor bloqueado nos lados comprador/solicitante do `/login`.
- Proxy (`proxy.ts`) roteia e bloqueia cruzamento de portais.
- Sessão MFA TOTP disponível (comprador).

---

## 3. Atores e permissões

### 3.1 Roles (comprador)

`admin`, `buyer`, `manager`, `approver_requisition`, `approver_order`, `requester`  
Armazenados em `profiles.roles` (array) + legado `profiles.role`.

### 3.2 Modelo de autorização

| Camada | Mecanismo |
|--------|-----------|
| Licença de módulo | `tenant_features` → `hasFeature()` |
| Permissão por perfil | `role_permissions` → `hasPermission()` (OR entre roles) |
| Permissão individual | `profile_permissions` (ex.: `user.impersonate`) |
| Bypass | `is_superadmin` (exceto durante “Agir como”) |

### 3.3 Features (`tenant_features`)

**Core:** `quotations`, `equalization`, `orders`, `requisitions`, `suppliers`, `items`, `reports`, `users`, `settings`, `logs`, `approval_requisition`, `approval_order`  

**Premium:** `ai_analytics`, `ai_negotiation`, `contracts`, `contract_balance`, `api_integrations`

### 3.4 “Agir como” (impersonation)

- Permissão **individual** `user.impersonate` (não no grupo Comprador).
- UI: Configurações → Usuários → botão “Agir como”.
- Cookie httpOnly; banner com **Finalizar**; logout limpa.
- Auditoria: `user_id` = ator real; metadata com `actingAsUserId`.
- Quem só tem essa flag vê a aba Usuários (listagem + agir como), sem CRUD admin.

---

## 4. Ciclo de compras — regras por módulo

### 4.1 Requisições

**Status:** `pending` → `approved` | `rejected` | `cancelled` → (`approved` → `in_quotation` → `completed`)

| Ação | Quem | Condicional |
|------|------|-------------|
| Criar | Solicitante / comprador (com permissão) | Catálogo + anexos |
| Cancelar | Solicitante | Só `pending` → `cancelled` (RLS explícito) |
| Aprovar / rejeitar | Aprovador | Feature `approval_requisition` + regra de CC; senão auto-aprovação |
| Editar / resubmeter | Solicitante | Após `rejected` |
| Vincular à cotação | Sistema | Itens com `source_requisition_code` ao salvar/enviar cotação → `in_quotation` |
| Liberar | Sistema | Cancelar cotação → REQ voltam a `approved`, `quotation_id` null |
| Import Excel | Admin/Master | Massivo; validação de catálogo |
| ERP inbound | API key | `POST /api/v1/requisitions`; PUT se `pending`/`rejected` |

### 4.2 Cotações e equalização

**Status cotação:** `draft` → `waiting` → `analysis` → `completed` | `cancelled`  

**Rodadas:** `active` | `closed`; propostas: `invited` → `submitted` → `selected` | `rejected`

**Regras:**
- `proposal_items` **obrigatório** com `round_id`.
- Nova rodada: propostas `invited` (sem itens).
- Condição de pagamento obrigatória no cabeçalho da proposta (tenant).
- Equalização: última rodada editável; benchmark % vs alvo / % vs média (`localStorage`).
- Clonar: copia itens/fornecedores → nova `draft`.
- Feature `ai_negotiation`: análise IA na equalização (cache 30 min).

### 4.3 Pedidos de compra

**Status:** `draft` → `sent` → aceite `processing` | recusa `refused`; também `cancelled`, `completed`, `error`, `integration_error`

| Evento | Efeito |
|--------|--------|
| Envio ao fornecedor | `sent` + notificação |
| Aceite fornecedor | Termos (se houver) → `processing` → dispara ERP `purchase_order.create` |
| Recusa | `refused` (≠ `cancelled`) |
| ERP OK | `completed` + `external_code` |
| ERP HTTP falhou | `error` (comprador pode reintegrar) |
| Valore falhou pós-ERP / persistência | `integration_error` (TI/admin, Monitor) |
| Labels fornecedor | `processing`/`completed`/`error`/`integration_error` → sempre “Pedido Aceito” |

**Outras regras:**
- `delivery_days` do pedido = maior `delivery_days` das linhas aceitas.
- `estimated_delivery_date` em `YYYY-MM-DD`.
- PDF via API service role.
- Pós-`completed`: editar → `draft` → reenviar `sent`; update ERP; cancelar só após delete ERP 2xx.

### 4.4 Contratos

**Status:** `draft` → `pending_acceptance` → `active` | (recusa → `draft`) → `cancelled` | `expired`

**Crítico:** status `active` **somente** via aceite do fornecedor (`/api/contracts/[id]/accept`) — nunca automático por data.

| Regra | Detalhe |
|-------|---------|
| Rascunho | `supplier_id`, datas nullable |
| Soft delete itens | `eliminated=true` |
| Saldo | Feature `contract_balance`; consumo via pedido; indicação na equalização |
| Expired | Job agendado por `end_date` |
| ERP | `contract.create` no aceite; falha não desativa contrato; alerta admin + reenvio Monitor |

### 4.5 Catálogo e fornecedores

- Itens: leitura no comprador; import/export Excel; sync ERP; preços Saving.
- Fornecedores: score (oculto no portal supplier); categorias (`supplier_categories`); import/export.
- Busca cotação: `.ilike` com `%termo%` **sem** aspas extras no filtro.

### 4.6 Saving e ROI

- Campos: `target_price`, `last_purchase_price`, `average_price`.
- **Negativo** = economia (verde); **positivo** = acima do alvo (vermelho).
- Triggers atualizam média histórica e herdam preços em `quotation_items`.
- Dashboard ROI + relatórios BI com 4 exports Excel.

### 4.7 Score de fornecedor

- Componentes: Preço, Cobertura, Lead Time, Confiabilidade.
- Peso preço: `company_settings.score_weight_price` (padrão 40%).
- **Nunca** exibir badge agregado para `profile_type === 'supplier'`.

### 4.8 Portal do fornecedor (multi-usuário)

| Regra | Valor |
|-------|-------|
| Limite | **5 usuários** por fornecedor |
| Admin | `is_supplier_admin` + login por **CNPJ** |
| Demais | Login por **e-mail**; criados pelo admin ou comprador |
| Convite | Comprador em `/comprador/fornecedores` (CNPJ obrigatório) |
| Ações | Bloquear / reativar / cancelar / atualizar; admin só altera e-mail |

### 4.9 Aprovações

- Fluxos: `requisition` | `order` em `approval_levels` / `approval_requests`.
- Features: `approval_requisition`, `approval_order`.
- Sem regra / feature off → auto-aprovação conforme tela de configurações.

---

## 5. Notificações e auditoria

### 5.1 Canais

- In-app: `notifications` + sino (`notification-bell`).
- E-mail: Resend via `sendEmail` / templates.
- Preferências: `*_bell` e `*_email` em `notification_preferences`.
- Tipos incluem: pedido, cotação, contrato, **Erro de Integração ERP** (`integration_error_*`, padrão ligado).

### 5.2 Alerta `integration_error`

- Destinatários: admins do tenant.
- Pedido: só ao **transicionar** para `integration_error` (não no status `error`).
- Contrato: falha de `contract.create`.
- Dedup: 60 minutos por entidade.

### 5.3 Auditoria (`audit_logs`)

Eventos principais: login/logout, CRUD usuários, cotação, requisição, proposta, pedido (aceite/recusa), impersonation, integração, fornecedor (login, usuários, import).

Paginação server-side (25/pág) em `/admin/logs`.

---

## 6. Integrações ERP (Loja de API)

### 6.1 Direção

| Direção | Exemplos |
|---------|----------|
| **Inbound** (ERP → Valore) | `POST /api/v1/requisitions` (+ OpenAPI `/docs/api`) |
| **Outbound** (Valore → ERP) | Pedido create/update/delete; contrato create |

### 6.2 Gatilhos outbound de pedido

1. Aceite fornecedor → `purchase_order.create`
2. Reenvio monitor / comprador (status elegível)
3. Update/delete conforme regras §10.10

### 6.3 Idempotência e retry

- Header `Idempotency-Key` = SHA-256(`company_id:action:entity_id`).
- Persistido em `integration_delivery_logs.idempotency_key`.
- `attempts` incrementa a cada tentativa.
- Trava: no máximo 1 despacho “Em andamento” por entidade; concorrente → 409.
- **Auto-retry:** só falhas transitórias (rede/timeout/5xx/429); backoff 1→5→15 min; máx. 4 tentativas; audit `integration.auto_retry*`; ao esgotar → `integration_error` + alerta.
- Reenvio Monitor: só se pendência real (`outbound-retry-eligibility`); oculto se ERP OK + PO `completed`.

### 6.4 Configuração

- Endpoints + API keys: `/admin/integracoes` (superadmin).
- Monitor: `/comprador/integracoes/monitor` (admin tenant + feature `api_integrations`).

---

## 7. IA e analytics

| Feature | Uso | Cache |
|---------|-----|-------|
| `ai_analytics` | Spend no dashboard | 1h |
| `ai_negotiation` | Equalização | 30 min |

- Modelo: `claude-sonnet-4-20250514`.
- Logs: `ai_analysis_logs` (service role); audit sem bloquear resposta.
- Propostas analisadas: status `submitted` | `selected`.

---

## 8. Configurações e segurança

### 8.1 Comprador (`/comprador/configuracoes`)

Abas: Empresa, Perfil, Notificações, Aprovações, Segurança (2FA), Campos, Termos, Usuários, Perfis de Acesso, Integrações.  
Deep link: `?tab=`.

### 8.2 Superadmin

- Tenants, features, settings técnicas (`tenant-settings-registry`), segurança/senha, Loja de API.
- Impersonação de **tenant** via cookie (diferente de “Agir como” usuário).

### 8.3 Política de senhas

Por tenant (migration 039): comprimento, classes, histórico, expiração; guardas no portal.

### 8.4 Storage

| Bucket | Uso |
|--------|-----|
| `company-logos` | Público |
| `profile-avatars` | Público |
| `proposal-attachments` | Privado |
| `contract-files` | Público |

Validação upload imagem: tipo + máx. 2MB.

---

## 9. Mapas de telas (estado)

### 9.1 Comprador

| Área | Status |
|------|--------|
| Dashboard + ROI + Spend IA | ✅ |
| Requisições / Aprovações | ✅ |
| Cotações + Equalização | ✅ |
| Pedidos + PDF + ERP | ✅ |
| Contratos + saldo | ✅ |
| Itens / Fornecedores | ✅ |
| Relatórios BI + exports | ✅ |
| Configurações unificadas | ✅ |
| Monitor integração | ✅ |

### 9.2 Solicitante / Fornecedor / Público

| Área | Status |
|------|--------|
| Solicitante CRUD + timeline | ✅ |
| Fornecedor dashboard, cotações, pedidos, contratos, usuários, atividades | ✅ |
| Termos públicos `/termos/[company_id]` | ✅ |
| Docs API `/docs/api` | ✅ |

---

## 10. Modelo de dados (principais)

| Tabela / conceito | Papel |
|-------------------|-------|
| `companies`, `profiles` | Tenant e usuários (`roles`, `profile_type`, `supplier_id`, `is_supplier_admin`) |
| `requisitions`, `requisition_items` | Solicitação |
| `quotations`, `quotation_rounds`, `quotation_items`, `quotation_suppliers`, `quotation_proposals`, `proposal_items` | Cotação RFQ |
| `purchase_orders`, `purchase_order_items` | Pedido + ERP |
| `contracts`, `contract_items` | Contratos + saldo |
| `items`, `suppliers`, `supplier_categories`, `payment_conditions` | Catálogo |
| `approval_levels`, `approval_requests` | Aprovações |
| `notifications`, `notification_preferences` | Alertas |
| `audit_logs` | Trilha |
| `tenant_features`, `role_permissions`, `profile_permissions`, `company_settings` | Licença e ACL |
| `api_keys`, `integration_endpoints`, `integration_delivery_logs` | Loja de API |
| `supplier_invites`, `supplier_terms`, `supplier_term_acceptances` | Portal fornecedor |

---

## 11. Padrões de implementação (técnicos)

- Next.js 16: `React.use(params)` — nunca `params.id` direto.
- Supabase client: `@/lib/supabase/client` no browser; service role só em API.
- Batch updates: `.in('id', ids)` — sem loop de UPDATE.
- ExcelJS sempre dynamic import; cabeçalho `#4F3EF5`.
- Design tokens (sem cores hardcoded, exceto badges/sidebar).
- Polling: `useAutoRefresh` (não `setInterval` solto).
- Isolamento: `useTenant()` + `companyId` nas deps; APIs resolvem cookie do superadmin.

---

## 12. Backlog resumido (pós-agosto/2026)

| Prioridade | Item |
|------------|------|
| ✅ Feito | Multi-user fornecedor, Agir como, import REQ, idempotência avançada, alertas `integration_error` |
| 🟡 Parcial | API Store (REQ outbound opcional) |
| ✅ Feito | Auto-retry outbound (backoff + audit) |
| ⏸️ Longo prazo | Recebimento + consumo por item de REQ |
| Escala | Previsão demanda, compra recorrente, IA negociação v2, spend pricing |
| Infra | Compliance, SSO/SAML, white-label |

---

## 13. Referências no repositório

| Documento | Uso |
|-----------|-----|
| `SPEC.md` | Spec operacional detalhada (integrações §10, contratos, notificações) |
| `HANDOFF.md` | Contexto de sessão / backlog vivo |
| `CLAUDE.md` | Regras críticas para agentes/devs |
| `docs/api` (rota) | Documentação pública OpenAPI |
| Este arquivo | Visão consolidada funcional + técnica + produto |

---

*Gerado para alinhar produto, engenharia e roadmap. Em caso de divergência pontual com o código, prevalece a implementação versionada + `SPEC.md` § correspondente.*

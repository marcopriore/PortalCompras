# Configurações de tenant — negócio e implantação

**Referência:** sessão de implantação SAP / multi-tenant (set/2026)  
**Código:** `lib/settings/tenant-feature-settings*.ts`, `lib/settings/tenant-settings-registry.ts`  
**UI admin:** `/admin/tenants/[id]` → aba **Configurações** (mesmo formulário das settings técnicas)

---

## 1. Conceito geral

Cada tenant pode ter comportamentos diferentes na implantação (ex.: cliente SAP com POR e classificação contábil vs. cliente sem ERP). As flags ficam em `company_settings` e são lidas no app via:

| Camada | Arquivo / hook |
|--------|----------------|
| Registry (chaves + defaults) | `lib/settings/tenant-feature-settings-registry.ts` |
| Parse / load server | `lib/settings/tenant-feature-settings.ts` |
| API comprador | `GET /api/tenant-feature-config` |
| API admin | `GET/PATCH /api/admin/tenant-settings` (unificado) |
| Hook frontend | `useTenantFeatureConfig()` — alias `useImplantationConfig()` |

**Não** existe aba separada “Cutover”. Tudo fica em **Admin → Tenant → Configurações**.

Chaves legadas `cutover_*` ainda são lidas como fallback (`LEGACY_FEATURE_KEY_ALIASES`).

---

## 2. Flags ON/OFF (negócio)

| Chave | Label | Quando ligado | Quando desligado |
|-------|-------|---------------|------------------|
| `account_assignment_enabled` | Classificação fiscal, coletores e rateio | Colunas K/F/P/A/X, coletor, modal de rateio em REQ/PO; validação na UI; campos no payload ERP | Sem colunas/validação na UI; campos omitidos no outbound |
| `por_enabled` | POR (fator de preço SAP) | Coluna POR no pedido; total = qtd × preço × POR | POR ignorado (multiplicador 1); `price_unit` omitido no outbound |
| `erp_integration_enabled` | Integração outbound ERP | Dispara outbound conforme `api_integrations` | Não envia (gate adicional ao feature `api_integrations`) |
| `erp_vendor` | Tipo de ERP (`none` \| `sap` \| `other`) | Afeta extensões SAP no payload (`sap_extensions`, etc.) | Perfil genérico |
| `api_capabilities` (JSON) | Matriz Loja de API (inbound + outbound) | Só dispara / aceita as rotas ligadas | Ver §2.1 |

**Defaults para tenant novo:** classificação e POR **desligados**; ERP integration **desligado**; vendor `none`; matriz de APIs **tudo off**.  
**Defaults legado (chave ausente):** classificação e POR **ligados** (compatibilidade com tenants já em uso); `api_capabilities` ausente = inbound aberto + outbound PO/contrato (REQ outbound off).

Outbound: `lib/integrations/purchase-order-outbound.ts` → `applyImplantationToPurchaseOrderPayload()`.

### 2.1 Matriz de APIs (`api_capabilities`)

UI: **Admin → Tenant → Configurações → Negócios** — tabela **Inbound / Outbound** com colunas GET | POST | PUT | DELETE | ENDPOINT (como mockup). Traço = método não aplicável.

| Direção | Gate |
|---------|------|
| **Inbound** | `withApiKey` + método HTTP da request → 403 se desligado |
| **Outbound** | `erp_integration_enabled` **e** célula ligada |

Mapeamento outbound (método → ação ERP):

| Recurso | GET | POST | PUT | DELETE |
|---------|-----|------|-----|--------|
| Pedidos | — | `purchase_order.create` | `purchase_order.update` | `purchase_order.delete` |
| Contratos | — | `contract.create` | — | — |
| Requisições | `approved` + `rejected` | `created` | `updated` | `cancelled` |

Código: `lib/settings/tenant-api-capabilities*.ts`. Monitor: reenvio só se ação habilitada.

---

## 3. Limites numéricos (sem ON/OFF)

Configurados como **números** em `company_settings` (grupo `negocios`, superadmin):

| Chave | Default | Uso |
|-------|---------|-----|
| `numeric_quantity_max_digits` | 7 | Máximo de dígitos em quantidade (ex.: 7 → até 9.999.999) |
| `numeric_price_decimal_places` | 5 | Casas decimais em preço/valor unitário |

Percentual: **2 casas fixas** no código (`DEFAULT_PERCENT_DECIMAL_PLACES`).

Hook: `useNumericLimits()` → `maxQuantity`, `priceDecimalPlaces`, `percentDecimalPlaces`.  
Componentes: `components/ui/numeric-field-inputs.tsx` (`QuantityInput`, `PriceInput`).  
Validação: `lib/validation/numeric-input.ts`.

**Não** há flag “validação numérica estrita” — os limites numéricos **sempre** aplicam onde o hook é usado.

---

## 4. POR (preço por unidade de medida)

- Coluna DB: `purchase_order_items.price_unit` (migration `071`) — valores `1, 10, 100, 1000, 10000`.
- **Fórmula:** `total_linha = quantidade × preço_unitário × POR`
- Ex.: `1 × 0,00005 × 10000 = 0,50`
- Helpers:
  - `computeLineTotal()` em `lib/validation/numeric-input.ts`
  - `computePurchaseOrderLineTotal(qty, price, priceUnit, porEnabled)` em `lib/purchase-order-line-total.ts`
- **Exibição:** sempre calcular na UI com `computePoLineTotal` / `computePurchaseOrderLineTotal` quando `porEnabled` — **não** confiar só em `purchase_order_items.total_price` gravado (pode estar sem POR).
- **Persistência:** ao salvar rascunho do pedido, atualizar `total_price` da linha com POR.

---

## 5. Classificação contábil e rateio (SAP)

### Tabelas (migrations `066`, `070`)

| Tabela | Entidade |
|--------|----------|
| `purchase_order_item_account_assignments` | Linhas de rateio do pedido |
| `requisition_item_account_assignments` | Linhas de rateio da requisição |

Colunas no item pai: `account_assignment_category` (K/F/P/A/X), `account_assignment_distribution` (coletor).

### Fluxo

1. REQ: preenchimento em nova/editar requisição (comprador e solicitante).
2. Detalhe REQ: `RequisitionLineItemsDetailSection` — colunas contábeis quando `accountAssignmentEnabled`.
3. PO: herança REQ → PO ao importar/vincular; edição em rascunho via `PoItemAccountConfigTableCells` + `PoAccountApportionmentDialog`.
4. Leitura: botão **Ver rateio** (`readOnly` no dialog).

Libs: `lib/po-account-assignment.ts`, `lib/po-account-assignment-persist.ts`, `lib/requisition-account-assignment-persist.ts`, `types/po-account-assignment.ts`.

---

## 6. Pedido — outras regras da sessão

- **Vínculo REQ → linha PO:** `requisition_item_id`, `source_requisition_code` (migration `067`).
- **Importação multi-requisição** no rascunho do pedido.
- **Export Excel detalhe:** `lib/excel/purchase-order-detail-export.ts` — coluna POR condicional, total correto.
- **PDF:** `lib/pdf/purchase-order-pdf-data.ts` + `porEnabled` do tenant; totais por linha com POR.

---

## 7. Aprovações no detalhe

Componente: `components/comprador/entity-approval-actions.tsx`

- Botões **Aprovar** / **Reprovar** no cabeçalho de:
  - `/comprador/requisicoes/[id]`
  - `/comprador/pedidos/[id]`
- Mesma API da grid: `POST /api/approvals/[id]/decide`
- Visível se: permissão `approval.requisition` ou `approval.order`, solicitação `pending`, e usuário é o `approver_id` ou admin/superadmin.
- Link da grid de pedidos: `?from=aprovacoes` para voltar à fila.

---

## 8. RLS superadmin (migrations `068`–`073`)

Superadmin opera tenant via cookie `selected_company_id`; RLS não lê cookie. Policies atualizadas para `is_superadmin OR company_id = profile.company_id` em:

- Pedidos e itens (`068`)
- Insert requisição cross-tenant (`069`)
- Contratos (`072`)
- Demais tabelas do portal comprador (`073`)

---

## 9. Testes adicionados

- `__tests__/lib/numeric-input.test.ts`
- `__tests__/lib/po-account-assignment.test.ts`
- `__tests__/lib/purchase-order-outbound.test.ts`

---

## 10. Arquivos principais criados/alterados (índice)

```
lib/settings/tenant-feature-settings-registry.ts
lib/settings/tenant-feature-settings.ts
lib/hooks/use-tenant-feature-config.ts
lib/hooks/use-numeric-limits.ts
lib/validation/numeric-input.ts
lib/purchase-order-line-total.ts
lib/integrations/purchase-order-outbound.ts
lib/excel/purchase-order-detail-export.ts
lib/pdf/purchase-order-pdf-data.ts
components/ui/numeric-field-inputs.tsx
components/ui/required-label.tsx
components/comprador/entity-approval-actions.tsx
components/comprador/po-item-account-config-cells.tsx
components/comprador/po-account-apportionment-dialog.tsx
components/requisitions/requisition-line-items-section.tsx
components/requisitions/requisition-line-items-detail-section.tsx
app/api/tenant-feature-config/route.ts
supabase/migrations/066–073
```

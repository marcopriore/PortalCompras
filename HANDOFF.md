# Valore — Handoff para Novo Chat

## Data: 25/08/2026
## Versão: v2.19.90

## 1. CONTEXTO DO PROJETO
- Valore é um SaaS de procurement B2B (comprador, fornecedor, solicitante, admin).
- Stack: Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui, Supabase, Resend, ExcelJS, Anthropic.
- Local: `C:\Dev\Portal Compras` · Repo: github.com/marcopriore/PortalCompras
- Supabase ref: `fijnckrlvwsgbzlkvesb`

## 2. PREMISSAS
- `npx tsc --noEmit` antes de concluir.
- Isolamento de tenant obrigatório (`useTenant` / cookie `selected_company_id` para superadmin).
- Commit + tag só quando o usuário pedir.

## 3. CATÁLOGO DE COMPRAS (v2.19.88) + CICLO REQ↔PO (v2.19.89–90)
- Feature `purchase_catalog` · permissões `nav.catalog`, `catalog.order`
- Rotas: `/comprador/catalogo`, `/solicitante/catalogo`
- Checkout (todos os perfis): por fornecedor cria
  1. `requisitions` status **`awaiting_buyer`**, `origin = 'catalog'`
  2. `purchase_orders` status **`draft`** com `requisition_code` + reserva de saldo
- Sync automático PO → REQ (migration **059**, trigger `trg_sync_requisition_from_po`):
  - draft/error/refused/integration_error → `awaiting_buyer`
  - sent/processing → `awaiting_supplier`
  - completed → `completed`; cancelled → `cancelled`
- Labels: `pending` = **Pendente Aprovação**; libs em `lib/requisitions/status.ts` + `timeline.ts`
- Timeline: data só em etapa concluída; detalhe mostra **Número do Pedido**
- APIs: `/api/catalog/offers|cart|checkout`
- Migrations: 054–059
- Notificação: autor + compradores (se solicitante) · template `templateCatalogOrderCreated`
- Dual-mode `buyer_review` **não é mais usado** no checkout (legado no constraint)

## 4. MÓDULOS PRINCIPAIS (já existentes)
- Cotações / equalização / Saving / IA
- Pedidos + PDF + integração ERP outbound
- Contratos + consumo de saldo
- Grupos de permissões (050+)
- Importação massiva de requisições (Excel)

## 5. SEEDS DE TESTE
- Empresa: `00000000-0000-0000-0000-000000000001`
- Buyer: `c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7` (teste@procuremax.com.br)
- Catálogo validado: REQ-2026-0178 (`awaiting_buyer`+draft), REQ-2026-0179 (`awaiting_supplier`+sent)

## 6. PRÓXIMOS PASSOS SUGERIDOS
- e2e do fluxo catálogo (checkout → envio → aceite → completed)
- API Store Fase 2 (contratos GET, aprovações inbound) ou `portal.solicitante` por role
- Cursor pagination se catálogo crescer muito
- Limpar REQs legadas `buyer_review` de testes, se houver
- Recebimento: adiado (não iniciar)

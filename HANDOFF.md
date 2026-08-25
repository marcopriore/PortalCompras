# Valore — Handoff para Novo Chat

## Data: 25/08/2026
## Versão: v2.19.88

## 1. CONTEXTO DO PROJETO
- Valore é um SaaS de procurement B2B (comprador, fornecedor, solicitante, admin).
- Stack: Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui, Supabase, Resend, ExcelJS, Anthropic.
- Local: `C:\Dev\Portal Compras` · Repo: github.com/marcopriore/PortalCompras
- Supabase ref: `fijnckrlvwsgbzlkvesb`

## 2. PREMISSAS
- `npx tsc --noEmit` antes de concluir.
- Isolamento de tenant obrigatório (`useTenant` / cookie `selected_company_id` para superadmin).
- Commit + tag só quando o usuário pedir.

## 3. CATÁLOGO DE COMPRAS (v2.19.88)
- Feature `purchase_catalog` · permissões `nav.catalog`, `catalog.order`
- Rotas: `/comprador/catalogo`, `/solicitante/catalogo`
- Checkout (todos os perfis): por fornecedor cria
  1. `requisitions` status **`completed`**, `origin = 'catalog'`
  2. `purchase_orders` status **`draft`** com `requisition_code` + reserva de saldo
- Solicitante acompanha pela REQ (lista inclui `completed`; detalhe já carrega POs por `requisition_code`)
- APIs: `/api/catalog/offers|cart|checkout`
- Migrations: 054–058
- Notificação: autor + compradores (se solicitante) · template `templateCatalogOrderCreated`
- Dual-mode `buyer_review` **não é mais usado** no checkout (código morto removido)

## 4. MÓDULOS PRINCIPAIS (já existentes)
- Cotações / equalização / Saving / IA
- Pedidos + PDF + integração ERP outbound
- Contratos + consumo de saldo
- Grupos de permissões (050+)
- Importação massiva de requisições (Excel)

## 5. SEEDS DE TESTE
- Empresa: `00000000-0000-0000-0000-000000000001`
- Buyer: `c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7` (teste@procuremax.com.br)

## 6. PRÓXIMOS PASSOS SUGERIDOS
- e2e do fluxo catálogo
- Cursor pagination se catálogo crescer muito
- Limpar REQs legadas `buyer_review` de testes, se houver

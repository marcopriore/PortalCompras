# Dívida de lint — `react-hooks/set-state-in-effect`

Última execução: `npm run lint` (pós-migração settings solicitante/comprador).

| Métrica | Antes (Fase 5) | Agora |
|---------|----------------|-------|
| Erros totais | 108 | **85** |
| Warnings | 50 | **68** |
| `set-state-in-effect` (aprox.) | — | **77** |

Ignorados por config: `components/ui/**`, `**/*.test.ts(x)`, `tests/**`.

## Exceções documentadas (não são dívida)

- `lib/hooks/useUser.ts` — sync `SessionUser` / Auth
- Sync DTO→form em telas de edição pesadas (pedido detalhe / equalização), com comentário `eslint-disable` onde aplicável
- Hidratação de formulário a partir de `useQuery` (configurações, nova REQ com centro de custo padrão)

## Residual — arquivos com `set-state-in-effect` (59)

`app/admin/admin-shell.tsx`, `app/admin/logs/page.tsx`, `app/admin/tenants/[id]/page.tsx`, `app/comprador/aprovacoes/page.tsx`, `app/comprador/configuracoes/page.tsx`, `app/comprador/contratos/[id]/page.tsx`, `app/comprador/contratos/novo/page.tsx`, `app/comprador/cotacoes/[id]/editar/page.tsx`, `app/comprador/cotacoes/[id]/equalizacao/page.tsx`, `app/comprador/cotacoes/[id]/novo-pedido/page.tsx`, `app/comprador/cotacoes/nova/page.tsx`, `app/comprador/itens/page.tsx`, `app/comprador/pedidos/[id]/page.tsx`, `app/comprador/pedidos/page.tsx`, `app/comprador/requisicoes/[id]/editar/page.tsx`, `app/comprador/requisicoes/page.tsx`, `app/fornecedor/atividades/page.tsx`, `app/fornecedor/cadastro/page.tsx`, `app/fornecedor/cotacoes/[id]/page.tsx`, `app/fornecedor/cotacoes/page.tsx`, `app/fornecedor/pedidos/[id]/page.tsx`, `app/fornecedor/pedidos/page.tsx`, `app/solicitante/[id]/editar/page.tsx`, `app/solicitante/[id]/page.tsx`, `app/solicitante/configuracoes/page.tsx`, `app/solicitante/page.tsx`, `components/admin/integrations-settings.tsx`, `components/admin/tenant-security-tab.tsx`, `components/admin/tenant-settings-tab.tsx`, `components/auth/password-expiry-guard.tsx`, `components/catalog/catalog-cart-sheet.tsx`, `components/comprador/configuracoes-usuarios-tab.tsx`, `components/comprador/create-po-from-contract-dialog.tsx`, `components/comprador/entity-approval-actions.tsx`, `components/comprador/link-contract-equalizacao-dialog.tsx`, `components/comprador/po-account-apportionment-dialog.tsx`, `components/comprador/quotation-ai-analysis.tsx`, `components/comprador/quotation-negotiation-plan.tsx`, `components/comprador/requisicoes-import-excel-dialog.tsx`, `components/comprador/requisition-line-items-import-excel-dialog.tsx`, `components/comprador/spend-ai-insights.tsx`, `components/comprador/supplier-categories.tsx`, `components/comprador/supplier-portal-users.tsx`, `components/comprador/user-permissions-dialog.tsx`, `components/data-table/data-table.tsx`, `components/fornecedor/import-proposal-wizard.tsx`, `components/fornecedor/terms-acceptance-dialog.tsx`, `components/integrations/integration-monitor.tsx`, `components/layout/fornecedor-portal-shell.tsx`, `components/layout/header.tsx`, `components/layout/navigation-progress.tsx`, `components/layout/sidebar.tsx`, `components/layout/supplier-client-selector.tsx`, `components/layout/tenant-selector.tsx`, `components/requisitions/requisition-line-items-section.tsx`, `components/support/support-page.tsx`, `components/support/support-ticket-detail.tsx`, `contexts/impersonation-context.tsx`, `hooks/use-mobile.ts`

## Plano de zerar

Ver `BACKLOG-MIGRACAO.md` — Lote E. Nada fica para trás; cada lote em commit separado.
# Dívida de lint — `react-hooks/set-state-in-effect`

Última execução: `npm run lint` (fechamento Fase 5).

| Métrica | Valor |
|---------|-------|
| Erros totais | 108 |
| Warnings | 50 |

Ignorados por config: `components/ui/**`, `**/*.test.ts(x)`, `tests/**`.

## Exceções documentadas (não são dívida)

- `lib/hooks/useUser.ts` — sync `SessionUser` / Auth
- Sync DTO→form em telas de edição pesadas (pedido detalhe / equalização), até o lote A reduzir

## Plano de zerar

Ver `BACKLOG-MIGRACAO.md` — lotes A→E. Nada fica para trás; cada lote em commit separado.

## Amostra de hotspots

- Equalização / pedido detalhe (efeitos secundários + form sync)
- `components/support/support-page.tsx`
- Forms: contratos novo/detalhe, cotações nova/editar, requisicoes
- Portal fornecedor
- Hooks: `use-notifications`, `use-supplier-score`, `use-tenant-feature-flags`

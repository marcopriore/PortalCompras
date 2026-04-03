# Atualização Automática — Polling

## Como funciona

O hook `useAutoRefresh` (`lib/hooks/use-auto-refresh.ts`) centraliza o `setInterval`: chama periodicamente uma função `onRefresh` (tipicamente `useCallback` que reexecuta o fetch da tela). Opções:

- **`intervalMs`** — período entre chamadas.
- **`enabled`** — quando `false`, o timer é limpo (ex.: sem `companyId` / `supplierId`).
- **`pauseWhenHidden`** — se `true` (padrão), não dispara o callback enquanto `document.hidden` (aba em segundo plano).
- Ao **voltar para a aba**, dispara **um refresh imediato** (evento `visibilitychange`).

O componente `LastUpdated` (`components/ui/last-updated.tsx`) mostra **“Atualizado às HH:mm:ss”** usando `formatDateTimeBR` e um ícone `RefreshCw` com `animate-spin` enquanto `isRefreshing` é verdadeiro.

Nas listagens, o padrão é:

1. **`loadData(silent)`** — com `silent === true`, não liga o loading global da página (sem spinner de carregamento inicial).
2. **`refresh`** — envolve `loadData(true)` com `setIsRefreshing(true/false)` e atualiza `lastUpdated`.
3. **`useAutoRefresh({ onRefresh: refresh, ... })`** — nunca `setInterval` solto na página.

## Telas com atualização automática

| Tela | Rota | Intervalo | O que atualiza |
|------|------|-----------|----------------|
| Pedidos (fornecedor) | `/fornecedor/pedidos` | 30s | Lista e métricas de pedidos do fornecedor |
| Cotações (fornecedor) | `/fornecedor/cotacoes` | 60s | Convites, métricas e tabela de cotações |
| Equalização | `/comprador/cotacoes/[id]/equalizacao` | 30s | Propostas e itens de proposta; refresh completo se mudar contagem de itens ou fornecedores |
| Aprovações | `/comprador/aprovacoes` | 30s | Requisições e pedidos pendentes de aprovação |
| Pedidos (comprador) | `/comprador/pedidos` | 60s | Lista de pedidos e totais derivados |

## Comportamento

- Atualização **silenciosa** nas listagens: sem reativar o estado de “loading” da página quando `silent` é usado (evita piscar o layout).
- Indicador **“Atualizado às HH:mm:ss”** no cabeçalho, alinhado ao título quando aplicável.
- **Pausa** automática com a aba em background (`pauseWhenHidden`).
- **Refresh imediato** ao retornar à aba.
- Timer **removido no unmount** do componente (`clearInterval` no cleanup do `useEffect`), sem vazamento óbvio de intervalo.

## Como adicionar em novas telas

1. Importar `useAutoRefresh` e `LastUpdated`.
2. Criar estado `lastUpdated: Date | null` e `isRefreshing: boolean`.
3. Extrair o fetch para uma função **`useCallback`**, com parâmetro opcional **`silent`**:
   - Se `!silent`, chame `setLoading(true)` antes do fetch e `setLoading(false)` depois.
   - Se `silent`, não altere o loading global; apenas atualize os dados e `setLastUpdated(new Date())` ao concluir com sucesso.
4. Criar **`refresh = useCallback(async () => { setIsRefreshing(true); try { await load(true); } finally { setIsRefreshing(false); } }, [load])`** (ajuste nomes).
5. No **`useEffect` de montagem**, chame `load(false)` e defina `lastUpdated` após sucesso (ou dentro de `load`).
6. Registrar **`useAutoRefresh({ intervalMs, onRefresh: refresh, enabled: ... })`** com `enabled` coerente (ex.: só quando há `companyId`).
7. Renderizar **`<LastUpdated timestamp={lastUpdated} isRefreshing={isRefreshing} />`** no cabeçalho.

**Importante:** mantenha `onRefresh` estável com `useCallback` e dependências corretas para o intervalo não ser recriado sem necessidade.

Para telas com **estado de UI frágil** (como equalização), prefira um refresh **parcial** dos dados e só faça reload completo quando a estrutura mudar (ex.: número de itens ou fornecedores).

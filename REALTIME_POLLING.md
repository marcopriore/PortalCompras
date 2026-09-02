# Atualização Automática — Polling

## Como funciona

O hook `useAutoRefresh` (`lib/hooks/use-auto-refresh.ts`) centraliza o `setInterval`: chama periodicamente uma função `onRefresh` (tipicamente `useCallback` que reexecuta o fetch da tela). Opções:

- **`intervalMs`** — período entre chamadas.
- **`enabled`** — quando `false`, o timer é limpo (ex.: sem `companyId` / `supplierId`).
- **`pauseWhenHidden`** — se `true`, não dispara o callback enquanto `document.hidden` (aba em segundo plano). **Padrão: `false`** — polling segue a cada 60s mesmo em segundo plano.
- **`refreshOnVisible`** — se `true`, dispara refresh imediato ao voltar para a aba. **Padrão: `false`** (evita picos de chamadas ao alternar janelas).

O componente `LastUpdated` (`components/ui/last-updated.tsx`) mostra **“Atualizado às HH:mm:ss”** usando `formatDateTimeBR` e um ícone `RefreshCw` com `animate-spin` enquanto `isRefreshing` é verdadeiro.

Nas listagens, o padrão é:

1. **`loadData(silent)`** — com `silent === true`, não liga o loading global da página (sem spinner de carregamento inicial).
2. **`refresh`** — envolve `loadData(true)` com `setIsRefreshing(true/false)` e atualiza `lastUpdated`.
3. **`useAutoRefresh({ onRefresh: refresh, ... })`** — nunca `setInterval` solto na página.

## Telas com atualização automática

| Tela | Rota | Intervalo | O que atualiza |
|------|------|-----------|----------------|
| Pedidos (fornecedor) | `/fornecedor/pedidos` | 60s | Lista e métricas de pedidos do fornecedor |
| Cotações (fornecedor) | `/fornecedor/cotacoes` | 60s | Convites, métricas e tabela de cotações |
| Equalização | `/comprador/cotacoes/[id]/equalizacao` | 60s | Propostas e itens de proposta; refresh completo se mudar contagem de itens ou fornecedores |
| Aprovações | `/comprador/aprovacoes` | 60s | Requisições e pedidos pendentes de aprovação |
| Pedidos (comprador) | `/comprador/pedidos` | 60s | Lista de pedidos e totais derivados |
| Solicitante (lista) | `/solicitante` | 60s | Listagem de requisições |
| Solicitante (detalhe) | `/solicitante/[id]` | 60s | Dados e histórico da requisição |

## Telas sem polling automático

| Tela | Rota | Comportamento |
|------|------|----------------|
| Contratos (comprador) | `/comprador/contratos`, `/comprador/contratos/[id]` | Carrega ao abrir; sem auto-refresh |
| Contratos (fornecedor) | `/fornecedor/contratos`, `/fornecedor/contratos/[id]` | Carrega ao abrir; sem auto-refresh |

## Comportamento

- Atualização **silenciosa** nas listagens: sem reativar o estado de “loading” da página quando `silent` é usado (evita piscar o layout).
- Indicador **“Atualizado às HH:mm:ss”** no cabeçalho, alinhado ao título quando aplicável.
- **Polling contínuo** a cada 60s, inclusive com a aba em segundo plano (`pauseWhenHidden: false` por padrão).
- **Sem refresh imediato** ao retornar à aba (padrão `refreshOnVisible: false`).
- Timer **removido no unmount** do componente (`clearInterval` no cleanup do `useEffect`), sem vazamento óbvio de intervalo.

## Tarefas em background

| Mecanismo | Quando roda |
|-----------|-------------|
| **Proxy** | Ao navegar no portal, no cooldown `background_tasks_cooldown_minutes` (padrão 15 min) — rodadas vencidas, contratos, retry ERP |
| **Equalização (negociação IA)** | Com painel autônomo aberto — `useAutoRefresh` → `negotiation-runs/[id]/tick` |
| **Cron externo** | ⚠️ **Desativado** — ver `docs/BACKLOG-PRODUCAO.md` |

O endpoint `POST /api/cron/background-jobs` continua disponível para **GitHub Actions** ou **Vercel Pro**, mas **não** é chamado pelo proxy nem pelo Vercel Cron no Hobby.

### Variáveis de ambiente (produção)

| Variável | Uso |
|----------|-----|
| `CRON_SECRET` | `Authorization: Bearer …` nas invocações de cron |
| `CONTRACT_MAINTENANCE_SECRET` | Alternativa (`x-maintenance-key`) — GitHub Actions, cron-job.org, proxy |

### Sem Vercel Cron Pro

| Opção | Esforço | Intervalo |
|-------|---------|-----------|
| **[cron-job.org](https://cron-job.org)** (ou similar) | ~5 min: cadastrar URL `POST …/api/cron/background-jobs` + header | 1–5 min (grátis) |
| **GitHub Actions** | Workflow `.github/workflows/background-jobs-cron.yml` + secrets `APP_URL` + `CRON_SECRET` | ~5 min (grátis) |
| **Vercel Cron** | Requer **Vercel Pro** + recriar `vercel.json` | Ver backlog |

⚠️ **Negociação IA 24/7:** obrigatório um dos cron externos ou Vercel Pro — ver `docs/BACKLOG-PRODUCAO.md`.

Em **dev local**, sem secrets: `Invoke-WebRequest -Method POST http://localhost:3000/api/cron/background-jobs`

## Como adicionar em novas telas

1. Importar `useAutoRefresh` e `LastUpdated`.
2. Criar estado `lastUpdated: Date | null` e `isRefreshing: boolean`.
3. Extrair o fetch para uma função **`useCallback`**, com parâmetro opcional **`silent`**:
   - Se `!silent`, chame `setLoading(true)` antes do fetch e `setLoading(false)` depois.
   - Se `silent`, não altere o loading global; apenas atualize os dados e `setLastUpdated(new Date())` ao concluir com sucesso.
4. Criar **`refresh = useCallback(async () => { setIsRefreshing(true); try { await load(true); } finally { setIsRefreshing(false); } }, [load])`** (ajuste nomes).
5. No **`useEffect` de montagem**, chame `load(false)` e defina `lastUpdated` após sucesso (ou dentro de `load`).
6. Registrar **`useAutoRefresh({ intervalMs: 60_000, onRefresh: refresh, enabled: ... })`** com `enabled` coerente (ex.: só quando há `companyId`).
7. Renderizar **`<LastUpdated timestamp={lastUpdated} isRefreshing={isRefreshing} />`** no cabeçalho.

**Importante:** mantenha `onRefresh` estável com `useCallback` e dependências corretas para o intervalo não ser recriado sem necessidade.

Para telas com **estado de UI frágil** (como equalização), prefira um refresh **parcial** dos dados e só faça reload completo quando a estrutura mudar (ex.: número de itens ou fornecedores).

Para telas de **cadastro/consulta** com baixa urgência de tempo real (ex.: contratos), prefira **apenas carga inicial** sem `useAutoRefresh`.

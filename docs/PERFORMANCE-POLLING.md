# Polling e performance — diretrizes

## Princípio

**Poll leve** atualiza só o que muda com frequência (propostas, status). **Dados pesados ou estáveis** (contratos, match de saldo, relatórios) carregam no refresh completo ou na ação do usuário.

## Onde há `useAutoRefresh` (comprador)

| Tela | Intervalo | O que atualiza |
|------|-----------|----------------|
| Equalização | `polling_interval_seconds` (tenant) | Propostas via `refreshProposalsLight` — **sem** `contract-matches` |
| Pedidos | idem | Lista de pedidos |
| Aprovações | idem | Fila de aprovações |
| Negociação IA (painel) | `ai_negotiation_autonomous_poll_minutes` | Tick do motor + `negotiation-plans` (só modo autônomo) |

## Equalização — `contract-matches`

- **Antes:** POST a cada poll porque `proposals` mudava de referência.
- **Agora:** POST apenas quando:
  1. `fetchEqualizationData` completa (carga inicial, ações do motor, fim de rodada, etc.)
  2. Usuário troca de rodada no seletor
  3. Ao criar pedido (fluxo existente no botão)
- Preview de ícone de contrato na grade usa o mapa em cache entre polls.

## Boas práticas ao adicionar efeitos

1. Não colocar arrays/objetos derivados de poll como dependência direta de `useEffect` que chama API — usar **geração de refresh** ou **assinatura estável** (`contractMatchSelectionsSignature`).
2. Preferir `refreshProposalsLight` (contagens + propostas) em vez de `fetchEqualizationData` no poll.
3. APIs que leem contratos/catálogo completo: cache por request ou carregar sob demanda.
4. `pauseWhenHidden: true` no `useAutoRefresh` (padrão) — já reduz carga com aba em background.

## Próximas otimizações (backlog)

- Cache server-side em `contract-matches` por `(companyId, supplierIds hash)` com TTL curto
- Revisar `negotiation-plans` GET no painel — evitar reload completo quando tick retorna "nenhuma ação"
- Auditoria de selects `*, proposal_items(*)` — projetar colunas necessárias

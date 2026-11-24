/**
 * Rotas representativas para baseline / medição pós-refatoração (VALORE).
 * Credenciais: e2e/helpers/test-env.ts (Empresa Teste).
 */
export type PerfRoute = {
  id: string
  path: string
  /** Seletor que indica “dados principais” visíveis (não só shell/loading). */
  readySelector: string
  /** Navegação pelo menu (texto do link na sidebar). null = só cold load. */
  menuLabel: string | null
  portal: "comprador" | "fornecedor"
}

export const PERF_ROUTES: PerfRoute[] = [
  {
    id: "dashboard",
    path: "/comprador",
    readySelector: "main h1, main h2, [data-perf-ready]",
    menuLabel: "Dashboard",
    portal: "comprador",
  },
  {
    id: "requisicoes",
    path: "/comprador/requisicoes",
    readySelector: "main table, main h1",
    menuLabel: "Requisições",
    portal: "comprador",
  },
  {
    id: "cotacoes",
    path: "/comprador/cotacoes",
    readySelector: "main table, main h1",
    menuLabel: "Cotações",
    portal: "comprador",
  },
  {
    id: "pedidos",
    path: "/comprador/pedidos",
    readySelector: "main table, main h1",
    menuLabel: "Pedidos",
    portal: "comprador",
  },
  {
    id: "contratos",
    path: "/comprador/contratos",
    readySelector: "main table, main h1",
    menuLabel: "Contratos",
    portal: "comprador",
  },
  {
    id: "fornecedores",
    path: "/comprador/fornecedores",
    readySelector: "main table, main h1",
    menuLabel: "Fornecedores",
    portal: "comprador",
  },
  {
    id: "itens",
    path: "/comprador/itens",
    readySelector: "main table, main h1",
    menuLabel: "Itens",
    portal: "comprador",
  },
  {
    id: "aprovacoes",
    path: "/comprador/aprovacoes",
    readySelector: "main h1, main table",
    menuLabel: "Aprovações",
    portal: "comprador",
  },
  {
    id: "catalogo",
    path: "/comprador/catalogo",
    readySelector: "main h1",
    menuLabel: "Catálogo",
    portal: "comprador",
  },
  {
    id: "relatorios",
    path: "/comprador/relatorios",
    readySelector: "main h1",
    menuLabel: "Relatórios",
    portal: "comprador",
  },
  {
    id: "pedido-detalhe",
    path: `/comprador/pedidos/${process.env.PERF_ORDER_ID ?? "cc46631f-fa0d-4846-ad11-105d9269972c"}`,
    readySelector: "main h1, main h2",
    menuLabel: null,
    portal: "comprador",
  },
  {
    id: "equalizacao",
    path: `/comprador/cotacoes/${process.env.PERF_QUOTATION_ID ?? "3c1a465b-f4d4-461e-a0b5-ab7609d6480d"}/equalizacao`,
    readySelector: "main h1, main table",
    menuLabel: null,
    portal: "comprador",
  },
]

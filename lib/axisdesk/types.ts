/** Status possíveis de um chamado no AxisDesk */
export type AxisDeskChamadoStatus =
  | "aberto"
  | "em_atendimento"
  | "pendente_usuario"
  | "validacao_usuario"
  | "pendente_publicacao"
  | "concluido"
  | "reprovado"
  | "cancelado"

export type AxisDeskChamadoTipo = "incidente" | "melhoria"

export type AxisDeskChamadoPrioridade = "baixa" | "media" | "alta" | "critica"

export type AxisDeskChamadoAcao =
  | "usuario_respondeu"
  | "usuario_aprovou"
  | "usuario_reprovou"
  | "usuario_cancelou"
  | "usuario_reenviou"

export type AxisDeskAnexo = {
  nome_arquivo: string
  tipo_mime: string
  conteudo_base64: string
}

export type AxisDeskSolicitante = {
  id_externo?: string
  nome: string
  email: string
}

export type AxisDeskSubcategoria = {
  id: string
  nome: string
}

export type AxisDeskCategoria = {
  id: string
  tipo: AxisDeskChamadoTipo
  nome: string
  subcategorias: AxisDeskSubcategoria[]
}

export type AxisDeskCreateTicketPayload = {
  tenant_id_externo: string
  nome_empresa: string
  solicitante: {
    id_externo: string
    nome: string
    email: string
  }
  tipo: AxisDeskChamadoTipo
  titulo: string
  descricao: string
  contexto_origem?: string
  prioridade?: AxisDeskChamadoPrioridade
  categoria_id?: string
  subcategoria_id?: string
  anexos?: AxisDeskAnexo[]
}

export type AxisDeskExecuteActionPayload = {
  acao: AxisDeskChamadoAcao
  mensagem?: string
  anexos?: AxisDeskAnexo[]
}

export type AxisDeskCategoriaRef = {
  id: string
  nome: string
}

export type AxisDeskComentario = {
  id?: string
  autor_tipo: string
  autor_nome: string
  mensagem: string
  created_at: string
}

export type AxisDeskAnexoDetalhe = {
  id?: string
  nome_arquivo: string
  tamanho?: number | null
  tamanho_bytes?: number | null
  url: string
  autor_nome?: string | null
  created_at: string
}

export type AxisDeskHistoricoEntry = {
  id?: string
  campo_alterado: string
  valor_anterior: string | null
  valor_novo: string | null
  alterado_por: string
  created_at?: string
  data?: string
}

export type AxisDeskChamado = {
  id: string
  tenant_id_externo: string
  tipo: AxisDeskChamadoTipo
  titulo: string
  descricao: string
  status: AxisDeskChamadoStatus
  prioridade: AxisDeskChamadoPrioridade
  contexto_origem?: string | null
  sla_prazo?: string | null
  created_at: string
  updated_at?: string | null
  solicitante?: {
    nome: string
    email: string
  }
  categoria?: AxisDeskCategoriaRef | null
  subcategoria?: AxisDeskCategoriaRef | null
}

export type AxisDeskChamadoDetalhe = AxisDeskChamado & {
  comentarios?: AxisDeskComentario[]
  anexos?: AxisDeskAnexoDetalhe[]
  historico?: AxisDeskHistoricoEntry[]
}

export type AxisDeskActivityItem =
  | {
      kind: "comment"
      id: string
      createdAt: string
      autorTipo: string
      autorNome: string
      mensagem: string
    }
  | {
      kind: "attachment"
      id: string
      createdAt: string
      nomeArquivo: string
      tamanho: number | null
      url: string
      autorNome: string | null
    }

export type AxisDeskClientError = {
  ok: false
  status: number
  message: string
}

export type AxisDeskClientResult<T> =
  | { ok: true; data: T }
  | AxisDeskClientError

export const AXISDESK_STATUS_OPTIONS: {
  value: AxisDeskChamadoStatus
  label: string
}[] = [
  { value: "aberto", label: "Aberto" },
  { value: "em_atendimento", label: "Em atendimento" },
  { value: "pendente_usuario", label: "Pendente usuário" },
  { value: "validacao_usuario", label: "Aguardando validação" },
  { value: "pendente_publicacao", label: "Pendente publicação" },
  { value: "concluido", label: "Concluído" },
  { value: "reprovado", label: "Reprovado" },
  { value: "cancelado", label: "Cancelado" },
]

export const AXISDESK_PRIORIDADE_OPTIONS: {
  value: AxisDeskChamadoPrioridade
  label: string
}[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
]

export const AXISDESK_TIPO_OPTIONS: {
  value: AxisDeskChamadoTipo
  label: string
}[] = [
  { value: "incidente", label: "Incidente" },
  { value: "melhoria", label: "Melhoria" },
]

export function getAxisDeskStatusLabel(status: AxisDeskChamadoStatus): string {
  return (
    AXISDESK_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
  )
}

export function getAxisDeskPrioridadeLabel(
  prioridade: AxisDeskChamadoPrioridade,
): string {
  return (
    AXISDESK_PRIORIDADE_OPTIONS.find((o) => o.value === prioridade)?.label ??
    prioridade
  )
}

export function formatAxisDeskFileSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes) || bytes < 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function buildAxisDeskActivityFeed(
  comentarios: AxisDeskComentario[] = [],
  anexos: AxisDeskAnexoDetalhe[] = [],
): AxisDeskActivityItem[] {
  const items: AxisDeskActivityItem[] = [
    ...comentarios.map((c, index) => ({
      kind: "comment" as const,
      id: c.id ?? `comment-${index}-${c.created_at}`,
      createdAt: c.created_at,
      autorTipo: c.autor_tipo,
      autorNome: c.autor_nome,
      mensagem: c.mensagem,
    })),
    ...anexos.map((a, index) => ({
      kind: "attachment" as const,
      id: a.id ?? `attachment-${index}-${a.created_at}`,
      createdAt: a.created_at,
      nomeArquivo: a.nome_arquivo,
      tamanho: a.tamanho_bytes ?? a.tamanho ?? null,
      url: a.url,
      autorNome: a.autor_nome ?? null,
    })),
  ]

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function getHistoricoEntryDate(entry: AxisDeskHistoricoEntry): string {
  return entry.created_at ?? entry.data ?? ""
}

export function sortHistoricoDesc(
  historico: AxisDeskHistoricoEntry[] = [],
): AxisDeskHistoricoEntry[] {
  return [...historico].sort(
    (a, b) =>
      new Date(getHistoricoEntryDate(b)).getTime() -
      new Date(getHistoricoEntryDate(a)).getTime(),
  )
}

export function formatHistoricoValue(
  campo: string,
  valor: string | null,
): string {
  if (!valor) return "—"
  if (campo === "status") {
    return getAxisDeskStatusLabel(valor as AxisDeskChamadoStatus)
  }
  return valor
}

export function getAxisDeskStatusVariant(
  status: AxisDeskChamadoStatus,
): "default" | "success" | "warning" | "destructive" | "info" | "muted" {
  switch (status) {
    case "concluido":
      return "success"
    case "reprovado":
    case "cancelado":
      return "destructive"
    case "pendente_usuario":
    case "validacao_usuario":
      return "warning"
    case "em_atendimento":
    case "pendente_publicacao":
      return "info"
    case "aberto":
    default:
      return "muted"
  }
}

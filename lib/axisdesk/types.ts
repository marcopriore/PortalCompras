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
  anexos?: AxisDeskAnexo[]
}

export type AxisDeskExecuteActionPayload = {
  acao: AxisDeskChamadoAcao
  mensagem?: string
  anexos?: AxisDeskAnexo[]
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

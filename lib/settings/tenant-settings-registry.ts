import type { FeatureKey } from "@/lib/hooks/usePermissions"

export type TenantSettingGroup =
  | "sistema"
  | "negocios"
  | "contratos"
  | "ia"
  | "fornecedores"

export type TenantSettingKey =
  | "polling_interval_seconds"
  | "background_tasks_cooldown_minutes"
  | "numeric_quantity_max_digits"
  | "numeric_price_decimal_places"
  | "contract_low_balance_threshold_pct"
  | "contract_expiring_alert_days"
  | "ai_spend_cache_minutes"
  | "ai_negotiation_cache_minutes"
  | "ai_negotiation_autonomous_poll_minutes"
  | "score_weight_price"

export type TenantSettingDefinition = {
  key: TenantSettingKey
  label: string
  description: string
  group: TenantSettingGroup
  defaultValue: number
  min: number
  max: number
  unit?: string
  /** Editável apenas pelo superadmin na aba Configurações do tenant */
  superadminOnly: true
  requiresFeature?: FeatureKey
}

export const TENANT_SETTING_GROUPS: Record<
  TenantSettingGroup,
  { label: string; description: string }
> = {
  sistema: {
    label: "Sistema",
    description:
      "Performance e atualização automática das telas com polling.",
  },
  negocios: {
    label: "Negócios",
    description:
      "Limites numéricos, classificação contábil, POR e integração ERP do tenant.",
  },
  contratos: {
    label: "Contratos",
    description: "Alertas e limites do módulo de contratos.",
  },
  ia: {
    label: "Inteligência Artificial",
    description: "Cache e comportamento das análises por IA.",
  },
  fornecedores: {
    label: "Fornecedores",
    description: "Parâmetros do score e indicadores de fornecedores.",
  },
}

export const TENANT_SETTINGS_REGISTRY: TenantSettingDefinition[] = [
  {
    key: "polling_interval_seconds",
    label: "Intervalo de atualização automática",
    description:
      "Tempo em segundos entre atualizações silenciosas em listagens e telas com polling. Contratos não usam auto-refresh.",
    group: "sistema",
    defaultValue: 60,
    min: 15,
    max: 300,
    unit: "s",
    superadminOnly: true,
  },
  {
    key: "background_tasks_cooldown_minutes",
    label: "Intervalo de tarefas em background",
    description:
      "Minutos entre execuções automáticas no servidor: fechar rodadas vencidas, expirar contratos e notificações agendadas. Evita sobrecarga; não afeta polling das telas.",
    group: "sistema",
    defaultValue: 15,
    min: 5,
    max: 120,
    unit: "min",
    superadminOnly: true,
  },
  {
    key: "numeric_quantity_max_digits",
    label: "Dígitos máximos — quantidade",
    description:
      "Quantidade máxima de dígitos permitidos em campos de quantidade (ex.: 6 = até 999.999).",
    group: "negocios",
    defaultValue: 7,
    min: 1,
    max: 9,
    unit: "dígitos",
    superadminOnly: true,
  },
  {
    key: "numeric_price_decimal_places",
    label: "Casas decimais — preço/valor",
    description:
      "Quantidade máxima de casas decimais em campos de valor e preço unitário.",
    group: "negocios",
    defaultValue: 5,
    min: 0,
    max: 8,
    unit: "casas",
    superadminOnly: true,
  },
  {
    key: "contract_low_balance_threshold_pct",
    label: "Limiar de saldo baixo",
    description:
      "Percentual mínimo de saldo restante antes de notificar compradores.",
    group: "contratos",
    defaultValue: 20,
    min: 1,
    max: 50,
    unit: "%",
    superadminOnly: true,
    requiresFeature: "contracts",
  },
  {
    key: "contract_expiring_alert_days",
    label: "Aviso de vencimento",
    description:
      "Quantidade de dias antes do fim da vigência para alertar sobre contratos ativos.",
    group: "contratos",
    defaultValue: 30,
    min: 7,
    max: 90,
    unit: "dias",
    superadminOnly: true,
    requiresFeature: "contracts",
  },
  {
    key: "ai_spend_cache_minutes",
    label: "Cache da análise de spend (IA)",
    description: "Tempo em minutos para reutilizar a última análise de spend no dashboard.",
    group: "ia",
    defaultValue: 60,
    min: 5,
    max: 240,
    unit: "min",
    superadminOnly: true,
    requiresFeature: "ai_analytics",
  },
  {
    key: "ai_negotiation_cache_minutes",
    label: "Cache da negociação (IA)",
    description:
      "Tempo em minutos para reutilizar a análise de negociação na equalização.",
    group: "ia",
    defaultValue: 30,
    min: 5,
    max: 120,
    unit: "min",
    superadminOnly: true,
    requiresFeature: "ai_negotiation",
  },
  {
    key: "ai_negotiation_autonomous_poll_minutes",
    label: "Polling negociação IA autônoma",
    description:
      "Intervalo em minutos para o motor verificar prazos e respostas automaticamente (modo sem aprovação por rodada).",
    group: "ia",
    defaultValue: 30,
    min: 1,
    max: 120,
    unit: "min",
    superadminOnly: true,
    requiresFeature: "ai_negotiation_autonomous",
  },
  {
    key: "score_weight_price",
    label: "Peso do critério Preço no score",
    description:
      "Percentual do score de fornecedor atribuído ao componente de preço (o restante é distribuído nos demais critérios).",
    group: "fornecedores",
    defaultValue: 40,
    min: 10,
    max: 80,
    unit: "%",
    superadminOnly: true,
  },
]

const REGISTRY_BY_KEY = new Map(
  TENANT_SETTINGS_REGISTRY.map((def) => [def.key, def]),
)

export function getTenantSettingDefinition(
  key: string,
): TenantSettingDefinition | undefined {
  return REGISTRY_BY_KEY.get(key as TenantSettingKey)
}

export function isTenantSettingKey(key: string): key is TenantSettingKey {
  return REGISTRY_BY_KEY.has(key as TenantSettingKey)
}

export function getSuperadminTenantSettingKeys(): TenantSettingKey[] {
  return TENANT_SETTINGS_REGISTRY.filter((d) => d.superadminOnly).map(
    (d) => d.key,
  )
}

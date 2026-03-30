# \# Valore — Portal de Compras

# \## Memória persistente do projeto · Lida automaticamente a cada sessão

# 

# \---

# 

# \## STACK

# \- Next.js 16 App Router · TypeScript · Tailwind CSS · shadcn/ui

# \- Supabase (PostgreSQL + RLS + Auth)

# \- Repositório: github.com/marcopriore/PortalCompras

# \- Caminho local: C:\\Dev\\Portal Compras

# \- Versão atual: v2.14.2

# 

# \---

# 

# \## REGRAS CRÍTICAS — NUNCA VIOLAR

# 

# \### Next.js 16

# \- SEMPRE usar `React.use(params)` para desembrulhar params de rota

# \- NUNCA usar `params.id` diretamente (causa warning/erro no Next.js 16)

# 

# \### Supabase

# \- `createClient` SEMPRE de `@/lib/supabase/client` no frontend

# \- `useUser` para obter userId e companyId

# \- `usePermissions` para hasFeature() e hasPermission()

# \- Batch updates SEMPRE com `.in('id', arrayDeIds)` — NUNCA loop individual

# \- INSERT em `proposal\_items` SEMPRE com `round\_id`

# \- INSERT em `quotation\_proposals` em nova rodada com status `'invited'`

# \- `purchase\_orders` criados com status `'draft'`

# 

# \### Qualidade de código

# \- SEMPRE remover imports ao remover componentes

# \- SEMPRE verificar balanceamento JSX após edições grandes

# \- SEMPRE rodar `npx tsc --noEmit` antes de considerar concluído

# \- NUNCA usar cores hardcoded — sempre tokens do design system

# 

# \---

# 

# \## IDENTIDADE VISUAL

# 

# \### Paleta

# | Token | Valor | Uso |

# |-------|-------|-----|

# | Primária | #4F3EF5 (índigo) | Ações principais |

# | Destaque | #00C2FF (elétrico) | Gradientes, destaques |

# | Sidebar | #1a1a2e (noite) | Background sidebar |

# | Lavanda | #f4f3ff | Backgrounds sutis |

# 

# \### Design System

# \- NUNCA cores hardcoded — usar: `bg-background`, `bg-card`, `text-foreground`,

# &#x20; `text-muted-foreground`, `border-border`, `text-primary`, `bg-primary`

# \- Exceção permitida: badges/cards de métrica (bg-blue-50, bg-green-50, etc.)

# \- Exceção permitida: sidebar usa #1a1a2e e branco/opacidade

# 

# \### Padrão de Cards de Métrica

# ```

# <div className="bg-white border border-{color}-100 rounded-xl p-5 flex items-center justify-between">

# &#x20; <div>

# &#x20;   <p className="text-sm text-{color}-600 font-medium">{label}</p>

# &#x20;   <p className="text-3xl font-bold text-{color}-700 mt-1">{valor}</p>

# &#x20; </div>

# &#x20; <div className="bg-{color}-100 p-3 rounded-full">

# &#x20;   <Icon className="w-6 h-6 text-{color}-600" />

# &#x20; </div>

# </div>

# ```

# Container: `grid grid-cols-4 gap-4 mb-6`

# 

# \### Padrão de Layout de Listagem

# 1\. Cabeçalho (título + botão de ação)

# 2\. Cards de métricas (grid 4 colunas)

# 3\. Filtros (`bg-muted/40 border border-border rounded-xl p-4 mb-6`)

# 4\. Tabela/grid de resultados

# 

# \### Padrão de Filtros

# \- Label acima de cada campo

# \- Listas: componente `MultiSelectFilter` (`components/ui/multi-select-filter.tsx`)

# \- Busca texto: input com ícone `Search` + botão `X` para limpar

# \- Larguras fixas (`w-40`, `w-48`) — nunca expandir

# \- Contador "X resultado(s)" + botão "Limpar filtros"

# 

# \---

# 

# \## ARQUITETURA MULTI-TENANT

# \- Shared Database, Shared Schema com `company\_id` em todas as tabelas

# \- RLS ativo em todas as tabelas de negócio

# \- Superadmin: acesso a todos os tenants via seletor no header

# \- Admin do tenant: acesso apenas à própria empresa

# 

# \---

# 

# \## BANCO DE DADOS — TABELAS PRINCIPAIS

# 

# | Tabela | Campos-chave |

# |--------|-------------|

# | profiles | role, roles text\[], profile\_type ('buyer'\\|'supplier'), supplier\_id |

# | suppliers | por tenant |

# | quotations | status: draft/waiting/analysis/completed/cancelled |

# | quotation\_rounds | round\_number, status ('active'\\|'closed'), response\_deadline |

# | quotation\_proposals | round\_id FK quotation\_rounds, status: invited/submitted/selected/rejected |

# | proposal\_items | round\_id FK quotation\_rounds (OBRIGATÓRIO) |

# | requisitions | status: pending/approved/rejected/in\_quotation/completed |

# | purchase\_orders | status: draft/processing/sent/error/completed |

# | approval\_levels | flow ('requisition'\\|'order'), cost\_center, category |

# | approval\_requests | flow, entity\_id, approver\_id, status: pending/approved/rejected |

# | tenant\_features | feature\_keys liberados por tenant |

# | role\_permissions | permission\_keys por role |

# 

# \---

# 

# \## ROLES E PERMISSÕES

# \- Roles disponíveis: `admin`, `buyer`, `manager`, `approver\_requisition`, `approver\_order`, `requester`, `supplier`

# \- `profile\_type`: `'buyer'` | `'supplier'` — determina qual portal o usuário acessa

# \- Portal do comprador: `/comprador/\*\*`

# \- Portal do fornecedor: `/fornecedor/\*\*`

# 

# \---

# 

# \## SEEDS DE TESTE

# \- Empresa Teste: `00000000-0000-0000-0000-000000000001`

# \- Usuário teste (buyer): `c3cff1ca-1c4b-4f59-bc48-686b0ac1d4a7` (teste@procuremax.com.br)

# \- Cotação referência: `aaaaaaaa-0000-0000-0000-000000000001` (COT-2026-0026)

# \- Cotação ativa: `3c1a465b-f4d4-461e-a0b5-ab7609d6480d` (COT-2026-0036)

# 

# \---

# 

# \## VERSIONAMENTO GIT

# ```

# cd "C:\\Dev\\Portal Compras"

# git add .

# git commit -m "feat: descrição"

# git tag vX.X.X

# git push origin main

# git push origin vX.X.X

# ```

# 

# \---

# 

# \## STATUS DAS TELAS

# | Rota | Status |

# |------|--------|

# | /comprador | ⚠️ cards mockados |

# | /comprador/requisicoes/\*\* | ✅ |

# | /comprador/aprovacoes | ✅ |

# | /comprador/cotacoes/\*\* | ✅ |

# | /comprador/cotacoes/\[id]/equalizacao | ✅ complexo |

# | /comprador/pedidos | ✅ |

# | /comprador/pedidos/\[id] | ⚠️ visual simples |

# | /comprador/itens | ✅ somente leitura |

# | /comprador/fornecedores | ✅ somente leitura |

# | /comprador/relatorios | ⚠️ parcial mockado |

# | /comprador/configuracoes/\*\* | ✅ |

# | /admin/tenants/\*\* | ✅ |

# | /fornecedor | 🔴 em construção |

# | /fornecedor/cotacoes | 🔴 em construção |

# | /fornecedor/cotacoes/\[id] | 🔴 em construção |


# Integração AxisDesk — referência para sistemas satélites

Este documento descreve como um sistema satélite (Valore, PRO-MAT, TrainHub) se
integra ao AxisDesk: como criar chamados, consultá-los, e receber notificações
de atualização.

## Base URL

```
https://suporte.axisstrategy.com.br
```

## Autenticação

Toda chamada à API do AxisDesk exige o header:

```
x-api-key: <chave própria do sistema satélite>
```

Cada satélite tem sua própria chave (ex.: `API_KEY_VALORE`). A chave já existe
nas variáveis de ambiente do projeto AxisDesk na Vercel — copie o valor real
de lá (Settings → Environment Variables → API_KEY_VALORE) e guarde como uma
env var no projeto do satélite (ex.: `AXISDESK_API_KEY`). Nunca exponha essa
chave no client — toda chamada à API do AxisDesk deve partir do backend do
satélite, nunca do navegador do usuário final.

## Criar um chamado

```
POST /api/chamados
Content-Type: application/json
x-api-key: <chave>
```

Corpo:

```json
{
  "tenant_id_externo": "id do tenant no Valore",
  "nome_empresa": "Nome da empresa (usado só se o tenant ainda não existir no AxisDesk)",
  "solicitante": {
    "id_externo": "id do usuário no Valore",
    "nome": "Nome do usuário",
    "email": "email@usuario.com"
  },
  "tipo": "incidente | melhoria",
  "titulo": "Título curto do chamado",
  "descricao": "Descrição completa",
  "contexto_origem": "Nome da tela/módulo de onde o chamado foi aberto (opcional)",
  "prioridade": "baixa | media | alta | critica (opcional, default: media)",
  "anexos": [
    {
      "nome_arquivo": "print.png",
      "tipo_mime": "image/png",
      "conteudo_base64": "..."
    }
  ]
}
```

Resposta `201`: o chamado criado, incluindo `id` (uuid), `status: "aberto"`,
`sla_prazo` (calculado automaticamente pela prioridade), `created_at`.

Erros: `400` (campo obrigatório ausente/inválido), `401` (chave inválida),
`500` (erro interno — mensagem genérica, sem detalhe de banco).

`anexos` é opcional. Falha no upload de um anexo não derruba a criação do
chamado — ele é criado normalmente e o anexo é apenas ignorado nesse caso.

## Listar chamados de um tenant

```
GET /api/chamados?tenant_id_externo=<id>&status=<opcional>
x-api-key: <chave>
```

`status`, se enviado, filtra por um dos 8 valores da seção abaixo. Sem esse
parâmetro, retorna todos os chamados do tenant.

Resposta `200`: array de chamados, cada um com `solicitante: { nome, email }`
embutido. Tenant sem nenhum chamado retorna `[]` (não é erro).

## Status possíveis

| Valor              | Significado                                                   |
|---------------------|----------------------------------------------------------------|
| `aberto`             | Recebido, ainda não iniciado                                   |
| `em_atendimento`     | Equipe Axis está trabalhando                                   |
| `pendente_usuario`   | Equipe pediu mais informação — aguardando resposta do usuário  |
| `validacao_usuario`  | Equipe resolveu, aguardando o usuário confirmar                |
| `pendente_publicacao`| Usuário aprovou, aguardando deploy da correção                 |
| `concluido`          | Finalizado                                                     |
| `reprovado`          | Chamado ou solução rejeitados (motivo no histórico)             |
| `cancelado`          | Usuário desistiu enquanto estava em `pendente_usuario`          |

## Notificação por webhook (AxisDesk → satélite)

O satélite pode configurar uma URL de webhook em
`suporte.axisstrategy.com.br` → Configurações → Integrações. Quando
configurada, o AxisDesk envia um `POST` para essa URL sempre que:

- o status do chamado muda para `validacao_usuario`, `pendente_usuario`,
  `concluido` ou `reprovado`
- a equipe Axis adiciona um comentário

Payload:

```json
{
  "evento": "status_alterado | comentario",
  "chamado_id": "uuid",
  "tenant_id_externo": "...",
  "solicitante_id_externo": "...",
  "timestamp": "ISO 8601",
  "...dados extras conforme o evento (status_novo, mensagem, motivo, autor)"
}
```

Header de validação: `x-axisdesk-secret`, com o segredo configurado na mesma
tela. Envio é best-effort (timeout de 5s) — se o webhook falhar, o AxisDesk
registra a falha internamente mas não bloqueia nem repete a ação.

## Ações do usuário (responder, aprovar, reprovar, cancelar)

```
POST /api/chamados/<id>/acoes
Content-Type: application/json
x-api-key: <chave>
```

Corpo:

```json
{
  "acao": "usuario_respondeu | usuario_aprovou | usuario_reprovou | usuario_cancelou",
  "mensagem": "opcional — usada como comentário em usuario_respondeu, e como motivo (obrigatório) em usuario_reprovou",
  "anexos": [
    { "nome_arquivo": "print.png", "tipo_mime": "image/png", "conteudo_base64": "..." }
  ]
}
```

Regras de transição (a ação só é aceita se o chamado estiver no status certo):

| Ação                 | Status exigido       | Novo status        |
|-----------------------|------------------------|----------------------|
| `usuario_respondeu`   | `pendente_usuario`     | `em_atendimento`     |
| `usuario_aprovou`     | `validacao_usuario`    | `pendente_publicacao`|
| `usuario_reprovou`    | `validacao_usuario`    | `em_atendimento`     |
| `usuario_cancelou`    | `pendente_usuario`     | `cancelado`          |

Respostas: `200` com o chamado atualizado. `404` se o chamado não existir ou
pertencer a outro sistema satélite. `409` se o chamado não estiver no status
exigido para a ação. `400` se `usuario_reprovou` vier sem `mensagem`.

## Identidade visual

Não é necessário levar a identidade visual do AxisDesk (cores, tipografia)
para a tela do Valore — a tela de Suporte deve seguir o design system já
existente no Valore, para parecer nativa do produto.

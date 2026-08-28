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

| Ação                 | Status exigido                  | Novo status        |
|-----------------------|-----------------------------------|----------------------|
| `usuario_respondeu`   | `pendente_usuario`               | `em_atendimento`     |
| `usuario_aprovou`     | `validacao_usuario`              | `pendente_publicacao`|
| `usuario_reprovou`    | `validacao_usuario`              | `em_atendimento`     |
| `usuario_cancelou`    | `pendente_usuario` ou `reprovado`| `cancelado`          |
| `usuario_reenviou`    | `reprovado`                      | `aberto`             |

`usuario_reenviou` aceita `mensagem` opcional (registrada como comentário) e
`anexos` opcionais — mesmo formato das outras ações. Use-a quando quiser dar
ao usuário a opção de reabrir e reenviar um chamado que a equipe reprovou.

Respostas: `200` com o chamado atualizado. `404` se o chamado não existir ou
pertencer a outro sistema satélite. `409` se o chamado não estiver no status
exigido para a ação. `400` se `usuario_reprovou` vier sem `mensagem`.

## Limites de caracteres

A API impõe limites (retorna `400` se excedidos) — trate-os como obrigatórios
no formulário do satélite, não só como validação de servidor:

- `titulo` (POST /api/chamados): máximo 200 caracteres
- `descricao` (POST /api/chamados): máximo 2000 caracteres
- `mensagem` (POST /api/chamados/<id>/acoes): máximo 2000 caracteres

## Categorias e subcategorias

```
GET /api/categorias?tipo=<opcional: incidente|melhoria>
x-api-key: <chave>
```

Retorna as categorias ativas (com subcategorias ativas aninhadas) do(s) tipo(s)
pedido(s). Sem `tipo`, retorna as duas listas.

```json
[
  {
    "id": "uuid",
    "tipo": "incidente",
    "nome": "Acesso e Login",
    "subcategorias": [{ "id": "uuid", "nome": "Não consegue logar" }]
  }
]
```

Use essas listas para popular selects em cascata (Categoria → Subcategoria) no
formulário de abertura de chamado.

## Categorização ao criar um chamado

O `POST /api/chamados` (seção acima) aceita dois campos opcionais adicionais
no corpo: `categoria_id` e `subcategoria_id` (uuids vindos de `GET
/api/categorias`). Se enviados, são validados contra o `tipo` do chamado —
`400` se a categoria não existir/estiver inativa/for de outro tipo, ou se a
subcategoria não pertencer à categoria enviada. Tornar esses campos
obrigatórios no formulário é uma decisão de cada satélite, não da API.

## Detalhe completo de um chamado

```
GET /api/chamados/<id>?tenant_id_externo=<id>
x-api-key: <chave>
```

Retorna o chamado com todos os campos do `GET /api/chamados` (listagem) mais:
`categoria`/`subcategoria` (id + nome), `comentarios` (cronológico, com
`autor_tipo`, `autor_nome`, `mensagem`, `created_at`), `anexos` (com `url`
assinada, válida por 1h) e `historico` (mudanças de campo, cronológico).
`tenant_id_externo` é obrigatório na query, para reforçar ownership. `404` se
o chamado não existir ou pertencer a outro sistema satélite.

## Identidade visual

Não é necessário levar a identidade visual do AxisDesk (cores, tipografia)
para a tela do Valore — a tela de Suporte deve seguir o design system já
existente no Valore, para parecer nativa do produto.

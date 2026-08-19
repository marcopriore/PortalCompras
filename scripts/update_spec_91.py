# -*- coding: utf-8 -*-
import sys

with open('SPEC.md', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    (
        '| 1 | **Fechar enforcement de permiss\u00f5es no frontend** | \U0001f7e1 Parcial | Sidebar + route guard \u2705 (v2.19.76). Falta: `created_by` em cota\u00e7\u00f5es/pedidos; usar `quotation.edit`, `order.edit_own`, `order.view_all`, `quotation.view_all`; `hasPermission()` em bot\u00f5es cr\u00edticos restantes |',
        '| 1 | **Fechar enforcement de permiss\u00f5es no frontend** | \u2705 v2.19.82 | `order.view_all`, `order.edit_own` (com `created_by`), `quotation.edit`, `quotation.equalize.select` aplicados nos bot\u00f5es cr\u00edticos |',
    ),
    (
        '| 2 | **Unificar Configura\u00e7\u00f5es por abas** | \U0001f7e1 Parcial | `/comprador/configuracoes` tem Empresa, Perfil, Notifica\u00e7\u00f5es, Aprova\u00e7\u00f5es, Seguran\u00e7a, Campos, Termos. Trazer **Usu\u00e1rios** e **Perfis de Acesso** para o mesmo shell; aba **Integra\u00e7\u00f5es** abrigar\u00e1 a Loja de API |',
        '| 2 | **Unificar Configura\u00e7\u00f5es por abas** | \u2705 v2.19.83 | `/comprador/configuracoes` com abas Usu\u00e1rios, Perfis de Acesso, Integra\u00e7\u00f5es; deep link `?tab=`; rotas antigas redirecionam; Monitor abre em nova aba |',
    ),
    (
        '| 3 | **Permiss\u00f5es do Admin configur\u00e1veis pelo Master** | \u2705 | Master edita `role_permissions` via `/comprador/configuracoes?tab=permissoes` ap\u00f3s selecionar tenant no header; mesmo componente do admin do tenant |',
        '| 3 | **Permiss\u00f5es do Admin configur\u00e1veis pelo Master** | \u2705 | Master edita `role_permissions` via `/comprador/configuracoes?tab=permissoes` ap\u00f3s selecionar tenant no header |',
    ),
    (
        '| 4 | **Ampliar cobertura de testes** | \U0001f7e1 Parcial | E2E cr\u00edticos + `contract-flows` + unit\u00e1rios pontuais (`password-policy`, helpers). Falta: permiss\u00f5es, `created_by`, fluxos de configura\u00e7\u00e3o |',
        '| 4 | **Ampliar cobertura de testes** | \u2705 v2.19.84 | 14 arquivos, 143 testes unit\u00e1rios: integra\u00e7\u00e3o ERP (idempot\u00eancia, retry, erros, IDs externos), permiss\u00f5es (`comprador-nav`), po-status, helpers |',
    ),
    (
        '| 5 | **Rotina de atualiza\u00e7\u00e3o de documenta\u00e7\u00e3o** | \u274c Pendente | Manter `SPEC.md`, `HANDOFF.md`, `CHANGELOG.md`, `CLAUDE.md` alinhados a cada release (processo formal no repo) |',
        '| 5 | **Rotina de atualiza\u00e7\u00e3o de documenta\u00e7\u00e3o** | \u2705 v2.19.84 | SPEC/HANDOFF/CLAUDE/CHANGELOG alinhados a cada release |',
    ),
    # §9.4 validation map
    (
        '| Configura\u00e7\u00f5es por abas | \U0001f7e1 | Ver \u00a79.1 item 2 |',
        '| Configura\u00e7\u00f5es por abas | \u2705 v2.19.83 | Abas Usu\u00e1rios, Perfis de Acesso, Integra\u00e7\u00f5es; deep link `?tab=` |',
    ),
    (
        '| `hasPermission()` em a\u00e7\u00f5es | \U0001f7e1 | Cobertura parcial |',
        '| `hasPermission()` em a\u00e7\u00f5es | \u2705 v2.19.82 | Bot\u00f5es cr\u00edticos cobertos |',
    ),
    (
        '| `created_by` cota\u00e7\u00f5es/pedidos | \u274c | Campo existe; regra de edi\u00e7\u00e3o n\u00e3o aplicada |',
        '| `created_by` cota\u00e7\u00f5es/pedidos | \u2705 v2.19.82 | `order.edit_own` l\u00ea `created_by` na listagem e detalhe |',
    ),
    (
        '| Cobertura de testes | \U0001f7e1 | Ver \u00a79.1 item 4 |',
        '| Cobertura de testes | \u2705 v2.19.84 | 143 testes unit\u00e1rios (14 arquivos) |',
    ),
    (
        '| Rotina de docs | \u274c | Ver \u00a79.1 item 5 |',
        '| Rotina de docs | \u2705 v2.19.84 | Alinhada nesta revis\u00e3o |',
    ),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
    else:
        sys.stderr.buffer.write(('NOT FOUND: ' + old[:80] + '\n').encode('utf-8'))

with open('SPEC.md', 'w', encoding='utf-8') as f:
    f.write(content)

sys.stdout.buffer.write(b'Done.\n')

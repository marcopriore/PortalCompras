# Postman — Valore API v1

## Importar

1. Abra o **Postman** (desktop ou web).
2. **Import** → arraste ou selecione:
   - `Valore-API-v1.postman_collection.json`
   - `Valore-Local.postman_environment.json`
3. No canto superior direito, selecione o environment **Valore — Local**.

## Configurar

1. Com o dev server rodando: `npm run dev`
2. Edite o environment **Valore — Local** (ícone de olho → Edit):
   - `api_key` → chave gerada com `npm run api-key:create`
   - `item_code` / `supplier_code` → códigos reais do tenant (ajuste após listar)
3. A collection usa **Bearer Token** herdado da pasta raiz (`{{api_key}}`).

## Ordem sugerida de testes

1. **Health → GET Health** — deve retornar `200` com `scopes`
2. **Itens → GET Listar itens** — copie um `code` da resposta para `item_code`
3. **Itens → GET Item por código**
4. **Fornecedores → GET Listar fornecedores**
5. **Fornecedores → GET Fornecedor por código**

## Erros comuns

| Status | Causa |
|--------|--------|
| 401 | `api_key` inválida, expirada ou feature `api_integrations` desligada |
| 403 | Escopo ausente (ex.: listar itens sem `items:read`) ou módulo `items`/`suppliers` off no tenant |
| 404 | `code` inexistente no tenant da chave |
| Connection refused | `npm run dev` não está rodando |

## Autenticação alternativa

Na aba **Authorization** de uma request, em vez de Bearer, use **API Key**:
- Key: `X-Api-Key`
- Value: `{{api_key}}`
- Add to: **Header**

## Nova chave

```powershell
cd "C:\Dev\Portal Compras"
npm run api-key:create
```

Copie a chave exibida **uma vez** para o environment do Postman.

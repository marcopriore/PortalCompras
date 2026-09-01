# Roteiro de demonstração comercial — Valore Portal de Compras

**Tenant demo:** Apresentação POC  
**Público:** misto (negócio + TI)  
**Duração sugerida:** 45–60 minutos

## Abertura (5 min)

- Problema: compras fragmentadas, pouca visibilidade de saving, fornecedor fora do loop digital.
- Proposta Valore: uma plataforma, três portais, fluxo integrado até o ERP.

## 1. Comprador — visão executiva (8 min)

| Ordem | Tela | O que destacar |
|-------|------|----------------|
| 1 | `/comprador` | Dashboard, ROI/Saving, widgets por permissão |
| 2 | `/comprador/relatorios` | BI: saving, spend, exports Excel |

**Mensagem:** decisão com dados, não só operação.

## 2. Demanda interna (8 min)

| Ordem | Tela | O que destacar |
|-------|------|----------------|
| 3 | `/solicitante` | Autonomia do requisitante, timeline, status |
| 4 | `/comprador/requisicoes` | Visão do comprador sobre a mesma demanda |
| 5 | `/comprador/aprovacoes` | Alçadas, fila, notificações |

**Mensagem:** governança sem travar a operação.

## 3. Sourcing (12 min)

| Ordem | Tela | O que destacar |
|-------|------|----------------|
| 6 | `/comprador/cotacoes` | Convites, rodadas, status |
| 7 | Detalhe + equalização | Benchmark, saving, score fornecedor, IA (se habilitada) |
| 8 | `/comprador/fornecedores` | Cadastro, categorias, histórico |

**Mensagem:** competição transparente e decisão baseada em critérios objetivos.

## 4. Execução e contratos (10 min)

| Ordem | Tela | O que destacar |
|-------|------|----------------|
| 9 | `/comprador/pedidos` | Status, PDF, integração ERP |
| 10 | `/comprador/contratos` | Saldo, aceite, **Disponibilizar para Catálogo** |
| 11 | `/comprador/catalogo` | Carrinho, checkout REQ+PO, filtro por contrato |

**Mensagem:** do acordo comercial à compra recorrente no self-service.

## 5. Fornecedor (7 min)

| Ordem | Tela | O que destacar |
|-------|------|----------------|
| 12 | `/fornecedor` | Dashboard |
| 13 | `/fornecedor/cotacoes` | Proposta, wizard Excel |
| 14 | `/fornecedor/pedidos` | Aceite, termos, data de entrega |

**Mensagem:** parceiro no mesmo ecossistema digital.

## 6. TI / Admin (5 min)

| Ordem | Tela | O que destacar |
|-------|------|----------------|
| 15 | `/admin/tenants` | Multi-tenant, features |
| 16 | `/comprador/integracoes/monitor` ou `/admin/integracoes` | API Store, logs, reenvio |
| 17 | `/comprador/suporte` | AxisDesk integrado |

**Mensagem:** escala SaaS, integração e suporte sem sair do portal.

## Encerramento (5 min)

- Benefícios: lead time, saving, auditoria, ERP.
- Próximos passos: discovery → piloto → go-live por módulos.

## Gerar materiais

```powershell
# 1. Capturar prints (credenciais via env — não commitar)
$env:COMMERCIAL_BASE_URL="https://app.axisstrategy.com.br"
$env:COMMERCIAL_BUYER_EMAIL="..."
$env:COMMERCIAL_BUYER_PASSWORD="..."
$env:COMMERCIAL_SUPPLIER_EMAIL="..."
$env:COMMERCIAL_SUPPLIER_PASSWORD="..."
$env:COMMERCIAL_ADMIN_EMAIL="..."
$env:COMMERCIAL_ADMIN_PASSWORD="..."
node scripts/capture-commercial-screenshots.mjs

# 2. Gerar PPT
npm install --save-dev pptxgenjs
node scripts/generate-commercial-ppt.mjs
```

Arquivo final: `docs/apresentacao-comercial/Valore-Portal-Compras-Apresentacao-Comercial.pptx`

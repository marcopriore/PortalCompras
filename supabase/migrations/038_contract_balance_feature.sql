-- Migration 038: feature premium contract_balance (consumo de saldo via pedido)

INSERT INTO tenant_features (company_id, feature_key, enabled)
VALUES ('00000000-0000-0000-0000-000000000001', 'contract_balance', true)
ON CONFLICT (company_id, feature_key) DO NOTHING;

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS documents_contract_id_idx ON documents(contract_id);
CREATE INDEX IF NOT EXISTS contracts_created_at_idx ON contracts(created_at DESC);
CREATE INDEX IF NOT EXISTS contract_relationships_a_idx ON contract_relationships(contract_a_id);
CREATE INDEX IF NOT EXISTS contract_relationships_b_idx ON contract_relationships(contract_b_id);

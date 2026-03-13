-- ══════════════════════════════════════════════
--  AutoEstoque · schema.sql
--  Cole este arquivo inteiro no SQL Editor do Supabase
--  e clique em "Run"
-- ══════════════════════════════════════════════

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUMS ─────────────────────────────────────
CREATE TYPE veiculo_status AS ENUM (
  'disponivel', 'reservado', 'vendido', 'manutencao'
);

CREATE TYPE combustivel_tipo AS ENUM (
  'Gasolina', 'Etanol', 'Flex', 'Diesel', 'Híbrido', 'Elétrico', 'GNV'
);

CREATE TYPE cambio_tipo AS ENUM (
  'Manual', 'Automático 6', 'Automático 8', 'CVT', 'AT7', 'DCT', 'DSG'
);

-- ── TABELA: veiculos ──────────────────────────
CREATE TABLE IF NOT EXISTS veiculos (
  id             UUID             DEFAULT uuid_generate_v4() PRIMARY KEY,
  marca          TEXT             NOT NULL,
  modelo         TEXT             NOT NULL,
  ano            SMALLINT         NOT NULL CHECK (ano >= 1990 AND ano <= 2100),
  cor            TEXT,
  placa          TEXT             UNIQUE NOT NULL,
  km             INTEGER          NOT NULL DEFAULT 0 CHECK (km >= 0),
  donos          SMALLINT         NOT NULL DEFAULT 1 CHECK (donos >= 1),
  combustivel    combustivel_tipo NOT NULL DEFAULT 'Flex',
  cambio         cambio_tipo      NOT NULL DEFAULT 'Manual',
  condicao       TEXT             NOT NULL DEFAULT 'Seminovo',
  preco_compra   NUMERIC(12,2)    NOT NULL CHECK (preco_compra >= 0),
  preco_venda    NUMERIC(12,2)    NOT NULL CHECK (preco_venda >= 0),
  status         veiculo_status   NOT NULL DEFAULT 'disponivel',
  foto_capa      TEXT,
  fotos_galeria  TEXT[]           DEFAULT '{}',
  observacoes    TEXT,
  criado_em      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Trigger: atualiza atualizado_em automaticamente
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_veiculos_atualizado
  BEFORE UPDATE ON veiculos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- Índices
CREATE INDEX idx_veiculos_status    ON veiculos(status);
CREATE INDEX idx_veiculos_marca     ON veiculos(marca);
CREATE INDEX idx_veiculos_ano       ON veiculos(ano);
CREATE INDEX idx_veiculos_criado_em ON veiculos(criado_em DESC);

-- ── TABELA: despesas ──────────────────────────
CREATE TABLE IF NOT EXISTS despesas (
  id          UUID           DEFAULT uuid_generate_v4() PRIMARY KEY,
  veiculo_id  UUID           NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  descricao   TEXT           NOT NULL,
  valor       NUMERIC(10,2)  NOT NULL CHECK (valor > 0),
  data        DATE           NOT NULL DEFAULT CURRENT_DATE,
  criado_em   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_despesas_veiculo_id ON despesas(veiculo_id);
CREATE INDEX idx_despesas_data       ON despesas(data DESC);

-- ── VIEW: custo real por veículo ──────────────
CREATE OR REPLACE VIEW vw_veiculo_custo AS
SELECT
  v.id, v.marca, v.modelo, v.ano, v.placa,
  v.preco_compra, v.preco_venda, v.status,
  COALESCE(SUM(d.valor), 0)                                    AS total_despesas,
  v.preco_compra + COALESCE(SUM(d.valor), 0)                   AS custo_total,
  v.preco_venda - v.preco_compra - COALESCE(SUM(d.valor), 0)   AS lucro_liquido,
  ROUND(
    (v.preco_venda - v.preco_compra - COALESCE(SUM(d.valor), 0))
    / NULLIF(v.preco_compra + COALESCE(SUM(d.valor), 0), 0) * 100
  , 2)                                                         AS margem_pct
FROM veiculos v
LEFT JOIN despesas d ON d.veiculo_id = v.id
GROUP BY v.id;

-- ── ROW LEVEL SECURITY ────────────────────────
ALTER TABLE veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;

-- Apenas usuários autenticados podem ler e escrever
CREATE POLICY "auth_select_veiculos"  ON veiculos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_veiculos"  ON veiculos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update_veiculos"  ON veiculos FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete_veiculos"  ON veiculos FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "auth_select_despesas"  ON despesas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_despesas"  ON despesas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update_despesas"  ON despesas FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete_despesas"  ON despesas FOR DELETE USING (auth.role() = 'authenticated');

-- ══════════════════════════════════════════════
--  FIM — verifique em Table Editor se as tabelas
--  "veiculos" e "despesas" aparecerem ✓
-- ══════════════════════════════════════════════
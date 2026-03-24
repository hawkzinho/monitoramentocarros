
CREATE TABLE IF NOT EXISTS carros (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo      text NOT NULL,
  placa       text,
  cor         text,
  ano         integer,
  quilometragem integer,
  data_compra date,
  data_venda  date,
  valor_compra numeric(12,2),
  valor_venda  numeric(12,2),
  status      text DEFAULT 'disponivel'
              CHECK (status IN ('disponivel','vendido','repasse','reservado','manutencao')),
  observacoes text,
  created_at  timestamptz DEFAULT now()
);

-- Despesas vinculadas a um carro
CREATE TABLE IF NOT EXISTS despesas_carros (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  carro_id  uuid NOT NULL REFERENCES carros(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor     numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Despesas gerais (não vinculadas a carro)
CREATE TABLE IF NOT EXISTS despesas_gerais (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao text NOT NULL,
  valor     numeric(12,2) NOT NULL,
  data      date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_carros_status     ON carros(status);
CREATE INDEX IF NOT EXISTS idx_carros_data_venda ON carros(data_venda);
CREATE INDEX IF NOT EXISTS idx_despesas_carros_carro_id ON despesas_carros(carro_id);
CREATE INDEX IF NOT EXISTS idx_despesas_gerais_data     ON despesas_gerais(data);

-- Row Level Security
ALTER TABLE carros          ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_carros ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_gerais ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (sistema sem autenticação)
CREATE POLICY "public_carros"          ON carros          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_despesas_carros" ON despesas_carros FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_despesas_gerais" ON despesas_gerais FOR ALL USING (true) WITH CHECK (true);


-- Checklist por veículo
CREATE TABLE IF NOT EXISTS checklist (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  carro_id        uuid NOT NULL REFERENCES carros(id) ON DELETE CASCADE,
  obs_frente      text,
  obs_tras        text,
  obs_lado_esq    text,
  obs_lado_dir    text,
  obs_geral       text,
  chave_reserva   boolean DEFAULT false,
  manual_fabrica  boolean DEFAULT false,
  updated_at      timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT checklist_carro_id_key UNIQUE (carro_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_carro_id ON checklist(carro_id);
ALTER TABLE checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_checklist" ON checklist FOR ALL USING (true) WITH CHECK (true);

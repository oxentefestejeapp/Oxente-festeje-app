import { createClient } from '@supabase/supabase-js';
import { Product, Sale, StoreInfo } from '../types';

// Read configuration from environment variables or localStorage
export const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const localUrl = localStorage.getItem('supabase_url');
  const localKey = localStorage.getItem('supabase_anon_key');

  return {
    url: envUrl || localUrl || 'https://sbeyfgxvjoaulxojjguu.supabase.co',
    key: envKey || localKey || 'sb_publishable_7aL1Xxp82aXaHTA_Zu3diA_GMfOf9oY',
    isConfigured: !!(envUrl || localUrl) || true, // Default to true as the user provided active keys!
  };
};

const config = getSupabaseConfig();
export const supabase = createClient(config.url, config.key);

// Generate migration SQL for Supabase SQL Editor
export const getSupabaseMigrationSQL = (): string => {
  return `-- SQL de Migração do Aplicativo Oxente Festeje
-- Copie este código e execute-o no Editor SQL do seu painel do Supabase.

-- 1. Tabela de Produtos (Products)
CREATE TABLE IF NOT EXISTS oxente_products (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  preco NUMERIC NOT NULL,
  estoque INTEGER NOT NULL,
  imagem_base64 TEXT,
  estoque_infinito BOOLEAN,
  preco_custo NUMERIC,
  precos_progressivos TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir que a coluna de preços progressivos exista se a tabela já foi criada anteriormente
ALTER TABLE oxente_products ADD COLUMN IF NOT EXISTS precos_progressivos TEXT;

-- Habilitar leitura/escrita aberta para simplificar (ajuste as políticas RLS como preferir em produção)
ALTER TABLE oxente_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso Livre Ler-Gravar-Editar" ON oxente_products FOR ALL USING (true) WITH CHECK (true);

-- 2. Tabela de Vendas e Pedidos (Sales)
CREATE TABLE IF NOT EXISTS oxente_sales (
  id TEXT PRIMARY KEY,
  cliente TEXT NOT NULL,
  telefone_cliente TEXT,
  produto_id TEXT,
  produto_nome TEXT,
  preco_un NUMERIC,
  quantidade INTEGER,
  total NUMERIC NOT NULL,
  forma_pagamento TEXT NOT NULL,
  data TEXT NOT NULL,
  valor_pago NUMERIC,
  valor_faltante NUMERIC,
  numero_pedido TEXT,
  status TEXT,
  itens JSONB,
  criado_por_email TEXT,
  data_retirada TEXT,
  status_producao TEXT,
  designer_id TEXT,
  status_arte TEXT,
  puxado_por TEXT,
  puxado_em TEXT,
  observacoes_design TEXT,
  foi_alterado BOOLEAN,
  remover_do_design BOOLEAN,
  editado_por_email TEXT,
  editado_em TEXT,
  arte_finalizada_por_email TEXT,
  arte_finalizada_em TEXT,
  valores_originais JSONB,
  notas_internas TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE oxente_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso Livre Ler-Gravar-Editar" ON oxente_sales FOR ALL USING (true) WITH CHECK (true);

-- 3. Tabela de Configurações da Loja (Store Info)
CREATE TABLE IF NOT EXISTS oxente_store_info (
  key TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  instagram TEXT,
  telefone TEXT,
  endereco TEXT,
  whatsapp_template TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE oxente_store_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso Livre Ler-Gravar-Editar" ON oxente_store_info FOR ALL USING (true) WITH CHECK (true);

-- Inserir dados de configuração padrão da loja se não existirem
INSERT INTO oxente_store_info (key, nome, instagram, telefone, endereco, whatsapp_template)
VALUES ('default', 'Oxente Festeje', '@oxente_festeje', '(81) 98765-4321', 'Rua Principal, Recife - PE', 'Olá {cliente}, seu pedido {numero} está {status}!')
ON CONFLICT (key) DO NOTHING;
`;
};

// Map helpers between Javascript types and Postgres keys
const mapProductToDb = (product: Product) => ({
  id: product.id,
  nome: product.nome,
  preco: product.preco,
  estoque: product.estoque,
  imagem_base64: product.imagemBase64 || null,
  estoque_infinito: product.estoqueInfinito || false,
  preco_custo: product.precoCusto || null,
  precos_progressivos: product.faixasPreco ? JSON.stringify(product.faixasPreco) : null,
  updated_at: new Date().toISOString()
});

const mapDbToProduct = (dbItem: any): Product => {
  let faixasPreco = undefined;
  if (dbItem.precos_progressivos) {
    try {
      faixasPreco = typeof dbItem.precos_progressivos === 'string'
        ? JSON.parse(dbItem.precos_progressivos)
        : dbItem.precos_progressivos;
    } catch (e) {
      console.error('Falha ao parsear precos_progressivos do banco de dados:', e);
    }
  }
  return {
    id: dbItem.id,
    nome: dbItem.nome,
    preco: Number(dbItem.preco),
    estoque: Number(dbItem.estoque),
    imagemBase64: dbItem.imagem_base64 || undefined,
    estoqueInfinito: dbItem.estoque_infinito || undefined,
    precoCusto: dbItem.precoCusto ? Number(dbItem.preco_custo) : undefined,
    faixasPreco
  };
};

const mapSaleToDb = (sale: Sale) => ({
  id: sale.id,
  cliente: sale.cliente,
  telefone_cliente: sale.telefoneCliente || null,
  produto_id: sale.produtoId || null,
  produto_nome: sale.produtoNome || null,
  preco_un: sale.precoUn || null,
  quantidade: sale.quantidade || null,
  total: sale.total,
  forma_pagamento: sale.formaPagamento,
  data: sale.data,
  valor_pago: sale.valorPago || null,
  valor_faltante: sale.valorFaltante || null,
  numero_pedido: sale.numeroPedido || null,
  status: sale.status || null,
  itens: sale.itens ? JSON.stringify(sale.itens) : null,
  criado_por_email: sale.criadoPorEmail || null,
  data_retirada: sale.dataRetirada || null,
  status_producao: sale.statusProducao || null,
  designer_id: sale.designerId || null,
  status_arte: sale.statusArte || null,
  puxado_por: sale.puxadoPor || null,
  puxado_em: sale.puxadoEm || null,
  observacoes_design: sale.observacoesDesign || null,
  foi_alterado: sale.foiAlterado || false,
  remover_do_design: sale.removerDoDesign || false,
  editado_por_email: sale.editadoPorEmail || null,
  editado_em: sale.editadoEm || null,
  arte_finalizada_por_email: sale.arteFinalizadaPorEmail || null,
  arte_finalizada_em: sale.arteFinalizadaEm || null,
  valores_originais: sale.valoresOriginais ? JSON.stringify(sale.valoresOriginais) : null,
  notas_internas: sale.notasInternas || null,
  updated_at: new Date().toISOString()
});

const mapDbToSale = (dbItem: any): Sale => ({
  id: dbItem.id,
  cliente: dbItem.cliente,
  telefoneCliente: dbItem.telefone_cliente || undefined,
  produtoId: dbItem.produto_id || undefined,
  produtoNome: dbItem.produto_nome || undefined,
  precoUn: dbItem.preco_un ? Number(dbItem.preco_un) : undefined as any,
  quantidade: dbItem.quantidade ? Number(dbItem.quantidade) : undefined as any,
  total: Number(dbItem.total),
  formaPagamento: dbItem.forma_pagamento as any,
  data: dbItem.data,
  valorPago: dbItem.valor_pago !== null ? Number(dbItem.valor_pago) : undefined,
  valorFaltante: dbItem.valor_faltante !== null ? Number(dbItem.valor_faltante) : undefined,
  numeroPedido: dbItem.numero_pedido || undefined,
  status: dbItem.status as any,
  itens: dbItem.itens ? (typeof dbItem.itens === 'string' ? JSON.parse(dbItem.itens) : dbItem.itens) : undefined,
  criadoPorEmail: dbItem.criado_por_email || undefined,
  dataRetirada: dbItem.data_retirada || undefined,
  statusProducao: dbItem.status_producao || undefined,
  designerId: dbItem.designer_id || undefined,
  statusArte: dbItem.status_arte || undefined,
  puxadoPor: dbItem.puxado_por || undefined,
  puxadoEm: dbItem.puxado_em || undefined,
  observacoesDesign: dbItem.observacoes_design || undefined,
  foiAlterado: dbItem.foi_alterado || undefined,
  removerDoDesign: dbItem.remover_do_design || undefined,
  editadoPorEmail: dbItem.editado_por_email || undefined,
  editadoEm: dbItem.editado_em || undefined,
  arteFinalizadaPorEmail: dbItem.arte_finalizada_por_email || undefined,
  arteFinalizadaEm: dbItem.arte_finalizada_em || undefined,
  valoresOriginais: dbItem.valores_originais ? (typeof dbItem.valores_originais === 'string' ? JSON.parse(dbItem.valores_originais) : dbItem.valores_originais) : undefined,
  notasInternas: dbItem.notas_internas || undefined
});

// MAIN INTERACTION METHODS WITH GRACEFUL FALLBACKS
export const dbSupabase = {
  // Test connection to verify URL and KEY are valid
  async testConnection(): Promise<{ success: boolean; error?: string; tablesConfigured?: boolean }> {
    try {
      const { data, error } = await supabase.from('oxente_store_info').select('*').limit(1);
      if (error) {
        // Handle specifically "relation does not exist" error
        if (error.code === '42P01') {
          return { success: true, tablesConfigured: false, error: 'As tabelas do Oxente Festeje ainda não foram criadas no banco de dados do Supabase. Execute o script de configuração abaixo!' };
        }
        return { success: false, error: error.message };
      }
      return { success: true, tablesConfigured: true };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  },

  // PRODUCTS
  async fetchProducts(): Promise<Product[] | null> {
    try {
      const { data, error } = await supabase.from('oxente_products').select('*').order('nome', { ascending: true });
      if (error) {
        console.warn('Erro ao carregar produtos do Supabase:', error.message);
        return null;
      }
      return data.map(mapDbToProduct);
    } catch (e) {
      console.warn('Erro geral de conexão com Supabase:', e);
      return null;
    }
  },

  async saveProduct(product: Product): Promise<boolean> {
    try {
      const dbRow = mapProductToDb(product);
      const { error } = await supabase.from('oxente_products').upsert(dbRow);
      if (error) {
        if (error.code === '42703') {
          console.warn('Coluna precos_progressivos ausente no Supabase. Salvando localmente e persistindo os demais dados no banco online:', error.message);
          const fallbackRow = { ...dbRow };
          delete (fallbackRow as any).precos_progressivos;
          const { error: fallbackError } = await supabase.from('oxente_products').upsert(fallbackRow);
          if (fallbackError) {
            console.error('Erro no fallback de salvar produto no Supabase:', fallbackError.message);
            return false;
          }
          return true;
        }
        console.error('Erro ao salvar produto no Supabase:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Falha ao conectar com Supabase ao salvar produto:', e);
      return false;
    }
  },

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('oxente_products').delete().eq('id', id);
      if (error) {
        console.error('Erro ao deletar produto no Supabase:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Falha ao conectar com Supabase ao deletar produto:', e);
      return false;
    }
  },

  // SALES / ORDERS
  async fetchSales(): Promise<Sale[] | null> {
    try {
      const { data, error } = await supabase.from('oxente_sales').select('*').order('data', { ascending: false });
      if (error) {
        console.warn('Erro ao carregar vendas do Supabase:', error.message);
        return null;
      }
      return data.map(mapDbToSale);
    } catch (e) {
      console.warn('Erro geral de conexão de vendas com Supabase:', e);
      return null;
    }
  },

  async saveSale(sale: Sale): Promise<boolean> {
    try {
      const dbRow = mapSaleToDb(sale);
      const { error } = await supabase.from('oxente_sales').upsert(dbRow);
      if (error) {
        console.error('Erro ao salvar venda no Supabase:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Falha ao conectar com Supabase ao salvar venda:', e);
      return false;
    }
  },

  async saveStoreInfo(storeInfo: StoreInfo): Promise<boolean> {
    try {
      const { error } = await supabase.from('oxente_store_info').upsert({
        key: 'default',
        nome: storeInfo.nome,
        instagram: storeInfo.instagram,
        telefone: storeInfo.telefone,
        endereco: storeInfo.endereco,
        whatsapp_template: storeInfo.whatsappTemplate || null,
        updated_at: new Date().toISOString()
      });
      if (error) {
        console.error('Erro ao salvar loja no Supabase:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Falha ao conectar com Supabase ao salvar dados da loja:', e);
      return false;
    }
  },

  async fetchStoreInfo(): Promise<StoreInfo | null> {
    try {
      const { data, error } = await supabase.from('oxente_store_info').select('*').eq('key', 'default').single();
      if (error) {
        console.warn('Erro ao carregar dados da loja do Supabase:', error.message);
        return null;
      }
      return {
        nome: data.nome,
        instagram: data.instagram || '',
        telefone: data.telefone || '',
        endereco: data.endereco || '',
        whatsappTemplate: data.whatsapp_template || ''
      };
    } catch (e) {
      console.warn('Erro geral de conexão de dados de loja com Supabase:', e);
      return null;
    }
  }
};

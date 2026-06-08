import { createClient } from '@supabase/supabase-js';
import { Product, Sale, StoreInfo } from '../types';

export interface SupabaseErrorDetail {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export let lastSupabaseError: SupabaseErrorDetail | null = null;

export function getFormattedSupabaseError(fallback = 'Erro desconhecido'): string {
  if (!lastSupabaseError) return fallback;
  const parts = [];
  if (lastSupabaseError.code) parts.push(`[Código: ${lastSupabaseError.code}]`);
  parts.push(lastSupabaseError.message);
  if (lastSupabaseError.details) parts.push(` - Detalhes: ${lastSupabaseError.details}`);
  if (lastSupabaseError.hint) parts.push(` - Dica: ${lastSupabaseError.hint}`);
  return parts.join(' ');
}

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

// Detect whether we are in the Google AI Studio DEV preview or PREVIEW environment
export const isSandbox = typeof window !== 'undefined' && (
  window.location.hostname.includes('ais-dev') || 
  window.location.hostname.includes('ais-pre') ||
  window.location.hostname.includes('localhost') ||
  window.location.hostname.includes('127.0.0.1')
);

// Mock client for Supabase Realtime subscriptions to avoid WebSocket errors during preview
const mockSupabase = {
  channel: () => ({
    on: () => mockSupabase.channel(),
    subscribe: (callback?: (status: string) => void) => {
      if (callback) {
        setTimeout(() => callback('SUBSCRIBED'), 100);
      }
      return {};
    }
  }),
  removeChannel: () => {},
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    upsert: () => Promise.resolve({ error: null }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }), neq: () => Promise.resolve({ error: null }) })
  })
} as any;

const config = getSupabaseConfig();
export const supabase = isSandbox 
  ? mockSupabase 
  : createClient(config.url, config.key);

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

-- Garantir que a coluna de imagem esteja presente também
ALTER TABLE oxente_products ADD COLUMN IF NOT EXISTS imagem_base64 TEXT;

-- Habilitar leitura/escrita aberta para simplificar (ajuste as políticas RLS como preferir em produção)
ALTER TABLE oxente_products ENABLE ROW LEVEL SECURITY;
-- Remove existing simple policy to avoid duplication errors and recreate cleanly
DROP POLICY IF EXISTS "Acesso Livre Ler-Gravar-Editar" ON oxente_products;
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
  pedido_anotado BOOLEAN DEFAULT FALSE,
  aviso_pronto_sended BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir que as colunas de pedido anotado e aviso de pronto existam caso a tabela já tenha sido criada anteriormente
ALTER TABLE oxente_sales ADD COLUMN IF NOT EXISTS pedido_anotado BOOLEAN DEFAULT FALSE;
ALTER TABLE oxente_sales ADD COLUMN IF NOT EXISTS aviso_pronto_sended BOOLEAN DEFAULT FALSE;

ALTER TABLE oxente_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Livre Ler-Gravar-Editar" ON oxente_sales;
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
DROP POLICY IF EXISTS "Acesso Livre Ler-Gravar-Editar" ON oxente_store_info;
CREATE POLICY "Acesso Livre Ler-Gravar-Editar" ON oxente_store_info FOR ALL USING (true) WITH CHECK (true);

-- Inserir dados de configuração padrão da loja se não existirem
INSERT INTO oxente_store_info (key, nome, instagram, telefone, endereco, whatsapp_template)
VALUES ('default', 'Oxente Festeje', '@oxente_festeje', '(83) 98885-9302', 'Rua Josina Lessa feitosa 176', 'Olá {cliente}, seu pedido {numero} está {status}!')
ON CONFLICT (key) DO NOTHING;

-- 4. Ajustar Réplica de Identidade (Garante payload completo em UPDATES e DELETES no canais Realtime)
ALTER TABLE oxente_products REPLICA IDENTITY FULL;
ALTER TABLE oxente_sales REPLICA IDENTITY FULL;
ALTER TABLE oxente_store_info REPLICA IDENTITY FULL;

-- 5. Habilitar Tempo Real (Realtime) para as Tabelas
-- Usamos um bloco PL/pgSQL seguro para evitar erros de tabela já cadastrada ao reexecutar o script
DO $$
BEGIN
  -- Habilitar replicação para 'oxente_products' se não estiver cadastrada
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'oxente_products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE oxente_products;
  END IF;

  -- Habilitar replicação para 'oxente_sales' se não estiver cadastrada
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'oxente_sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE oxente_sales;
  END IF;

  -- Habilitar replicação para 'oxente_store_info' se não estiver cadastrada
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'oxente_store_info'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE oxente_store_info;
  END IF;
END $$;

-- 6. FORÇAR RECARREGAMENTO DO CACHE DE SCHEMA DO SUPABASE (Diferencial Crucial!)
NOTIFY pgrst, 'reload schema';
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

export const mapDbToProduct = (dbItem: any): Product => {
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
    precoCusto: dbItem.preco_custo ? Number(dbItem.preco_custo) : undefined,
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
  pedido_anotado: sale.pedidoAnotado || false,
  aviso_pronto_sended: sale.avisoProntoSended || false,
  updated_at: new Date().toISOString()
});

export const mapDbToSale = (dbItem: any): Sale => ({
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
  statusProducao: (dbItem.status_producao as any) || 'Agendado',
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
  notasInternas: dbItem.notas_internas || undefined,
  pedidoAnotado: dbItem.pedido_anotado || false,
  avisoProntoSended: dbItem.aviso_pronto_sended || false
});

// MAIN INTERACTION METHODS WITH GRACEFUL FALLBACKS
const realDbSupabase = {
  // Test connection to verify URL and KEY are valid
  async testConnection(): Promise<{ success: boolean; error?: string; tablesConfigured?: boolean }> {
    try {
      const { data, error } = await supabase.from('oxente_store_info').select('*').limit(1);
      if (error) {
        lastSupabaseError = error;
        // Handle specifically "relation does not exist" error
        if (error.code === '42P01') {
          return { success: true, tablesConfigured: false, error: 'As tabelas do Oxente Festeje ainda não foram criadas no banco de dados do Supabase. Execute o script de configuração abaixo!' };
        }
        return { success: false, error: `[Código: ${error.code || 'Desconhecido'}] ${error.message}` };
      }
      lastSupabaseError = null;
      return { success: true, tablesConfigured: true };
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      return { success: false, error: e.message || String(e) };
    }
  },

  // PRODUCTS
  async fetchProducts(): Promise<Product[] | null> {
    try {
      const { data, error } = await supabase.from('oxente_products').select('*').order('nome', { ascending: true });
      if (error) {
        lastSupabaseError = error;
        console.warn('Erro ao carregar produtos do Supabase:', error.message);
        return null;
      }
      lastSupabaseError = null;
      return data.map(mapDbToProduct);
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      console.warn('Erro geral de conexão com Supabase:', e);
      return null;
    }
  },

  async saveProduct(product: Product): Promise<boolean> {
    try {
      const dbRow = mapProductToDb(product);
      const currentPayload = { ...dbRow };
      
      // Let's attempt to upsert, and if there are missing column errors, we dynamically delete those columns and retry.
      for (let attempt = 0; attempt < 8; attempt++) {
        const { error } = await supabase.from('oxente_products').upsert(currentPayload);
        if (!error) {
          lastSupabaseError = null;
          return true; // Successfully saved!
        }
        
        lastSupabaseError = error;

        // Check for undefined column error (Code 42703 in Postgres, or PostgREST schema cache and "column not found" mismatch)
        const isColumnError = 
          error.code === '42703' || 
          error.message.includes('column') || 
          error.message.includes('coluna') || 
          error.message.includes('schema cache');

        if (isColumnError) {
          // Parse the column name from the error message. e.g. "column \"preco_custo\" of relation \"oxente_products\" does not exist"
          // Or: "Could not find the 'precos_progressivos' column of 'oxente_products' in the schema cache"
          const match = error.message.match(/column '([^']+)'/i) ||
                        error.message.match(/Could not find the '([^']+)' column/i) ||
                        error.message.match(/Could not find the "([^"]+)" column/i) ||
                        error.message.match(/column "([^"]+)"/i) || 
                        error.message.match(/coluna "([^"]+)"/i) ||
                        error.message.match(/column ([a-zA-Z_0-9]+) does not exist/i);
          
          if (match && match[1]) {
            const missingColumn = match[1];
            console.warn(`Dynamic Save Healing: Deleting missing column "${missingColumn}" and retrying product save...`);
            delete (currentPayload as any)[missingColumn];
            continue; // Retry with cleaned payload
          } else {
            // Fallback: if we can't parse but it's a column error, try to delete potentially missing columns one by one
            console.warn('Dynamic Save Healing: Column error received but column name not parsed automatically. Trying fallback removal.');
            const nonEssential = ['precos_progressivos', 'preco_custo', 'estoque_infinito', 'imagem_base64'];
            let removedAny = false;
            for (const col of nonEssential) {
              if (col in currentPayload) {
                console.warn(`Dynamic Save Healing: Fallback-deleting column "${col}"`);
                delete (currentPayload as any)[col];
                removedAny = true;
                break; // Delete one and retry
              }
            }
            if (!removedAny) {
              console.error('Dynamic Save Healing: Nothing left to remove. Aborting:', error.message);
              return false;
            }
            continue;
          }
        }
        
        console.error('Erro ao salvar produto no Supabase:', error.message);
        return false;
      }
      return false;
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      console.error('Falha ao conectar com Supabase ao salvar produto:', e);
      return false;
    }
  },

  async updateProductStock(id: string, newStock: number, isInfinite?: boolean): Promise<boolean> {
    try {
      const updateData: any = {
        estoque: newStock,
        updated_at: new Date().toISOString()
      };
      if (isInfinite !== undefined) {
        updateData.estoque_infinito = isInfinite;
      }
      
      const currentPayload = { ...updateData };
      
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabase
          .from('oxente_products')
          .update(currentPayload)
          .eq('id', id);

        if (!error) {
          lastSupabaseError = null;
          return true;
        }

        lastSupabaseError = error;

        const isColumnError = 
          error.code === '42703' || 
          error.message.includes('column') || 
          error.message.includes('coluna') || 
          error.message.includes('schema cache');

        if (isColumnError) {
          const match = error.message.match(/column '([^']+)'/i) ||
                        error.message.match(/Could not find the '([^']+)' column/i) ||
                        error.message.match(/Could not find the "([^"]+)" column/i) ||
                        error.message.match(/column "([^"]+)"/i) || 
                        error.message.match(/coluna "([^"]+)"/i) ||
                        error.message.match(/column ([a-zA-Z_0-9]+) does not exist/i);
          
          if (match && match[1]) {
            const missingColumn = match[1];
            if (missingColumn in currentPayload) {
              console.warn(`Dynamic Save Healing (Stock): Deleting missing column "${missingColumn}" and retrying...`);
              delete (currentPayload as any)[missingColumn];
              continue;
            }
          } else if ('estoque_infinito' in currentPayload) {
            console.warn(`Dynamic Save Healing (Stock): Fallback removing "estoque_infinito" column and retrying...`);
            delete currentPayload.estoque_infinito;
            continue;
          }
        }

        console.error('Erro ao atualizar estoque no Supabase:', error.message);
        return false;
      }
      return false;
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      console.error('Falha ao conectar com Supabase ao atualizar estoque:', e);
      return false;
    }
  },

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('oxente_products').delete().eq('id', id);
      if (error) {
        lastSupabaseError = error;
        console.error('Erro ao deletar produto no Supabase:', error.message);
        return false;
      }
      lastSupabaseError = null;
      return true;
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      console.error('Falha ao conectar com Supabase ao deletar produto:', e);
      return false;
    }
  },

  // SALES / ORDERS
  async fetchSales(): Promise<Sale[] | null> {
    try {
      const { data, error } = await supabase.from('oxente_sales').select('*').order('data', { ascending: false });
      if (error) {
        lastSupabaseError = error;
        console.warn('Erro ao carregar vendas do Supabase:', error.message);
        return null;
      }
      lastSupabaseError = null;
      return data.map(mapDbToSale);
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      console.warn('Erro geral de conexão de vendas com Supabase:', e);
      return null;
    }
  },

  async saveSale(sale: Sale): Promise<boolean> {
    try {
      const dbRow = mapSaleToDb(sale) as any;
      let attempt = 0;
      while (attempt < 2) {
        const { error } = await supabase.from('oxente_sales').upsert(dbRow);
        if (error) {
          lastSupabaseError = error;
          // Se as colunas novas 'pedido_anotado' ou 'aviso_pronto_sended' não existirem no banco (erro 42703), omitimos e tentamos de novo
          if (error.code === '42703') {
            console.warn('Colunas novas podem não existir no Supabase, tentando salvar sem elas.');
            delete dbRow.pedido_anotado;
            delete dbRow.aviso_pronto_sended;
            attempt++;
            continue;
          }
          console.error('Erro ao salvar venda no Supabase:', error.message);
          return false;
        }
        lastSupabaseError = null;
        return true;
      }
      return false;
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      console.error('Falha ao conectar com Supabase ao salvar venda:', e);
      return false;
    }
  },

  async purgeOldDeliveredSales(): Promise<boolean> {
    try {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const dateString = tenDaysAgo.toISOString();

      const { error } = await supabase
        .from('oxente_sales')
        .delete()
        .eq('status_producao', 'Entregue')
        .lt('updated_at', dateString);

      if (error) {
        lastSupabaseError = error;
        console.warn('Erro ao expurgar vendas entregues antigas do Supabase:', error.message);
        return false;
      }
      lastSupabaseError = null;
      return true;
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      console.warn('Falha ao conectar com Supabase ao expurgar vendas entregues:', e);
      return false;
    }
  },

  async purgeOldEstimates(): Promise<boolean> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const dateString = oneDayAgo.toISOString();

      const { error } = await supabase
        .from('oxente_sales')
        .delete()
        .eq('status', 'Orçamento')
        .lt('data', dateString);

      if (error) {
        lastSupabaseError = error;
        console.warn('Erro ao expurgar orçamentos antigos do Supabase:', error.message);
        return false;
      }
      lastSupabaseError = null;
      return true;
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      console.warn('Falha ao conectar com Supabase ao expurgar orçamentos antigos:', e);
      return false;
    }
  },

  async clearAllSales(): Promise<boolean> {
    try {
      const { error } = await supabase.from('oxente_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        lastSupabaseError = error;
        console.error('Erro ao limpar todas as vendas no Supabase:', error.message);
        return false;
      }
      lastSupabaseError = null;
      return true;
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      console.error('Falha ao conectar com Supabase ao limpar todas as vendas:', e);
      return false;
    }
  },

  async deleteSale(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('oxente_sales').delete().eq('id', id);
      if (error) {
        lastSupabaseError = error;
        console.error('Erro ao excluir venda no Supabase:', error.message);
        return false;
      }
      lastSupabaseError = null;
      return true;
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      console.error('Falha ao conectar com Supabase ao excluir venda:', e);
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
        lastSupabaseError = error;
        console.error('Erro ao salvar loja no Supabase:', error.message);
        return false;
      }
      lastSupabaseError = null;
      return true;
    } catch (e: any) {
      lastSupabaseError = { message: e.message || String(e) };
      console.error('Falha ao conectar com Supabase ao salvar dados da loja:', e);
      return false;
    }
  },

  async fetchStoreInfo(): Promise<StoreInfo | null> {
    try {
      const { data, error } = await supabase.from('oxente_store_info').select('*').eq('key', 'default').single();
      if (error) {
        lastSupabaseError = error;
        console.warn('Erro ao carregar dados da loja do Supabase:', error.message);
        return null;
      }
      lastSupabaseError = null;
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

// SANDBOX ENVIRONMENT DATABASE SIMULATOR (Uses Local Storage only, leaving production database 100% untouched)
const sandboxDbSupabase = {
  testConnection: async (): Promise<{ success: boolean; error?: string; tablesConfigured?: boolean }> => {
    return { success: true, tablesConfigured: true };
  },

  fetchProducts: async (): Promise<Product[] | null> => {
    const cached = localStorage.getItem('oxente_products');
    return cached ? JSON.parse(cached) : [];
  },

  saveProduct: async (product: Product): Promise<boolean> => {
    const cached = localStorage.getItem('oxente_products');
    const list: Product[] = cached ? JSON.parse(cached) : [];
    const index = list.findIndex(p => p.id === product.id);
    if (index >= 0) {
      list[index] = product;
    } else {
      list.push(product);
    }
    localStorage.setItem('oxente_products', JSON.stringify(list));
    return true;
  },

  updateProductStock: async (id: string, newStock: number, isInfinite?: boolean): Promise<boolean> => {
    const cached = localStorage.getItem('oxente_products');
    if (cached) {
      const list: Product[] = JSON.parse(cached);
      const product = list.find(p => p.id === id);
      if (product) {
        product.estoque = newStock;
        if (isInfinite !== undefined) product.estoqueInfinito = isInfinite;
        localStorage.setItem('oxente_products', JSON.stringify(list));
      }
    }
    return true;
  },

  deleteProduct: async (id: string): Promise<boolean> => {
    const cached = localStorage.getItem('oxente_products');
    if (cached) {
      const list: Product[] = JSON.parse(cached);
      const filtered = list.filter(p => p.id !== id);
      localStorage.setItem('oxente_products', JSON.stringify(filtered));
    }
    return true;
  },

  fetchSales: async (): Promise<Sale[] | null> => {
    const cached = localStorage.getItem('oxente_sales');
    return cached ? JSON.parse(cached) : [];
  },

  saveSale: async (sale: Sale): Promise<boolean> => {
    const cached = localStorage.getItem('oxente_sales');
    const list: Sale[] = cached ? JSON.parse(cached) : [];
    const index = list.findIndex(s => s.id === sale.id);
    if (index >= 0) {
      list[index] = sale;
    } else {
      list.push(sale);
    }
    localStorage.setItem('oxente_sales', JSON.stringify(list));
    return true;
  },

  purgeOldDeliveredSales: async (): Promise<boolean> => {
    return true;
  },

  purgeOldEstimates: async (): Promise<boolean> => {
    return true;
  },

  clearAllSales: async (): Promise<boolean> => {
    localStorage.setItem('oxente_sales', JSON.stringify([]));
    return true;
  },

  deleteSale: async (id: string): Promise<boolean> => {
    const cached = localStorage.getItem('oxente_sales');
    if (cached) {
      const list: Sale[] = JSON.parse(cached);
      const filtered = list.filter(s => s.id !== id);
      localStorage.setItem('oxente_sales', JSON.stringify(filtered));
    }
    return true;
  },

  saveStoreInfo: async (storeInfo: StoreInfo): Promise<boolean> => {
    localStorage.setItem('oxente_store_info', JSON.stringify(storeInfo));
    return true;
  },

  fetchStoreInfo: async (): Promise<StoreInfo | null> => {
    const cached = localStorage.getItem('oxente_store_info');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // ignore
      }
    }
    return {
      nome: 'Oxente Festeje',
      instagram: '@oxente_festeje',
      telefone: '(83) 98885-9302',
      endereco: 'Rua Josina Lessa feitosa 176',
      whatsappTemplate: 'Olá {cliente}, seu pedido {numero} está {status}!'
    };
  }
};

export const dbSupabase = isSandbox ? sandboxDbSupabase : realDbSupabase;

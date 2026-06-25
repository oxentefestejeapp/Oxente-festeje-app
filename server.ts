import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';

dotenv.config();

// Register global safety error handlers to keep the server running and prevent unexpected crashes
process.on('uncaughtException', (err) => {
  console.error('🔥 [Critical Server Error] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 [Critical Server Error] Unhandled Rejection at:', promise, 'reason:', reason);
});

const { Pool } = pg;

const app = express();
const httpServer = createServer(app);
const PORT = 3000;

// Configure JSON body parser with increased limit to support large JSON backups
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Helper to update local .env file safely
function updateEnvFile(updates: Record<string, string>) {
  const envPath = path.join(process.cwd(), '.env');
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  const lines = content.split('\n');
  const updatedKeys = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const eqIdx = line.indexOf('=');
      const key = line.substring(0, eqIdx).trim();
      if (updates[key] !== undefined) {
        lines[i] = `${key}="${updates[key].replace(/"/g, '\\"')}"`;
        updatedKeys.add(key);
      }
    }
  }

  // Append any keys that weren't in the original .env
  for (const [key, val] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      lines.push(`${key}="${val.replace(/"/g, '\\"')}"`);
    }
  }

  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
}

// Database Provider Configuration (reassignable for dynamic switching)
let dbProvider = process.env.VITE_DATABASE_PROVIDER || 'supabase';

// Initialize PostgreSQL Connection Pool if configured for AWS
let pool: pg.Pool | null = null;

function initializePostgresPool() {
  if (dbProvider === 'aws') {
    const pgConfig = {
      host: process.env.PG_HOST || process.env.PGHOST,
      port: parseInt(process.env.PG_PORT || process.env.PGPORT || '5432', 10),
      user: process.env.PG_USER || process.env.PGUSER,
      password: process.env.PG_PASSWORD || process.env.PGPASSWORD,
      database: process.env.PG_DATABASE || process.env.PGDATABASE,
      ssl: process.env.PG_SSL === 'false' ? false : { rejectUnauthorized: false }
    };

    console.log('🔌 [AWS Postgres] Inicializando pool de conexão para:', pgConfig.host);
    if (pool) {
      pool.end().catch(err => console.error('Erro ao encerrar pool antigo:', err));
    }
    pool = new Pool(pgConfig);
    
    // Safety check to handle unexpected errors on idle PostgreSQL pool clients
    pool.on('error', (err) => {
      console.error('⚠️ [AWS Postgres Pool] Erro inesperado em cliente ocioso do banco de dados:', err);
    });

    // Setup tables on startup
    setupDatabaseTables().catch(err => {
      console.error('❌ [AWS Postgres] Falha na criação/verificação de tabelas no banco de dados:', err);
    });
  } else {
    console.log('📡 [Supabase] Executando em modo de comunicação direta com o Supabase.');
    if (pool) {
      pool.end().catch(err => console.error('Erro ao encerrar pool:', err));
      pool = null;
    }
  }
}

// Run initial database pool setup
initializePostgresPool();

// Socket.io Server Setup
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 [Socket.io] Novo cliente conectado: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔌 [Socket.io] Cliente desconectado: ${socket.id}`);
  });
});

// Broadcast changes helper
function broadcastChange(channel: 'products_changes' | 'sales_changes' | 'store_changes' | 'users_changes', payload: any) {
  io.emit(channel, payload);
  console.log(`📡 [Socket.io Broadcast] Canal: ${channel}, Tipo: ${payload.eventType}`);
}

// ----------------------------------------------------
// DATABASE TABLE SETUP DDL (PostgreSQL)
// ----------------------------------------------------
async function setupDatabaseTables() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    console.log('🔄 [AWS Postgres] Verificando e criando tabelas do banco de dados...');
    
    // 1. Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS oxente_products (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        preco NUMERIC NOT NULL,
        estoque INTEGER NOT NULL,
        imagem_base64 TEXT,
        estoque_infinito BOOLEAN DEFAULT FALSE,
        preco_custo NUMERIC,
        precos_progressivos TEXT,
        adicional BOOLEAN DEFAULT FALSE,
        conferido BOOLEAN DEFAULT FALSE,
        prazo_urgencia INTEGER,
        cores TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Sales Table
    await client.query(`
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
        cor_selecionada TEXT,
        criado_por_email TEXT,
        data_retirada TEXT,
        status_producao TEXT,
        designer_id TEXT,
        status_arte TEXT,
        puxado_por TEXT,
        puxado_em TEXT,
        observacoes_design TEXT,
        foi_alterado BOOLEAN DEFAULT FALSE,
        remover_do_design BOOLEAN DEFAULT FALSE,
        editado_por_email TEXT,
        editado_em TEXT,
        arte_finalizada_por_email TEXT,
        arte_finalizada_em TEXT,
        valores_originais JSONB,
        notas_internas TEXT,
        pedido_anotado BOOLEAN DEFAULT FALSE,
        aviso_pronto_sended BOOLEAN DEFAULT FALSE,
        turno_entrega TEXT,
        indicado_codigo TEXT,
        desconto_referral NUMERIC,
        cashback_gasto NUMERIC,
        referral_sended BOOLEAN DEFAULT FALSE,
        bloqueado_lembrete BOOLEAN DEFAULT FALSE,
        pedido_vinculo_numero TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Store Info Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS oxente_store_info (
        key TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        instagram TEXT,
        telefone TEXT,
        endereco TEXT,
        whatsapp_template TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Insert default store config if none exists
    await client.query(`
      INSERT INTO oxente_store_info (key, nome, instagram, telefone, endereco, whatsapp_template)
      VALUES ('default', 'Oxente Festeje', '@oxente_festeje', '(83) 98885-9302', 'Rua Josina Lessa feitosa 176', 'Olá {cliente}, seu pedido {numero} está {status}!')
      ON CONFLICT (key) DO NOTHING;
    `);

    // 4. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS oxente_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'colaborador',
        status TEXT NOT NULL DEFAULT 'approved',
        password TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('✅ [AWS Postgres] Estrutura das tabelas verificada com sucesso!');
  } finally {
    client.release();
  }
}

// Helper to query safe with fallback
async function executeQuery(queryText: string, params: any[] = []) {
  if (!pool) throw new Error('PostgreSQL pool is not initialized');
  return pool.query(queryText, params);
}

// ----------------------------------------------------
// REST API ENDPOINTS FOR AWS POSTGRESQL PROXY
// ----------------------------------------------------

// Get current database connection settings
app.get('/api/db/config', (req, res) => {
  res.json({
    provider: dbProvider,
    pgHost: process.env.PG_HOST || '',
    pgPort: process.env.PG_PORT || '5432',
    pgUser: process.env.PG_USER || '',
    pgPassword: process.env.PG_PASSWORD || '',
    pgDatabase: process.env.PG_DATABASE || '',
    pgSsl: process.env.PG_SSL !== 'false'
  });
});

// Configure and persist database settings dynamically
app.post('/api/db/configure', async (req, res) => {
  const { provider, pgHost, pgPort, pgUser, pgPassword, pgDatabase, pgSsl } = req.body;

  if (provider === 'aws') {
    if (!pgHost || !pgUser || !pgDatabase) {
      return res.status(400).json({ error: 'Configuração incompleta. Preencha Host, Usuário e Banco de Dados.' });
    }

    // 1. Validate the connection by attempting a test connection
    const testConfig = {
      host: pgHost,
      port: parseInt(pgPort || '5432', 10),
      user: pgUser,
      password: pgPassword,
      database: pgDatabase,
      ssl: pgSsl === false ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000 // fail fast if credentials/host are wrong
    };

    const testPool = new pg.Pool(testConfig);
    testPool.on('error', (err) => {
      console.error('⚠️ [AWS Postgres testPool] Erro de rede em cliente de teste:', err);
    });
    try {
      const testClient = await testPool.connect();
      await testClient.query('SELECT 1');
      testClient.release();
      await testPool.end();
    } catch (err: any) {
      await testPool.end();
      console.error('❌ Erro no teste de conexão AWS Postgres:', err.message);
      return res.status(400).json({ 
        error: `Erro ao conectar ao banco de dados: ${err.message}. Verifique se as credenciais e o host estão corretos.` 
      });
    }

    // 2. Persist to local .env file
    try {
      updateEnvFile({
        VITE_DATABASE_PROVIDER: 'aws',
        PG_HOST: pgHost,
        PG_PORT: String(pgPort || '5432'),
        PG_USER: pgUser,
        PG_PASSWORD: pgPassword || '',
        PG_DATABASE: pgDatabase,
        PG_SSL: pgSsl === false ? 'false' : 'true'
      });
    } catch (err: any) {
      console.error('Falha ao escrever no arquivo .env:', err);
    }

    // 3. Update active environment in-memory
    process.env.VITE_DATABASE_PROVIDER = 'aws';
    process.env.PG_HOST = pgHost;
    process.env.PG_PORT = String(pgPort || '5432');
    process.env.PG_USER = pgUser;
    process.env.PG_PASSWORD = pgPassword || '';
    process.env.PG_DATABASE = pgDatabase;
    process.env.PG_SSL = pgSsl === false ? 'false' : 'true';

    dbProvider = 'aws';

    // 4. Reinitialize active pool and setup tables
    initializePostgresPool();

    return res.json({ 
      success: true, 
      message: 'Banco de Dados AWS Postgres/Hostinger configurado e conectado com sucesso!' 
    });
  } else if (provider === 'supabase') {
    // 1. Persist to local .env file
    try {
      updateEnvFile({
        VITE_DATABASE_PROVIDER: 'supabase'
      });
    } catch (err: any) {
      console.error('Falha ao escrever no arquivo .env:', err);
    }

    // 2. Update active environment in-memory
    process.env.VITE_DATABASE_PROVIDER = 'supabase';
    dbProvider = 'supabase';

    // 3. Reinitialize active pool
    initializePostgresPool();

    return res.json({ 
      success: true, 
      message: 'Provedor alterado com sucesso para Supabase!' 
    });
  } else {
    return res.status(400).json({ error: 'Provedor de banco de dados inválido.' });
  }
});

// API Status
app.get('/api/db/status', async (req, res) => {
  if (dbProvider !== 'aws') {
    return res.json({ provider: 'supabase', connected: true });
  }
  try {
    await executeQuery('SELECT 1');
    res.json({ provider: 'aws', connected: true });
  } catch (err: any) {
    res.status(500).json({ provider: 'aws', connected: false, error: err.message });
  }
});

// Sync Check API for AWS
app.get('/api/db/sync-check', async (req, res) => {
  if (dbProvider !== 'aws') {
    return res.json({ provider: 'supabase' });
  }
  try {
    const productsRes = await executeQuery('SELECT COUNT(*)::integer as count, COALESCE(MAX(updated_at), NOW()) as last_updated FROM oxente_products');
    const salesRes = await executeQuery('SELECT COUNT(*)::integer as count, COALESCE(MAX(updated_at), NOW()) as last_updated FROM oxente_sales');
    
    res.json({
      provider: 'aws',
      products: {
        count: productsRes.rows[0]?.count || 0,
        lastUpdated: productsRes.rows[0]?.last_updated || null
      },
      sales: {
        count: salesRes.rows[0]?.count || 0,
        lastUpdated: salesRes.rows[0]?.last_updated || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Products
app.get('/api/db/products', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM oxente_products ORDER BY nome ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert Product
app.post('/api/db/products', async (req, res) => {
  const p = req.body;
  try {
    const query = `
      INSERT INTO oxente_products (
        id, nome, preco, estoque, imagem_base64, estoque_infinito, 
        preco_custo, precos_progressivos, adicional, conferido, prazo_urgencia, cores, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        preco = EXCLUDED.preco,
        estoque = EXCLUDED.estoque,
        imagem_base64 = EXCLUDED.imagem_base64,
        estoque_infinito = EXCLUDED.estoque_infinito,
        preco_custo = EXCLUDED.preco_custo,
        precos_progressivos = EXCLUDED.precos_progressivos,
        adicional = EXCLUDED.adicional,
        conferido = EXCLUDED.conferido,
        prazo_urgencia = EXCLUDED.prazo_urgencia,
        cores = EXCLUDED.cores,
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [
      p.id, p.nome, p.preco, p.estoque, p.imagem_base64 || null, p.estoque_infinito || false,
      p.preco_custo || null, p.precos_progressivos || null, p.adicional || false, p.conferido || false,
      p.prazo_urgencia !== undefined && p.prazo_urgencia !== null ? p.prazo_urgencia : null,
      p.cores || null
    ];
    const result = await executeQuery(query, values);
    const saved = result.rows[0];

    // Broadcast change
    broadcastChange('products_changes', { eventType: 'UPDATE', new: saved });
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update stock
app.post('/api/db/products/stock', async (req, res) => {
  const { id, estoque, estoque_infinito, cores } = req.body;
  try {
    const query = `
      UPDATE oxente_products 
      SET estoque = $1, estoque_infinito = COALESCE($2, estoque_infinito), cores = COALESCE($3, cores), updated_at = NOW()
      WHERE id = $4
      RETURNING *;
    `;
    const result = await executeQuery(query, [estoque, estoque_infinito !== undefined ? estoque_infinito : null, cores || null, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const saved = result.rows[0];
    broadcastChange('products_changes', { eventType: 'UPDATE', new: saved });
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Product
app.delete('/api/db/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await executeQuery('DELETE FROM oxente_products WHERE id = $1', [id]);
    broadcastChange('products_changes', { eventType: 'DELETE', old: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Sales
app.get('/api/db/sales', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM oxente_sales ORDER BY data DESC, updated_at DESC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert Sale
app.post('/api/db/sales', async (req, res) => {
  const s = req.body;
  try {
    const query = `
      INSERT INTO oxente_sales (
        id, cliente, telefone_cliente, produto_id, produto_nome, preco_un, quantidade, total,
        forma_pagamento, data, valor_pago, valor_faltante, numero_pedido, status, itens, cor_selecionada,
        criado_por_email, data_retirada, status_producao, designer_id, status_arte, puxado_por, puxado_em,
        observacoes_design, foi_alterado, remover_do_design, editado_por_email, editado_em,
        arte_finalizada_por_email, arte_finalizada_em, valores_originais, notas_internas, pedido_anotado,
        aviso_pronto_sended, turno_entrega, indicado_codigo, desconto_referral, cashback_gasto,
        referral_sended, bloqueado_lembrete, pedido_vinculo_numero, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
        $39, $40, $41, NOW()
      ) ON CONFLICT (id) DO UPDATE SET
        cliente = EXCLUDED.cliente,
        telefone_cliente = EXCLUDED.telefone_cliente,
        produto_id = EXCLUDED.produto_id,
        produto_nome = EXCLUDED.produto_nome,
        preco_un = EXCLUDED.preco_un,
        quantidade = EXCLUDED.quantidade,
        total = EXCLUDED.total,
        forma_pagamento = EXCLUDED.forma_pagamento,
        data = EXCLUDED.data,
        valor_pago = EXCLUDED.valor_pago,
        valor_faltante = EXCLUDED.valor_faltante,
        numero_pedido = EXCLUDED.numero_pedido,
        status = EXCLUDED.status,
        itens = EXCLUDED.itens,
        cor_selecionada = EXCLUDED.cor_selecionada,
        criado_por_email = EXCLUDED.criado_por_email,
        data_retirada = EXCLUDED.data_retirada,
        status_producao = EXCLUDED.status_producao,
        designer_id = EXCLUDED.designer_id,
        status_arte = EXCLUDED.status_arte,
        puxado_por = EXCLUDED.puxado_por,
        puxado_em = EXCLUDED.puxado_em,
        observacoes_design = EXCLUDED.observacoes_design,
        foi_alterado = EXCLUDED.foi_alterado,
        remover_do_design = EXCLUDED.remover_do_design,
        editado_por_email = EXCLUDED.editado_por_email,
        editado_em = EXCLUDED.editado_em,
        arte_finalizada_por_email = EXCLUDED.arte_finalizada_por_email,
        arte_finalizada_em = EXCLUDED.arte_finalizada_em,
        valores_originais = EXCLUDED.valores_originais,
        notas_internas = EXCLUDED.notas_internas,
        pedido_anotado = EXCLUDED.pedido_anotado,
        aviso_pronto_sended = EXCLUDED.aviso_pronto_sended,
        turno_entrega = EXCLUDED.turno_entrega,
        indicado_codigo = EXCLUDED.indicado_codigo,
        desconto_referral = EXCLUDED.desconto_referral,
        cashback_gasto = EXCLUDED.cashback_gasto,
        referral_sended = EXCLUDED.referral_sended,
        bloqueado_lembrete = EXCLUDED.bloqueado_lembrete,
        pedido_vinculo_numero = EXCLUDED.pedido_vinculo_numero,
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [
      s.id, s.cliente, s.telefone_cliente || null, s.produto_id || null, s.produto_nome || null,
      s.preco_un || null, s.quantidade || null, s.total, s.forma_pagamento, s.data,
      s.valor_pago || null, s.valor_faltante || null, s.numero_pedido || null, s.status || null,
      s.itens ? (typeof s.itens === 'string' ? s.itens : JSON.stringify(s.itens)) : null,
      s.cor_selecionada || null, s.criado_por_email || null, s.data_retirada || null,
      s.status_producao || null, s.designer_id || null, s.status_arte || null,
      s.puxado_por || null, s.puxado_em || null, s.observacoes_design || null,
      s.foi_alterado || false, s.remover_do_design || false, s.editado_por_email || null,
      s.editado_em || null, s.arte_finalizada_por_email || null, s.arte_finalizada_em || null,
      s.valores_originais ? (typeof s.valores_originais === 'string' ? s.valores_originais : JSON.stringify(s.valores_originais)) : null,
      s.notas_internas || null, s.pedido_anotado || false, s.aviso_pronto_sended || false,
      s.turno_entrega || null, s.indicado_codigo || null, s.desconto_referral || null,
      s.cashback_gasto || null, s.referral_sended || false, s.bloqueado_lembrete || false,
      s.pedido_vinculo_numero || null
    ];
    const result = await executeQuery(query, values);
    const saved = result.rows[0];
    broadcastChange('sales_changes', { eventType: 'UPDATE', new: saved });
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Sale
app.delete('/api/db/sales/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await executeQuery('DELETE FROM oxente_sales WHERE id = $1', [id]);
    broadcastChange('sales_changes', { eventType: 'DELETE', old: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear All Sales
app.post('/api/db/sales/clear-all', async (req, res) => {
  try {
    await executeQuery('DELETE FROM oxente_sales');
    broadcastChange('sales_changes', { eventType: 'DELETE', old: { id: 'all' } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Purge delivered sales
app.post('/api/db/sales/purge-delivered', async (req, res) => {
  try {
    const limitDate = new Date();
    limitDate.setMonth(limitDate.getMonth() - 2);
    const dateLimitStr = limitDate.toLocaleDateString('en-CA'); // 'YYYY-MM-DD'

    await executeQuery("DELETE FROM oxente_sales WHERE status = 'Entregue' AND data < $1", [dateLimitStr]);
    broadcastChange('sales_changes', { eventType: 'DELETE', old: { id: 'purge-delivered' } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Purge estimates
app.post('/api/db/sales/purge-estimates', async (req, res) => {
  try {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 15);
    const dateLimitStr = limitDate.toLocaleDateString('en-CA');

    await executeQuery("DELETE FROM oxente_sales WHERE status = 'Orçamento' AND data < $1", [dateLimitStr]);
    broadcastChange('sales_changes', { eventType: 'DELETE', old: { id: 'purge-estimates' } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Store Info
app.get('/api/db/store-info', async (req, res) => {
  try {
    const result = await executeQuery("SELECT * FROM oxente_store_info WHERE key = 'default'");
    if (result.rows.length === 0) {
      return res.json({
        key: 'default',
        nome: 'Oxente Festeje',
        instagram: '@oxente_festeje',
        telefone: '(83) 98885-9302',
        endereco: 'Rua Josina Lessa feitosa 176',
        whatsapp_template: 'Olá {cliente}, seu pedido {numero} está {status}!'
      });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save Store Info
app.post('/api/db/store-info', async (req, res) => {
  const store = req.body;
  const key = store.key || 'default';
  try {
    const query = `
      INSERT INTO oxente_store_info (key, nome, instagram, telefone, endereco, whatsapp_template, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (key) DO UPDATE SET
        nome = EXCLUDED.nome,
        instagram = EXCLUDED.instagram,
        telefone = EXCLUDED.telefone,
        endereco = EXCLUDED.endereco,
        whatsapp_template = EXCLUDED.whatsapp_template,
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [
      key,
      store.nome,
      store.instagram || null,
      store.telefone || null,
      store.endereco || null,
      store.whatsappTemplate || store.whatsapp_template || null
    ];
    const result = await executeQuery(query, values);
    const saved = result.rows[0];
    broadcastChange('store_changes', { eventType: 'UPDATE', new: saved });
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Users
app.get('/api/db/users', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM oxente_users ORDER BY name ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save User
app.post('/api/db/users', async (req, res) => {
  const u = req.body;
  const id = u.id || u.uid;
  try {
    const query = `
      INSERT INTO oxente_users (id, name, email, role, status, password, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        password = COALESCE(EXCLUDED.password, oxente_users.password),
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [id, u.name, u.email || null, u.role || 'colaborador', u.status || 'approved', u.password || null];
    const result = await executeQuery(query, values);
    const saved = result.rows[0];
    broadcastChange('users_changes', { eventType: 'UPDATE', new: saved });
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete User
app.delete('/api/db/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await executeQuery('DELETE FROM oxente_users WHERE id = $1', [id]);
    broadcastChange('users_changes', { eventType: 'DELETE', old: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update User Status
app.post('/api/db/users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const query = 'UPDATE oxente_users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;';
    const result = await executeQuery(query, [status, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    const saved = result.rows[0];
    broadcastChange('users_changes', { eventType: 'UPDATE', new: saved });
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update User Heartbeat
app.post('/api/db/users/:id/heartbeat', async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'UPDATE oxente_users SET updated_at = NOW() WHERE id = $1 RETURNING *;';
    const result = await executeQuery(query, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    const saved = result.rows[0];
    broadcastChange('users_changes', { eventType: 'UPDATE', new: saved });
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// DIRECT BACKUP IMPORT ENDPOINT Perfect Answer for:
// "backup que já baixei onde coloco"
// ----------------------------------------------------
app.post('/api/db/import-backup', async (req, res) => {
  if (!pool) {
    return res.status(400).json({ error: 'AWS Postgres is not active or configured.' });
  }
  const { products, sales, storeInfo } = req.body;
  console.log(`📥 [Import-Backup] Iniciando restauração: ${products?.length || 0} produtos, ${sales?.length || 0} vendas.`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Restore Products
    if (Array.isArray(products)) {
      for (const p of products) {
        const query = `
          INSERT INTO oxente_products (
            id, nome, preco, estoque, imagem_base64, estoque_infinito, 
            preco_custo, precos_progressivos, adicional, conferido, prazo_urgencia, cores, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome,
            preco = EXCLUDED.preco,
            estoque = EXCLUDED.estoque,
            imagem_base64 = EXCLUDED.imagem_base64,
            estoque_infinito = EXCLUDED.estoque_infinito,
            preco_custo = EXCLUDED.preco_custo,
            precos_progressivos = EXCLUDED.precos_progressivos,
            adicional = EXCLUDED.adicional,
            conferido = EXCLUDED.conferido,
            prazo_urgencia = EXCLUDED.prazo_urgencia,
            cores = EXCLUDED.cores,
            updated_at = NOW();
        `;
        const values = [
          p.id, p.nome, p.preco, p.estoque, p.imagemBase64 || null, p.estoqueInfinito || false,
          p.precoCusto || null, p.faixasPreco ? JSON.stringify(p.faixasPreco) : null, p.adicional || false, p.conferido || false,
          p.prazoUrgencia !== undefined && p.prazoUrgencia !== null ? p.prazoUrgencia : null,
          p.cores ? JSON.stringify(p.cores) : null
        ];
        await client.query(query, values);
      }
    }

    // 2. Restore Sales
    if (Array.isArray(sales)) {
      for (const s of sales) {
        const query = `
          INSERT INTO oxente_sales (
            id, cliente, telefone_cliente, produto_id, produto_nome, preco_un, quantidade, total,
            forma_pagamento, data, valor_pago, valor_faltante, numero_pedido, status, itens, cor_selecionada,
            criado_por_email, data_retirada, status_producao, designer_id, status_arte, puxado_por, puxado_em,
            observacoes_design, foi_alterado, remover_do_design, editado_por_email, editado_em,
            arte_finalizada_por_email, arte_finalizada_em, valores_originais, notas_internas, pedido_anotado,
            aviso_pronto_sended, turno_entrega, indicado_codigo, desconto_referral, cashback_gasto,
            referral_sended, bloqueado_lembrete, pedido_vinculo_numero, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
            $39, $40, $41, NOW()
          ) ON CONFLICT (id) DO UPDATE SET
            cliente = EXCLUDED.cliente,
            telefone_cliente = EXCLUDED.telefone_cliente,
            produto_id = EXCLUDED.produto_id,
            produto_nome = EXCLUDED.produto_nome,
            preco_un = EXCLUDED.preco_un,
            quantidade = EXCLUDED.quantidade,
            total = EXCLUDED.total,
            forma_pagamento = EXCLUDED.forma_pagamento,
            data = EXCLUDED.data,
            valor_pago = EXCLUDED.valor_pago,
            valor_faltante = EXCLUDED.valor_faltante,
            numero_pedido = EXCLUDED.numero_pedido,
            status = EXCLUDED.status,
            itens = EXCLUDED.itens,
            cor_selecionada = EXCLUDED.cor_selecionada,
            criado_por_email = EXCLUDED.criado_por_email,
            data_retirada = EXCLUDED.data_retirada,
            status_producao = EXCLUDED.status_producao,
            designer_id = EXCLUDED.designer_id,
            status_arte = EXCLUDED.status_arte,
            puxado_por = EXCLUDED.puxado_por,
            puxado_em = EXCLUDED.puxado_em,
            observacoes_design = EXCLUDED.observacoes_design,
            foi_alterado = EXCLUDED.foi_alterado,
            remover_do_design = EXCLUDED.remover_do_design,
            editado_por_email = EXCLUDED.editado_por_email,
            editado_em = EXCLUDED.editado_em,
            arte_finalizada_por_email = EXCLUDED.arte_finalizada_por_email,
            arte_finalizada_em = EXCLUDED.arte_finalizada_em,
            valores_originais = EXCLUDED.valores_originais,
            notas_internas = EXCLUDED.notas_internas,
            pedido_anotado = EXCLUDED.pedido_anotado,
            aviso_pronto_sended = EXCLUDED.aviso_pronto_sended,
            turno_entrega = EXCLUDED.turno_entrega,
            indicado_codigo = EXCLUDED.indicado_codigo,
            desconto_referral = EXCLUDED.desconto_referral,
            cashback_gasto = EXCLUDED.cashback_gasto,
            referral_sended = EXCLUDED.referral_sended,
            bloqueado_lembrete = EXCLUDED.bloqueado_lembrete,
            pedido_vinculo_numero = EXCLUDED.pedido_vinculo_numero,
            updated_at = NOW();
        `;
        const values = [
          s.id, s.cliente, s.telefoneCliente || null, s.produtoId || null, s.produtoNome || null,
          s.precoUn || null, s.quantidade || null, s.total, s.formaPagamento, s.data,
          s.valorPago || null, s.valorFaltante || null, s.numeroPedido || null, s.status || null,
          s.itens ? JSON.stringify(s.itens) : null, s.corSelecionada || null, s.criadoPorEmail || null,
          s.dataRetirada || null, s.statusProducao || null, s.designerId || null, s.statusArte || null,
          s.puxadoPor || null, s.puxadoEm || null, s.observacoesDesign || null, s.foiAlterado || false,
          s.removerDoDesign || false, s.editadoPorEmail || null, s.editadoEm || null,
          s.arteFinalizadaPorEmail || null, s.arteFinalizadaEm || null,
          s.valoresOriginais ? JSON.stringify(s.valoresOriginais) : null, s.notasInternas || null,
          s.pedidoAnotado || false, s.avisoProntoSended || false, s.turnoEntrega || null,
          s.indicadoCodigo || null, s.descontoReferral || null, s.cashbackGasto || null,
          s.referralSended || false, s.bloqueadoLembrete || false, s.pedidoVinculoNumero || null
        ];
        await client.query(query, values);
      }
    }

    // 3. Restore Store Info
    if (storeInfo) {
      const query = `
        INSERT INTO oxente_store_info (key, nome, instagram, telefone, endereco, whatsapp_template, updated_at)
        VALUES ('default', $1, $2, $3, $4, $5, NOW())
        ON CONFLICT (key) DO UPDATE SET
          nome = EXCLUDED.nome,
          instagram = EXCLUDED.instagram,
          telefone = EXCLUDED.telefone,
          endereco = EXCLUDED.endereco,
          whatsapp_template = EXCLUDED.whatsapp_template,
          updated_at = NOW();
      `;
      const values = [storeInfo.nome, storeInfo.instagram, storeInfo.telefone, storeInfo.endereco, storeInfo.whatsappTemplate || storeInfo.whatsapp_template];
      await client.query(query, values);
    }

    await client.query('COMMIT');
    console.log('✅ [Import-Backup] Backup restaurado e commitado no AWS Postgres com sucesso!');
    
    // Notify all connected devices to pull fresh data
    broadcastChange('products_changes', { eventType: 'INSERT', new: {} });
    broadcastChange('sales_changes', { eventType: 'INSERT', new: {} });
    broadcastChange('store_changes', { eventType: 'UPDATE', new: {} });

    res.json({ success: true, message: 'Backup importado com sucesso no AWS Postgres!' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ [Import-Backup] Erro ao restaurar transação de backup:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// ----------------------------------------------------
// VITE DEV MIDDLEWARE AND STATIC SERVING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Oxente Server] Servidor full-stack rodando na porta ${PORT}`);
  });
}

startServer();

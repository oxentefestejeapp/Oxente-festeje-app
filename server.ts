import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const SUPABASE_URL = 'https://sbeyfgxvjoaulxojjguu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_7aL1Xxp82aXaHTA_Zu3diA_GMfOf9oY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BI7IEtKXkeIFKOELzwkwAAuofPOYUe07MN6h5_uH6jEFyWZ8L-4OwsWnI1NaWxNU_OwYF7kvBuM-n58MfDA0oHE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'yMZESviczjI4yNqad32NqO-ehEkmD6a8mwSFyHOsLS0';
const VAPID_SUBJECT = 'mailto:oxentefesteje@gmail.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'oxente-push-server', time: new Date().toISOString() });
});

// Push dispatch route: sends Web Push notifications to all subscribed mobile devices
app.post('/api/send-order-push', async (req, res) => {
  try {
    const bodyData = req.body || {};
    const isTest = Boolean(bodyData.is_test);
    const delaySeconds = Math.min(Math.max(Number(bodyData.delay_seconds || 0), 0), 30);
    const saleRecord = bodyData.record || bodyData.new || bodyData;

    console.log(`[Push Server] Requisição recebida: isTest=${isTest}, delay=${delaySeconds}s`);

    let notificationTitle = '🛍️ Novo Pedido Registrado!';
    let notificationBody = 'Um novo pedido acabou de entrar no sistema.';
    let orderId = 'novo';

    if (isTest) {
      notificationTitle = bodyData.title || '🛍️ Novo pedido #TESTE';
      notificationBody = bodyData.body || 'Cliente de Teste no valor de R$ 99,90. Toque para abrir!';
      orderId = bodyData.orderId || 'TESTE-001';
    } else if (saleRecord && (saleRecord.numeroPedido || saleRecord.numero_pedido || saleRecord.clienteNome || saleRecord.cliente || saleRecord.valorTotal || saleRecord.total)) {
      const numPedido = saleRecord.numeroPedido || saleRecord.numero_pedido ? `#${saleRecord.numeroPedido || saleRecord.numero_pedido}` : '';
      const totalVal = saleRecord.valorTotal ?? saleRecord.total;
      const valorStr = totalVal !== undefined
        ? `R$ ${Number(totalVal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'R$ 0,00';
      const rawCliente = saleRecord.clienteNome || saleRecord.cliente || '';
      const cliente = rawCliente && rawCliente.trim() !== 'Consumidor' ? rawCliente.trim() : 'Consumidor Geral';
      
      let qtdItens = '';
      if (Array.isArray(saleRecord.itens) && saleRecord.itens.length > 0) {
        qtdItens = ` (${saleRecord.itens.length} ${saleRecord.itens.length === 1 ? 'item' : 'itens'})`;
      }

      // Título: apenas "Novo pedido tal" (ex: "🛍️ Novo pedido #1042")
      // Mensagem (corpo): detalhes de quem é e o valor (ex: "Maria Silva no valor de R$ 150,00 (2 itens). Toque para abrir!")
      const pedidoRef = numPedido ? ` ${numPedido}` : '';
      notificationTitle = `🛍️ Novo pedido${pedidoRef}`;
      notificationBody = `${cliente} no valor de ${valorStr}${qtdItens}. Toque para abrir!`;
      orderId = String(saleRecord.numeroPedido || saleRecord.numero_pedido || saleRecord.id || 'novo');
    }

    // Optional delay to give user time to turn off/lock the screen
    if (delaySeconds > 0) {
      console.log(`[Push Server] Aguardando ${delaySeconds}s para permitir bloqueio da tela...`);
      await new Promise(r => setTimeout(r, delaySeconds * 1000));
    }

    // Fetch all active subscriptions from oxente_push_subscriptions in Supabase
    const { data: subscriptions, error: subError } = await supabase
      .from('oxente_push_subscriptions')
      .select('*');

    if (subError) {
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar celulares cadastrados no Supabase', 
        details: subError 
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'Nenhum celular cadastrado na tabela oxente_push_subscriptions ainda.',
        sentCount: 0
      });
    }

    const payload = JSON.stringify({
      title: notificationTitle,
      body: notificationBody,
      orderId: orderId,
      badgeCount: 1,
      url: '/?tab=vendas',
      timestamp: Date.now()
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (subRow: any) => {
        let sub = subRow.subscription;
        if (typeof sub === 'string') {
          try { sub = JSON.parse(sub); } catch {}
        }
        if (!sub || !sub.endpoint) return null;

        try {
          await webpush.sendNotification(sub, payload, {
            TTL: 86400,
            urgency: 'high'
          });
          return { id: subRow.id, status: 'sent' };
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await supabase.from('oxente_push_subscriptions').delete().eq('id', subRow.id);
            return { id: subRow.id, status: 'expired_and_deleted' };
          }
          throw err;
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    const logMsg = `[${new Date().toISOString()}] Push despachado: ${successful} sucesso(s), ${failed} falha(s)\n`;
    try { fs.appendFileSync('push_activity.log', logMsg); } catch {}

    console.log(`[Push Server] ${logMsg.trim()}`);

    return res.status(200).json({
      success: successful > 0,
      sentCount: successful,
      failedCount: failed,
      title: notificationTitle,
      body: notificationBody,
      message: successful > 0
        ? `Notificação despachada com sucesso para ${successful} aparelho(s)!`
        : `Falha ao entregar nos aparelhos cadastrados.`
    });
  } catch (error: any) {
    console.error('[Push Server] Erro:', error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Erro inesperado no servidor' 
    });
  }
});

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

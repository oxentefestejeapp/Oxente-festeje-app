// Supabase Edge Function: send-order-push
// Dispatches Web Push Notifications to all registered mobile devices (Android / iOS PWA)
// even when the app is completely closed or screen is locked.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.48.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default stable VAPID keypair for Oxente Festeje
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'BI7IEtKXkeIFKOELzwkwAAuofPOYUe07MN6h5_uH6jEFyWZ8L-4OwsWnI1NaWxNU_OwYF7kvBuM-n58MfDA0oHE';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'yMZESviczjI4yNqad32NqO-ehEkmD6a8mwSFyHOsLS0';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:oxentefesteje@gmail.com';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://sbeyfgxvjoaulxojjguu.supabase.co';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_7aL1Xxp82aXaHTA_Zu3diA_GMfOf9oY';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Supabase credentials missing in Edge Function environment' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let bodyData: any = {};
    try {
      bodyData = await req.json();
    } catch {
      bodyData = {};
    }

    // Extract sale record from either direct call, webhook call, or test call
    const isTest = Boolean(bodyData.is_test);
    const saleRecord = bodyData.record || bodyData.new || (bodyData.type === 'INSERT' ? bodyData.record : null) || bodyData;

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
      // Mensagem (corpo): quem é e o valor (ex: "Maria Silva no valor de R$ 150,00")
      const pedidoRef = numPedido ? ` ${numPedido}` : '';
      notificationTitle = `🛍️ Novo pedido${pedidoRef}`;
      notificationBody = `${cliente} no valor de ${valorStr}${qtdItens}. Toque para abrir!`;
      orderId = String(saleRecord.numeroPedido || saleRecord.numero_pedido || saleRecord.id || 'novo');
    }

    // Fetch all active subscriptions from oxente_push_subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('oxente_push_subscriptions')
      .select('*');

    if (subError) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar inscritos', details: subError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'Nenhum celular cadastrado na tabela oxente_push_subscriptions ainda.',
        sent: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        const sub = subRow.subscription;
        if (!sub || !sub.endpoint) return null;

        try {
          await webpush.sendNotification(sub, payload, {
            TTL: 86400, // 24 hours in seconds
            urgency: 'high'
          });
          return { id: subRow.id, status: 'sent' };
        } catch (err: any) {
          // If subscription is expired or unsubscribed, remove it
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

    return new Response(JSON.stringify({
      success: true,
      sentCount: successful,
      failedCount: failed,
      title: notificationTitle,
      body: notificationBody
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Erro inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

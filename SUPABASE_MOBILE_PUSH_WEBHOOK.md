# 📱 Guia de Notificações Push & Selo no Ícone Mobile (Supabase Webhook)

Este guia contém as instruções e o SQL necessário para que novos pedidos registrados enviem notificações automáticas e atualizem o ícone do aplicativo no celular (**Android / iOS PWA**), mesmo se o app estiver fechado ou minimizado.

---

## 1. 🗄️ SQL para rodar no Supabase (SQL Editor)

Acesse o painel do seu Supabase, clique em **SQL Editor** no menu lateral esquerdo, cole e execute o código abaixo:

```sql
-- 1. Cria a tabela de registro dos celulares inscritos para receber Push Notifications
CREATE TABLE IF NOT EXISTS oxente_push_subscriptions (
  id TEXT PRIMARY KEY,
  user_email TEXT,
  device_type TEXT DEFAULT 'mobile',
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permite gravação e leitura dos aparelhos autorizados
ALTER TABLE oxente_push_subscriptions DISABLE ROW LEVEL SECURITY;

-- 2. Tabela auxiliar de contagem de pedidos não visualizados por usuário
CREATE TABLE IF NOT EXISTS oxente_badge_counters (
  user_email TEXT PRIMARY KEY,
  unread_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE oxente_badge_counters DISABLE ROW LEVEL SECURITY;
```

---

## 2. ⚡ Como funciona a Notificação e o Selo no Ícone

- **Exclusivo Mobile:** O recurso é ativado apenas em celulares e tablets (Android e iOS). No computador, o comportamento permanece normal sem interferências.
- **App Aberto ou em Segundo Plano:** O sistema usa a sincronização em tempo real do Supabase (`supabase.channel('oxente_sales')`). Ao receber um novo pedido:
  - Incrementa o contador no ícone do aplicativo (`navigator.setAppBadge(count)`).
  - Emite som e notificação nativa.
  - Ao entrar na aba **Pedidos / Vendas**, o selo no ícone é automaticamente zerado e limpo (`navigator.clearAppBadge()`).
- **App Totalmente Fechado (Web Push):** O Service Worker (`sw.js`) recebe o evento `push` disparado pelo Supabase Webhook, chama `self.navigator.setAppBadge()` e exibe o banner nativo do sistema operacional.

---

## 3. 🌐 Configuração do Webhook no Painel do Supabase

Caso deseje acionar o envio de Push quando o aplicativo estiver 100% encerrado:

1. No painel do Supabase, vá em **Database** ➔ **Webhooks** (ou **Integrations** ➔ **Webhooks**).
2. Clique em **Create a new webhook**.
3. Preencha os campos:
   - **Name:** `notificar-novo-pedido-mobile`
   - **Table:** `oxente_sales`
   - **Events:** Marque **apenas `INSERT`**
   - **Webhook Type:** `Supabase Edge Functions` ou `HTTP Request`
   - **URL / Function:** Endpoint que recebe a venda e despacha a notificação Web Push aos endpoints da tabela `oxente_push_subscriptions`.

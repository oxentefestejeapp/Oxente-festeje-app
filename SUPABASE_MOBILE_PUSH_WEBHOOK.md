# 📱 Guia Completo: Notificações Push com App Fechado (Supabase Web Push)

Este guia contém as instruções passo a passo para ativar o envio de notificações mesmo com o **aplicativo 100% fechado** e a **tela do celular apagada/bloqueada** (Android / iPhone PWA).

---

## 🚀 Como funciona

1. **No Celular**: Ao abrir o sistema ou fazer login no celular, o app registra automaticamente uma chave exclusiva do aparelho na tabela `oxente_push_subscriptions` do seu Supabase.
2. **Ao entrar um Novo Pedido**: 
   - A venda é gravada na tabela `oxente_sales`.
   - O Supabase aciona a Edge Function `send-order-push`.
   - A Edge Function envia a notificação diretamente aos servidores do Google (FCM) e da Apple (APNs) usando chaves criptográficas VAPID.
   - O Google/Apple acorda o celular, exibe a notificação na tela de bloqueio e atualiza o selo numérico no ícone do app!

---

## Passo 1: Criar a tabela no Supabase (SQL Editor)

No painel do seu Supabase ([supabase.com](https://supabase.com)):
1. Vá em **SQL Editor** (menu lateral esquerdo).
2. Clique em **New query**.
3. Cole o código abaixo e clique em **Run**:

```sql
-- 1. Cria a tabela de registro dos celulares inscritos
CREATE TABLE IF NOT EXISTS public.oxente_push_subscriptions (
  id TEXT PRIMARY KEY,
  user_email TEXT,
  device_type TEXT DEFAULT 'mobile',
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permite gravação e leitura pública com segurança
ALTER TABLE public.oxente_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura e gravacao de push subscriptions" ON public.oxente_push_subscriptions;
CREATE POLICY "Permitir leitura e gravacao de push subscriptions" ON public.oxente_push_subscriptions
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 2. Tabela de contadores de badges
CREATE TABLE IF NOT EXISTS public.oxente_badge_counters (
  user_email TEXT PRIMARY KEY,
  unread_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.oxente_badge_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir badge counters" ON public.oxente_badge_counters;
CREATE POLICY "Permitir badge counters" ON public.oxente_badge_counters
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
```

---

## Passo 2: Implantar a Edge Function `send-order-push`

O código da função já está pronto no projeto no caminho `/supabase/functions/send-order-push/index.ts`.

### Opção A: Usando a Supabase CLI no terminal (Mais rápida)
Se você tem a CLI do Supabase instalada ou o projeto clonado:
```bash
# Faça login no Supabase
npx supabase login

# Associe ao seu projeto
npx supabase link --project-ref SEU_PROJECT_ID_DO_SUPABASE

# Envie a Edge Function
npx supabase functions deploy send-order-push --no-verify-jwt
```

### Opção B: Pelo Painel Web do Supabase (Sem terminal)
1. No painel do Supabase, clique em **Edge Functions** no menu lateral.
2. Clique em **Create Function** ou **New Function**.
3. Defina o nome da função como: `send-order-push`.
4. Copie todo o conteúdo do arquivo `supabase/functions/send-order-push/index.ts` deste repositório e cole no editor da função.
5. Clique em **Deploy**.

> 🔑 **Observação sobre as Chaves VAPID**: A Edge Function já possui as chaves estáveis pré-configuradas no código. Caso queira configurar como variáveis secretas no Supabase (em **Edge Functions > Secrets**):
> - `VAPID_PUBLIC_KEY`: `BI7IEtKXkeIFKOELzwkwAAuofPOYUe07MN6h5_uH6jEFyWZ8L-4OwsWnI1NaWxNU_OwYF7kvBuM-n58MfDA0oHE`
> - `VAPID_PRIVATE_KEY`: `yMZESviczjI4yNqad32NqO-ehEkmD6a8mwSFyHOsLS0`
> - `VAPID_SUBJECT`: `mailto:oxentefesteje@gmail.com`

---

## Passo 3: Configurar o Database Webhook (Disparo Automático)

Para que qualquer venda inserida (pelo sistema, PDV, API ou importação) dispare a notificação automaticamente:

1. No painel do Supabase, clique em **Database** ➔ **Webhooks**.
2. Clique no botão verde **Create a new webhook**.
3. Preencha o formulário:
   - **Name:** `notificar-novo-pedido-mobile`
   - **Table:** selecione a tabela `oxente_sales`
   - **Events:** marque apenas `Insert` (desmarque Update e Delete)
   - **Webhook type:** selecione **Supabase Edge Functions**
   - **Edge Function:** selecione `send-order-push`
   - **HTTP Method:** `POST`
4. Clique em **Create webhook**.

---

## Passo 4: Como Testar no Celular

1. Abra o aplicativo no seu celular (navegador Chrome no Android ou Safari no iPhone adicionado à Tela de Início).
2. Vá na aba **⚙️ Configurações** ➔ role até a seção **"Diagnóstico & Teste de Notificações Mobile"**.
3. Clique no botão **"3. Push em 4s (Bloquear Celular)"**:
   - O aplicativo vai registrar o celular e acionar a notificação com contagem regressiva de 4 segundos.
4. **Bloqueie a tela do celular imediatamente** ou saia para a tela inicial.
5. Você ouvirá o som, a vibração e verá a notificação:
   `🛍️ Novo Pedido #... - R$ ...` na tela de bloqueio com o selo no ícone!

---

## 🛠️ Por que algumas notificações não chegavam com o app fechado?

1. **Ícones SVG vs PNG nos Celulares**: O Android e o iPhone (iOS Safari) não renderizam ícones SVG em notificações de sistema em segundo plano. Se o ícone falhar ao ser decodificado com a tela apagada, o Android/iOS descartava a notificação. **Corrigido:** criamos ícones rasterizados PNG (`/pwa-192x192.png` e `/badge-96.png`) e adicionamos fallback triplo no Service Worker que nunca falha.
2. **Eventos que não disparavam Push anteriormente**:
   - Orçamento aprovado e transformado em pedido real (era um UPDATE, não disparava push). **Corrigido.**
   - Pedido marcado como "Pronto para Retirada". **Corrigido.**
   - Pedido alterado/editado por outro colaborador. **Corrigido.**
   - Mensagens no Chat Interno da Equipe. **Corrigido.**
3. **Otimização de Bateria do Android (Modo Doze / Deep Sleep)**:
   - No Android (Samsung, Xiaomi, Motorola), por padrão os navegadores entram em "Otimização de Bateria". Quando o celular fica com a tela apagada por mais de 10 minutos, o sistema suspende o aplicativo para economizar energia.
   - **Como resolver no Android**:
     1. Mantenha pressionado o ícone do aplicativo (ou do Chrome) na tela inicial.
     2. Toque no ícone de **Informações do app (i)**.
     3. Vá em **Bateria** ➔ marque **Sem restrições** (ou "Não otimizar").
     4. Em **Notificações**, certifique-se de que todas as opções estão permitidas e com som/pop-up ativados.
4. **No iPhone (iOS)**:
   - Para receber notificações com o app fechado no iPhone, é **obrigatório** abrir o app no Safari, tocar no botão de **Compartilhar** (quadrado com seta para cima) e escolher **"Adicionar à Tela de Início"**. O Web Push da Apple só é liberado para apps instalados na Tela de Início.

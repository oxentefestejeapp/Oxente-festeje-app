# 🚀 Guia de Hospedagem: SUPABASE PREMIUM BR
### Como Migrar e Configurar o seu Banco de Dados da Oxente Festeje no Seu Servidor Hostinger

Este guia descreve exatamente o que você precisa fazer para colocar seu banco de dados para rodar no seu endereço customizado da Hostinger: **`https://lightgray-dugong-844289.hostingersite.com/`**.

---

## 🧭 O que significa hospedar o Supabase no seu site?

O **Supabase** é um conjunto de ferramentas de backend (banco de dados PostgreSQL + Autenticação + APIs + tempo real por WebSockets) executado em servidores em nuvem. 

Para que a URL `https://lightgray-dugong-844289.hostingersite.com` responda às requisições do aplicativo Oxente Festeje, você tem duas opções principais:

### Opção A: Executar o Supabase Auto-Hospedado (Self-Hosted via Docker) no seu servidor Hostinger (Recomendado se tiver VPS)
Se você contratou um plano **VPS da Hostinger**:
1. Acesse o terminal SSH do seu VPS Hostinger.
2. Siga as instruções oficiais do Supabase para auto-hospedagem usando Docker (utilizando `git clone https://github.com/supabase/supabase.git` e rodando `./docker-compose.yml`).
3. Configure o roteamento/reversa do Nginx no VPS para direcionar a porta `8000` (porta de API do Supabase) para o seu domínio público `https://lightgray-dugong-844289.hostingersite.com/`.

### Opção B: Roteador de Proxy Reverso para uma Instância Cloud Existente
Se você possui um banco Supabase rodando na nuvem tradicional e apenas quer que ele fique sob a marca e domínio da sua empresa:
1. Adicione um arquivo de configuração de rota na Hostinger (ou arquivo `.htaccess` / proxy reverso do Nginx se for painel hPanel tradicional).
2. Redirecione todas as requisições que chegam em `https://lightgray-dugong-844289.hostingersite.com/` para a URL real do seu projeto na nuvem do Supabase.

---

## 🛠️ Como configurar o Aplicativo no Novo Endereço

Já adiantamos e facilitamos todo o processo no código! O aplicativo Oxente Festeje agora tem suporte dinâmico completo:

1. **URL Padrão Atualizada:** O aplicativo Oxente Festeje agora tenta conectar automaticamente e por padrão ao endereço `https://lightgray-dugong-844289.hostingersite.com`.
2. **Modo Sincronização Flexível:** No menu **Configurações** no topo direito do aplicativo, você ou qualquer colaborador podem visualizar e preencher manualmente novos endereços de `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

---

## 📝 Script SQL de Inicialização (Criar as Tabelas e Habilitar Sincronização)

Assim que seu novo servidor estiver rodando no endereço Hostinger, você precisa criar a estrutura do banco de dados (tabelas e canais em tempo real). 

Para rodar essa estruturação facilmente:
1. No seu aplicativo, vá em **Configurações** (no botão do topo direito da interface do Oxente Festeje).
2. Na seção de banco de dados, você verá o botão **"Copiar Roteiro SQL"** (ou use as instruções abaixo).
3. Abra o painel gerenciador da sua instância do Supabase (geralmente sob a porta de administração ou pelo painel web administrativo do banco), clique na aba **SQL Editor**, adicione uma nova query (New Query), cole todo o roteiro obtido e clique em **Run** (Executar).

### Estrutura de Tabelas Criadas Automaticamente pelo Roteiro:
* 🛒 `oxente_products` (Banco físico de produtos com preços, estoque, histórico coletivo, conferência e faixas de desconto progressivo).
* 📦 `oxente_sales` (Banco de pedidos unificado com datas de entrega, turnos, dados de contato, designer responsável, status de produção, valores pagos e faltantes).
* 🏪 `oxente_store_info` (Gerenciamento unificado de metadados Oxente Festeje como Instagram, Telefone, Endereço e modelos rápidos de mensageria).
* 👥 `oxente_users` (Permissões de colaboradores e senha administrativa protegida contra redefinições arbitrárias locais).

---

## 🛡️ Segurança e Resiliência (Sistema de Autonomia Offline)

Caso o seu servidor de hospedagem Hostinger fique instável, caia ou esteja passando por testes de porta no começo: **o sistema do Oxente Festeje não vai travar!**

Nós implementamos filtros de rede automáticos e persistência resiliente. Se a URL `https://lightgray-dugong-844289.hostingersite.com` estiver instável, o aplicativo:
* Continuará salvando, calculando e gravando todos os pedidos temporariamente no `localStorage` do navegador de forma transparente.
* Concederá acesso aos colaboradores consultarem os dados locais e cadastros já feitos até que a conexão do domínio da Hostinger responda de volta, garantindo que o fluxo da Oxente Festeje na loja física continue inabalável!

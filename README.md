# 📱 Radar OLX & Notícias (Frontend Android - Expo 57)

Aplicativo mobile desenvolvido para **Android** utilizando **React Native (0.86)** e **Expo SDK 57**, integrado em tempo real com o banco de dados **Supabase** e o microservidor **ARM32 (Samsung Galaxy Win)** para monitoramento contínuo de anúncios da OLX e portais de notícias.

---

## ✨ Funcionalidades Principais

- **🔔 Notificações Push Nativas (Expo 57 + FCM v1):**
  - Registro automático do token do aparelho no Supabase (`usuarios`).
  - Canal de notificação dedicado no Android (`default` com prioridade máxima, vibração e som).
  - Abertura direta do anúncio ou notícia ao tocar na notificação.
- **🏷️ Radares Customizáveis para OLX:**
  - Definição do termo de busca (ex: *iPhone 15*, *Pneu Aro 16*, etc.).
  - Preço alvo e margem de tolerância percentual com cálculo em tempo real da faixa aceita.
  - Botão **"Testar Agora ⚡"** para forçar uma varredura imediata no servidor Galaxy Win.
- **📰 Radar de Notícias:**
  - Monitoramento de páginas jornalísticas (ex: *G1*) baseado em proximidade de palavras-chave.
- **📊 Dashboard & Feed de Oportunidades:**
  - Resumo de métricas (radares ativos, alertas encontrados, status do Galaxy Win).
  - Lista completa de todos os resultados capturados com valor em destaque e botão direto para abrir no navegador.
  - Console de logs do servidor em tempo real.

---

## 🛠️ Tecnologias Utilizadas

- **Expo SDK 57** (versão 57.0.22)
- **React Native 0.86.3** / React 19.2.3
- **@react-navigation/native** (Bottom Tabs & Native Stack)
- **expo-notifications** & **expo-device**
- **@supabase/supabase-js**
- **@expo/vector-icons** (Ionicons)

---

## 📋 Pré-requisitos & Configurações

### 1. Variáveis e Credenciais
As credenciais do Supabase já estão configuradas no arquivo `supabase.js`:
- `supabaseUrl`: `https://rshqzbrxjykqdgjgdyky.supabase.co`

### 2. Notificações Push no Android (FCM v1)
O projeto contém:
- `google-services.json` configurado no diretório raiz do app.
- EAS Project ID: `a68a6cba-cbc8-482b-968b-f501341bea46`.
- `plugins` configurado no `app.json` para `expo-notifications`.

> [!NOTE]
> No Expo 57, o recebimento de notificações remotas de push em aparelhos físicos requer uma **Development Build** ou um APK gerado pelo **EAS Build** (não disponível no cliente Expo Go padrão do Android).

---

## 🚀 Como Executar

### Instalar Dependências
```bash
npm install
```

### Iniciar o Servidor Expo de Desenvolvimento
```bash
npm start
# ou
npx expo start
```

### Gerar APK de Teste para Instalar no Celular (EAS Build)
Para gerar um APK instalável diretamente no seu aparelho Android:
```bash
eas build -p android --profile preview
```
Ou para compilar localmente se tiver o Android Studio / SDK instalado:
```bash
npx expo run:android
```

---

## 📱 Estrutura das Telas

1. **Home (`DashboardScreen`):** Status do Galaxy Win, métricas em tempo real, últimas ofertas capturadas e console de logs.
2. **Radares (`MonitorListScreen`):** Gestão completa dos monitores cadastrados, interruptor liga/desliga, botão de teste manual e exclusão.
3. **Oportunidades (`AlertsScreen`):** Feed visual com todas as ofertas encontradas pelo robô, valores e links diretos.
4. **Novo Radar (`CreateMonitorScreen`):** Modal de cadastro com segmentação (OLX vs Notícia), preview de faixa de preço e frequência.
5. **Configurações (`SettingsScreen`):** Diagnóstico de hardware do Galaxy Win, exibição do Token Push do dispositivo e botão de teste de notificação local.

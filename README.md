# 🚀 AchôAI — Monitor Inteligente de Ofertas e Anúncios (Mobile SaaS 2026)

O **AchôAI** é um aplicativo mobile nativo (Android) desenvolvido com **React Native (0.86)** e **Expo SDK 57**, desenhado com padrões de **UI/UX Mobile-First 2026** e arquitetura **Freemium SaaS** de alta escalabilidade. O aplicativo se conecta em tempo real ao **Supabase** (PostgREST, Auth e Realtime) e a um backend autônomo em Python de varredura contínua de plataformas como **OLX**, **Zoom**, **Buscapé** e portais de notícias.

---

## 💎 Arquitetura Freemium SaaS & Tiers de Acesso

O sistema opera com 4 níveis de acesso perfeitamente orquestrados entre o aplicativo mobile e o banco de dados:

| Recurso / Funcionalidade | Free (Gratuito) | Premium Lite (Trial 2 Dias) | Premium (R$ 39,90/mês) | Administrador Master |
| :--- | :---: | :---: | :---: | :---: |
| **Limite de Radares Ativos** | **1 radar** | Até 5 radares | Até 5 radares | Ilimitado |
| **Plataformas de Busca** | OLX, Zoom, Buscapé | Todas (+ Outros Sites) | Todas (+ Outros Sites) | Todas |
| **Estratégias de Busca** | Padrão (Mais Recentes) | Todas (+ Preço Alvo) | Todas (+ Preço Alvo) | Todas |
| **Frequência de Varredura** | Fixa em 3 horas (180 min) | Customizável (30m a 6h) | Customizável (30m a 6h) | Customizável |
| **Cooldown do Botão "Varrer"** | **60 minutos** (com timer) | Instantâneo (Sem cooldown) | Instantâneo (Sem cooldown) | Instantâneo |
| **Sincronização Nuvem** | Não (Isolado no Aparelho) | Sim (Multi-Dispositivo) | Sim (Multi-Dispositivo) | Sim |
| **Visualização de Telemetria** | Bloqueada com Cadeado | Liberada | Liberada | Liberada |
| **Previsão de Próxima Busca** | Bloqueada com Cadeado | Liberada | Liberada | Liberada |
| **Abertura de Ofertas** | In-app protegido com Lock | Abertura Direta no Navegador | Abertura Direta no Navegador | Abertura Direta |
| **Duração do Plano** | Permanente | 48 horas (Única vez) | 30 dias renováveis | Vitalício |

---

### 🛡️ Regras Anti-Abuso do Teste Grátis (Premium Lite)
O teste grátis de 2 dias (48h) com benefícios Premium completos é estritamente limitado:
1. **Uma única vez por dispositivo físico (`deviceId`)**: Registrado no Supabase sob a chave `trial_dev_{deviceId}`.
2. **Uma única vez por conta Google (`email`/`id`)**: Registrado no Supabase sob a chave `trial_usr_{identifier}`.
3. **Auto-Downgrade & Poda de Radares**: Ao término das 48h, o app rebaixa a conta automaticamente para o plano Free, mantém o radar principal ativo e pausa os radares excedentes (`pruneExcessRadars`), alertando o usuário através de modal nativo (`TrialExpiredModal`).

---

### 💳 Assinatura Premium (R$ 39,90/mês) & Contagem Regressiva
- Concede 30 dias de acesso com liberação de até 5 radares simultâneos e sincronização em múltiplos aparelhos.
- **Contagem Regressiva Dinâmica**: Na aba *Configurações*, o usuário visualiza em tempo real `X dias, Y horas e Z minutos restantes`.
- **Aviso Preventivo de Renovação**: Quando restarem 5 dias ou menos, o app exibe um badge de aviso e o modal de renovação preventiva (`RenewalModal`).
- **Simulação de Pagamento Integrada**: Fluxo completo de simulação de checkout com animação de celebração (`CelebrationModal`).

---

## 🔐 Autenticação & Isolamento Multi-Tenant

- **Google Sign-In Exclusivo**: Formulários legados de email e senha foram 100% removidos. A autenticação é realizada com 1 toque via **Supabase Google OAuth** utilizando `expo-auth-session` e `expo-web-browser`.
- **Isolamento do Usuário Free**: Usuários do plano Free mantêm seus radares e alertas vinculados exclusivamente ao identificador do aparelho (`deviceId`), garantindo que o plano gratuito não sincronize dados indevidamente entre múltiplos celulares.
- **Migração Automática no Upgrade**: Ao assinar o plano Premium ou ativar o Trial, os radares locais do dispositivo são automaticamente migrados para a Conta Google do usuário (`migrateDeviceMonitorsToAccount`), permitindo acesso sincronizado instantâneo em qualquer outro dispositivo conectado.
- **Isolamento no Motor de Notificações**: O backend em Python (`worker.py` e `db.py`) implementa isolamento multi-tenant (`get_effective_owner_id`), garantindo que varreduras do mesmo anúncio por usuários diferentes notifiquem cada usuário de forma independente.

---

## 🎨 Design System & UI/UX (Mobile Edition 2026)

- **Dark Mode OLED**: Paleta refinada com fundo `#08090D`, superfícies `#11141D` e detalhes em Laranja Vibrante `#FF7A00` com efeito Glow.
- **Componentes Freemium Reutilizáveis**:
  - `LockOverlay`: Camada de bloqueio visual com efeito de vidro fosco, ícone de cadeado e botão de upgrade.
  - `LockBadge`: Selo compacto de bloqueio para plataformas e estratégias restritas.
  - `TierBadge`: Badge visual do plano ativo (Free, Premium Lite, Premium, Admin) integrado ao header da Home e Configurações.
  - `FreemiumModal`: Tabela comparativa SaaS moderna de planos.
  - `AdDetailModal`: Visualizador interno de ofertas com proteção para usuários Free.
- **Microinterações & Haptics**: Vibração tátil no aparelho ao capturar novas oportunidades via listener Realtime do Supabase.
- **Bottom Navigation Ergonômica**: Barra inferior elevada com cálculo dinâmico de área segura (`SafeAreaInsets`), evitando conflitos com a barra de navegação do sistema Android.

---

## 📱 Telas do Aplicativo

1. **Início (`DashboardScreen`)**:
   - Header com branding AchôAI e badge dinâmico do plano (`TierBadge`).
   - Métricas em tempo real (Radares Ativos, Oportunidades Capturadas, Status do Servidor).
   - Feed das últimas oportunidades capturadas (com proteção por tier ao abrir).
   - Próxima busca programada e Telemetria (com `LockOverlay` no plano Free).
2. **Radares (`MonitorListScreen`)**:
   - Lista completa de monitores com filtros rápidos (Todos, Ativos, Pausados).
   - Limitação dinâmica de radares (1 no Free vs 5 no Premium).
   - Botão **"Varrer Agora"** com contagem regressiva de 60 minutos e cadeado no plano Free.
3. **Alertas (`AlertsScreen`)**:
   - Feed completo de oportunidades capturadas com busca por texto e filtros rápidos por plataforma.
   - Rotas de abertura condicionadas ao plano do usuário.
4. **Configurar Radar (`CreateMonitorScreen`)**:
   - Seleção visual de plataforma (OLX, Zoom, Buscapé, Outros Sites).
   - Estratégias de busca (Mais Recentes, Preço Alvo com margem percentual, Menor Preço).
   - Bloqueio contextual de plataformas e estratégias adicionais para usuários Free.
5. **Configurações (`SettingsScreen`)**:
   - Seção **"MINHA ASSINATURA & PLANO"**: Exibição do tier atual, tempo restante com contagem regressiva e botões de upgrade/renovação/trial.
   - Seção **"IDENTIDADE E CONTA"**: Login Google com 1 clique ou exibição do perfil autenticado com detalhes de sincronização.
   - Diagnóstico do Motor de Varredura e teste de notificação local.

---

## 🛠️ Tecnologias Utilizadas

### Frontend Mobile
- **Expo SDK 57** (`57.0.22`)
- **React Native 0.86.3** / React 19.2.3
- **@react-navigation/native** (Bottom Tabs & Native Stack)
- **expo-notifications** & **expo-device**
- **expo-auth-session** & **expo-web-browser**
- **@supabase/supabase-js** (PostgREST + Realtime + Auth)
- **@react-native-async-storage/async-storage**
- **@expo/vector-icons** (Ionicons)

### Backend de Varredura
- **Python 3.11+**
- **Supabase Python SDK**
- **Requests & BeautifulSoup4**
- **Push Notification Service (Expo FCM v1)**

---

## 🚀 Como Executar o Projeto

### 1. Instalar Dependências
```bash
cd radar-olx-app
npm install
```

### 2. Iniciar o Ambiente de Desenvolvimento
```bash
npx expo start
```

### 3. Gerar APK Instalável (EAS Build)
Para compilar um APK standalone do Android:
```bash
eas build -p android --profile preview
```
Ou para compilar localmente com Android Studio / SDK:
```bash
npx expo run:android
```

---

## 📄 Licença e Direitos

AchôAI © 2026. Todos os direitos reservados.
Desenvolvido com foco em alta performance, usabilidade móvel e modelos SaaS contemporâneos.

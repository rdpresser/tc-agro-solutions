# TC Agro Solutions - Mobile App

App mobile React Native (Expo) para monitoramento IoT agrícola. Roda em **iOS** e **Android** com o mesmo código.

## Tech Stack

| Componente | Tecnologia |
|---|---|
| Framework | Expo SDK 55 + Expo Router |
| Linguagem | TypeScript |
| Estilização | NativeWind v4 (Tailwind CSS) |
| Estado Cliente | Zustand v5 |
| Estado Servidor | TanStack Query v5 |
| Formulários | React Hook Form + Zod |
| HTTP | Axios |
| Real-time | SignalR |
| Auth | expo-secure-store |
| Biometria | expo-local-authentication |

## Estrutura do Projeto

```
poc/mobile/
├── app/                          # Navegação (Expo Router file-based)
│   ├── _layout.tsx               # Root: providers (Query, Auth, Theme)
│   ├── index.tsx                 # Auth guard → login ou dashboard
│   ├── (auth)/
│   │   ├── login.tsx             # Tela de login
│   │   └── signup.tsx            # Tela de cadastro
│   └── (app)/
│       ├── _layout.tsx           # Bottom Tab Navigator (5 tabs)
│       ├── (dashboard)/index.tsx # Dashboard com métricas real-time
│       ├── (properties)/         # CRUD de propriedades
│       ├── (plots)/              # CRUD de talhões
│       ├── (sensors)/            # CRUD + monitoramento live
│       ├── (alerts)/             # Alertas com tabs
│       ├── (users)/              # Gestão de usuários (admin)
│       └── (settings)/           # Perfil, tema, biometria
├── src/
│   ├── api/                      # Camada HTTP (Axios)
│   ├── hooks/                    # TanStack Query + SignalR + biometria
│   ├── stores/                   # Zustand (auth, theme, realtime)
│   ├── components/               # UI kit + componentes de domínio
│   ├── providers/                # Query, Auth, Theme providers
│   ├── constants/                # Cores, config API, tipos
│   ├── lib/                      # Formatação, validação, token, storage
│   └── types/                    # Interfaces TypeScript
├── app.json                      # Configuração Expo
├── tailwind.config.js            # Tema Tailwind (cores agro)
├── metro.config.js               # Metro + NativeWind
└── babel.config.js               # Babel + NativeWind
```

## Funcionalidades

- **Auth**: Login/signup com JWT, armazenamento seguro (SecureStore), biometria (Face ID / fingerprint)
- **Dashboard**: 4 stat cards, 4 métricas real-time, leituras recentes, alertas pendentes, pull-to-refresh
- **Properties**: CRUD completo com busca, paginação, seletor de owner, coordenadas
- **Plots**: CRUD com filtros de status, tipo de cultura, irrigação, thresholds
- **Sensors**: CRUD, histórico de leituras, grid de monitoramento live
- **Alerts**: Tabs (Pending/Resolved/All), ação de resolve, badge counter no tab bar
- **Users**: Gestão admin com roles
- **Settings**: Perfil, dark mode, biometria, logout
- **Real-time**: SignalR (sensor + alert hubs) com fallback HTTP polling 15s
- **Connection Badge**: Indicador de status (Live/Reconnecting/Fallback/Offline)

## APIs Consumidas

| Serviço | Porta | Endpoints |
|---|---|---|
| Identity | 5001 | `/auth/login`, `/auth/register`, `/api/user` |
| Farm | 5002 | `/api/properties`, `/api/plots`, `/api/sensors`, `/api/owners` |
| Sensor Ingest | 5003 | `/api/dashboard/latest`, `/api/readings/latest`, `/api/sensors/{id}/readings` |
| Analytics | 5004 | `/api/alerts/pending`, `/api/alerts/{id}/resolve` |

**SignalR Hubs**: `/dashboard/sensorshub`, `/dashboard/alertshub`

---

## Pré-requisitos Comuns

- **Node.js** 18+ → https://nodejs.org
- **npm** (vem com Node)

---

## Setup no macOS

### 1. Instalar dependências

```bash
cd poc/mobile
npm install
```

### 2. Rodar com Expo Go (mais rápido, sem Xcode)

```bash
npx expo start
```

Escaneia o QR code com a câmera do iPhone (precisa do app **Expo Go** instalado via App Store).

### 3. Rodar no Simulador iOS (precisa do Xcode)

**Instalar Xcode:**
1. Abre a **App Store** → busca **Xcode** → instala (~10GB)
2. Abre o Xcode e aceita os termos de licença
3. Vai em **Xcode → Settings → Platforms** → instala **iOS**
4. No terminal:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

**Rodar:**

```bash
cd poc/mobile
npx expo run:ios
```

O simulador iPhone abre automaticamente com o app.

### 4. Rodar no Emulador Android (precisa do Android Studio)

**Instalar Android Studio:**
1. Baixa em https://developer.android.com/studio
2. Instala e abre
3. Vai em **More Actions → Virtual Device Manager**
4. Cria um emulador (ex: Pixel 8, API 34)
5. Configura a variável de ambiente no `~/.zshrc`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

6. Recarrega o terminal: `source ~/.zshrc`

**Rodar:**

```bash
cd poc/mobile
npx expo run:android
```

---

## Setup no Windows

### 1. Instalar Node.js

Baixa e instala o Node.js 18+ em https://nodejs.org

### 2. Instalar dependências

```powershell
cd poc\mobile
npm install
```

### 3. Rodar com Expo Go (iOS e Android)

```powershell
npx expo start
```

- **Android**: Instala o app **Expo Go** pela Play Store, escaneia o QR code
- **iPhone**: Instala o app **Expo Go** pela App Store, escaneia o QR code com a câmera

> O PC e o celular devem estar na **mesma rede Wi-Fi**. Se não funcionar, use `npx expo start --tunnel`.

### 4. Rodar no Emulador Android (precisa do Android Studio)

**Instalar Android Studio:**
1. Baixa em https://developer.android.com/studio
2. Instala e abre
3. Vai em **More Actions → Virtual Device Manager**
4. Cria um emulador (ex: Pixel 8, API 34)
5. Configura variáveis de ambiente:
   - Abre **Configurações do Sistema → Variáveis de Ambiente**
   - Adiciona `ANDROID_HOME` = `C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk`
   - Adiciona ao `Path`: `%ANDROID_HOME%\emulator` e `%ANDROID_HOME%\platform-tools`

**Rodar:**

```powershell
cd poc\mobile
npx expo run:android
```

### 5. iOS no Windows

Não é possível rodar o simulador iOS no Windows (requer macOS + Xcode). Alternativas:

- Usa **Expo Go** no iPhone físico (funciona normalmente)
- Usa um Mac com Xcode para builds iOS

---

## Comandos Úteis

| Comando | Descrição |
|---|---|
| `npx expo start` | Inicia o dev server (QR code para Expo Go) |
| `npx expo start --tunnel` | Dev server com tunnel (não precisa mesma rede Wi-Fi) |
| `npx expo run:ios` | Build nativo + abre simulador iOS (macOS + Xcode) |
| `npx expo run:android` | Build nativo + abre emulador Android |
| `npx tsc --noEmit` | Verificação de tipos TypeScript |
| `npx expo export` | Gera bundle de produção |

## Configuração de API

Por padrão o app conecta nos serviços locais:

| Serviço | URL |
|---|---|
| Identity | `http://localhost:5001` |
| Farm | `http://localhost:5002` |
| Sensor Ingest | `http://localhost:5003` |
| Analytics | `http://localhost:5004` |

Para alterar, edite `src/constants/api-config.ts`.

> **Atenção**: No celular físico via Expo Go, `localhost` aponta para o próprio celular. Substitua por o IP da máquina onde os serviços rodam (ex: `http://192.168.0.15:5001`).

## Troubleshooting

| Problema | Solução |
|---|---|
| QR code não aparece | Certifique que está rodando em terminal interativo, não via IDE |
| Expo Go não conecta | Verifique se estão na mesma rede Wi-Fi ou use `--tunnel` |
| `localhost` não funciona no celular | Troque por o IP da máquina em `api-config.ts` |
| Build iOS falha com "platform not installed" | Xcode → Settings → Platforms → instala iOS |
| CocoaPods não encontrado | Roda `sudo gem install cocoapods` ou instala via Homebrew |
| Android emulador não aparece | Abra o emulador no Android Studio antes de rodar `expo run:android` |
| Erro de permissão no macOS | Roda `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` |

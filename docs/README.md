# Biscast Bot 🤖

Bot do Discord feito em Node.js rodando via Termux/Android.

**Um bot para Discord em desenvolvimento ativo, focado em organização e personalização!**
*(Versão atual: BIS.0.4.4-alpha | Estado: Alpha)*

---

## ✨ Funcionalidades Principais
- **Multi-prefixos**: Aceita vários prefixos simultaneamente (ex: `..`, `,`, `!`).
- **Aliases de comandos**: Comandos podem ter nomes alternativos (ex: `addprefix` = `botarprefixo`).
- **Categorias de comandos**: Organizados em pastas (`economy`, `welcome`, `bye`, `config`, `info`, `util`).
- **Carregamento automático**: Comandos e eventos são detectados automaticamente via filesystem.
- **Sistema de dono**: Controle restrito ao dono via Discord ID (config.json).
- **Comando `help` dinâmico**: Gera ajuda baseada em `command_data.json`.
- **Template de comandos**: Use `mkcmd` para criar novos comandos rapidamente.
- **Sincronização de mensagens**: Sistema `@register-messages` + `syncmsg` para i18n.
- **Banco de dados Supabase (PostgreSQL)**: Operações atômicas via RPC (economia, XP, cooldowns).

---

## 🛠️ Instalação e Uso

### 1. Clone o repositório
```bash
git clone [URL_DO_REPOSITÓRIO]
cd bisc-bot
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o ambiente
Crie um arquivo `.env` na raiz (ou em `.config/.env`) com as variáveis obrigatórias:
```env
BOT_TOKEN=seu_token_do_discord
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

> **Nota:** `SUPABASE_SERVICE_ROLE_KEY` é obrigatória (backend sem RLS). O bot falha no boot se faltar.

### 4. Configure o schema no Supabase
Execute o script SQL em `scripts/supabase-schema.sql` no **SQL Editor** do painel do Supabase para criar:
- Tabelas: `users`, `welcomes`, `byes`
- RPCs atômicas: `transfer_biscoins`, `add_xp_and_check_level`, `check_and_set_cooldown`, `increment_field`, `decrement_field_safe`, `transfer_between_wallet_bank`

### 5. Inicie o bot
```bash
npm start
# ou em desenvolvimento (auto-reload via nodemon):
npm run dev
```

> O ponto de entrada é `index.js` → `src/app/heart.js`.

---

## 📂 Estrutura do Projeto (Pós-Migração Supabase)
```
bisc-bot/
├── index.js                      # Entry point → src/app/heart.js
├── package.json                  # Manifest + scripts (start, dev, test)
├── .env                          # Segredos (NÃO versionar)
├── .gitignore
├── scripts/
│   └── supabase-schema.sql       # DDL + RPCs (rodar manualmente no Supabase)
├── src/
│   ├── app/
│   │   ├── heart.js              # Main do bot (startup, BotState, loaders)
│   │   └── BotState.js           # Singleton EventEmitter (status, uptime, client)
│   ├── config/
│   │   ├── env.js                # Carrega .env + valida REQUIRED_VARS
│   │   ├── config.js             # Prefixos/owners persistidos em config.json
│   │   ├── message_data.json     # Source of truth de TODAS as mensagens (i18n)
│   │   ├── command_data.json     # Metadados de comandos (nome, aliases, categoria)
│   │   ├── sync_snapshot.json    # Estado 3-way merge do syncmsg
│   │   ├── msg-handler.js        # Resolvedor de mensagens + fallback __missing__
│   │   └── syncmsg.js            # Sincroniza @register-messages ↔ message_data.json
│   ├── commands/
│   │   ├── economy/              # daily, pay, banco, depositar, sacar, carteira, perfil
│   │   ├── welcome/              # welcome, setwelcome, viewwelcome, removewelcome
│   │   ├── bye/                  # bye, setbye, viewbye, removebye
│   │   ├── config/               # prefix, addprefix, removeprefix, listprefixes, mkcmd, sync
│   │   ├── info/                 # help, ping
│   │   └── util/                 # store_chat, twimg
│   ├── events/
│   │   ├── Ready.js              # Log de boot + prefixos
│   │   ├── MessageCreate.js      # XP + prefix routing + command dispatch
│   │   ├── GuildMemberAdd.js     # Welcome system
│   │   └── guildMemberRemove.js  # Bye system
│   ├── infra/
│   │   ├── DiscordClient.js      # Factory do client + intents + validarAmbiente
│   │   ├── Supabase.js           # Cliente Supabase + connectToSupabase health check
│   │   ├── logger/               # Logger minimalista (file + console, 4 níveis)
│   │   └── database/
│   │       ├── index.js          # Barrel: user/welcome/bye repositories
│   │       └── repositories/
│   │           ├── userRepository.js     # RPCs economia, XP, cooldown, transfer
│   │           ├── welcomeRepository.js  # CRUD welcomes
│   │           └── byeRepository.js      # CRUD byes
│   ├── loaders/
│   │   ├── CommandLoader.js      # Auto-discovery recursivo + Map<name, cmd> + aliases
│   │   └── EventLoader.js        # Auto-discovery recursivo + client.on/once
│   ├── types/
│   │   └── database.js           # JSDoc typedefs + mapUserRowToProfile (snake↔camel)
│   └── util/
│       ├── wrong-sort/           # Fuzzy matcher (Levenshtein + Jaro-Winkler + teclado)
│       ├── input_time_parser.js  # Parser PT-BR de datas/horas (natural language)
│       ├── msg-modder.js         # CLI para editar message_data.json via YAML
│       └── TwimgFetch.js         # Extractor de vídeo Twitter (twdown.net)
├── tests/
│   └── unit/
│       ├── wrongSort.test.js     # TST-01: sugestão de comandos
│       └── cooldown.test.js      # TST-02: parser de tempo + janelas 24h/48h
└── docs/
    ├── CHANGELOG.md
    ├── README.md                 # Este arquivo
    ├── mongodb-to-supabase.md    # Análise da migração
    └── mongodb-to-supabase-plan.md
```

---

## ⚙️ Variáveis de Ambiente (`.env`)
| Variável | Obrigatória? | Descrição |
|----------|--------------|-----------|
| `BOT_TOKEN` | Sim | Token do bot Discord |
| `SUPABASE_URL` | Sim | URL do projeto Supabase (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave Service Role (backend sem RLS) |
| `BOT_ID` | Não | ID do bot (para menções) |
| `BOT_OWNERS` | Não | IDs dos donos separados por vírgula (fallback para config.json) |
| `LOG_LEVEL` | Não | `debug` \| `info` \| `warn` \| `error` (padrão: `info`) |

---

## 🧪 Testes
```bash
npm test
```
Executa a suíte nativa do Node.js (`node --test`) sobre:
- `tests/unit/wrongSort.test.js` — algoritmo de sugestão de comandos (TST-01)
- `tests/unit/cooldown.test.js` — parser de tempo + janelas 24h/48h (TST-02)

---

## 📝 Comandos Úteis
| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia o bot (produção) |
| `npm run dev` | Inicia com nodemon (auto-reload) |
| `npm test` | Roda suíte de testes unitários |
| `node src/util/msg-modder.js` | CLI para editar message_data.json via YAML |

---

## 🛠️ Criando um Novo Comando
Use o comando `mkcmd` no Discord (apenas donos):
```
..mkcmd
```
Isso guiará interativamente a criação:
1. Nome do comando
2. Descrição
3. Categoria (pasta em `src/commands/`)
4. Rascunho da lógica (inserido como comentário no template)

Gera automaticamente:
- Arquivo `src/commands/<categoria>/<nome>.js` a partir de `cmd-template.txt`
- Entrada em `src/config/command_data.json`

---

## ⚠️ Problemas Conhecidos
- O parser de linguagem natural (`input_time_parser`) tem comportamento de timezone não-padrão para "amanhã" (+12h) e "daqui a N dias" (variável). Usado apenas no comando admin `store_chat`.
- Projeto em alpha — mudanças bruscas na API podem ocorrer.

---

## 📜 Changelog
Veja todas as mudanças no [CHANGELOG.md](CHANGELOG.md).
*Última atualização: 2026-09-27 (BIS.0.4.4-alpha)*

---

## 🚀 Próximos Passos
- Evoluir para versão BIS.1.0.0-beta!
- Implementar sistema de plugins
- Adicionar dashboard web

*Feito com ❤️ (e um pouco de TOC) por Felos*
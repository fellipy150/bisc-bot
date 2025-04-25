
# BiscBot

Bot do Discord feito em Node.js rodando via Termux.

## Pré-requisitos

- [Node.js](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/)
- Termux com acesso ao armazenamento (`termux-setup-storage`)
- Arquivo `.env` com seu token:

```env
DISCORD_TOKEN=seu_token_aqui
```

## Instalação

No Termux, navegue até o diretório do projeto:

```bash
cd /mnt/sdcard/.bisc
```

Instale as dependências:

```bash
yarn install
```

## Estrutura

- `src/index.js` — Arquivo principal.
- `src/comandos/` — Comandos do bot.
- `src/event/` — Manipuladores de eventos.
- `src/util/` — Arquivos utilitários.
- `src/config/` — Configurações do bot.
- `.env` — Variáveis de ambiente (não versionado).

## Como rodar

Use o comando abaixo no Termux:

```bash
node src/index.js
```

Se quiser manter o bot rodando mesmo ao fechar o terminal, use:

```bash
nohup node src/index.js &
```

## Logs

Você pode criar logs personalizados na pasta `util/` ou usar ferramentas como `proj_log.txt` para debug.

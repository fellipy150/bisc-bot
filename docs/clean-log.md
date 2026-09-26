O log de inicialização confirma que a arquitetura legada da TUI e os subprocessos foram completamente removidos — o bot agora roda de forma limpa e direta em Node.js.
Quanto ao planejamento de migração de banco, o Supabase utiliza PostgreSQL por baixo dos panos, o que mudará o paradigma de documentos (NoSQL do MongoDB) para relacional (SQL). No momento oportuno, trocaremos a camada do Mongoose/MongoDB por Prisma ORM ou @supabase/supabase-js, refatorando os models e services na pasta src/infra/database/.
Sanitização e Padronização dos Logs
Para deixar os logs profissionais, estruturados e informativos, aplicaremos as seguintes mudanças:
 * Remoção de Emojis e Símbolos Duplicados: Formatação corporativa baseada em marcas de texto limpas (e.g., [INFO], [WARN], [ERROR], [DEBUG]).
 * Cores ANSI Discretas no Terminal: Manteremos destaques visuais apenas para leitura rápida no terminal, mas sem poluição de caracteres de console.
 * Mapeamento de Objetos de Erro: Tratar adequadamente a pilha de exceções (stack trace) e mensagens de erro para que os detalhes não sejam truncados no arquivo de log.
src/infra/logger/Logger.js
Substitua o conteúdo do seu logger por este modelo sanitizado:
/**
 * Caminho: src/infra/logger/Logger.js
 * Descrição: Sistema de logs sanitizado para produção (formato texto limpo, sem emojis).
 */
import fs from 'fs';
import path from 'path';
import { config } from '../../config/env.js';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const CURRENT_LEVEL = LEVELS[config.log?.level?.toLowerCase()] ?? LEVELS.info;

function formatTimestamp() {
  return new Date().toISOString();
}

function writeToFile(level, message, details = '') {
  const line = `[${formatTimestamp()}] [${level.toUpperCase()}] ${message}${details ? ' ' + details : ''}\n`;
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('[FATAL] Falha ao escrever no arquivo de log:', err);
  });
}

function parseArgs(args) {
  if (!args.length) return '';
  return args
    .map((arg) => (arg instanceof Error ? arg.stack || arg.message : typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
    .join(' ');
}

export const Logger = {
  debug(message, ...args) {
    if (CURRENT_LEVEL > LEVELS.debug) return;
    const details = parseArgs(args);
    console.log(`\x1b[90m[DEBUG] ${message}${details ? ' - ' + details : ''}\x1b[0m`);
    writeToFile('debug', message, details);
  },

  info(message, ...args) {
    if (CURRENT_LEVEL > LEVELS.info) return;
    const details = parseArgs(args);
    console.log(`\x1b[36m[INFO] ${message}${details ? ' - ' + details : ''}\x1b[0m`);
    writeToFile('info', message, details);
  },

  warn(message, ...args) {
    if (CURRENT_LEVEL > LEVELS.warn) return;
    const details = parseArgs(args);
    console.warn(`\x1b[33m[WARN] ${message}${details ? ' - ' + details : ''}\x1b[0m`);
    writeToFile('warn', message, details);
  },

  error(message, ...args) {
    if (CURRENT_LEVEL > LEVELS.error) return;
    const details = parseArgs(args);
    console.error(`\x1b[31m[ERROR] ${message}${details ? ' - ' + details : ''}\x1b[0m`);
    writeToFile('error', message, details);
  }
};

Sanitizando as chamadas de Log no Inicializador
Agora, limpe as mensagens informais/duplicadas nos arquivos que geram os logs do boot do sistema:
1. index.js
import { Logger } from './src/infra/logger/index.js';
import { startBot } from './src/app/heart.js';

async function bootstrap() {
  Logger.info("Inicializando o processo da aplicação em ambiente Node.js");
  await startBot();
}

bootstrap().catch((err) => {
  Logger.error("Falha crítica durante a inicialização da aplicação", err);
  process.exit(1);
});

2. src/infra/MongoDB.js
// Onde houver logs da conexão com o MongoDB:
Logger.error("Falha na conexão com o cluster MongoDB", err);
Logger.warn("Aplicação operando sem integração com banco de dados MongoDB");

3. src/loaders/CommandLoader.js e EventLoader.js
// No CommandLoader:
Logger.info("Iniciando o carregamento do módulo de comandos");
Logger.info(`Módulo de comandos carregado com sucesso: ${totalComandos} comandos e ${totalAliases} aliases (${tempoExecucao}ms)`);

// No EventLoader:
Logger.info("Registrando escutadores de eventos do Discord");
Logger.info(`Eventos registrados com sucesso. Total: ${totalEventos}`);

4. src/events/Ready.js (ou onde o bot loga a sessão ativa)
Logger.info(`Sessão autenticada como ${client.user.tag}`);
Logger.info(`Prefixos operacionais configurados: ${prefixos.join(', ')}`);

Com essas alterações aplicadas, o console terá a seguinte saída limpa e corporativa no próximo npm start:
[INFO] Inicializando o processo da aplicação em ambiente Node.js
[ERROR] Falha na conexão com o cluster MongoDB - Error: querySrv ENOTFOUND _mongodb._tcp.bisc-bot-cluster.duwb4fa.mongodb.net
[WARN] Aplicação operando sem integração com banco de dados MongoDB
[INFO] Iniciando o carregamento do módulo de comandos
[INFO] Módulo de comandos carregado com sucesso: 28 comandos e 66 aliases (247ms)
[INFO] Registrando escutadores de eventos do Discord
[INFO] Eventos registrados com sucesso. Total: 4
[INFO] Sessão autenticada como project-bot#3069
[INFO] Prefixos operacionais configurados: .., ,,



Excelente, um formato compacto estilo CLI minimalista economiza espaço na tela e deixa o terminal extremamente limpo.
Aqui está o src/infra/logger/Logger.js atualizado para usar os marcadores compactos [i], [!], [x] e [?]:
/**
 * Caminho: src/infra/logger/Logger.js
 * Descrição: Sistema de logs minimalista com marcadores compactos baseados em caracteres.
 */
import fs from 'fs';
import path from 'path';
import { config } from '../../config/env.js';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const CURRENT_LEVEL = LEVELS[config.log?.level?.toLowerCase()] ?? LEVELS.info;

function formatTimestamp() {
  return new Date().toISOString();
}

function writeToFile(tag, message, details = '') {
  const line = `[${formatTimestamp()}] [${tag}] ${message}${details ? ' ' + details : ''}\n`;
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('[x] Falha ao escrever no arquivo de log:', err);
  });
}

function parseArgs(args) {
  if (!args.length) return '';
  return args
    .map((arg) => (arg instanceof Error ? arg.stack || arg.message : typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
    .join(' ');
}

export const Logger = {
  debug(message, ...args) {
    if (CURRENT_LEVEL > LEVELS.debug) return;
    const details = parseArgs(args);
    console.log(`\x1b[90m[d] ${message}${details ? ' - ' + details : ''}\x1b[0m`);
    writeToFile('DEBUG', message, details);
  },

  info(message, ...args) {
    if (CURRENT_LEVEL > LEVELS.info) return;
    const details = parseArgs(args);
    console.log(`\x1b[36m[i] ${message}${details ? ' - ' + details : ''}\x1b[0m`);
    writeToFile('INFO', message, details);
  },

  warn(message, ...args) {
    if (CURRENT_LEVEL > LEVELS.warn) return;
    const details = parseArgs(args);
    console.warn(`\x1b[33m[!] ${message}${details ? ' - ' + details : ''}\x1b[0m`);
    writeToFile('WARN', message, details);
  },

  error(message, ...args) {
    if (CURRENT_LEVEL > LEVELS.error) return;
    const details = parseArgs(args);
    console.error(`\x1b[31m[x] ${message}${details ? ' - ' + details : ''}\x1b[0m`);
    writeToFile('ERROR', message, details);
  }
};

Com essa alteração, o terminal passará a exibir os logs de forma bem compacta:
[i] Inicializando o processo da aplicação em ambiente Node.js
[x] Falha na conexão com o cluster MongoDB - Error: querySrv ENOTFOUND...
[!] Aplicação operando sem integração com banco de dados MongoDB
[i] Iniciando o carregamento do módulo de comandos
[i] Módulo de comandos carregado com sucesso: 28 comandos e 66 aliases (247ms)


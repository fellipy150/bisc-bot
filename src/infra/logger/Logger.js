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

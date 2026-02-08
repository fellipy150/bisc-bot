/**
 * Caminho: infra/logger/Logger.js
 * Descrição: Sistema de logs centralizado com suporte a arquivo, terminal colorido e níveis de log.
 */
import fs from 'fs';
import path from 'path';
import { config } from '../../config/env.js';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');

// Garante que a pasta logs existe
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const CURRENT_LEVEL = LEVELS[config.log.level.toLowerCase()] ?? LEVELS.info;

function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

function writeToFile(text) {
  fs.appendFile(LOG_FILE, text + '\n', (err) => {
    if (err) console.error('FATAL: Falha ao escrever no arquivo de log.', err);
  });
}

export const Logger = {
  debug(message, ...args) {
    if (CURRENT_LEVEL > LEVELS.debug) return;
    const msg = args.length ? `${message} ${JSON.stringify(args)}` : message;
    console.log(`\x1b[90m🐛 ${message}\x1b[0m`, ...args); 
    writeToFile(formatMessage('debug', msg));
  },

  info(message, ...args) {
    if (CURRENT_LEVEL > LEVELS.info) return;
    const msg = args.length ? `${message} ${JSON.stringify(args)}` : message;
    console.log(`\x1b[36mℹ️  ${message}\x1b[0m`, ...args); 
    writeToFile(formatMessage('info', msg));
  },

  warn(message, ...args) {
    if (CURRENT_LEVEL > LEVELS.warn) return;
    const msg = args.length ? `${message} ${JSON.stringify(args)}` : message;
    console.warn(`\x1b[33m⚠️  ${message}\x1b[0m`, ...args); 
    writeToFile(formatMessage('warn', msg));
  },

  error(message, error) {
    const errorStack = error?.stack || error?.message || error || '';
    const fullMsg = `${message} | ${errorStack}`;
    console.error(`\x1b[31m❌ ${message}\x1b[0m`, error || ''); 
    writeToFile(formatMessage('error', fullMsg));
  }
};


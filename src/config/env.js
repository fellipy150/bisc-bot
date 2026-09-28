/**
 * Caminho: config/env.js
 * Descrição: Orquestra o carregamento e a validação das variáveis de ambiente (.env).
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Tenta localizar o arquivo .env em diferentes locais possíveis
const rootPath = process.cwd();
const possiblePaths = [
  path.join(rootPath, '.env'),
  path.join(rootPath, '.config', '.env')
];

let envPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    envPath = p;
    break;
  }
}

if (envPath) {
  dotenv.config({ path: envPath });
} else {
  console.warn("[!] Nenhum arquivo .env encontrado. Tentando usar variáveis de ambiente do sistema.");
}

// Variáveis obrigatórias para o funcionamento do bot
const REQUIRED_VARS = ['BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingVars = REQUIRED_VARS.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  console.error(`[x] Variáveis de ambiente faltando: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Objeto de configuração exportado de forma tipada e limpa
export const config = {
  bot: {
    token: process.env.BOT_TOKEN,
    id: process.env.BOT_ID,
    owners: (process.env.BOT_OWNERS || '').split(','),
  },
  db: {
    url: process.env.SUPABASE_URL,
  },
  log: {
    level: process.env.LOG_LEVEL || 'info', // Níveis: debug, info, warn, error
  }
};


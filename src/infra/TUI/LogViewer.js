/**
 * Caminho: infra/TUI/LogViewer.js
 * Descrição: Gerencia a visualização dos logs do bot através do terminal.
 */
import fs from 'fs';
import path from 'path';
import { Logger } from '../logger';

const LOG_FILE = path.resolve(process.cwd(), 'logs/bot.log');

/**
 * Função para abrir e exibir os logs
 */
export async function openLogViewer() {
  console.clear();
  Logger.info('--- Modo de Visualização de Logs (Últimas 20 linhas) ---');

  if (!fs.existsSync(LOG_FILE)) {
    console.log('\x1b[31m⚠️  Arquivo de log ainda não foi criado.\x1b[0m');
  } else {
    try {
      const logs = fs.readFileSync(LOG_FILE, 'utf8');
      const lines = logs.split('\n').filter(line => line.trim() !== '');
      const lastLines = lines.slice(-20);

      console.log('\x1b[90m' + lastLines.join('\n') + '\x1b[0m');
    } catch (error) {
      Logger.error('Erro ao ler arquivo de log:', error);
    }
  }

  console.log('\n\x1b[33mPressione ENTER para voltar ao menu...\x1b[0m');
  
  return new Promise((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
}


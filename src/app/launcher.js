/**
 * Caminho: src/app/launcher.js
 * Descrição: Script isolado para o processo filho.
 */
import { startBot, stopBot } from './heart.js';
import BotState from './BotState.js';

// Envia mudanças de estado para o pai (TUI)
BotState.on('statusChange', (status) => {
  if (process.send) {
    // Garante que enviamos uma string simples
    process.send({ type: 'status', status: String(status) });
  }
});

process.on('message', async (msg) => {
  if (msg === 'shutdown') {
    await stopBot();
    process.exit(0);
  }
});

// Impede que o processo morra sem avisar o motivo
process.on('uncaughtException', (err) => {
  console.error('Launcher Crash:', err.stack);
  if (process.send) {
    process.send({ type: 'status', status: 'error' });
  }
  process.exit(1);
});

// Inicia o bot
startBot().catch(() => {
  if (process.send) process.send({ type: 'status', status: 'error' });
});


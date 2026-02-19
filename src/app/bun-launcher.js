/**
 * Caminho: src/app/bun-launcher.js
 * Descrição: Implementação do launcher para Bun.
 *
 * Comunicação:
 *  - Filho -> Pai: envia JSON por linha no stdout: { type, payload }
 *  - Pai -> Filho: recebe JSON por linha no stdin: { type, ... }
 *
 * Observações:
 *  - Mantém API simples: suporta comandos "shutdown"/"stop" e "restart".
 *  - Encaminha logs via mensagens { type: "log", payload: { text } }.
 */

import { startBot, stopBot } from './heart.js';
import BotState from './BotState.js';

function safeWrite(obj) {
  try {
    process.stdout.write(JSON.stringify(obj) + '\n');
  } catch (_) {
    // best-effort, ignorar falhas de escrita
  }
}

function send(type, payload) {
  safeWrite({ type, payload });
}

/* -----------------------
   Forward console methods
   ----------------------- */
const _consoleLog = console.log;
const _consoleError = console.error;
const _consoleWarn = console.warn;
const _consoleInfo = console.info;

console.log = (...args) => {
  try {
    send('log', { level: 'info', text: args.map(String).join(' ') });
  } catch (_) {}
  _consoleLog.apply(console, args);
};
console.info = (...args) => {
  try {
    send('log', { level: 'info', text: args.map(String).join(' ') });
  } catch (_) {}
  _consoleInfo.apply(console, args);
};
console.warn = (...args) => {
  try {
    send('log', { level: 'warn', text: args.map(String).join(' ') });
  } catch (_) {}
  _consoleWarn.apply(console, args);
};
console.error = (...args) => {
  try {
    send('log', { level: 'error', text: args.map(String).join(' ') });
  } catch (_) {}
  _consoleError.apply(console, args);
};

/* -----------------------
   Listen for BotState events
   ----------------------- */
if (BotState && typeof BotState.on === 'function') {
  BotState.on('statusChange', (status) => {
    try {
      send('status', String(status));
    } catch (_) {}
  });

  // Se houver eventos de log nativos no BotState, encaminha-os também.
  try {
    if (typeof BotState.on === 'function') {
      BotState.on('log', (payload) => {
        try {
          // payload pode ser string ou objeto
          const text = typeof payload === 'string' ? payload : payload?.text ?? JSON.stringify(payload);
          send('log', { level: 'info', text });
        } catch (_) {}
      });
    }
  } catch (_) {}
}

/* -----------------------
   stdin: receber comandos
   ----------------------- */
let _buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.resume();

process.stdin.on('data', async (chunk) => {
  _buffer += chunk;
  const lines = _buffer.split('\n');
  _buffer = lines.pop(); // última linha possivelmente incompleta

  for (const raw of lines) {
    if (!raw || !raw.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      // Mensagem inválida — ignora, mas registra para diagnóstico.
      console.error('bun-launcher: invalid stdin JSON ->', err?.message ?? err);
      continue;
    }

    const type = typeof msg === 'string' ? msg : msg?.type;
    try {
      if (type === 'shutdown' || type === 'stop') {
        try {
          if (typeof stopBot === 'function') await stopBot();
        } catch (e) {
          console.error('bun-launcher: stopBot error ->', e && e.stack ? e.stack : e);
        } finally {
          process.exit(0);
        }
      } else if (type === 'restart') {
        try {
          if (typeof stopBot === 'function') await stopBot();
        } catch (e) {
          console.error('bun-launcher: stopBot (restart) error ->', e && e.stack ? e.stack : e);
        }
        try {
          if (typeof startBot === 'function') await startBot();
        } catch (e) {
          console.error('bun-launcher: startBot (restart) error ->', e && e.stack ? e.stack : e);
          send('status', 'error');
        }
      } else {
        // comando desconhecido: ignora silenciosamente (pode evoluir)
      }
    } catch (err) {
      console.error('bun-launcher: command handler error ->', err && err.stack ? err.stack : err);
    }
  }
});

process.stdin.on('end', () => {
  // Pai fechou stdin — opcional: manter-se rodando ou encerrar.
  // Aqui optamos por não encerrar automaticamente.
});

/* -----------------------
   uncaughtException -> report + exit
   ----------------------- */
process.on('uncaughtException', (err) => {
  try {
    console.error('Launcher Crash:', err && err.stack ? err.stack : err);
    send('status', 'error');
  } catch (_) {}
  process.exit(1);
});

/* -----------------------
   Start the bot
   ----------------------- */
(async () => {
  try {
    if (typeof startBot === 'function') {
      await startBot();
    } else {
      console.error('bun-launcher: startBot is not a function');
      send('status', 'error');
      process.exit(1);
    }
  } catch (err) {
    try {
      console.error('bun-launcher: startBot threw ->', err && err.stack ? err.stack : err);
    } catch (_) {}
    send('status', 'error');
    process.exit(1);
  }
})();

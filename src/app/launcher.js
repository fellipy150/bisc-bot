/*/**
 * Caminho: src/app/launcher.js
 * Descrição: Script isolado para o processo filho.
 
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

*/


/**
 * Caminho: src/app/launcher.js
 * Descrição: Launcher universal — detecta em silêncio se está rodando em Bun ou Node.
 *
 * - Se estiver em Bun: delega imediatamente para ./bun-launcher.js (import dinâmico).
 * - Se estiver em Node: executa a versão Node.js (usa process.send / process.on('message')).
 *
 * Importante: este arquivo é o único ponto de entrada esperado pelo sistema.
 */

const isBun = typeof process !== "undefined" && !!process.versions?.bun;

if (isBun) {
  // Delegar a implementação específica do Bun e encerrar este orquestrador.
  // Usamos import dinâmico para evitar carregar código Node quando estivermos em Bun.
  // Nenhum log ou saída extra — detecção silenciosa.
  await import("./bun-launcher.js");
} else {

// --------------------------
// Ramo Node.js (fork + IPC)
// --------------------------
// Import dinâmico para manter o arquivo único e evitar carga desnecessária no runtime Bun.
const heartMod = await import("./heart.js");
const botStateMod = await import("./BotState.js");

// Resolução segura das exportações (default ou named)
const { startBot, stopBot } = heartMod;
const BotState = botStateMod.default ?? botStateMod;

// Helper seguro que só envia se process.send estiver disponível
const canSendIPC = typeof process.send === "function";
function sendIPC(obj) {
  if (!canSendIPC) return;
  try {
    process.send(obj);
  } catch (err) {
    // Não interrompe a execução — apenas tenta enviar quando possível.
  }
}

// Escuta mudanças de estado do bot e notifica o processo pai (se houver)
if (BotState && typeof BotState.on === "function") {
  BotState.on("statusChange", (status) => {
    if (canSendIPC) {
      sendIPC({ type: "status", status: String(status) });
    }
  });
}

// Recebe mensagens do processo pai (Node fork)
process.on("message", async (msg) => {
  try {
    // Suporta tanto mensagens simples (ex.: "shutdown") quanto objetos { type: 'shutdown' }
    const command = typeof msg === "string" ? msg : msg?.type;
    if (command === "shutdown" || command === "stop") {
      if (typeof stopBot === "function") {
        await stopBot();
      }
      process.exit(0);
    }
    // Possibilidade de estender outros comandos aqui (restart, ping, etc.)
  } catch (err) {
    // Em caso de erro ao processar mensagem, reporta e continua.
    console.error("Launcher message handler error:", err && err.stack ? err.stack : err);
  }
});

// Proteção contra exceções não capturadas — reporta ao pai e encerra com erro
process.on("uncaughtException", (err) => {
  try {
    console.error("Launcher Crash:", err && err.stack ? err.stack : err);
    sendIPC({ type: "status", status: "error" });
  } catch (_) {
    // ignora
  } finally {
    // saída clara para o supervisor
    process.exit(1);
  }
});

// Inicializa o bot (assíncrono). Em caso de falha, informa o pai.
(async () => {
  try {
    if (typeof startBot === "function") {
      await startBot();
    } else {
      // nada a iniciar — sinaliza erro para o pai se estiver em modo fork
      sendIPC({ type: "status", status: "error" });
      process.exit(1);
    }
  } catch (err) {
    try {
      console.error("Launcher startBot error:", err && err.stack ? err.stack : err);
    } catch (_) {}
    sendIPC({ type: "status", status: "error" });
    process.exit(1);
  }
})();
}

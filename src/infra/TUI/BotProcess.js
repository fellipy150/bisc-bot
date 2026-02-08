/**
 * Caminho: src/infra/TUI/BotProcess.js
 * Descrição: Gerencia o ciclo de vida do processo filho com segurança de tipos.
 */
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAUNCHER_PATH = path.resolve(__dirname, '../../app/launcher.js');

class BotProcessManager extends EventEmitter {
  constructor() {
    super();
    this.child = null;
    this.status = 'offline'; // Garantido como string
    this.pid = null;
  }

  start() {
    if (this.child) return;

    this._setStatus('starting');
    
    // stdio: 'pipe' para o Blessed capturar os logs sem sujar a tela principal
    this.child = fork(LAUNCHER_PATH, [], { 
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'] 
    });

    this.pid = this.child.pid;
    this.emit('process', { pid: this.pid });

    this.child.on('message', (msg) => {
      // Validação extra da mensagem IPC
      if (msg && msg.type === 'status' && typeof msg.status === 'string') {
        this._setStatus(msg.status);
      }
    });

    this.child.stdout.on('data', (data) => {
      this._emitLog(data.toString());
    });

    this.child.stderr.on('data', (data) => {
      this._emitLog(data.toString(), true);
    });

    this.child.on('exit', (code) => {
      this.child = null;
      this.pid = null;
      this._setStatus(code === 0 ? 'offline' : 'error');
      this._emitLog(`Processo encerrado (Code: ${code})`, code !== 0);
    });

    this.child.on('error', (err) => {
      this._emitLog(`Erro no processo filho: ${err.message}`, true);
      this._setStatus('error');
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (!this.child) {
        this._setStatus('offline');
        return resolve();
      }

      this._setStatus('stopping');
      
      if (this.child.connected) {
        this.child.send('shutdown');
      }

      const timer = setTimeout(() => {
        if (this.child) this.child.kill('SIGKILL');
        resolve();
      }, 4000);

      this.child.on('exit', () => {
        clearTimeout(timer);
        this.child = null;
        this.pid = null;
        this._setStatus('offline');
        resolve();
      });
    });
  }

  async restart() {
    await this.stop();
    this.start();
  }

  _setStatus(newStatus) {
    // Força a conversão para string caso algo estranho venha do IPC
    this.status = String(newStatus || 'offline');
    this.emit('status', this.status);
  }

  _emitLog(text, isError = false) {
    const cleanText = text.trim();
    if (cleanText) {
      this.emit('log', { text: cleanText, isError });
    }
  }
}

export default new BotProcessManager();


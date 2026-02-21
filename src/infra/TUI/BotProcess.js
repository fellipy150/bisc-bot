/**
 * Caminho: src/infra/TUI/BotProcess.js
 * Descrição: Gerencia o ciclo de vida do processo filho (Node + Bun).
 */
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAUNCHER_PATH = path.resolve(__dirname, '../../app/launcher.js');

const isBun = typeof process !== 'undefined' && !!process.versions?.bun;

class BotProcessManager extends EventEmitter {
  constructor() {
    super();
    this.child = null;
    this.status = 'offline';
    this.pid = null;
  }

  start() {
    if (this.child) return;

    this._setStatus('starting');

    if (isBun) {
      this._startWithBun();
    } else {
      this._startWithNode();
    }
  }

  /* -----------------------
     Node.js (fork + IPC)
     ----------------------- */
  _startWithNode() {
    this.child = fork(LAUNCHER_PATH, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    this._attachNodeHandlers();
  }

  _attachNodeHandlers() {
    this.pid = this.child.pid;
    this.emit('process', { pid: this.pid });

    this.child.on('message', (msg) => {
      if (msg?.type === 'status' && typeof msg.status === 'string') {
        this._setStatus(msg.status);
      }
    });

    this.child.stdout?.on('data', (data) => {
      this._emitLog(data.toString());
    });

    this.child.stderr?.on('data', (data) => {
      this._emitLog(data.toString(), true);
    });

    this.child.on('exit', (code) => this._handleExit(code));
    this.child.on('error', (err) => this._handleError(err));
  }

  /* -----------------------
     Bun (spawn + streams)
     ----------------------- */
  _startWithBun() {
    // Detecta se estamos no Termux e pega o caminho absoluto da pasta raiz (PREFIX)
    const isTermux = !!process.env.PREFIX && process.env.PREFIX.includes('termux');
    
    // Se for Termux, process.execPath aponta para o 'grun'. Usamos o caminho absoluto do Bun.
    const bunCommand = isTermux
      ? [`${process.env.PREFIX}/bin/grun`, `${process.env.HOME}/.bun/bin/bun`, LAUNCHER_PATH]
      : [process.execPath, LAUNCHER_PATH];

    this.child = Bun.spawn(
      bunCommand,
      {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    this.pid = this.child.pid;
    this.emit('process', { pid: this.pid });

    this._readBunStdout();
    this._readBunStderr();

    this.child.exited.then((code) => {
      this._handleExit(code);
    });
  }

  async _readBunStdout() {
    for await (const chunk of this.child.stdout) {
      // Buffer.from garante que o Uint8Array seja convertido para string de texto
      const text = Buffer.from(chunk).toString('utf-8');
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const msg = JSON.parse(line);
          if (msg.type === 'status') {
            this._setStatus(msg.payload);
          } else if (msg.type === 'log') {
            this.emit('log', msg.payload);
          }
        } catch {
          this._emitLog(line);
        }
      }
    }
  }

  async _readBunStderr() {
    for await (const chunk of this.child.stderr) {
      const text = Buffer.from(chunk).toString('utf-8');
      this._emitLog(text, true);
    }
  }

  /* -----------------------
     Stop / Restart
     ----------------------- */
  async stop() {
    if (!this.child) {
      this._setStatus('offline');
      return;
    }

    this._setStatus('stopping');

    if (isBun) {
      this.child.stdin.write(
        JSON.stringify({ type: 'shutdown' }) + '\n'
      );
    } else if (this.child.connected) {
      this.child.send('shutdown');
    }

    await new Promise((resolve) => setTimeout(resolve, 4000));

    if (this.child) {
      try {
        this.child.kill?.('SIGKILL');
      } catch {}
    }
  }

  async restart() {
    await this.stop();
    this.start();
  }

  /* -----------------------
     Internals
     ----------------------- */
  _handleExit(code) {
    this.child = null;
    this.pid = null;
    this._setStatus(code === 0 ? 'offline' : 'error');
    this._emitLog(`Processo encerrado (Code: ${code})`, code !== 0);
  }

  _handleError(err) {
    this._emitLog(`Erro no processo filho: ${err.message}`, true);
    this._setStatus('error');
  }

  _setStatus(status) {
    this.status = String(status ?? 'offline');
    this.emit('status', this.status);
  }

  _emitLog(text, isError = false) {
    const clean = text?.trim();
    if (clean) {
      this.emit('log', { text: clean, isError });
    }
  }
}

export default new BotProcessManager();

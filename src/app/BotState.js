/**
 * Caminho: app/BotState.js
 * Descrição: Gerenciador de estado (singleton).
 */
import { EventEmitter } from 'events';

class BotState extends EventEmitter {
  constructor() {
    super();
    this._status = 'offline'; // offline, starting, online, stopping, error
    this._startTime = null;
    this._lastError = null;
    this._client = null;
  }

  get status() {
    return this._status;
  }

  get uptime() {
    return this._startTime ? Date.now() - this._startTime : 0;
  }

  get lastError() {
    return this._lastError;
  }

  get client() {
    return this._client;
  }

  setStatus(newStatus) {
    if (this._status === newStatus) return;

    const oldStatus = this._status;
    this._status = newStatus;

    if (newStatus === 'online') this._startTime = Date.now();
    if (newStatus === 'offline') this._startTime = null;

    // 🔹 Novo formato (completo)
    this.emit('statusChange', { newStatus, oldStatus });

    // 🔹 Compatibilidade com o segundo código
    this.emit('statusChange:simple', newStatus);
  }

  setClient(client) {
    this._client = client;
  }

  setError(err) {
    this._lastError = err;
    this.setStatus('error');
    this.emit('error', err);
  }
}

export default new BotState();
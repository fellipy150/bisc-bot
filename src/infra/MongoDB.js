/**
 * Caminho: infra/MongoDB.js
 * Descrição: Gerenciamento da conexão MongoDB.
 */
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { Logger } from './logger/index.js';

export async function connectToMongoDB() {
  try {
    Logger.debug('Tentando conexão com MongoDB...');
    await mongoose.connect(config.db.uri, {
      family: 4, // Força IPv4 para evitar timeouts de DNS SRV no Termux/Bun
    });
    Logger.info('✅ MongoDB Conectado.');
    return true;
  } catch (error) {
    Logger.error('❌ Erro na conexão MongoDB:', error);
    return false;
  }
}

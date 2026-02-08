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
    await mongoose.connect(config.db.uri);
    Logger.info('✅ MongoDB Conectado.');
    return true;
  } catch (error) {
    Logger.error('❌ Erro na conexão MongoDB:', error);
    return false;
  }
}

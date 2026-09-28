/**
 * Caminho: src/infra/Supabase.js
 * Descrição: Cliente Supabase (PostgreSQL) — substitui a conexão MongoDB.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';
import { Logger } from './logger/index.js';

// Service Role Key é obrigatória (validada no boot em env.js); backend sem RLS
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(config.db.url, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Valida a comunicação básica com o Supabase (Fase 2 do plano).
 * Executa uma query trivial nas tabelas do schema.
 * @returns {Promise<boolean>} true se conectado, false se falhou
 */
export async function connectToSupabase() {
  try {
    Logger.debug('Validando conexão com Supabase...');
    const { error } = await supabase.from('users').select('id', { count: 'exact', head: true });
    if (error) throw error;
    Logger.info('Supabase Conectado.');
    return true;
  } catch (error) {
    Logger.error('Falha na conexão com o Supabase', error);
    return false;
  }
}

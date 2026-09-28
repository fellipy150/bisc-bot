/**
 * Caminho: src/infra/index.js
 * Descrição: Ponto central de exportação para a camada de infraestrutura.
 */

// Core Infra
export { Logger } from './logger/index.js';
export { config } from '../config/env.js';

// Discord & DB
export { gerarClienteDiscord, validarAmbiente } from './DiscordClient.js';
export { connectToSupabase, supabase } from './Supabase.js';

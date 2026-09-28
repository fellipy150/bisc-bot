/**
 * Caminho: src/infra/database/index.js
 * Descrição: Barrel file para os repositórios Supabase.
 */

// Repositórios (substituem models + services do MongoDB)
export * as userService from './repositories/userRepository.js';
export * as welcomeService from './repositories/welcomeRepository.js';
export * as byeService from './repositories/byeRepository.js';

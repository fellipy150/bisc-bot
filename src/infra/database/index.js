/**
 * Caminho: src/infra/database/index.js
 * Descrição: Barrel file para modelos e serviços do MongoDB.
 */

// Exportação de Models
export { default as User } from './models/userModel.js';
export { default as Welcome } from './models/welcomeModel.js';
export { default as Bye } from './models/byeModel.js';

// Exportação de Services
export * as userService from './services/userService.js';
export * as welcomeService from './services/welcomeService.js';
export * as byeService from './services/byeService.js';
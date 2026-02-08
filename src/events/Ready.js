/**
 * Caminho: events/Ready.js
 * Descrição: executado quando o bot se conecta ao Discord.
 */

import { Events } from 'discord.js';
import { Logger } from '../infra/logger/index.js';
import { getPrefixes } from '../config/config.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    Logger.info(`Sessão iniciada como ${client.user.tag}`);
    
    try {
      const prefixes = getPrefixes();
      Logger.info(`Prefixos configurados: ${prefixes.join(", ")}`);
    } catch (error) {
      Logger.warn("Não foi possível carregar a lista de prefixos no evento ready.");
    }
  },
};
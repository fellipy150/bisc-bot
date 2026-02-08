/**
 * Caminho: events/guildMemberRemove.js
 * Descrição: disparado quando um membro sai do server
 */
import { Events } from 'discord.js';
import { Logger } from '../infra/logger/index.js';
import byeSystem from '../commands/bye/bye.js';

export default {
  name: Events.GuildMemberRemove,
  once: false,

  async execute(member) {
    try {
      if (member.user.bot) return;

      Logger.info(`Membro saiu: ${member.user.tag} do servidor ${member.guild.name}`);

      // sistema de bye
      await byeSystem.handleMemberLeave(member);
      
    } catch (error) {
      Logger.error(`Erro ao processar saída do membro ${member.user.tag}:`, error);
    }
  },
};


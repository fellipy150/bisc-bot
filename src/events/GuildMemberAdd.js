/**
 * Caminho: events/guildMemberAdd.js
 * Descrição: disparado quando um membro entra no server.
 */
import { Events } from 'discord.js';
import { Logger } from '../infra/logger/index.js';
import welcomeSystem from '../commands/welcome/welcome.js';

export default {
  name: Events.GuildMemberAdd,
  once: false,

  async execute(member, client) {
    try {
      Logger.info(`Novo membro detectado: ${member.user.tag} em ${member.guild.name}`);

      if (member.user.bot) {
        Logger.debug(`Membro ${member.user.tag} é um bot. Ignorando sistema de boas-vindas.`);
        return;
      }

      //dados pro welcome system.
      const userData = {
        id: member.user.id,
        tag: member.user.tag,
        username: member.user.username,
        avatarURL: member.user.displayAvatarURL({ dynamic: true }),
        joinedAt: member.joinedAt,
        guildId: member.guild.id
      };

      //welcome system
      await welcomeSystem.handleNewMember(userData, member.guild);
      Logger.debug(`Sistema de boas-vindas finalizado para ${member.user.tag}`);

    } catch (error) {
      Logger.error(`Erro crítico ao processar entrada de membro (${member.user.tag}):`, error);
    }
  }
};


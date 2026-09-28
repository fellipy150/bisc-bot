/**
 * Caminho: src/events/guildMemberRemove.js
 * Descrição: disparado quando um membro sai do server.
 * Consome o byeRepository diretamente (sem indireção via comando bye.js).
 */
import { Events, EmbedBuilder } from 'discord.js';
import { Logger } from '../infra/logger/index.js';
import { byeRepo } from '../infra/database/repositories/byeRepository.js';

export default {
  name: Events.GuildMemberRemove,
  once: false,

  async execute(member) {
    try {
      if (member.user.bot) return;

      const config = await byeRepo.getGuildBye(member.guild.id);
      if (!config || !config.enabled || !config.message_embed) return;

      const channel = member.guild.channels.cache.get(config.chat_id);
      if (!channel) return;

      const guild = member.guild;

      // Função local para substituir placeholders
      const replaceTags = (text) => {
        if (!text) return null;
        return text
          .replace(/{user_tag}/g, member.user.tag)
          .replace(/{user_id}/g, member.id)
          .replace(/{user_username}/g, member.user.username)
          .replace(/{server_count}/g, guild.memberCount);
      };

      const content = replaceTags(config.message_content);

      let embed = null;
      if (config.message_embed) {
        const eData = config.message_embed;
        embed = new EmbedBuilder();

        if (eData.description) embed.setDescription(replaceTags(eData.description));
        if (eData.title) embed.setTitle(replaceTags(eData.title));
        if (eData.url) embed.setURL(eData.url);

        // Tratamento de cor
        if (eData.color) {
          let c = eData.color;
          // Converte string numérica ou hex para inteiro/string válida
          if (typeof c === 'string' && !c.startsWith('#') && !isNaN(c)) c = parseInt(c);
          try {
            embed.setColor(c);
          } catch {
            embed.setColor('#ff0000'); // Fallback red
          }
        }

        if (eData.image?.url) embed.setImage(eData.image.url);

        if (eData.thumbnail?.url) {
          const thumb = eData.thumbnail.url.replace(
            '{user_avatar_url}',
            member.user.displayAvatarURL({ dynamic: true })
          );
          embed.setThumbnail(thumb);
        }

        if (eData.footer) {
          const fText = replaceTags(eData.footer.text);
          const fIcon = eData.footer.icon_url?.replace(
            '{user_avatar_url}',
            member.user.displayAvatarURL({ dynamic: true })
          );
          if (fText) embed.setFooter({ text: fText, iconURL: fIcon });
        }

        if (eData.author) {
          const aName = replaceTags(eData.author.name);
          const aIcon = eData.author.icon_url?.replace(
            '{user_avatar_url}',
            member.user.displayAvatarURL({ dynamic: true })
          );
          const aUrl = eData.author.url;
          if (aName) embed.setAuthor({ name: aName, iconURL: aIcon, url: aUrl });
        }

        if (eData.fields && Array.isArray(eData.fields)) {
          const fields = eData.fields.map((f) => ({
            name: replaceTags(f.name),
            value: replaceTags(f.value),
            inline: f.inline,
          }));
          embed.addFields(fields);
        }

        if (eData.timestamp) embed.setTimestamp();
      }

      // Envia a mensagem
      await channel.send({
        content: content,
        embeds: embed ? [embed] : [],
      });
    } catch (error) {
      Logger.error(`Erro ao processar saída do membro ${member.user.tag}:`, error);
    }
  },
};

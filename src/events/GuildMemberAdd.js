/**
 * Caminho: src/events/GuildMemberAdd.js
 * Descrição: disparado quando um membro entra no server.
 * Consome o welcomeRepository diretamente (sem indireção via comando welcome.js).
 */
import { Events, EmbedBuilder } from 'discord.js';
import { Logger } from '../infra/logger/index.js';
import { welcomeRepo } from '../infra/database/repositories/welcomeRepository.js';

export default {
  name: Events.GuildMemberAdd,
  once: false,

  async execute(member, client) {
    try {
      if (member.user.bot) {
        Logger.debug(`Membro ${member.user.tag} é um bot. Ignorando sistema de boas-vindas.`);
        return;
      }

      const config = await welcomeRepo.getGuildWelcome(member.guild.id);
      if (!config || !config.enabled || !config.message_embed) return;

      const channel = member.guild.channels.cache.get(config.chat_id);
      if (!channel) {
        Logger.warn(`Canal de boas-vindas não encontrado para o servidor ${member.guild.id}`);
        return;
      }

      const userData = {
        id: member.user.id,
        tag: member.user.tag,
        username: member.user.username,
        avatarURL: member.user.displayAvatarURL({ dynamic: true }),
        joinedAt: member.joinedAt,
        guildId: member.guild.id,
      };

      // Conteúdo da mensagem (fora da embed) — placeholders {user_id} e {user_tag}
      const content = config.message_content
        ? config.message_content
            .replace('{user_id}', userData.id)
            .replace('{user_tag}', userData.tag)
        : null;

      let embed = null;
      if (config.message_embed) {
        const embedData = config.message_embed;
        embed = new EmbedBuilder();

        // 1. Description
        if (embedData.description) {
          embed.setDescription(
            embedData.description
              .replace('{user_tag}', userData.tag)
              .replace('{user_id}', userData.id)
          );
        }

        // 2. Color (converte string numérica "14327" para inteiro se necessário)
        if (embedData.color) {
          let colorValue = embedData.color;
          if (typeof colorValue === 'string' && !colorValue.startsWith('#') && !isNaN(colorValue)) {
            colorValue = parseInt(colorValue);
          }
          try {
            embed.setColor(colorValue);
          } catch {
            embed.setColor('#ffffff');
          }
        }

        // 3. Title e URL
        if (embedData.title) embed.setTitle(embedData.title.replace('{user_tag}', userData.tag));
        if (embedData.url) embed.setURL(embedData.url);

        // 4. Image
        if (embedData.image?.url) {
          embed.setImage(embedData.image.url.replace('{user_avatar_url}', userData.avatarURL));
        }

        // 5. Thumbnail
        if (embedData.thumbnail?.url) {
          embed.setThumbnail(
            embedData.thumbnail.url.replace('{user_avatar_url}', userData.avatarURL)
          );
        }

        // 6. Footer (mapea icon_url -> iconURL)
        if (embedData.footer) {
          const footerOptions = {};
          if (embedData.footer.text)
            footerOptions.text = embedData.footer.text.replace('{user_tag}', userData.tag);
          // O site/DB usa 'icon_url', o Discord.js usa 'iconURL'
          if (embedData.footer.icon_url)
            footerOptions.iconURL = embedData.footer.icon_url.replace(
              '{user_avatar_url}',
              userData.avatarURL
            );

          if (footerOptions.text) embed.setFooter(footerOptions);
        }

        // 7. Author (mapea icon_url -> iconURL)
        if (embedData.author && embedData.author.name) {
          const authorOptions = {
            name: embedData.author.name.replace('{user_tag}', userData.tag),
          };
          if (embedData.author.icon_url)
            authorOptions.iconURL = embedData.author.icon_url.replace(
              '{user_avatar_url}',
              userData.avatarURL
            );
          if (embedData.author.url) authorOptions.url = embedData.author.url;

          embed.setAuthor(authorOptions);
        }

        // 8. Fields
        if (embedData.fields && Array.isArray(embedData.fields) && embedData.fields.length > 0) {
          const processedFields = embedData.fields.map((field) => ({
            name: field.name.replace('{user_tag}', userData.tag),
            value: field.value
              .replace('{user_tag}', userData.tag)
              .replace('{user_id}', userData.id),
            inline: field.inline ?? false,
          }));
          embed.addFields(processedFields);
        }

        // 9. Timestamp
        if (embedData.timestamp) {
          embed.setTimestamp();
        }
      }

      await channel.send({
        content: content,
        embeds: embed ? [embed] : [],
      });
      Logger.debug(`Sistema de boas-vindas finalizado para ${member.user.tag}`);
    } catch (error) {
      Logger.error(`Erro crítico ao processar entrada de membro (${member.user.tag}):`, error);
    }
  },
};

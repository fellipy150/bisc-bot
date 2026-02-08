import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import { EmbedBuilder, PermissionsBitField } from 'discord.js';

// Configuração de __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import de Serviços e Subcomandos
import ByeService from '../../infra/database/services/byeService.js';
import setbye from './setbye.js';

// Import do JSON com caminho dinâmico
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData['bye'];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
  },

  async execute(message, args, client) {
    // Verificação de permissão
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply(
        '❌ Você precisa ser um administrador para configurar o sistema de saídas.'
      );
    }

    const subcomando = args[0]?.toLowerCase();

    switch (subcomando) {
      case 'add':
      case 'set':
        // Delega para o arquivo de configuração (setbye.js)
        await setbye.execute(message, args.slice(1), client);
        break;

      // Futuras implementações de remove/view podem ser adicionadas aqui

      default:
        message.reply(`ℹ️ Use \`${d.nome} add\` para configurar a mensagem de saída.`);
    }
  },

  // FUNÇÃO AUXILIAR: Chamada pelo evento 'guildMemberRemove'
  async handleMemberLeave(member) {
    try {
      const guild = member.guild;
      const guildConfig = await ByeService.getGuildBye(guild.id);

      // Se não houver config ou mensagem definida, para
      if (!guildConfig || !guildConfig.message) return;

      const byeChannel = guild.channels.cache.get(guildConfig.chatId);
      if (!byeChannel) return;

      const msgData = guildConfig.message;

      // Função local para substituir placeholders
      const replaceTags = (text) => {
        if (!text) return null;
        return text
          .replace(/{user_tag}/g, member.user.tag)
          .replace(/{user_id}/g, member.id)
          .replace(/{user_username}/g, member.user.username)
          .replace(/{server_count}/g, guild.memberCount);
      };

      const content = replaceTags(msgData.content);

      let embed = null;
      if (msgData.embed) {
        const eData = msgData.embed;
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
      await byeChannel.send({
        content: content,
        embeds: embed ? [embed] : [],
      });
    } catch (error) {
      console.error('[Bye System] Erro ao enviar mensagem de saída:', error);
    }
  },
};

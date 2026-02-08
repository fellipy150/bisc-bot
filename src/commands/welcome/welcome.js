import { EmbedBuilder, PermissionsBitField } from 'discord.js';
import allData from '../../config/command_data.json' with { type: 'json' };
import WelcomeService from '../../infra/database/services/welcomeService.js';
import setwelcome from './setwelcome.js';
import viewwelcome from './viewwelcome.js';
import removewelcome from './removewelcome.js';
const d = allData['welcome'];


export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
  },

  async execute(message, args, client) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('Você precisa ser um administrador para usar esse comando.');
    }

    const subcomando = args[0]?.toLowerCase();

    switch (subcomando) {
      case 'add':
        message.reply('Iniciando configuração de boas-vindas. Usando comando `setwelcome`...');
        await setwelcome.execute(message, args.slice(1), client);
        break;
      case 'edit':
        message.reply('Editando mensagem de boas-vindas. Usando comando `setwelcome`...');
        await setwelcome.execute(message, args.slice(1), client);
        break;
      case 'remove':
        message.reply('Removendo sistema de boas-vindas. Usando comando `removewelcome`...');
        await removewelcome.execute(message, args.slice(1), client);
        break;
      case 'view':
        message.reply('Visualizando mensagem de boas-vindas. Usando comando `viewwelcome`...');
        await viewwelcome.execute(message, args.slice(1), client);
        break;
      default:
        message.reply(
          `**Sistema de Boas-Vindas - Central de Ajuda**\nUse: \`welcome add\`, \`welcome edit\`, \`welcome remove\` ou \`welcome view\`.`
        );
    }
  },

  // Função chamada pelo evento OnNewMember
  async handleNewMember(userData, guild) {
    try {
      const guildId = guild.id;
      const guildConfig = await WelcomeService.getGuildWelcome(guildId);

      if (!guildConfig || !guildConfig.message) return;

      const welcomeChannel = guild.channels.cache.get(guildConfig.chatId);
      if (!welcomeChannel) {
        console.error(`Canal de boas-vindas não encontrado para o servidor ${guildId}`);
        return;
      }

      const welcome = guildConfig.message;

      // Conteúdo da mensagem (fora da embed)
      const content = welcome.content
        ? welcome.content.replace('{user_id}', userData.id).replace('{user_tag}', userData.tag)
        : null;

      let embed = null;
      if (welcome.embed) {
        const embedData = welcome.embed;
        embed = new EmbedBuilder();

        // 1. Description
        if (embedData.description) {
          embed.setDescription(
            embedData.description
              .replace('{user_tag}', userData.tag)
              .replace('{user_id}', userData.id)
          );
        }

        // 2. Color (Correção do "14327")
        if (embedData.color) {
          let colorValue = embedData.color;
          // Converte string numérica ("14327") para inteiro (14327) se necessário
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

        // 6. Footer (Correção: mapear icon_url -> iconURL)
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

        // 7. Author (Correção: mapear icon_url -> iconURL)
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

        // 8. Fields (Adicionado suporte a campos)
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
          embed.setTimestamp(); // Usa o horário atual se timestamp for true ou existir
        }
      }

      await welcomeChannel.send({
        content: content,
        embeds: embed ? [embed] : [],
      });
    } catch (error) {
      console.error('Erro ao processar mensagem de boas-vindas:', error);
    }
  },
};

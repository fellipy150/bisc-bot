import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData['viewwelcome'];

// Importando o serviço de boas-vindas para MongoDB
import WelcomeService from '../../infra/database/services/welcomeService.js';

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
  },

  async execute(message, args, client) {
    const guildId = message.guild.id;
    const user = message.author;

    // Busca as configurações de boas-vindas do MongoDB
    const guildConfig = await WelcomeService.getGuildWelcome(guildId);

    if (!guildConfig || !guildConfig.message) {
      return message.reply(msg("viewwelcome.no_welcome"));
    }

    const welcome = guildConfig.message;

    // Função auxiliar para substituir placeholders
    const replaceTags = (text) => {
      if (!text) return null;
      return text
        .replace(/{user_id}/g, user.id)
        .replace(/{user_tag}/g, user.tag)
        .replace(/{user_username}/g, user.username)
        .replace(/{user_avatar_url}/g, user.displayAvatarURL({ dynamic: true }))
        .replace(/{server_name}/g, message.guild.name)
        .replace(/{server_count}/g, message.guild.memberCount);
    };

    // 1. Content (Mensagem fora da embed)
    const content = replaceTags(welcome.content);

    // 2. Montagem da Embed
    const embedData = welcome.embed;
    let embed = null;

    // Só cria o objeto embed se existir dados de embed
    if (embedData) {
      embed = new EmbedBuilder();

      // Título e URL
      if (embedData.title) embed.setTitle(replaceTags(embedData.title));
      if (embedData.url) embed.setURL(embedData.url);

      // Descrição
      if (embedData.description) {
        embed.setDescription(replaceTags(embedData.description));
      }

      // --- CORREÇÃO DE COR ---
      if (embedData.color) {
        let colorValue = embedData.color;
        // Se for String ("14327") e não Hex, converte para Int
        if (typeof colorValue === 'string' && !colorValue.startsWith('#') && !isNaN(colorValue)) {
          colorValue = parseInt(colorValue);
        }
        try {
          embed.setColor(colorValue);
        } catch (err) {
          embed.setColor('#ffffff'); // Fallback branco
        }
      }

      // Imagem Grande
      if (embedData.image?.url) {
        embed.setImage(replaceTags(embedData.image.url));
      }

      // Thumbnail
      if (embedData.thumbnail?.url) {
        embed.setThumbnail(replaceTags(embedData.thumbnail.url));
      }

      // Footer (Mapeia icon_url -> iconURL)
      if (embedData.footer) {
        const footerText = replaceTags(embedData.footer.text);
        const footerIcon = replaceTags(embedData.footer.icon_url);

        if (footerText) {
          embed.setFooter({ text: footerText, iconURL: footerIcon });
        }
      }

      // Author (Mapeia icon_url -> iconURL)
      if (embedData.author && embedData.author.name) {
        const authorName = replaceTags(embedData.author.name);
        const authorIcon = replaceTags(embedData.author.icon_url);
        const authorUrl = embedData.author.url;

        embed.setAuthor({ name: authorName, iconURL: authorIcon, url: authorUrl });
      }

      // Fields (Novos campos)
      if (embedData.fields && Array.isArray(embedData.fields)) {
        const processedFields = embedData.fields.map((field) => ({
          name: replaceTags(field.name),
          value: replaceTags(field.value),
          inline: field.inline ?? false,
        }));
        if (processedFields.length > 0) {
          embed.addFields(processedFields);
        }
      }

      // Timestamp
      if (embedData.timestamp) {
        embed.setTimestamp();
      }
    }

    // Botões
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(msg("viewwelcome.btn_edit"))
        .setStyle(ButtonStyle.Primary)
        .setCustomId('edit_welcome'),
      new ButtonBuilder()
        .setLabel(msg("viewwelcome.btn_close"))
        .setStyle(ButtonStyle.Secondary)
        .setCustomId('fechar_viewwelcome')
    );

    const reply = await message.channel.send({
      content: content || msg("viewwelcome.preview_text"),
      embeds: embed ? [embed] : [],
      components: [row],
    });

    // Lógica do Coletor
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === user.id,
      time: 180000,
    });

    collector.on('collect', async (interaction) => {
      try {
        if (interaction.customId === 'edit_welcome') {
          await interaction.reply({
            content: msg("viewwelcome.edit_instruction"),
            ephemeral: true,
          });
        } else if (interaction.customId === 'fechar_viewwelcome') {
          await interaction.update({
            content: msg("viewwelcome.view_closed"),
            embeds: [],
            components: [],
          });
          collector.stop();
        }
      } catch (err) {
        console.error(err);
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        reply.edit({ components: [] }).catch(() => {});
      }
    });
  },
};

/*
@register-messages
{
  "viewwelcome": {
    "no_welcome": "⚠️ Nenhuma mensagem de boas-vindas configurada neste servidor. Use `welcome add` para configurar.",
    "btn_edit": "Editar",
    "btn_close": "Fechar",
    "preview_text": "**Visualização da mensagem de boas-vindas:**",
    "edit_instruction": "Para editar, use o comando `welcome edit` e envie a nova URL.",
    "view_closed": "Visualização encerrada."
  }
}
@end
*/
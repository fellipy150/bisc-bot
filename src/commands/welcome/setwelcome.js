import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
} from 'discord.js';
import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData['setwelcome'];

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
    // 1. Verificação de uma Permissão
    if (!message.member.permissions.has('Administrator')) {
      return message.reply(msg("setwelcome.no_admin"));
    }

    const guildId = message.guild.id;
    const filterAuthor = (m) => m.author.id === message.author.id;

    // 2. Pergunta o Canal
    await message.channel.send(msg("setwelcome.ask_channel"));

    try {
      const collectedChannel = await message.channel.awaitMessages({
        filter: filterAuthor,
        max: 1,
        time: 60000,
        errors: ['time'],
      });
      const canalMsg = collectedChannel.first();
      const canal = canalMsg.mentions.channels.first();

      if (!canal || canal.type !== ChannelType.GuildText) {
        return message.channel.send(msg("setwelcome.invalid_channel"));
      }

      // 3. Pede a URL do Site
      await message.channel.send(msg("setwelcome.instructions"));

      // 4. Coleta a URL
      const collectedUrl = await message.channel.awaitMessages({
        filter: filterAuthor,
        max: 1,
        time: 300000,
        errors: ['time'],
      }); // 5 minutos para fazer a arte
      const urlMsg = collectedUrl.first();
      const urlContent = urlMsg.content.trim();

      // 5. Processa a URL
      const parsedData = parseSheepTesterUrl(urlContent);

      if (!parsedData) {
        return message.channel.send(msg("setwelcome.invalid_url"));
      }

      // 6. Prepara o Preview
      const confirmButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_welcome')
          .setLabel(msg("setwelcome.btn_accept"))
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
      );

      const previewMsg = await message.channel.send({
        content: msg("setwelcome.preview", { content: parsedData.apiPayload.content || '' }),
        embeds: parsedData.apiPayload.embeds,
        components: [confirmButton],
      });

      // 7. Aguarda o clique no botão "Aceitar"
      const collector = previewMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
        max: 1,
      });

      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
          return interaction.reply({
            content: msg("setwelcome.btn_not_author"),
            ephemeral: true,
          });
        }

        // Salva no MongoDB
        const success = await WelcomeService.setGuildWelcome(
          guildId,
          canal.id,
          parsedData.dbPayload
        );

        if (success) {
          await interaction.update({
            content: msg("setwelcome.success", { canal: canal.toString() }),
            components: [],
            embeds: [],
          });
        } else {
          await interaction.update({
            content: msg("setwelcome.db_error"),
            components: [],
          });
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          previewMsg
            .edit({ content: msg("setwelcome.timeout_confirm"), components: [] })
            .catch(() => {});
        }
      });
    } catch (error) {
      console.error(error);
      if (error.message === 'time') {
        return message.channel.send(msg("setwelcome.timeout"));
      }
      message.channel.send(msg("setwelcome.unexpected_error"));
    }
  },
};

// --- Funções Auxiliares ---

function parseSheepTesterUrl(urlString) {
  try {
    const url = new URL(urlString);
    const jsonParam = url.searchParams.get('json');

    if (!jsonParam) return null;

    const payload = JSON.parse(jsonParam);

    // Limpa campos nulos recursivamente
    cleanNulls(payload);

    // Prepara os dados
    const content = payload.content || '';

    // O site retorna uma lista de embeds
    const embedsList = payload.embeds || [];

    // CORREÇÃO DA COR: Converte para NÚMERO INTEIRO
    if (embedsList.length > 0) {
      embedsList.forEach((embed) => {
        if (embed.color) {
          if (typeof embed.color === 'string' && embed.color.startsWith('#')) {
            embed.color = parseInt(embed.color.replace('#', ''), 16);
          } else {
            embed.color = parseInt(embed.color);
          }
        }
      });
    }

    // O objeto para o envio imediato (Preview)
    const apiPayload = {
      content: content,
      embeds: embedsList,
    };

    // O objeto para salvar no Banco de Dados
    const dbPayload = {
      content: content,
      embed: embedsList.length > 0 ? embedsList[0] : null,
    };

    return { apiPayload, dbPayload };
  } catch (e) {
    console.error('Erro ao parsear URL:', e);
    return null;
  }
}

// Remove propriedades com valor null para evitar erros na API do Discord
function cleanNulls(obj) {
  Object.keys(obj).forEach((key) => {
    if (obj[key] && typeof obj[key] === 'object') {
      cleanNulls(obj[key]);
    } else if (obj[key] === null) {
      delete obj[key];
    }
  });
}

/*
@register-messages
{
  "setwelcome": {
    "no_admin": "❌ Você precisa ser administrador para usar este comando!",
    "ask_channel": "📢 Em qual canal você quer ativar o sistema de boas-vindas? (Mencione o canal com `#`)",
    "invalid_channel": "❌ Canal inválido ou não mencionado. Operação cancelada.",
    "instructions": "🔗 **Configuração da Mensagem**\n1. Acesse este site: <https://sheeptester.github.io/javascripts/webhook-sender.html>\n2. Configure a mensagem, título, cor, imagem, etc. como desejar.\n3. Quando terminar, copie a **URL completa** do navegador.\n4. **Cole a URL aqui neste chat.**",
    "invalid_url": "❌ URL inválida ou não contém os dados JSON esperados. Tente novamente executando o comando.",
    "btn_accept": "Aceitar e Salvar",
    "preview": "**⬇️ PREVIEW DA MENSAGEM ⬇️**\n\n{content}",
    "btn_not_author": "Apenas quem usou o comando pode aceitar.",
    "success": "✅ **Configurado!** A mensagem de boas-vindas foi salva e será enviada no canal {canal}.",
    "db_error": "❌ Houve um erro ao salvar no banco de dados.",
    "timeout_confirm": "⏳ Tempo esgotado para confirmação.",
    "timeout": "⏳ Tempo esgotado. Tente novamente.",
    "unexpected_error": "❌ Ocorreu um erro inesperado."
  }
}
@end
*/
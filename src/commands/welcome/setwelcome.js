import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
} from 'discord.js';
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
      return message.reply('❌ Você precisa ser administrador para usar este comando!');
    }

    const guildId = message.guild.id;
    const filterAuthor = (m) => m.author.id === message.author.id;

    // 2. Pergunta o Canal
    await message.channel.send(
      '📢 Em qual canal você quer ativar o sistema de boas-vindas? (Mencione o canal com `#`)'
    );

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
        return message.channel.send('❌ Canal inválido ou não mencionado. Operação cancelada.');
      }

      // 3. Pede a URL do Site
      const instructions = `
🔗 **Configuração da Mensagem**
1. Acesse este site: <https://sheeptester.github.io/javascripts/webhook-sender.html>
2. Configure a mensagem, título, cor, imagem, etc. como desejar.
3. Quando terminar, copie a **URL completa** do navegador.
4. **Cole a URL aqui neste chat.**
      `;
      await message.channel.send(instructions);

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
        return message.channel.send(
          '❌ URL inválida ou não contém os dados JSON esperados. Tente novamente executando o comando.'
        );
      }

      // 6. Prepara o Preview
      // Nota: parsedData.apiPayload é o formato que o Discord lê agora.
      // parsedData.dbPayload é o formato para salvar no seu banco.

      const confirmButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_welcome')
          .setLabel('Aceitar e Salvar')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
      );

      const previewMsg = await message.channel.send({
        content: `**⬇️ PREVIEW DA MENSAGEM ⬇️**\n\n${parsedData.apiPayload.content || ''}`,
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
            content: 'Apenas quem usou o comando pode aceitar.',
            ephemeral: true,
          });
        }

        // Salva no MongoDB
        // Importante: Passamos parsedData.dbPayload pois seu serviço parece esperar { content, embed } (singular)
        const success = await WelcomeService.setGuildWelcome(
          guildId,
          canal.id,
          parsedData.dbPayload
        );

        if (success) {
          await interaction.update({
            content: `✅ **Configurado!** A mensagem de boas-vindas foi salva e será enviada no canal ${canal}.`,
            components: [],
            embeds: [], // Remove a embed de preview para limpar o chat, ou mantenha se preferir
          });
        } else {
          await interaction.update({
            content: '❌ Houve um erro ao salvar no banco de dados.',
            components: [],
          });
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          previewMsg
            .edit({ content: '⏳ Tempo esgotado para confirmação.', components: [] })
            .catch(() => {});
        }
      });
    } catch (error) {
      console.error(error);
      if (error.message === 'time') {
        // Erro do awaitMessages por timeout
        return message.channel.send('⏳ Tempo esgotado. Tente novamente.');
      }
      message.channel.send('❌ Ocorreu um erro inesperado.');
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
          // O site manda 14327 (number) ou "14327" (string)
          // O Discord exige 14327 (number)

          if (typeof embed.color === 'string' && embed.color.startsWith('#')) {
            // Se por acaso vier Hex (#ffffff), converte para Int
            embed.color = parseInt(embed.color.replace('#', ''), 16);
          } else {
            // Garante que é um Inteiro base 10
            embed.color = parseInt(embed.color);
          }
        } else {
          // Se não tiver cor, você pode definir uma padrão ou deixar sem
          // embed.color = 0xffffff; // Branco
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

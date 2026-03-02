import msg from '../../config/msg-handler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
} from 'discord.js';
import ByeService from '../../infra/database/services/byeService.js';

// Configuração de __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import do JSON com caminho dinâmico
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData['setbye'];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
  },
  async execute(message, args, client) {
    // Verifica permissões
    if (!message.member.permissions.has('Administrator')) {
      return message.reply(msg("setbye.permissao_negada"));
    }

    const guildId = message.guild.id;
    const filterAuthor = (m) => m.author.id === message.author.id;

    // 1. Pergunta o Canal
    await message.channel.send(
      msg("setbye.mensagem_2"));

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
        return message.channel.send(msg("setbye.mensagem_3"));
      }

      // 2. Instruções para o JSON
      const instructions = `
👋 **Configuração de Saída (Bye)**
1. Acesse: <https://sheeptester.github.io/javascripts/webhook-sender.html>
2. Monte a mensagem de despedida.
3. Copie a URL gerada (no final da página, botão "Copy URL").
4. **Cole a URL aqui.**
      `;
      await message.channel.send(instructions);

      const collectedUrl = await message.channel.awaitMessages({
        filter: filterAuthor,
        max: 1,
        time: 300000,
        errors: ['time'],
      });
      const urlMsg = collectedUrl.first();
      const urlContent = urlMsg.content.trim();

      // 3. Processa a URL
      const parsedData = parseSheepTesterUrl(urlContent);

      if (!parsedData) {
        return message.channel.send(msg("setbye.mensagem_4"));
      }

      // 4. Cria botão de confirmação
      const confirmButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_bye')
          .setLabel('Salvar Despedida')
          .setStyle(ButtonStyle.Danger) // Vermelho combina com Saída/Bye
          .setEmoji('👋')
      );

      // 5. Envia Preview
      const previewMsg = await message.channel.send({
        content: msg("setbye.mensagem_5", { "content": parsedData.apiPayload.content || '' }),
        embeds: parsedData.apiPayload.embeds,
        components: [confirmButton],
      });

      // 6. Coletor do Botão
      const collector = previewMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
        max: 1,
      });

      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) return interaction.deferUpdate();

        // Salva no Banco de Dados
        const success = await ByeService.setGuildBye(guildId, canal.id, parsedData.dbPayload);

        if (success) {
          await interaction.update({
            content: `✅ **Configurado!** A mensagem de saída será enviada no canal ${canal}.`,
            components: [],
            embeds: [],
          });
        } else {
          await interaction.update({
            content: '❌ Erro ao salvar configuração no banco de dados.',
            components: [],
          });
        }
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          previewMsg
            .edit({ content: msg("setbye.mensagem_6"), components: [] })
            .catch(() => {});
        }
      });
    } catch (error) {
      console.error(error);
      message.channel.send(msg("setbye.mensagem_7"));
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
    cleanNulls(payload);

    const content = payload.content || '';
    const embedsList = payload.embeds || [];
    const dbEmbeds = JSON.parse(JSON.stringify(embedsList));

    // Normalização de cores
    if (dbEmbeds.length > 0) {
      dbEmbeds.forEach((embed) => {
        if (embed.color) {
          let colorInt;
          if (typeof embed.color === 'string' && embed.color.startsWith('#')) {
            colorInt = parseInt(embed.color.replace('#', ''), 16);
          } else {
            colorInt = parseInt(embed.color);
          }

          // Discord prefere hex strings ou inteiros, garantindo formato seguro
          if (!isNaN(colorInt)) {
            embed.color = `#${colorInt.toString(16).padStart(6, '0')}`;
          } else {
            embed.color = '#ffffff';
          }
        }
      });
    }

    return {
      // Payload para enviar direto pro Discord (preview)
      apiPayload: { content, embeds: embedsList },
      // Payload para salvar no banco (normalmente queremos apenas 1 embed principal ou a estrutura limpa)
      dbPayload: { content, embed: dbEmbeds.length > 0 ? dbEmbeds[0] : null },
    };
  } catch (e) {
    return null;
  }
}

function cleanNulls(obj) {
  Object.keys(obj).forEach((key) => {
    if (obj[key] && typeof obj[key] === 'object') cleanNulls(obj[key]);
    else if (obj[key] === null) delete obj[key];
  });
}

/*
@register-messages
{
  "setbye": {
    "mensagem_2": "📢 Em qual canal você quer ativar o sistema de **Saída**? (Mencione o canal com `#`)",
    "mensagem_3": "❌ Canal inválido ou não mencionado. Operação cancelada.",
    "mensagem_4": "❌ URL inválida ou mal formatada.",
    "mensagem_5": "**⬇️ PREVIEW DA DESPEDIDA ⬇️**\n\n{content}",
    "mensagem_6": "❌ Tempo esgotado para confirmação.",
    "mensagem_7": "❌ Operação cancelada ou tempo esgotado.",
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "permissao_negada": "❌ Você precisa ser administrador para usar este comando!"
  }
}
@end
*/

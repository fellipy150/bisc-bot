import msg from '../../config/msg-handler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';

// Configuração de __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import do JSON com caminho dinâmico
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData['viewbye'];

// Importando o serviço de Saída (Bye)
import ByeService from '../../infra/database/services/byeService.js';

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

    // Busca as configurações de saída do MongoDB
    const guildConfig = await ByeService.getGuildBye(guildId);

    if (!guildConfig || !guildConfig.message) {
      return message.reply(
        '⚠️ Nenhuma mensagem de saída (bye) configurada neste servidor. Use `bye add` para configurar.'
      );
    }

    const byeMessage = guildConfig.message;

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
    const content = replaceTags(byeMessage.content);

    // Botões
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Editar').setStyle(ButtonStyle.Primary).setCustomId('edit_bye'),
      new ButtonBuilder()
        .setLabel('Fechar')
        .setStyle(ButtonStyle.Secondary)
        .setCustomId('fechar_viewbye')
    );

    const reply = await message.channel.send({
      content: content || '**Visualização da mensagem de saída:**',
      embeds: [],
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
        if (interaction.customId === 'edit_bye') {
          await interaction.reply({
            content:
              'Para editar, use o comando `bye add` (ou `bye set`) e envie a nova URL do SheepTester.',
            ephemeral: true,
          });
        } else if (interaction.customId === 'fechar_viewbye') {
          await interaction.update({
            content: 'Visualização encerrada.',
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
  "viewbye": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
    "mensagem_1": "⚠️ Nenhuma mensagem de saída (bye) configurada neste servidor. Use `bye add` para configurar."
  }
}
@end
*/

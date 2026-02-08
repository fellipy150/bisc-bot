import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData['removewelcome'];

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
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Você precisa ser administrador para usar este comando!');
    }

    const guildId = message.guild.id;

    // Verifica se existe configuração usando MongoDB
    const hasConfig = await WelcomeService.hasWelcomeConfig(guildId);

    if (!hasConfig) {
      return message.reply('⚠️ Nenhuma configuração de boas-vindas foi encontrada neste servidor.');
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirmar_remocao')
        .setLabel('Sim, desativar')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancelar_remocao')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary)
    );

    const confirmMsg = await message.channel.send({
      content:
        '🚨 **Atenção:** Você tem certeza que deseja **desativar e apagar** o sistema de boas-vindas deste servidor?',
      components: [row],
    });

    try {
      const interaction = await confirmMsg.awaitMessageComponent({
        filter: (i) => i.user.id === message.author.id,
        componentType: ComponentType.Button,
        time: 60000, // 60 segundos
      });

      if (interaction.customId === 'confirmar_remocao') {
        // Remove a configuração usando MongoDB
        const oldConfig = await WelcomeService.removeGuildWelcome(guildId);

        if (oldConfig) {
          // Converte para string segura para evitar erros de limite
          const configJson = JSON.stringify(oldConfig.toObject(), null, 2).substring(0, 1900);

          await interaction.update({
            content: `✅ **Sistema de boas-vindas desativado.**\n\nBackup da configuração removida:\n\`\`\`json\n${configJson}\n\`\`\``,
            components: [],
          });
        } else {
          await interaction.update({
            content: '❌ Erro ao remover a configuração. Tente novamente.',
            components: [],
          });
        }
      } else {
        await interaction.update({ content: '❌ Operação cancelada.', components: [] });
      }
    } catch (err) {
      // Ignora erro de timeout, apenas edita a mensagem
      if (confirmMsg.editable) {
        confirmMsg
          .edit({ content: '⏳ Tempo esgotado. Operação cancelada.', components: [] })
          .catch(() => {});
      }
    }
  },
};

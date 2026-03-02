import msg from '../../config/msg-handler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';

// Configuração de __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import do JSON com caminho dinâmico
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData['removebye'];

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
    if (!message.member.permissions.has('Administrator')) {
      return message.reply(msg("removebye.permissao_negada"));
    }

    const guildId = message.guild.id;

    // Verifica se existe configuração
    // Nota: Se ByeService não tiver 'hasByeConfig', usamos getGuildBye
    const config = await ByeService.getGuildBye(guildId);

    if (!config) {
      return message.reply(msg("removebye.config_ausente"));
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirmar_remocao_bye')
        .setLabel('Sim, desativar')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancelar_remocao_bye')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary)
    );

    const confirmMsg = await message.channel.send({
      content:
        msg("removebye.mensagem_3"),
      components: [row],
    });

    try {
      const interaction = await confirmMsg.awaitMessageComponent({
        filter: (i) => i.user.id === message.author.id,
        componentType: ComponentType.Button,
        time: 60000, // 60 segundos
      });

      if (interaction.customId === 'confirmar_remocao_bye') {
        // Remove a configuração
        const oldConfig = await ByeService.removeGuildBye(guildId);

        if (oldConfig) {
          // Backup em JSON
          const configJson = JSON.stringify(oldConfig.toObject(), null, 2).substring(0, 1900);

          await interaction.update({
            content: `✅ **Sistema de saída desativado.**\n\nBackup da configuração removida:\n\`\`\`json\n${configJson}\n\`\`\``,
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
      if (confirmMsg.editable) {
        confirmMsg
          .edit({ content: msg("removebye.mensagem_4"), components: [] })
          .catch(() => {});
      }
    }
  },
};

/*
@register-messages
{
  "removebye": {
    "mensagem_3": "🚨 **Atenção:** Você tem certeza que deseja **desativar e apagar** o sistema de saída (bye) deste servidor?",
    "mensagem_4": "⏳ Tempo esgotado. Operação cancelada.",
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "permissao_negada": "❌ Você precisa ser administrador para usar este comando!",
    "config_ausente": "⚠️ Nenhuma configuração de saída (bye) encontrada neste servidor."
  }
}
@end
*/

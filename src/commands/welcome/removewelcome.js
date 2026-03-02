import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import msg from '../../config/msg-handler.js';
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
      return message.reply(msg("removewelcome.permissao_negada"));
    }

    const guildId = message.guild.id;

    // Verifica se existe configuração usando MongoDB
    const hasConfig = await WelcomeService.hasWelcomeConfig(guildId);

    if (!hasConfig) {
      return message.reply(msg("removewelcome.config_ausente"));
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirmar_remocao')
        .setLabel(msg("removewelcome.botao_confirmar"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancelar_remocao')
        .setLabel(msg("removewelcome.botao_cancelar"))
        .setStyle(ButtonStyle.Secondary)
    );

    const confirmMsg = await message.channel.send({
      content: msg("removewelcome.aviso_atencao"),
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
            content: msg("removewelcome.sucesso_remocao", { configJson }),
            components: [],
          });
        } else {
          await interaction.update({
            content: msg("removewelcome.falha_remocao"),
            components: [],
          });
        }
      } else {
        await interaction.update({ content: msg("removewelcome.operacao_cancelada"), components: [] });
      }
    } catch (err) {
      // Ignora erro de timeout, apenas edita a mensagem
      if (confirmMsg.editable) {
        confirmMsg
          .edit({ content: msg("removewelcome.tempo_esgotado"), components: [] })
          .catch(() => {});
      }
    }
  },
};

/*
@register-messages
{
  "removewelcome": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "permissao_negada": "❌ Você precisa ser administrador para usar este comando!",
    "config_ausente": "⚠️ Nenhuma configuração de boas-vindas foi encontrada neste servidor.",
    "botao_confirmar": "Sim, desativar",
    "botao_cancelar": "Cancelar",
    "aviso_atencao": "🚨 **Atenção:** Você tem certeza que deseja **desativar e apagar** o sistema de boas-vindas deste servidor?",
    "sucesso_remocao": "✅ **Sistema de boas-vindas desativado.**\n\nBackup da configuração removida:\n```json\n{configJson}\n```",
    "falha_remocao": "❌ Erro ao remover a configuração. Tente novamente.",
    "operacao_cancelada": "❌ Operação cancelada.",
    "tempo_esgotado": "⏳ Tempo esgotado. Operação cancelada."
  }
}
@end
*/

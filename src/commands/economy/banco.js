import msg from '../../config/msg-handler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { 
  EmbedBuilder, 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType 
} from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import allData from '../../config/command_data.json' with { type: 'json' };
import { getUser, bankTransaction } from '../../infra/database/services/userService.js';
import { getPrefixes } from '../../config/config.js'; // Importação do prefixo

const d = allData["banco"];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
    permissions: [PermissionFlagsBits.SendMessages]
  },

  async execute(message, args, client) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const prefix = getPrefixes()[0] || '..';

    try {
      // 1. Atalho via texto: (ex: ..banco sacar 100)
      if (args.length > 0) {
        const subCommand = args[0].toLowerCase();
        const amountStr = args[1];

        if (['sacar', 'saque', 'withdraw'].includes(subCommand)) {
          return this.handleTransaction(message, userId, guildId, amountStr, 'withdraw');
        }
        
        if (['depositar', 'dep', 'deposit'].includes(subCommand)) {
          return this.handleTransaction(message, userId, guildId, amountStr, 'deposit');
        }
      }

      // 2. Menu Principal com Botões
      const userData = await getUser(userId, guildId);

      const embed = new EmbedBuilder()
        .setColor('#e67e22')
        .setTitle('🏦 BiscBank')
        .setDescription(`Olá **${message.author.username}**!\n\n👛 Carteira: \`${userData.wallet.toLocaleString()}\` ₿\n🏛️ Banco: \`${userData.bank.toLocaleString()}\` ₿`)
        .setFooter({ text: 'Clique em um botão para movimentar seu saldo.' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bank_deposit').setLabel('Depositar').setEmoji('📥').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bank_withdraw').setLabel('Sacar').setEmoji('📤').setStyle(ButtonStyle.Danger)
      );

      const response = await message.reply({ embeds: [embed], components: [row] });

      // Coletor dos Botões
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: msg("banco.erro_acesso"), ephemeral: true });
        }

        const actionType = i.customId === 'bank_deposit' ? 'deposit' : 'withdraw';
        const actionName = actionType === 'deposit' ? 'depositar' : 'sacar';

        // Pergunta ao usuário
        await i.reply({ 
          content: msg("banco.valor_necessario", { actionName }),
          ephemeral: true 
        });

        // Coletor de Mensagem para pegar o valor
        const filter = (m) => m.author.id === userId;
        const msgCollector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

        msgCollector.on('collect', async (m) => {
          // Deleta a mensagem do usuário para manter o chat limpo (se tiver permissão)
          if (m.deletable) m.delete().catch(() => null);

          const value = m.content.toLowerCase();
          await this.handleTransaction(message, userId, guildId, value, actionType);
        });

        msgCollector.on('end', (collected, reason) => {
            if (reason === 'time') {
                i.followUp({ content: msg("banco.valor_invalido"), ephemeral: true }).catch(() => null);
            }
        });
      });

      collector.on('end', () => {
        response.edit({ components: [] }).catch(() => null);
      });

    } catch (error) {
      console.error(`[Erro no Comando ${d.nome}]:`, error);
      message.reply(msg("banco.motivo_erro"));
    }
  },

  // Lógica de processamento (usada tanto por texto quanto por botão)
  async handleTransaction(message, userId, guildId, amountStr, type) {
    if (!amountStr) {
      return message.reply(msg("banco.mensagem_5"));
    }

    const userData = await getUser(userId, guildId);
    let amount;

    if (amountStr === 'all' || amountStr === 'tudo') {
      amount = type === 'deposit' ? userData.wallet : userData.bank;
    } else {
      amount = parseInt(amountStr.replace(/[^0-9]/g, ''));
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return message.reply(msg("banco.mensagem_6"));
    }

    const result = await bankTransaction(userId, guildId, amount, type);

    if (!result.success) {
      return message.reply(msg("banco.erro_motivo", { "reason": result.reason }));
    }

    const embed = new EmbedBuilder()
      .setColor(type === 'deposit' ? '#2ecc71' : '#e74c3c')
      .setTitle(`✅ ${type === 'deposit' ? 'Depósito' : 'Saque'} Realizado`)
      .setDescription(`Valor: **${amount.toLocaleString()} ₿**`)
      .addFields(
        { name: '👛 Carteira', value: `\`${result.newWallet.toLocaleString()}\``, inline: true },
        { name: '🏛️ Banco', value: `\`${result.newBank.toLocaleString()}\``, inline: true }
      );

    return message.reply({ embeds: [embed] });
  }
};

/*
@register-messages
{
  "banco": {
    "erro_acesso": "❌ Este menu não é para você.",
    "valor_necessario": "❌ Você precisa informar um valor.",
    "valor_invalido": "❌ Valor inválido informado.",
    "motivo_erro": "❌ Ocorreu um erro ao acessar o banco.",
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "erro_motivo": "❌ **Erro:** {reason}"
  }
}
@end
*/

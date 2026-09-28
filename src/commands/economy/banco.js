import msg from '../../config/msg-handler.js';
import { Logger } from '../../infra/logger/index.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { 
  EmbedBuilder, 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import allData from '../../config/command_data.json' with { type: 'json' };
import { ensureUser, bankTransaction } from '../../infra/database/repositories/userRepository.js';
import { getPrefixes } from '../../config/config.js';

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

    try {
      // 1. Atalho via texto no chat (ex: ..banco sacar 100)
      if (args.length > 0) {
        const subCommand = args[0].toLowerCase();
        const amountStr = args[1];

        if (['sacar', 'saque', 'withdraw'].includes(subCommand)) {
          return this.processTransaction(message, userId, guildId, amountStr, 'withdraw');
        }
        
        if (['depositar', 'dep', 'deposit'].includes(subCommand)) {
          return this.processTransaction(message, userId, guildId, amountStr, 'deposit');
        }
      }

      // 2. Menu Principal com Botões de Ação
      const userData = await ensureUser(userId, guildId);

      const buildEmbed = (user, data) => new EmbedBuilder()
        .setColor('#e67e22')
        .setTitle('🏦 BiscBank')
        .setDescription(`Olá **${user.username}**!\n\n👛 Carteira: \`${(data.wallet || 0).toLocaleString()}\` ₿\n🏛️ Banco: \`${(data.bank || 0).toLocaleString()}\` ₿`)
        .setFooter({ text: 'Clique em um botão para movimentar seu saldo.' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bank_deposit').setLabel('Depositar').setEmoji('📥').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bank_withdraw').setLabel('Sacar').setEmoji('📤').setStyle(ButtonStyle.Danger)
      );

      const response = await message.reply({ embeds: [buildEmbed(message.author, userData)], components: [row] });

      // Coletor para os botões do menu
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });
      collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: msg("banco.erro_acesso"), flags: MessageFlags.Ephemeral });
        }

        const actionType = i.customId === 'bank_deposit' ? 'deposit' : 'withdraw';
        const actionName = actionType === 'deposit' ? 'depositar' : 'sacar';

        const modal = new ModalBuilder()
          .setCustomId(`bank_modal_${actionType}_${i.id}`)
          .setTitle(`BiscBank — ${actionType === 'deposit' ? 'Depositar' : 'Sacar'}`);

        const amountInput = new TextInputBuilder()
          .setCustomId('bank_amount')
          .setLabel(`Quanto deseja ${actionName}? (ex: 100 ou tudo)`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Digite um valor ou "tudo"')
          .setRequired(true)
          .setMaxLength(20);

        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

        await i.showModal(modal);

        try {
          const modalSubmit = await i.awaitModalSubmit({
            filter: (m) => m.customId === `bank_modal_${actionType}_${i.id}` && m.user.id === message.author.id,
            time: 60000
          });

          await modalSubmit.deferReply({ flags: MessageFlags.Ephemeral });

          const rawAmount = modalSubmit.fields.getTextInputValue('bank_amount').trim().toLowerCase();
          const freshUser = await ensureUser(userId, guildId);
          
          let amount;
          if (rawAmount === 'all' || rawAmount === 'tudo') {
            amount = actionType === 'deposit' ? Number(freshUser.wallet) : Number(freshUser.bank);
          } else {
            amount = parseInt(rawAmount.replace(/[^0-9]/g, ''), 10);
          }

          if (!amount || isNaN(amount) || amount <= 0) {
            return modalSubmit.editReply({ content: msg("banco.mensagem_6") });
          }

          const result = await bankTransaction(userId, guildId, amount, actionType);

          if (!result.success) {
            return modalSubmit.editReply({ content: msg("banco.erro_motivo", { reason: result.reason }) });
          }

          const successEmbed = new EmbedBuilder()
            .setColor(actionType === 'deposit' ? '#2ecc71' : '#e74c3c')
            .setTitle(`✅ ${actionType === 'deposit' ? 'Depósito' : 'Saque'} Realizado`)
            .setDescription(`Valor: **${amount.toLocaleString()} ₿**`)
            .addFields(
              { name: '👛 Carteira', value: `\`${result.newWallet.toLocaleString()}\``, inline: true },
              { name: '🏛️ Banco', value: `\`${result.newBank.toLocaleString()}\``, inline: true }
            );

          await modalSubmit.editReply({ embeds: [successEmbed] });

          const updatedUserData = await ensureUser(userId, guildId);
          await response.edit({ embeds: [buildEmbed(message.author, updatedUserData)] }).catch(() => null);

        } catch (modalError) {
          // Timeout ou fecho do modal ignorado
        }
      });

      collector.on('end', () => {
        response.edit({ components: [] }).catch(() => null);
      });

    } catch (error) {
      Logger.error(`[Erro no Comando ${d.nome}]:`, error);
      message.reply(msg("banco.motivo_erro"));
    }
  },

  // Processamento via comando de texto direto (ex: ..banco depositar 100)
  async processTransaction(message, userId, guildId, amountStr, type) {
    if (!amountStr) {
      return message.reply(msg("banco.mensagem_5"));
    }

    const userData = await ensureUser(userId, guildId);
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
      return message.reply(msg("banco.erro_motivo", { reason: result.reason }));
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
    "valor_necessario": "Informe o valor desejado:",
    "valor_invalido": "❌ Valor inválido informado.",
    "motivo_erro": "❌ Ocorreu um erro ao acessar o banco.",
    "mensagem_5": "⚠️ Informe um valor para realizar a operação (ex: 100 ou tudo).",
    "mensagem_6": "❌ Por favor, insira um valor numérico válido e maior que zero.",
    "erro_motivo": "❌ **Erro:** {reason}"
  }
}
@end
*/

import msg from '../../config/msg-handler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import allData from '../../config/command_data.json' with { type: 'json' };
import { getUser, removeBiscoins, addBiscoins } from '../../infra/database/services/userService.js';
import { getPrefixes } from '../../config/config.js';

const commandData = allData["pay"];
const BANK_TAX_RATE = 0.03;
const MAX_TRANSFER_AMOUNT = 1000000;

const isInvalidUser = (targetUser, originalAuthor) => {
    return targetUser.id === originalAuthor.id || targetUser.bot;
};

const extractAmountFromArguments = (args) => {
    const numericArgument = args.find(arg => !arg.startsWith('<@') && !isNaN(arg));
    return numericArgument ? parseInt(numericArgument) : null;
};

const isValidAmount = (amount) => {
    return amount > 0 && amount <= MAX_TRANSFER_AMOUNT;
};

const calculateTransaction = (amount) => {
    const taxAmount = Math.floor(amount * BANK_TAX_RATE);
    const finalAmount = amount - taxAmount;
    return { taxAmount, finalAmount };
};

const createReceiptMessage = (sender, receiver, amount, taxAmount, finalAmount) => {
    return [
        `**Transferência Realizada**`,
        `**De:** ${sender.username}`,
        `**Para:** ${receiver.username}`,
        `**Valor Enviado:** ${amount}`,
        `**Taxa do Banco (${BANK_TAX_RATE * 100}%):** -${taxAmount}`,
        `**Valor Recebido:** ${finalAmount} Biscoins`
    ].join('\n');
};

export default {
    data: {
        name: commandData.nome,
        aliases: commandData.apelidos,
        description: commandData.descricao,
        usage: commandData.uso,
        category: commandData.categoria
    },
    async execute(message, args, client) {
        try {
            const commandPrefix = getPrefixes()[0] || "..";
            const targetUser = message.mentions.users.first();
            const sender = message.author;

            if (!targetUser) {
                return message.reply(`**Uso incorreto.** Use: \`${commandPrefix}pay @usuario <valor>\``);
            }

            if (isInvalidUser(targetUser, sender)) {
                const errorMessage = targetUser.id === sender.id 
                    ? 'Você não pode fazer transferências para si mesmo.'
                    : 'Não é possível transferir para bots.';
                return message.reply(errorMessage);
            }

            const transferAmount = extractAmountFromArguments(args);
            
            if (!transferAmount) {
                return message.reply('Especifique um valor numérico válido.');
            }

            if (!isValidAmount(transferAmount)) {
                const errorMessage = transferAmount <= 0 
                    ? 'O valor deve ser maior que zero.'
                    : `O limite máximo por transferência é de ${MAX_TRANSFER_AMOUNT}.`;
                return message.reply(errorMessage);
            }

            const { taxAmount, finalAmount } = calculateTransaction(transferAmount);
            
            const hasSufficientFunds = await removeBiscoins(
                sender.id, 
                message.guild.id, 
                transferAmount, 
                'wallet'
            );

            if (!hasSufficientFunds) {
                const userBalance = await getUser(sender.id, message.guild.id);
                return message.reply(
                    `**Saldo insuficiente.** Você tentou enviar ${transferAmount}, mas possui apenas ${userBalance.wallet} na carteira.`
                );
            }

            await addBiscoins(
                targetUser.id, 
                message.guild.id, 
                finalAmount, 
                'wallet'
            );

            const receiptMessage = createReceiptMessage(
                sender,
                targetUser,
                transferAmount,
                taxAmount,
                finalAmount
            );

            return message.reply(receiptMessage);

        } catch (error) {
            console.error('Erro no comando pay:', error);
            message.reply('Ocorreu um erro interno na transação. O dinheiro não foi descontado.');
        }
    }
};
/*
@register-messages
{
  "pay": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
    "mensagem_1": "**Uso incorreto.** Use: \\",
    "mensagem_2": "Especifique um valor numérico válido.",
    "mensagem_3": "**Saldo insuficiente.** Você tentou enviar ${transferAmount}, mas possui apenas ${userBalance.wallet} na carteira.",
    "mensagem_4": "Ocorreu um erro interno na transação. O dinheiro não foi descontado."
  }
}
@end
*/

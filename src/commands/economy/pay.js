import msg from '../../config/msg-handler.js';
import { Logger } from '../../infra/logger/index.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import allData from '../../config/command_data.json' with { type: 'json' };
import { userRepo } from '../../infra/database/repositories/userRepository.js';
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
                return message.reply(msg("pay.instrucao_uso", { commandPrefix }));
            }

            if (isInvalidUser(targetUser, sender)) {
                const errorMessage = targetUser.id === sender.id 
                    ? 'Você não pode fazer transferências para si mesmo.'
                    : 'Não é possível transferir para bots.';
                return message.reply(errorMessage);
            }

            const transferAmount = extractAmountFromArguments(args);
            
            if (!transferAmount) {
                return message.reply(msg("pay.valor_invalido"));
            }

            if (!isValidAmount(transferAmount)) {
                const errorMessage = transferAmount <= 0 
                    ? 'O valor deve ser maior que zero.'
                    : `O limite máximo por transferência é de ${MAX_TRANSFER_AMOUNT}.`;
                return message.reply(errorMessage);
            }

            // Execução da transferência atômica via RPC (débito + crédito em uma transação)
            const result = await userRepo.transferBiscoins(sender.id, targetUser.id, message.guild.id, transferAmount);

            if (!result.success) {
                if (result.reason === 'INSUFFICIENT_FUNDS') {
                    const userBalance = await userRepo.getUser(sender.id, message.guild.id);
                    return message.reply(
                        msg("pay.saldo_insuficiente", { transferAmount, "wallet": userBalance.wallet }));
                }
                return message.reply(msg("pay.erro_transacao"));
            }

            // O resultado já retorna os saldos atualizados e a taxa cobrada
            const { tax, net } = result;

            const receiptMessage = createReceiptMessage(
                sender,
                targetUser,
                transferAmount,
                tax,
                net
            );

            return message.reply(receiptMessage);

        } catch (error) {
            Logger.error('Erro no comando pay:', error);
            message.reply(msg("pay.erro_transacao"));
        }
    }
};

/*
@register-messages
{
  "pay": {
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "instrucao_uso": "**Uso incorreto.** Use: `{commandPrefix}pay @usuario <valor>`",
    "valor_invalido": "Especifique um valor numérico válido.",
    "saldo_insuficiente": "**Saldo insuficiente.** Você tentou enviar {transferAmount}, mas possui apenas {wallet} na carteira.",
    "erro_transacao": "Ocorreu um erro interno na transação. O dinheiro não foi descontado."
  }
}
@end
*/

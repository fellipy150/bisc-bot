import msg from '../../config/msg-handler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

// Configuração de ambiente ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import do JSON e Serviços
import allData from '../../config/command_data.json' with { type: 'json' };
import { getUser, bankTransaction } from '../../infra/database/services/userService.js';

const d = allData["sacar"];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
    permissions: [PermissionFlagsBits.SendMessages],
    ownerOnly: false
  },

  async execute(message, args, client) {
    try {
      const userId = message.author.id;
      const guildId = message.guild.id;

      // 1. Verificações Iniciais (Sanity Checks)
      if (args.length === 0) {
        return message.reply(`⚠️ **Uso incorreto!** Tente: \`${d.uso}\` (ex: \`sacar 100\` ou \`sacar all\`)`);
      }

      // 2. Lógica de Valor
      const userData = await getUser(userId, guildId);
      let amount;
      const arg0 = args[0].toLowerCase();

      if (arg0 === 'all' || arg0 === 'tudo') {
        amount = userData.bank;
      } else {
        amount = parseInt(arg0.replace(/[^0-9]/g, '')); // Limpa caracteres não numéricos
      }

      // Validações de Negócio
      if (!amount || isNaN(amount) || amount <= 0) {
        return message.reply('❌ Por favor, insira um valor numérico válido e maior que zero para sacar.');
      }

      if (userData.bank <= 0) {
        return message.reply('❌ Você não possui Biscoins guardadas no banco para realizar um saque.');
      }

      if (amount > userData.bank) {
        return message.reply(`❌ Você não tem essa quantia no banco. Seu saldo bancário atual é de **${userData.bank.toLocaleString()} Biscoins**.`);
      }

      // 3. Execução da Transação no Banco de Dados
      const result = await bankTransaction(userId, guildId, amount, 'withdraw');

      if (!result.success) {
        return message.reply(`❌ **Falha na operação:** ${result.reason}`);
      }

      // 4. Feedback Visual
      const successEmbed = new EmbedBuilder()
        .setColor('#2ecc71') // Verde para sucesso
        .setTitle('📤 Saque Efetuado com Sucesso')
        .setDescription(`Você retirou **${amount.toLocaleString()} Biscoins** do seu cofre bancário.`)
        .addFields(
          { name: '🏛️ Saldo no Banco', value: `\`${result.newBank.toLocaleString()}\` ₿`, inline: true },
          { name: '👛 Saldo na Carteira', value: `\`${result.newWallet.toLocaleString()}\` ₿`, inline: true }
        )
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2489/2489756.png')
        .setFooter({ text: 'Dinheiro na carteira pode ser roubado! Use com sabedoria.' })
        .setTimestamp();

      return message.reply({ embeds: [successEmbed] });

    } catch (error) {
      console.error(`[Erro no Comando ${d.nome}]:`, error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Erro Interno')
        .setDescription('Ocorreu um erro ao processar o saque. O dinheiro permanece seguro no banco.');
      
      return message.reply({ embeds: [errorEmbed] });
    }
  }
};


/*
@register-messages
{
  "sacar": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
    "mensagem_1": "⚠️ **Uso incorreto!** Tente: \\",
    "mensagem_2": "❌ Por favor, insira um valor numérico válido e maior que zero para sacar.",
    "mensagem_3": "❌ Você não possui Biscoins guardadas no banco para realizar um saque.",
    "mensagem_4": "❌ Você não tem essa quantia no banco. Seu saldo bancário atual é de **${userData.bank.toLocaleString()} Biscoins**.",
    "mensagem_5": "❌ **Falha na operação:** ${result.reason}"
  }
}
@end
*/

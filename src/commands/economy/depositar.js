import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

// Configuração de ambiente ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import do JSON e Serviços
import allData from '../../config/command_data.json' with { type: 'json' };
import { getUser, bankTransaction } from '../../infra/database/services/userService.js';

const d = allData["depositar"];

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
        return message.reply(`⚠️ **Uso incorreto!** Tente: \`${d.uso}\` (ex: \`depositar 100\` ou \`depositar all\`)`);
      }

      // 2. Lógica de Valor
      const userData = await getUser(userId, guildId);
      let amount;
      const arg0 = args[0].toLowerCase();

      if (arg0 === 'all' || arg0 === 'tudo') {
        amount = userData.wallet;
      } else {
        // Remove qualquer caractere que não seja número (ex: R$ ou pontos)
        amount = parseInt(arg0.replace(/[^0-9]/g, ''));
      }

      // Validações de Negócio
      if (!amount || isNaN(amount) || amount <= 0) {
        return message.reply('❌ Por favor, insira um valor numérico válido para depositar.');
      }

      if (userData.wallet <= 0) {
        return message.reply('❌ Sua carteira está vazia! Você não tem Biscoins para depositar.');
      }

      if (amount > userData.wallet) {
        return message.reply(`❌ Você não tem essa quantia na carteira. Seu saldo atual é de **${userData.wallet.toLocaleString()} Biscoins**.`);
      }

      // 3. Execução da Transação no Banco de Dados
      // A função bankTransaction lida com a lógica de remover da wallet e somar no bank
      const result = await bankTransaction(userId, guildId, amount, 'deposit');

      if (!result.success) {
        return message.reply(`❌ **Erro na transação:** ${result.reason}`);
      }

      // 4. Feedback Visual
      const successEmbed = new EmbedBuilder()
        .setColor('#2ecc71') // Verde para sucesso
        .setTitle('📥 Depósito Realizado')
        .setDescription(`Você guardou **${amount.toLocaleString()} Biscoins** com segurança no **BiscBank**.`)
        .addFields(
          { name: '👛 Saldo na Carteira', value: `\`${result.newWallet.toLocaleString()}\` ₿`, inline: true },
          { name: '🏛️ Saldo no Banco', value: `\`${result.newBank.toLocaleString()}\` ₿`, inline: true }
        )
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2830/2830284.png')
        .setFooter({ text: 'Seu dinheiro agora está protegido contra roubos e rendendo juros!' })
        .setTimestamp();

      return message.reply({ embeds: [successEmbed] });

    } catch (error) {
      console.error(`[Erro no Comando ${d.nome}]:`, error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Erro Interno')
        .setDescription('Ocorreu um erro ao processar seu depósito. Tente novamente mais tarde.');
      
      return message.reply({ embeds: [errorEmbed] });
    }
  }
};


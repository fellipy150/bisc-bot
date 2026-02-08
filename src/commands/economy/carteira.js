import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

// Configuração de __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import do JSON com caminho dinâmico
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData["carteira"];

// Import do serviço de usuário
import { getUser } from '../../infra/database/services/userService.js';

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria
  },
  async execute(message, args, client) {
    try {
      const target = message.mentions.users.first() || message.author;
      const userData = await getUser(target.id, message.guild.id);

      if (!userData) {
        return message.reply(`❌ ${target.id === message.author.id ? 'Você não está registrado no sistema!' : 'Este usuário não está registrado no sistema!'} Use algum comando para se registrar.`);
      }

      const isSelf = target.id === message.author.id;
      const userPronoun = isSelf ? 'Você' : target.username;
      
      // Formatar o valor monetário
      const formattedWallet = userData.wallet.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });

      // Opções de resposta com emojis diferentes
      const responseOptions = [
        `💰 ${userPronoun} possui **${formattedWallet}** na carteira!`,
        `💵 Saldo atual de ${isSelf ? 'sua' : `${target.username}'s`} carteira: **${formattedWallet}**`,
        `💳 ${isSelf ? 'Seu' : `${target.username}'s`} saldo: **${formattedWallet}**`,
        `🏦 Carteira de ${isSelf ? 'você' : target.username}: **${formattedWallet}**`
      ];

      // Selecionar uma resposta aleatória para variedade
      const randomResponse = responseOptions[Math.floor(Math.random() * responseOptions.length)];
      
      // Adicionar informações extras se o saldo for alto
      let extraInfo = '';
      if (userData.wallet > 1000000) {
        extraInfo = '\n🎉 **Uau! Você é um(a) milionário(a)!** 🎊';
      } else if (userData.wallet > 100000) {
        extraInfo = '\n🌟 **Bom trabalho! Economizando bem!**';
      } else if (userData.wallet < 100) {
        extraInfo = '\n💡 *Dica: Use comandos diários para ganhar mais dinheiro!*';
      }

      await message.reply(randomResponse + extraInfo);

    } catch (error) {
      console.error('Erro ao executar comando carteira:', error);
      await message.reply('❌ Ocorreu um erro ao verificar o saldo da carteira. Por favor, tente novamente mais tarde.');
    }
  }
};
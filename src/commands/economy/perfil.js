import msg from '../../config/msg-handler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

// Configuração de __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import do JSON com caminho dinâmico
import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData["perfil"];

// Novos imports
import { getUser } from '../../infra/database/services/userService.js';
import { EmbedBuilder } from 'discord.js';

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
        return message.reply('❌ Perfil não encontrado! Use algum comando para ser registrado no sistema.');
      }

      const xpNeeded = userData.level * 500;
      const progress = Math.min((userData.xp / xpNeeded) * 100, 100);

      const embed = new EmbedBuilder()
        .setTitle(`👤 Perfil de ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
        .setColor('#0099ff')
        .addFields(
          { 
            name: '💰 Carteira', 
            value: `R$ ${userData.wallet.toLocaleString()}`, 
            inline: true 
          },
          { 
            name: '📊 Nível', 
            value: `${userData.level}`, 
            inline: true 
          },
          { 
            name: '✨ Progresso (XP)', 
            value: `${userData.xp.toLocaleString()} / ${xpNeeded.toLocaleString()} (${progress.toFixed(1)}%)`, 
            inline: true 
          }
        )
        .setFooter({ 
          text: `ID: ${target.id} | Comando solicitado por ${message.author.username}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Erro ao executar comando perfil:', error);
      await message.reply('❌ Ocorreu um erro ao exibir o perfil. Tente novamente mais tarde.');
    }
  }
};
/*
@register-messages
{
  "perfil": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
    "mensagem_1": "❌ Perfil não encontrado! Use algum comando para ser registrado no sistema.",
    "mensagem_2": "❌ Ocorreu um erro ao exibir o perfil. Tente novamente mais tarde."
  }
}
@end
*/

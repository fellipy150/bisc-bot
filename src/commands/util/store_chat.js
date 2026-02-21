import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import { EmbedBuilder, PermissionFlagsBits, AttachmentBuilder, SnowflakeUtil } from 'discord.js';
import allData from '../../config/command_data.json' with { type: 'json' };
import parseInputTime from '../../util/input_time_parser.js'; // Ajuste se o export não for default

// Configuração de ambiente ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const d = allData["store_chat"];

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
      // 1. Verificações Iniciais (Sanity Checks)
      if (this.data.usage && args.length === 0 && this.data.usage.includes('<')) {
        return message.reply(`⚠️ Uso incorreto! Tente: \`${d.uso}\` `);
      }

      console.log(`Comando ${d.nome} executado por ${message.author.tag}`);
      const channel = message.channel;

      // Função auxiliar para coletar respostas do usuário
      const askQuestion = async (question) => {
        await channel.send(question);
        const filter = m => m.author.id === message.author.id;
        try {
          const collected = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
          return collected.first(); // Retorna o objeto da mensagem
        } catch (error) {
          await channel.send("⏳ Tempo esgotado. Comando cancelado.");
          return null;
        }
      };

      // 2. Pergunta o horário de início
      const timeMsg = await askQuestion("⏰ Que horas a conversa começou?");
      if (!timeMsg) return;

      // Passa a resposta para o utilitário e desestrutura o novo formato de objeto
      const parsedTime = await parseInputTime(timeMsg.content);
      if (!parsedTime || !parsedTime.inicio) {
        return channel.send("❌ Formato de data inválido. Comando cancelado.");
      }
      const startTimestamp = parsedTime.inicio;
      const endTimestamp = parsedTime.fim;

      // 3. Pergunta os participantes
      const partMsg = await askQuestion("👥 Quem estava participando? (Mencione os usuários, envie os IDs, ou digite 'todos' para ignorar o filtro)");
      if (!partMsg) return;

      const filterParticipants = partMsg.content.toLowerCase() !== 'todos';
      let targetIds = [];
      
      if (filterParticipants) {
        // Pega IDs de menções diretas
        const mentionedIds = Array.from(partMsg.mentions.users.keys());
        // Pega IDs puros enviados no texto (regex para capturar IDs do Discord)
        const rawIds = partMsg.content.match(/\b\d{17,19}\b/g) || [];
        
        // Junta tudo e remove duplicatas
        targetIds = [...new Set([...mentionedIds, ...rawIds])];
        
        if (targetIds.length === 0) {
          return channel.send("❌ Nenhum usuário ou ID válido foi encontrado na sua resposta. Comando cancelado.");
        }
      }

      await channel.send("⏳ Buscando o histórico, aguarde...");

      // 4. Lógica de Busca de Mensagens
      const snowflake = SnowflakeUtil.generate({ timestamp: startTimestamp });
      let messagesFetch = [];
      let lastId = null;
      let fetchMore = true;
      let failsafe = 0; // Previne loops infinitos

      while (fetchMore && failsafe < 50) { // Limite de 5000 mensagens
        failsafe++;
        const options = { limit: 100, after: lastId || snowflake };

        const fetched = await channel.messages.fetch(options);
        if (fetched.size === 0) {
          fetchMore = false;
          break;
        }

        messagesFetch.push(...fetched.values());
        
        // No fetch com 'after', a mensagem com maior ID (mais recente do lote) deve ser o novo ponto de partida
        // As mensagens vêm ordenadas da mais nova para a mais velha dentro do lote retornado pelo Discord
        lastId = fetched.first().id; 
        
        if (fetched.size < 100) fetchMore = false; 
      }

      // Ordena cronologicamente (da mais velha para a mais nova)
      messagesFetch.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      // Filtra pelos participantes, se ativado
      if (filterParticipants) {
        messagesFetch = messagesFetch.filter(m => targetIds.includes(m.author.id));
      }
      
      // Se o parser identificou um intervalo (data/hora de término), recorta as mensagens que passaram do limite
      if (endTimestamp) {
        messagesFetch = messagesFetch.filter(m => m.createdTimestamp <= endTimestamp);
      }

      // 5. Processamento e Formatação
      let historyText = "";

      for (const msg of messagesFetch) {
        const author = msg.author.username;
        let content = msg.cleanContent;

        const images = msg.attachments.filter(a => a.contentType && a.contentType.startsWith('image/'));
        const audios = msg.attachments.filter(a => (a.contentType && a.contentType.startsWith('audio/')) || a.flags.has(8192));

        if (images.size > 0) {
          content = content ? `${content} [imagem]` : "[imagem]";
        }
        
        if (audios.size > 0) {
          const audio = audios.first();
          let durationStr = "desconhecido";
          if (audio.durationSecs) {
            const mins = Math.floor(audio.durationSecs / 60);
            const secs = String(Math.floor(audio.durationSecs % 60)).padStart(2, '0');
            durationStr = `${mins}:${secs}`;
          }
          const audioText = `áudio de ${durationStr}`;
          content = content ? `${content} ${audioText}` : audioText;
        }

        // Verifica se é uma resposta
        if (msg.reference && msg.reference.messageId) {
          let repliedAuthor = "desconhecido";
          let repliedContent = "...";

          try {
            // Busca a mensagem no array que já baixamos para evitar excesso de requisições na API
            let repliedMsg = messagesFetch.find(m => m.id === msg.reference.messageId);
            
            // Se não estiver no array, busca na API do Discord
            if (!repliedMsg) {
              repliedMsg = await channel.messages.fetch(msg.reference.messageId);
            }
            
            repliedAuthor = repliedMsg.author.username;
            repliedContent = repliedMsg.cleanContent || '...';
            
            historyText += `${author} respondendo ${repliedAuthor}: "${repliedContent}" // ${content}\n`;
          } catch (error) {
            historyText += `${author} respondendo [mensagem apagada ou inacessível]: "..." // ${content}\n`;
          }
        } else {
          // Mensagem normal
          historyText += `${author}: ${content}\n`;
        }
      }

      if (!historyText) {
        return channel.send("ℹ️ Nenhuma mensagem encontrada para esses critérios ou período.");
      }

      // 6. Salvamento e Envio
      const timestamp = Date.now();
      const fileName = `historico-${timestamp}.txt`;
      const filePath = path.join(__dirname, fileName);
      
      fs.writeFileSync(filePath, historyText);

      const attachment = new AttachmentBuilder(filePath);
      await channel.send({ 
        content: `✅ O histórico foi capturado com sucesso! (${messagesFetch.length} mensagens processadas)`, 
        files: [attachment] 
      });

      // Limpa o arquivo local
      fs.unlinkSync(filePath);

    } catch (error) {
      console.error(`[Erro no Comando ${d.nome}]:`, error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Erro Interno')
        .setDescription('Ocorreu um erro ao processar este comando. Tente novamente mais tarde.');
      
      return message.reply({ embeds: [errorEmbed] });
    }
  }
};

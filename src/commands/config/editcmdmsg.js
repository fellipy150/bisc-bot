import msg from '../../config/msg-handler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData['editcmdmsg'];

// --- FUNÇÃO AUXILIAR: Transforma código em texto amigável ---
// Ex: "Olá \`${nome}\`" -> "Olá {nome}"
// --- FUNÇÕES AUXILIARES DE TRATAMENTO ---

function formatarParaUsuario(texto, quoteType) {
  let formatado = texto;

  // 1. Remove escapes da aspa usada no arquivo (ex: \" vira ")
  if (quoteType === '"') formatado = formatado.replace(/\\"/g, '"');
  if (quoteType === "'") formatado = formatado.replace(/\\'/g, "'");
  if (quoteType === '`') formatado = formatado.replace(/\\`/g, '`');

  // 2. Transforma interpolação ${var} em {var}
  formatado = formatado.replace(/\$\{([^}]+)\}/g, '{$1}');

  // 3. PREVENÇÃO DE QUEBRA DE MARKDOWN:
  // Se houver ``` no texto original, vamos substituir por ` ` ` (com espaços)
  // apenas para exibição, evitando fechar a caixa de texto do bot.
  formatado = formatado.replace(/```/g, '` ` `');

  return formatado;
}

function formatarParaCodigo(texto, quoteType) {
  let codigo = texto;

  // 1. Remove a prevenção de quebra de markdown (volta os espaços para crases coladas)
  codigo = codigo.replace(/` ` `/g, '```');

  // 2. Transforma placeholder {var} volta para ${var}
  codigo = codigo.replace(/\{([^}]+)\}/g, '${$1}');

  // 3. Adiciona escapes para a aspa que o arquivo utiliza
  if (quoteType === '"') codigo = codigo.replace(/"/g, '\\"');
  if (quoteType === "'") codigo = codigo.replace(/'/g, "\\'");
  if (quoteType === '`') {
    // Se a aspa for crase, precisamos escapar as crases internas
    codigo = codigo.replace(/`/g, '\\`');
  }

  return codigo;
}

// --- LÓGICA DE EDIÇÃO ---
async function iniciarEdicao(message, cmdKey, cmdData, searchKeywords = []) {
  const comandosDir = path.resolve(__dirname, '..');
  const targetPath = path.join(comandosDir, cmdData.categoria, `${cmdData.nome}.js`);

  if (!fs.existsSync(targetPath)) {
    return message.reply(msg("editcmdmsg.arquivo_nao_encontrado", { targetPath }));
  }

  const fileContent = fs.readFileSync(targetPath, 'utf8');

// Nova Regex: Agora captura métodos de envio, propriedades de embed e retornos
const regex = /((?:message|msg|channel|client)\.(?:reply|send)|throw\s+new\s+Error|title|description|name|value|text|return)\s*[:(\s]\s*(['"`])((?:(?!\2|\\).|\\.)*)\2/g;

  const matches = [];
  let match;
  while ((match = regex.exec(fileContent)) !== null) {
    let score = 0;
    if (searchKeywords.length > 0) {
      const contentLower = match[3].toLowerCase();
      searchKeywords.forEach((k) => {
        if (contentLower.includes(k.toLowerCase())) score++;
      });
    }

    matches.push({
      fullMatch: match[0],
      method: match[1],
      quoteType: match[2],
      content: match[3], // Conteúdo cru do arquivo (com escapes e ${})
      indexStart: match.index + match[0].indexOf(match[3]),
      indexEnd: match.index + match[0].indexOf(match[3]) + match[3].length,
      relevance: score,
    });
  }

  if (matches.length === 0) {
    return message.reply(msg("editcmdmsg.referencia_arquivo", { "nome": cmdData.nome }));
  }

  // Ordena por relevância interna (para exibir os mais prováveis primeiro na lista, mas sem ícones)
  // Se preferir manter a ordem do arquivo, remova o .sort
  matches.sort((a, b) => b.relevance - a.relevance);

  // Calcula quantos dígitos o maior número tem para o padStart (ex: 10 itens -> "01", "10")
  const padLen = String(matches.length).length;

  let msgList = `📝 **Editando comando:** \`${cmdData.nome}\`\nEscolha o número da mensagem para editar:\n\n`;

  // Abre bloco markdown
  msgList += '```markdown\n';

  matches.forEach((m, i) => {
    const num = String(i + 1).padStart(padLen, '0');

    // Formata para visualização (limpa)
    let displayContent = formatarParaUsuario(m.content, m.quoteType);

    // Remove quebras de linha para a lista não ficar gigante
    displayContent = displayContent.replace(/\n/g, 'Val(NL)');
    if (displayContent.length > 60) displayContent = displayContent.substring(0, 60) + '...';

    msgList += `[${num}] ${displayContent}\n`;
  });

  msgList += "```\nDigite o **número** (ou 'cancelar').";

  await message.reply(msgList);

  const filter = (m) => m.author.id === message.author.id;
  try {
    const collectedChoice = await message.channel.awaitMessages({
      filter,
      max: 1,
      time: 60000,
      errors: ['time'],
    });
    const choiceMsg = collectedChoice.first();

    if (choiceMsg.content.toLowerCase() === 'cancelar') return message.reply(msg("editcmdmsg.operacao_cancelada"));

    const choice = parseInt(choiceMsg.content);
    if (isNaN(choice) || choice < 1 || choice > matches.length)
      return message.reply(msg("editcmdmsg.opcao_invalida"));

    const selectedMatch = matches[choice - 1];

    // Prepara o texto original para o usuário copiar/editar
    const textoParaEdicao = formatarParaUsuario(selectedMatch.content, selectedMatch.quoteType);

    await message.reply(
      msg("editcmdmsg.instrucao_edicao", { textoParaEdicao }));

    const collectedText = await message.channel.awaitMessages({
      filter,
      max: 1,
      time: 300000,
      errors: ['time'],
    }); // 5 min para editar
    const rawNewText = collectedText.first().content;

    // Converte de volta para o formato de código
    const finalCodeText = formatarParaCodigo(rawNewText, selectedMatch.quoteType);

    // Segurança de arquivo
    const currentFileContent = fs.readFileSync(targetPath, 'utf8');
    const snippetCheck = currentFileContent.substring(
      selectedMatch.indexStart,
      selectedMatch.indexEnd
    );

    if (snippetCheck !== selectedMatch.content) {
      return message.reply(msg("editcmdmsg.arquivo_alterado"));
    }

    const newFileContent =
      currentFileContent.substring(0, selectedMatch.indexStart) +
      finalCodeText +
      currentFileContent.substring(selectedMatch.indexEnd);

    fs.writeFileSync(targetPath, newFileContent, 'utf8');
    message.reply(msg("editcmdmsg.referencia_comando", { "nome": cmdData.nome }));
    console.log(`[EditCmdMsg] ${cmdData.nome} alterado por ${message.author.tag}`);
  } catch (err) {
    if (err.size === 0) return message.reply(msg("editcmdmsg.tempo_esgotado"));
    console.error(err);
    return message.reply(msg("editcmdmsg.erro_processamento"));
  }
}

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
  },
  async execute(message, args, client) {
    // --- LÓGICA DE SELEÇÃO DO COMANDO (MANTIDA IGUAL) ---

    if (args[0]) {
      const cmdKey = Object.keys(allData).find(
        (k) => allData[k].nome === args[0] || allData[k].apelidos.includes(args[0])
      );
      if (cmdKey) return iniciarEdicao(message, cmdKey, allData[cmdKey]);
      return message.reply(msg("editcmdmsg.comando_invalido", { "args0": args[0] }));
    }

    if (message.reference) {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      const content = repliedMessage.content;

      const keywords = content
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      const firstWord = content.split(' ')[0].replace(/^[^a-zA-Z0-9]+/, '');
      const cmdKeyDirect = Object.keys(allData).find(
        (k) => allData[k].nome === firstWord || allData[k].apelidos.includes(firstWord)
      );

      if (cmdKeyDirect) {
        return iniciarEdicao(message, cmdKeyDirect, allData[cmdKeyDirect], keywords);
      }

      await message.channel.sendTyping();
      const candidatos = [];
      const comandosDir = path.resolve(__dirname, '..');

      for (const [key, data] of Object.entries(allData)) {
        const filePath = path.join(comandosDir, data.categoria, `${data.nome}.js`);
        if (fs.existsSync(filePath)) {
          const fileBody = fs.readFileSync(filePath, 'utf8');
          let score = 0;
          keywords.forEach((word) => {
            if (fileBody.includes(word)) score++;
          });
          if (score > 0) candidatos.push({ key, data, score });
        }
      }

      candidatos.sort((a, b) => b.score - a.score);

      if (candidatos.length === 0)
        return message.reply(msg("editcmdmsg.origem_nao_encontrada"));

      const bestScore = candidatos[0].score;
      const topCandidatos = candidatos.filter((c) => c.score === bestScore);

      if (topCandidatos.length === 1) {
        return iniciarEdicao(message, topCandidatos[0].key, topCandidatos[0].data, keywords);
      } else {
        let listStr = `🤔 Encontrei múltiplos comandos possíveis (Score: ${bestScore}):\n\`\`\`markdown\n`;
        const padLenCand = String(topCandidatos.length).length;
        topCandidatos.forEach((c, i) => {
          const num = String(i + 1).padStart(padLenCand, '0');
          listStr += `[${num}] ${c.data.nome}\n`;
        });
        listStr += '```\nResponda com o número.';

        await message.reply(listStr);
        const filter = (m) => m.author.id === message.author.id;
        try {
          const c = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
          const idx = parseInt(c.first().content);
          if (isNaN(idx) || idx < 1 || idx > topCandidatos.length)
            return message.reply(msg("editcmdmsg.valor_invalido"));

          return iniciarEdicao(
            message,
            topCandidatos[idx - 1].key,
            topCandidatos[idx - 1].data,
            keywords
          );
        } catch {
          return message.reply(msg("editcmdmsg.tempo_excedido"));
        }
      }
    }

    return message.reply(msg("editcmdmsg.referencia_necessaria"));
  },
};

/*
@register-messages
{
  "editcmdmsg": {
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "arquivo_nao_encontrado": "Arquivo não encontrado em: `{targetPath}`",
    "referencia_arquivo": "o arquivo `{nome}.js` não possui mensagens compatíveis.",
    "operacao_cancelada": "Operação cancelada.",
    "opcao_invalida": "❌ Opção inválida.",
    "instrucao_edicao": "Copie e edite a mensagem abaixo (envie o novo texto):\n```markdown\n{textoParaEdicao}\n```",
    "arquivo_alterado": "❌ O arquivo mudou enquanto você digitava. Operação abortada.",
    "referencia_comando": "Comando `{nome}` atualizado com sucesso",
    "tempo_esgotado": "⏳ Tempo esgotado.",
    "erro_processamento": "❌ Erro ao processar.",
    "comando_invalido": "❌ Comando `{args0}` não encontrado.",
    "origem_nao_encontrada": "❌ Não encontrei a origem dessa mensagem.",
    "valor_invalido": "Inválido.",
    "tempo_excedido": "Tempo esgotado.",
    "referencia_necessaria": "❌ Mencione um comando ou responda a uma mensagem."
  }
}
@end
*/

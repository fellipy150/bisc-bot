import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import { PermissionFlagsBits } from 'discord.js';
import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };

// Configuração de ambiente ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Definição de Caminhos
const CMDS_DIR = path.join(__dirname, "../../commands");
const MSG_FILE = path.join(__dirname, "../../config/message_data.json");
const CMD_DATA_FILE = path.join(__dirname, "../../config/command_data.json");

const d = allData["sync"];

// --- ESTADO GLOBAL E CONTROLE DE SINAL ---
let isSyncing = false;
let restartRequested = false;

// Interceptador de sinal do Nodemon (SIGUSR2)
process.on('SIGUSR2', () => {
  if (isSyncing) {
    console.log('⚠️ [Nodemon] Reinício detectado durante sincronização. Aguardando conclusão...');
    restartRequested = true;
  } else {
    process.exit(0);
  }
});

// --- FUNÇÕES UTILITÁRIAS ---

/**
 * Encerra o processo com um atraso para permitir que as operações de rede (Discord) finalizem.
 */
function safeExit() {
  if (restartRequested) {
    console.log('♻️ [Sync] Finalizando processo para reinício do Nodemon...');
    setTimeout(() => {
      process.exit(0);
    }, 2000); // 2 segundos de margem de segurança
  }
}

/**
 * Escrita Atômica: Escreve num ficheiro temporário e renomeia para evitar corrupção.
 */
function atomicWrite(filePath, content) {
  try {
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    console.error(`❌ [Erro Escrita Atómica] Falha em ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Busca recursiva de ficheiros .js
 */
const getAllFiles = (dir) => {
  let results = [];
  try {
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        results = results.concat(getAllFiles(fullPath));
      } else if (fullPath.endsWith('.js')) {
        results.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`❌ [Erro getAllFiles] Erro ao ler diretório ${dir}:`, error.message);
  }
  return results;
};

/**
 * Extrai o bloco @register-messages evitando auto-deteção através de fragmentação de strings.
 */
function extractRegisterBlock(content) {
  try {
    const START_TAG = "@register" + "-messages"; // Fragmentado para não encontrar no código
    const END_TAG = "@" + "end";

    // Usamos lastIndexOf para priorizar o bloco de comentário no fim do ficheiro
    const sIdx = content.lastIndexOf(START_TAG);
    const eIdx = content.lastIndexOf(END_TAG);

    if (sIdx === -1 || eIdx === -1 || eIdx < sIdx) return null;

    const commentOpen = content.lastIndexOf("/*", sIdx);
    const commentClose = content.indexOf("*/", eIdx);
    if (commentOpen === -1 || commentClose === -1) return null;

    const afterNewline = content.indexOf("\n", sIdx);
    const innerStart = afterNewline === -1 ? sIdx + START_TAG.length : afterNewline + 1;
    
    return {
      fullStart: commentOpen,
      fullEnd: commentClose + 2,
      inner: content.slice(innerStart, eIdx).trim(),
      fullText: content.slice(commentOpen, commentClose + 2)
    };
  } catch (error) {
    console.error("❌ [Erro extractRegisterBlock] Falha no parser:", error.message);
    return null;
  }
}

/**
 * Localiza o fecho de aspas respeitando escapes (essencial para o replaceMessageKey)
 */
function findClosingQuote(text, startIndex, quoteChar) {
  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === quoteChar) {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && text[j] === "\\") { backslashes++; j--; }
      if (backslashes % 2 === 0) return i;
    }
  }
  return -1;
}

/**
 * Substitui chaves msg('key') de forma cirúrgica no código fonte.
 */
function replaceMessageKey(content, cmdName, oldKey, newKey) {
  try {
    let result = content;
    let searchIndex = 0;
    const needle = "msg(";
    const targetKey = `${cmdName}.${oldKey}`;

    while (true) {
      const msgIndex = result.indexOf(needle, searchIndex);
      if (msgIndex === -1) break;

      let i = msgIndex + needle.length;
      while (i < result.length && /\s/.test(result[i])) i++; 

      const quote = result[i];
      if (!["'", '"', "`"].includes(quote)) {
        searchIndex = i;
        continue;
      }

      const keyStart = i + 1;
      const keyEnd = findClosingQuote(result, keyStart, quote);
      if (keyEnd === -1) break;

      if (result.slice(keyStart, keyEnd) === targetKey) {
        const replacement = `${cmdName}.${newKey}`;
        result = result.slice(0, keyStart) + replacement + result.slice(keyEnd);
        searchIndex = keyStart + replacement.length;
      } else {
        searchIndex = keyEnd + 1;
      }
    }
    return result;
  } catch (error) {
    console.error(`❌ [Erro replaceMessageKey] Falha no comando ${cmdName}:`, error.message);
    return content;
  }
}

// --- HANDLERS (SUBCOMANDOS) ---

const handlers = {
  /**
   * Sincroniza as pastas físicas com a propriedade 'categoria' no JSON de dados.
   */
  cat: async (message) => {
    isSyncing = true;
    try {
      await message.reply("🔍 Analisando categorias e estrutura de ficheiros...");
      
      let json;
      try {
        json = JSON.parse(fs.readFileSync(CMD_DATA_FILE, "utf8"));
      } catch (e) {
        throw new Error(`Falha ao ler ${CMD_DATA_FILE}: ${e.message}`);
      }

      let dessincronizados = [];

      const verificar = async (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await verificar(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(".js")) {
            try {
              const fileUrl = 'file://' + fullPath.replace(/\\/g, '/');
              const cmdModule = await import(`${fileUrl}?update=${Date.now()}`);
              const cmd = cmdModule.default;

              const name = cmd?.data?.name;
              if (!name || !json[name]) continue;

              const relative = path.relative(CMDS_DIR, fullPath);
              const parts = relative.split(path.sep);
              const pastaCategoria = parts.length > 1 ? parts[0] : "misc";

              if (json[name].category !== pastaCategoria) {
                dessincronizados.push({ nome: name, atual: json[name].category, correta: pastaCategoria });
              }
            } catch (err) {
              console.error(`⚠️ [Aviso] Falha ao importar ${entry.name} para verificação de categoria.`);
            }
          }
        }
      };

      await verificar(CMDS_DIR);

      if (dessincronizados.length === 0) {
        return await message.channel.send(msg("sync.mensagem_1"));
      }

      let relatorio = "⚠️ **Dessincronias encontradas:**\n" + 
        dessincronizados.map(c => `- \`${c.nome}\`: ${c.atual} -> **${c.correta}**`).join("\n") +
        "\n\nDeseja sincronizar? (Responda com `s` em 30s)";

      await message.channel.send(relatorio);
      const filter = m => m.author.id === message.author.id && m.content.toLowerCase() === 's';
      const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });

      if (collected.size > 0) {
        dessincronizados.forEach(c => { if(json[c.nome]) json[c.nome].category = c.correta; });
        atomicWrite(CMD_DATA_FILE, JSON.stringify(json, null, 2));
        await message.channel.send(msg("sync.mensagem_2"));
      } else {
        await message.channel.send(msg("sync.mensagem_3"));
      }
    } catch (error) {
      console.error("❌ [Erro Handler Cat]:", error);
      await message.channel.send("❌ Ocorreu um erro ao processar a sincronização de categorias.");
    } finally {
      isSyncing = false;
      safeExit();
    }
  },

  /**
   * Sincroniza mensagens entre o ficheiro global e o código fonte de cada comando.
   */
  msg: async (message) => {
    isSyncing = true;
    const statusMsg = await message.reply("🔄 Sincronizando mensagens (Bidirecional)...");

    try {
      const jsonMTime = fs.existsSync(MSG_FILE) ? fs.statSync(MSG_FILE).mtimeMs : 0;
      let mainData = {};
      
      try {
        mainData = JSON.parse(fs.readFileSync(MSG_FILE, "utf8"));
      } catch (e) {
        console.error("⚠️ [Aviso] Message file vazio ou inválido, iniciando novo.");
      }

      let pendingWrites = [];
      let jsonChanged = false;

      const files = getAllFiles(CMDS_DIR);

      for (const filePath of files) {
        try {
          const fileContent = fs.readFileSync(filePath, "utf8");
          const fileMTime = fs.statSync(filePath).mtimeMs;
          const register = extractRegisterBlock(fileContent);
          
          if (!register) continue;

          let localData;
          try { 
            localData = JSON.parse(register.inner); 
          } catch (e) {
            console.error(`\n❌ [Erro Sintaxe JSON] no comando: ${path.basename(filePath)}`);
            console.error(`| Texto capturado: "${register.inner.substring(0, 50)}..."`);
            continue; 
          }

          const cmdName = Object.keys(localData)[0];
          if (!cmdName) continue;
          
          const localMessages = localData[cmdName];

          // CASO A: Código é mais novo que o JSON -> Atualiza o JSON
          if (fileMTime > jsonMTime) {
            console.log(`[Sync Msg] 🆙 Atualizando JSON global via: ${cmdName}`);
            mainData[cmdName] = { _nota: mainData[cmdName]?._nota, ...localMessages };
            // Remove chaves que não existem mais no local
            Object.keys(mainData[cmdName]).forEach(k => {
              if (k !== '_nota' && !localMessages[k]) delete mainData[cmdName][k];
            });
            jsonChanged = true;
          } 
          // CASO B: JSON é mais novo que o Código -> Atualiza o ficheiro do Comando
          else if (jsonMTime > fileMTime) {
            console.log(`[Sync Msg] ⬇️ Atualizando código fonte de: ${cmdName}`);
            const globalMessages = mainData[cmdName];
            if (!globalMessages) continue;

            let newFileContent = fileContent;
            let contentModified = false;

            // 1. Atualiza bloco de comentário
            const newBlock = `/*\n@register-messages\n${JSON.stringify({ [cmdName]: globalMessages }, null, 2)}\n@end\n*/`;
            if (register.fullText !== newBlock) {
              newFileContent = newFileContent.slice(0, register.fullStart) + newBlock + newFileContent.slice(register.fullEnd);
              contentModified = true;
            }

            // 2. Atualiza chamadas msg('...') dinamicamente
            for (const [gKey, gVal] of Object.entries(globalMessages)) {
              if (gKey === '_nota') continue;
              const oldKeyEntry = Object.entries(localMessages).find(([lk, lv]) => lv === gVal && lk !== gKey);
              if (oldKeyEntry) {
                const prev = newFileContent;
                newFileContent = replaceMessageKey(newFileContent, cmdName, oldKeyEntry[0], gKey);
                if (newFileContent !== prev) contentModified = true;
              }
            }

            if (contentModified) pendingWrites.push({ path: filePath, content: newFileContent });
          }
        } catch (fileErr) {
          console.error(`❌ [Erro Processar Ficheiro] ${filePath}:`, fileErr.message);
        }
      }

      if (jsonChanged) {
        atomicWrite(MSG_FILE, JSON.stringify(mainData, null, 2));
      }

      for (const w of pendingWrites) {
        atomicWrite(w.path, w.content);
      }

      await statusMsg.edit("✅ Todas as mensagens foram sincronizadas com sucesso!");
    } catch (error) {
      console.error("❌ [Erro Handler Msg]:", error);
      await statusMsg.edit("❌ Ocorreu um erro crítico durante a sincronização de mensagens.");
    } finally {
      isSyncing = false;
      safeExit();
    }
  }
};

// --- EXPORTAÇÃO DO COMANDO ---

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
    permissions: [PermissionFlagsBits.SendMessages],
    ownerOnly: true
  },

  async execute(message, args, client) {
    const sub = args[0]?.toLowerCase();
    const run = handlers[sub];

    if (!run) {
      return await message.reply(msg("sync.uso_incorreto", { uso: d.uso }));
    }

    try {
      if (isSyncing) return await message.reply("⏳ Já existe uma sincronização em curso. Aguarde...");
      await run(message, args, client);
    } catch (error) {
      console.error(`❌ [Erro Comando Sync]: Erro no subcomando ${sub}:`, error);
      isSyncing = false;
      await message.reply(msg("sync.erro_interno"));
      safeExit();
    }
  }
};

/*
@register-messages
{
  "sync": {
    "_nota": "Utilitário de sincronização atómica e bidirecional.",
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
    "mensagem_1": "✅ Todas as categorias estão sincronizadas!",
    "mensagem_2": "✅ Categorias atualizadas atomicamente.",
    "mensagem_3": "❌ Cancelado."
  }
}
@end
*/


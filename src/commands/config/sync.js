import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import { PermissionFlagsBits } from 'discord.js';
import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Definição de Caminhos[span_4](end_span)[span_5](end_span)
const CMDS_DIR = path.join(__dirname, "../../commands");
const MSG_FILE = path.join(__dirname, "../../config/message_data.json");
const CMD_DATA_FILE = path.join(__dirname, "../../config/command_data.json");
const SNAPSHOT_FILE = path.join(__dirname, "../../config/sync_snapshot.json");

const d = allData["sync"];

// ESTADO GLOBAL E CONTROLE DE SINAL 
let isSyncing = false;
let restartRequested = false;

process.on('SIGUSR2', () => {
  if (isSyncing) {
    console.log('⚠️ [Sync] Reinício do Nodemon suspenso até o fim da sincronização.');
    restartRequested = true;
  } else {
    process.exit(0);
  }
});

// --- FUNÇÕES UTILITÁRIAS 

function atomicWrite(filePath, content) {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

const getAllFiles = (dir) => {
  let results = [];
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
  return results;
};

function extractRegisterBlock(content) {
  const START_TAG = "@register-messages";
  const END_TAG = "@end";
  const sIdx = content.lastIndexOf(START_TAG);
  const eIdx = content.lastIndexOf(END_TAG, sIdx);
  if (sIdx === -1 || eIdx === -1) return null;

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
}

function replaceMessageKey(content, cmdName, oldKey, newKey) {
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
    if (!["'", '"', "`"].includes(quote)) { searchIndex = i; continue; }

    const keyStart = i + 1;
    const keyEnd = result.indexOf(quote, keyStart);
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
}

// --- HANDLERS ---

const handlers = {
  /** * Sincronização de Categorias */
  cat: async (message) => {
    isSyncing = true;
    try {
      let json = JSON.parse(fs.readFileSync(CMD_DATA_FILE, "utf8"));
      let dessincronizados = [];

      const files = getAllFiles(CMDS_DIR);
      for (const filePath of files) {
        const fileUrl = 'file://' + filePath.replace(/\\/g, '/');
        const cmd = (await import(`${fileUrl}?update=${Date.now()}`)).default;
        const name = cmd?.data?.name;
        if (!name || !json[name]) continue;

        const relative = path.relative(CMDS_DIR, filePath);
        const pastaCategoria = relative.split(path.sep)[0] || "misc";

        if (json[name].category !== pastaCategoria) {
          dessincronizados.push({ nome: name, atual: json[name].category, correta: pastaCategoria });
        }
      }

      if (dessincronizados.length === 0) return message.reply(msg("sync.mensagem_1"));

      await message.channel.send("⚠️ **Dessincronias de pasta:**\n" + dessincronizados.map(c => `- \`${c.nome}\`: ${c.atual} -> **${c.correta}**`).join("\n") + "\nConfirmar? (`s`)");
      const collected = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id && m.content.toLowerCase() === 's', max: 1, time: 30000 });

      if (collected.size > 0) {
        dessincronizados.forEach(c => json[c.nome].category = c.correta);
        atomicWrite(CMD_DATA_FILE, JSON.stringify(json, null, 2));
        await message.channel.send(msg("sync.mensagem_2"));
      }
    } finally {
      isSyncing = false;
      if (restartRequested) process.exit(0);
    }
  },

  /**
   * Sincronização Inteligente de Mensagens (Snapshot 3-Way Merge)
   */
  msg: async (message) => {
    isSyncing = true;
    const statusMsg = await message.reply("🔄 Iniciando sincronização inteligente...");

    try {
      let mainData = JSON.parse(fs.readFileSync(MSG_FILE, "utf8"));
      let snapshot = fs.existsSync(SNAPSHOT_FILE) ? JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8")) : {};
      let pendingWrites = [];
      let jsonChanged = false;

      const files = getAllFiles(CMDS_DIR);

      for (const filePath of files) {
        const fileContent = fs.readFileSync(filePath, "utf8");
        const register = extractRegisterBlock(fileContent);
        if (!register) continue;

        let L_Cmd;
        try { L_Cmd = JSON.parse(register.inner); } catch { continue; }

        const cmdName = Object.keys(L_Cmd)[0];
        const localMessages = L_Cmd[cmdName];
        const globalMessages = mainData[cmdName] || {};
        const snapMessages = snapshot[cmdName] || {};

        let mergedMessages = { ...snapMessages };
        let localNeedsUpdate = false;
        let globalNeedsUpdate = false;
        let newFileContent = fileContent;

        const allKeys = new Set([...Object.keys(localMessages), ...Object.keys(globalMessages), ...Object.keys(snapMessages)]);

        for (const key of allKeys) {
          if (key === '_nota') continue;
          const valL = localMessages[key];
          const valG = globalMessages[key];
          const valS = snapMessages[key];

          // LÓGICA DE DECISÃO (SNAPSHOT)
          if (valL === valG) {
            mergedMessages[key] = valL;
          } 
          else if (valL === valS && valG !== valS) {
            // Alteração no JSON vence
            mergedMessages[key] = valG;
            localNeedsUpdate = true;
          } 
          else if (valG === valS && valL !== valS) {
            // Alteração no Código vence
            mergedMessages[key] = valL;
            globalNeedsUpdate = true;
          } 
          else {
            // CONFLITO ou CHAVE NOVA: Código prevalece (Cenário 3)
            mergedMessages[key] = valL ?? valG;
            globalNeedsUpdate = true;
            localNeedsUpdate = true;
          }

          // Detecção de Renomeação (Cenário 1)
          if (valL === undefined && valG !== undefined) {
             const oldKey = Object.keys(localMessages).find(k => localMessages[k] === valG);
             if (oldKey) {
                newFileContent = replaceMessageKey(newFileContent, cmdName, oldKey, key);
                localNeedsUpdate = true;
             }
          }
        }

        if (globalNeedsUpdate) {
          mainData[cmdName] = { _nota: globalMessages._nota, ...mergedMessages };
          jsonChanged = true;
        }

        if (localNeedsUpdate || newFileContent !== fileContent) {
          const finalBlock = `/*\n@register-messages\n${JSON.stringify({ [cmdName]: mainData[cmdName] }, null, 2)}\n@end\n*/`;
          const updatedContent = newFileContent.slice(0, register.fullStart) + finalBlock + newFileContent.slice(register.fullEnd);
          pendingWrites.push({ path: filePath, content: updatedContent });
        }

        snapshot[cmdName] = mainData[cmdName];
      }

      if (jsonChanged) atomicWrite(MSG_FILE, JSON.stringify(mainData, null, 2));
      for (const w of pendingWrites) atomicWrite(w.path, w.content);
      atomicWrite(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));

      await statusMsg.edit(`✨ Sincronia concluída!\nJSON: ${jsonChanged ? 'Sim' : 'Não'} | Arquivos: ${pendingWrites.length}`);
    } finally {
      isSyncing = false;
      if (restartRequested) process.exit(0);
    }
  }
};

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.description,
    usage: d.usage,
    category: d.category,
    permissions: [PermissionFlagsBits.SendMessages],
    ownerOnly: true
  },

  async execute(message, args) {
    const sub = args[0]?.toLowerCase();
    const run = handlers[sub];
    if (!run) return message.reply(msg("sync.uso_incorreto", { uso: d.usage }));

    try {
      if (isSyncing) return message.reply("⏳ Sincronização em curso...");
      await run(message);
    } catch (error) {
      console.error(error);
      isSyncing = false;
      return message.reply(msg("sync.erro_interno"));
    }
  }
};

/*
@register-messages
{
  "sync": {
    "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
    "mensagem_1": "✅ Todas as categorias estão sincronizadas!",
    "mensagem_2": "🔄 Iniciando sincronização de mensagens..."
  }
}
@end
*/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Definição de Caminhos
const CMDS_DIR = path.join(__dirname, "../../commands");
const MSG_FILE = path.join(__dirname, "../../config/message_data.json");
const SNAPSHOT_FILE = path.join(__dirname, "../../config/sync_snapshot.json");

const d = allData["syncmsg"] || { nome: "syncmsg", apelidos: [], descricao: "Sincroniza mensagens globalmente.", uso: "..syncmsg", categoria: "config" };

// --- ESTADO GLOBAL E CONTROLE DE SINAL ---
let isSyncing = false;
let restartRequested = false;

// Evita duplicação de listeners se o sync.js principal também estiver a ouvir
if (process.listenerCount('SIGUSR2') === 0) {
  process.on('SIGUSR2', () => {
    if (isSyncing) {
      console.log('⚠️ [SyncMsg] Reinício do Nodemon suspenso até o fim da sincronização.');
      restartRequested = true;
    } else {
      process.exit(0);
    }
  });
}

// --- FUNÇÕES UTILITÁRIAS ---

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

// BLINDADO: Strings fragmentadas para o script não ler a si mesmo
function extractRegisterBlock(content) {
  const START_TAG = "@register" + "-messages";
  const END_TAG = "@" + "end";
  
  const sIdx = content.lastIndexOf(START_TAG);
  if (sIdx === -1) return null;
  
  const eIdx = content.indexOf(END_TAG, sIdx);
  if (eIdx === -1) return null;

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

// --- COMANDO PRINCIPAL ---

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
    ownerOnly: true
  },

  async execute(message, args, client) {
    try {
      // Validação básica de uso
      if (this.data.usage && args.length === 0 && this.data.usage.includes('<')) {
        return message.reply(
          msg("syncmsg.uso_incorreto", { uso: d.uso })
        );
      }

      if (isSyncing) {
        return message.reply(msg("syncmsg.em_curso"));
      }

      isSyncing = true;
      const statusMsg = await message.reply(msg("syncmsg.iniciando"));
      
      console.log("\n=========================================");
      console.log("🛠️ INICIANDO DEPURAÇÃO DO SYNC MSG");
      console.log("=========================================\n");

      let mainData = fs.existsSync(MSG_FILE) ? JSON.parse(fs.readFileSync(MSG_FILE, "utf8")) : {};
      let snapshot = fs.existsSync(SNAPSHOT_FILE) ? JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8")) : {};
      let pendingWrites = [];
      let jsonChanged = false;

      const files = getAllFiles(CMDS_DIR);

      for (const filePath of files) {
        const fileContent = fs.readFileSync(filePath, "utf8");
        const register = extractRegisterBlock(fileContent);
        if (!register) continue;

        let L_Cmd;
        try { 
          L_Cmd = JSON.parse(register.inner); 
        } catch (err) { 
          console.log(`❌ Erro de sintaxe JSON no ficheiro ${path.basename(filePath)}: ${err.message}`);
          continue; 
        }

        const cmdName = Object.keys(L_Cmd)[0];
        const localMessages = L_Cmd[cmdName] || {};
        const globalMessages = mainData[cmdName] || {};
        const snapMessages = snapshot[cmdName] || {};

        let mergedMessages = { ...snapMessages };
        let localNeedsUpdate = false;
        let globalNeedsUpdate = false;
        let newFileContent = fileContent;

        const allKeys = new Set([...Object.keys(localMessages), ...Object.keys(globalMessages), ...Object.keys(snapMessages)]);

        if (allKeys.size > 0) console.log(`\n📂 Analisando comando: [${cmdName}]`);

        for (const key of allKeys) {
          const valL = localMessages[key];
          const valG = globalMessages[key];
          const valS = snapMessages[key];

          const strL = valL !== undefined ? "✓" : "✗";
          const strG = valG !== undefined ? "✓" : "✗";
          const strS = valS !== undefined ? "✓" : "✗";
          let action = "";

          if (valL === valG) {
            mergedMessages[key] = valL;
            action = "Mantido (L == G)";
          } 
          else if (valL === undefined && valG !== undefined) {
            delete mergedMessages[key];
            globalNeedsUpdate = true;
            action = "APAGADO DO JSON (Falta no Código)";
          }
          else if (valL === valS && valG !== valS) {
            mergedMessages[key] = valG;
            localNeedsUpdate = true;
            action = "CÓDIGO ATUALIZADO (JSON mudou)";
          } 
          else if (valG === valS && valL !== valS) {
            mergedMessages[key] = valL;
            globalNeedsUpdate = true;
            action = "JSON ATUALIZADO (Código mudou)";
          } 
          else {
            mergedMessages[key] = valL ?? valG;
            globalNeedsUpdate = true;
            localNeedsUpdate = true;
            action = "CONFLITO RESOLVIDO (Código Venceu)";
          }

          if (valL === undefined && valG !== undefined) {
             const oldKey = Object.keys(localMessages).find(k => localMessages[k] === valG);
             if (oldKey) {
                newFileContent = replaceMessageKey(newFileContent, cmdName, oldKey, key);
                localNeedsUpdate = true;
                action += " + [Renomeação Detectada]";
             }
          }

          if (action !== "Mantido (L == G)") {
             console.log(`  🔑 Chave: ${key.padEnd(20)} | L:${strL} G:${strG} S:${strS} -> ${action}`);
          }
        }

        if (globalNeedsUpdate) {
          mainData[cmdName] = Object.fromEntries(
             Object.entries(mergedMessages).filter(([_, v]) => v !== undefined)
          );
          jsonChanged = true;
        }

        if (localNeedsUpdate || newFileContent !== fileContent) {
          const finalBlock = `/*\n@register` + `-messages\n${JSON.stringify({ [cmdName]: mainData[cmdName] }, null, 2)}\n@` + `end\n*/`;
          
          const currentRegister = extractRegisterBlock(newFileContent) || register;
          
          const updatedContent = newFileContent.slice(0, currentRegister.fullStart) + finalBlock + newFileContent.slice(currentRegister.fullEnd);
          pendingWrites.push({ path: filePath, content: updatedContent });
        }

        snapshot[cmdName] = { ...mainData[cmdName] };
      }

      if (jsonChanged) atomicWrite(MSG_FILE, JSON.stringify(mainData, null, 2));
      for (const w of pendingWrites) atomicWrite(w.path, w.content);
      atomicWrite(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));

      console.log("\n✅ DEPURAÇÃO CONCLUÍDA\n=========================================\n");
      
      const jsonStatus = jsonChanged ? 'Sim' : 'Não';
      await statusMsg.edit(
        msg("syncmsg.concluido", { jsonStatus, filesCount: pendingWrites.length })
      );

    } catch (error) {
      console.error(`[Erro no comando syncmsg]:`, error);
      return message.reply(
        msg("syncmsg.erro_interno", { err: error.message })
      );
    } finally {
      isSyncing = false;
      if (restartRequested) process.exit(0);
    }
  }
};

/*
@register-messages
{
  "syncmsg": {
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "em_curso": "⏳ Sincronização inteligente já está em curso. Por favor, aguarde...",
    "iniciando": "🔄 Iniciando sincronização inteligente com depuração...",
    "concluido": "✨ Sincronia concluída!\nJSON Alterado: **{jsonStatus}**\nFicheiros Alterados: **{filesCount}**\n*Verifica o terminal para veres os logs.*",
    "erro_interno": "❌ Ocorreu um erro crítico ao processar este comando: {err}"
  }
}
@end
*/


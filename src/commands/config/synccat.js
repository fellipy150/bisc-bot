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
const CMD_DATA_FILE = path.join(__dirname, "../../config/command_data.json");

const d = allData["synccat"] || { nome: "synccat", apelidos: [], descricao: "Sincroniza categorias com a estrutura de pastas.", uso: "..synccat", categoria: "config" };

// --- ESTADO GLOBAL E CONTROLE DE SINAL ---
let isSyncing = false;
let restartRequested = false;

// Evita duplicação de listeners se for chamado via router
if (process.listenerCount('SIGUSR2') === 0) {
  process.on('SIGUSR2', () => {
    if (isSyncing) {
      console.log('⚠️ [SyncCat] Reinício do Nodemon suspenso até o fim da sincronização.');
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

// --- COMANDO PRINCIPAL ---

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
    ownerOnly: true // Restrito a donos/admins do bot
  },

  async execute(message, args, client) {
    try {
      // Validação básica de uso
      if (this.data.usage && args.length > 0 && this.data.usage.includes('<')) {
        return message.reply(
          msg("synccat.uso_incorreto", { uso: d.uso })
        );
      }

      if (isSyncing) {
        return message.reply(msg("synccat.em_curso"));
      }

      isSyncing = true;

      // 1. Carrega o banco de dados de comandos atual
      let json;
      try {
        json = JSON.parse(fs.readFileSync(CMD_DATA_FILE, "utf8"));
      } catch (e) {
        throw new Error(`Falha ao ler command_data.json: ${e.message}`);
      }

      let dessincronizados = [];
      const files = getAllFiles(CMDS_DIR);

      // 2. Varre os ficheiros e compara a pasta real com o JSON
      for (const filePath of files) {
        const fileUrl = 'file://' + filePath.replace(/\\/g, '/');
        
        let cmd;
        try {
          // Import dinâmico com timestamp para evitar cache do Node
          cmd = (await import(`${fileUrl}?update=${Date.now()}`)).default;
        } catch (err) {
          console.error(`⚠️ [SyncCat] Falha ao importar ${path.basename(filePath)} para verificação.`);
          continue;
        }

        const name = cmd?.data?.name;
        if (!name || !json[name]) continue;

        // Extrai o nome da pasta imediatamente dentro de 'commands/'
        const relative = path.relative(CMDS_DIR, filePath);
        const parts = relative.split(path.sep);
        const pastaCategoria = parts.length > 1 ? parts[0] : "misc";

        // Verifica os dois possíveis nomes da chave (categoria ou category)
        const categoriaAtual = json[name].categoria || json[name].category;

        if (categoriaAtual !== pastaCategoria) {
          dessincronizados.push({ 
            nome: name, 
            atual: categoriaAtual || "indefinido", 
            correta: pastaCategoria 
          });
        }
      }

      // 3. Resultado: Nada a fazer
      if (dessincronizados.length === 0) {
        return message.reply(msg("synccat.sincronizadas"));
      }

      // 4. Resultado: Dessincronias encontradas, pede confirmação
      const listaFormatada = dessincronizados.map(c => `- \`${c.nome}\`: ${c.atual} -> **${c.correta}**`).join("\n");
      
      await message.channel.send(
        msg("synccat.dessincronias", { lista: listaFormatada })
      );

      const filter = m => m.author.id === message.author.id && m.content.toLowerCase() === 's';
      const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });

      // 5. Aplica a correção se confirmado
      if (collected.size > 0) {
        dessincronizados.forEach(c => {
          // Atualiza a chave que existir no JSON
          if (json[c.nome].hasOwnProperty('categoria')) json[c.nome].categoria = c.correta;
          if (json[c.nome].hasOwnProperty('category')) json[c.nome].category = c.correta;
        });
        
        atomicWrite(CMD_DATA_FILE, JSON.stringify(json, null, 2));
        await message.channel.send(msg("synccat.sucesso"));
      } else {
        await message.channel.send(msg("synccat.cancelado"));
      }

    } catch (error) {
      console.error(`[Erro no comando synccat]:`, error);
      return message.reply(
        msg("synccat.erro_interno")
      );
    } finally {
      // Liberta o lock e processa reinício se necessário
      isSyncing = false;
      if (restartRequested) process.exit(0);
    }
  }
};

/*
@register-messages
{
  "synccat": {
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "em_curso": "⏳ Sincronização de categorias em curso. Aguarde...",
    "sincronizadas": "✅ Todas as categorias estão devidamente sincronizadas com a estrutura de pastas!",
    "dessincronias": "⚠️ **Dessincronias de pasta encontradas:**\n{lista}\n\nConfirmar sincronização? (Responda com `s` em 30s)",
    "sucesso": "✅ Categorias atualizadas atomicamente com sucesso!",
    "cancelado": "❌ Sincronização cancelada por falta de confirmação (ou tempo esgotado).",
    "erro_interno": "❌ Ocorreu um erro ao processar a sincronização de categorias."
  }
}
@end
*/


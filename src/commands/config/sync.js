import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import msg from '../../config/msg-handler.js';
import allData from '../../config/command_data.json' with { type: 'json' };

// Configuração de ambiente ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const d = allData["sync"];

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
        return message.reply( msg("sync.uso_incorreto", { uso: d.uso }) );
      }

      // 2. Rascunho da Lógica:
      // utilitario para fazer sincronias das informações do comando no banco de dados
      // uso: sync (arg)
      // se o argumento for cat, deixe um espaço para a lógica do sync cat
      // se for msg, deixe o espaço para lógica do sync msg

      const subcomando = args[0]?.toLowerCase();      if (subcomando === 'cat') {
        console.log(`Sync cat executado por ${message.author.tag}`);
        await message.reply("🔍 Verificando sincronia de categorias...");

        const base = path.join(__dirname, "../../commands");
        const dataPath = path.join(__dirname, "../../config/command_data.json");
        let json = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        let dessincronizados = [];

        async function verificar(dir) {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              await verificar(fullPath);
            } else if (entry.isFile() && entry.name.endsWith(".js")) {
              const fileUrl = 'file://' + fullPath.replace(/\\/g, '/');
              const cmd = (await import(fileUrl)).default;

              const name = cmd?.data?.name;
              if (!name || !json[name]) continue;

              const relative = path.relative(base, fullPath);
              const parts = relative.split(path.sep);
              const pastaCategoria = parts.length > 1 ? parts[0] : "misc";
              const jsonCategoria = json[name].categoria;

              if (jsonCategoria !== pastaCategoria) {
                dessincronizados.push({
                  nome: name,
                  categoriaAtual: jsonCategoria,
                  categoriaCorreta: pastaCategoria
                });
              }
            }
          }
        }

        try {
          await verificar(base);

          if (dessincronizados.length === 0) {
            return message.channel.send("✅ Todas as categorias estão sincronizadas!");
          }

          let relatorio = "⚠️ **Comandos dessincronizados encontrados:**\n";
          for (const cmd of dessincronizados) {
            relatorio += `- \`${cmd.nome}\`: ${cmd.categoriaAtual} -> **${cmd.categoriaCorreta}**\n`;
          }
          relatorio += "\nDeseja sincronizar essas categorias? (Responda com `s` ou `n` no chat em até 30s)";

          await message.channel.send(relatorio);

          const filter = m => m.author.id === message.author.id && ['s', 'n'].includes(m.content.toLowerCase());
          const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
          const resposta = collected.first().content.toLowerCase();

          if (resposta === 's') {
            for (const cmd of dessincronizados) {
              json[cmd.nome].categoria = cmd.categoriaCorreta;
            }
            fs.writeFileSync(dataPath, JSON.stringify(json, null, 2), "utf8");
            await message.channel.send("✅ Categorias sincronizadas com sucesso!");
          } else {
            await message.channel.send("❌ Operação cancelada.");
          }
        } catch (error) {
          if (error.size !== undefined || error.constructor.name === 'Collection') {
            await message.channel.send("⏳ Tempo esgotado. Operação cancelada.");
          } else {
            console.error("Erro no sync cat:", error);
            await message.channel.send(msg("sync.erro_interno"));
          }
        }

      } else if (subcomando === 'msg') {console.log(`Sync msg executado por ${message.author.tag}`);
        await message.reply("🔄 Iniciando sincronização de mensagens...");

        const cmdsDir = path.join(__dirname, "../../commands");
        const msgFile = path.join(__dirname, "../../config/message_data.json");
        const REGISTER_REGEX = /\/\*\s*@register-messages([\s\S]*?)@end\s*\*\//g;

        function loadJSON(filePath) {
          if (!fs.existsSync(filePath)) return {};
          return JSON.parse(fs.readFileSync(filePath, "utf8"));
        }

        function saveJSON(filePath, data) {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
        }

        function deepMergeSafe(target, source) {
          for (const key in source) {
            if (typeof source[key] === "object" && source[key] !== null && !Array.isArray(source[key])) {
              if (!target[key]) target[key] = {};
              deepMergeSafe(target[key], source[key]);
            } else if (target[key] === undefined) {
              target[key] = source[key];
            }
          }
        }         function processFile(filePath, messageData) {
          const content = fs.readFileSync(filePath, "utf8");
          content.replace(REGISTER_REGEX, (_, jsonBlock) => {
            try {
              const parsed = JSON.parse(jsonBlock.trim());
              deepMergeSafe(messageData, parsed);
            } catch (err) {
              console.error(`❌ JSON inválido em: ${filePath}`);
            }
          });
        } function walk(dir, messageData) {
          if (!fs.existsSync(dir)) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(fullPath, messageData);
            } else if (entry.isFile() && entry.name.endsWith(".js")) {
              processFile(fullPath, messageData);
            }
          }
        }

        try {
          const messageData = loadJSON(msgFile);
          walk(cmdsDir, messageData);
          saveJSON(msgFile, messageData);
          await message.channel.send("✨ Sincronização concluída.");
        } catch (error) {
          console.error("Erro no sync msg:", error);
          await message.channel.send(msg("sync.erro_interno"));
        }

      } else {// Comando sem argumento ou argumento inválido
        return message.reply( msg("sync.uso_incorreto", { uso: d.uso }) );
      }

    } catch (error) {
      console.error(`[Erro no Comando ${d.nome}]:`, error);
      
      return message.reply( msg("sync.erro_interno") );
    }
  }
};

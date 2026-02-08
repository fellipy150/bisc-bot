/**
 * Caminho: loaders/CommandLoader.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url"; // Adicionado pathToFileURL
import { Logger } from '../infra/logger/index.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async (client) => {
  client.commands = new Map();
  const commandsPath = path.join(__dirname, "../commands");

  if (!fs.existsSync(commandsPath)) {
    Logger.warn(`❌ Caminho de comandos não encontrado: ${commandsPath}`);
    return;
  }

  async function loadCommands(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await loadCommands(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        // 1. Usar pathToFileURL garante que o caminho funcione em Windows/Linux sem erros de "/"
        const fileUrl = pathToFileURL(fullPath).href;

        try {
          const module = await import(fileUrl);
          const cmd = module.default || module;

          // 2. Validação detalhada da estrutura
          if (!cmd.data || !cmd.execute) {
            Logger.warn(`⚠️ Comando ignorado em ${entry.name}: Falta propriedade "data" ou "execute".`);
            continue;
          }

          if (!cmd.data.name) {
            Logger.warn(`⚠️ Comando ignorado em ${entry.name}: "data.name" está indefinido.`);
            continue;
          }

          client.commands.set(cmd.data.name, cmd);
          
          if (cmd.data.aliases && Array.isArray(cmd.data.aliases)) {
            cmd.data.aliases.forEach(a => client.commands.set(a, cmd));
          }

          Logger.debug(`✅ Carregado: ${cmd.data.name}`);

        } catch (e) {
          // 3. Debug Profundo: Mostra o arquivo exato e o stack trace completo
          Logger.error(`\n❌ ERRO CRÍTICO NO ARQUIVO: ${entry.name}`);
          Logger.error(`Caminho Completo: ${fullPath}`);
          Logger.error(`Mensagem: ${e.message}`);
          
          // O stack trace dirá a linha exata do erro de sintaxe
          if (e.stack) {
            console.error(e.stack); 
          }
          
          Logger.error(`-------------------------------------------\n`);
        }
      }
    }
  }

  Logger.info("🔄 Iniciando carregamento do sistema de comandos...");
  const start = Date.now();
  
  await loadCommands(commandsPath);
  
  const end = Date.now();
  Logger.info(`✨ ${client.commands.size} comandos carregados em ${end - start}ms.`);
};

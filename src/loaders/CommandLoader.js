/**
 * Caminho: loaders/CommandLoader.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
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

  // Variáveis de contagem declaradas no escopo do loader
  let commandCount = 0;
  let aliasCount = 0;

  async function loadCommands(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await loadCommands(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const fileUrl = pathToFileURL(fullPath).href;

        try {
          const module = await import(fileUrl);
          const cmd = module.default || module;

          // Validação da estrutura do comando
          if (!cmd.data || !cmd.execute) {
            Logger.warn(`⚠️ Comando ignorado em ${entry.name}: Falta propriedade "data" ou "execute".`);
            continue;
          }

          if (!cmd.data.name) {
            Logger.warn(`⚠️ Comando ignorado em ${entry.name}: "data.name" está indefinido.`);
            continue;
          }

          // Registra comando principal e incrementa contador
          client.commands.set(cmd.data.name, cmd);
          commandCount++;
          
          // Registra aliases e incrementa contador (evitando duplicatas no Map)
          if (cmd.data.aliases && Array.isArray(cmd.data.aliases)) {
            cmd.data.aliases.forEach(a => {
              if (!client.commands.has(a)) {
                client.commands.set(a, cmd);
                aliasCount++;
              }
            });
          }

          Logger.debug(`✅ Carregado: ${cmd.data.name}`);

        } catch (e) {
          Logger.error(`\n❌ ERRO CRÍTICO NO ARQUIVO: ${entry.name}`);
          Logger.error(`Caminho Completo: ${fullPath}`);
          Logger.error(`Mensagem: ${e.message}`);
          
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
  
  // Log final com a separação solicitada
  Logger.info(
    `✨ ${commandCount} comandos carregados e ${aliasCount} aliases carregados em ${end - start}ms.`
  );
};

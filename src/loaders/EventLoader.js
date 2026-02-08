/**
 * Caminho: loaders/EventLoader.js
 * Descrição: Gerencia o registro dinâmico de eventos do Discord.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Logger } from "../infra/logger/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async (client) => {
  const eventsPath = path.join(__dirname, "../events");
  
  if (!fs.existsSync(eventsPath)) {
    Logger.warn("⚠️ Pasta 'events' ausente.");
    return;
  }

  Logger.info("🔄 Registrando eventos do sistema...");

  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"));
  let count = 0;

  for (const file of eventFiles) {
    try {
      const filePath = path.join(eventsPath, file);
      const fileUrl = `file://${filePath}`;
      const module = await import(fileUrl);
      const event = module.default || module;

      if (event.name && event.execute) {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }
        Logger.debug(`Evento vinculado: ${event.name}`);
        count++;
      }
    } catch (error) {
      Logger.error(`Erro no evento ${file}:`, error);
    }
  }
  Logger.info(`✅ Eventos vinculados: ${count}`);
};


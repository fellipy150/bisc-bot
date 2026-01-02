import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async (client) => {
  const eventsPath = path.join(__dirname, "eventos");
  
  // Verifica se a pasta existe para evitar erro de readdirSync
  if (!fs.existsSync(eventsPath)) {
    console.warn("⚠️ Pasta 'eventos' não encontrada.");
    return;
  }

  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((f) => f.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    
    // Importação dinâmica para ESM
    const fileUrl = `file://${filePath}`;
    const module = await import(fileUrl);
    const event = module.default || module;

    if (event.name && event.execute) {
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
      console.log(`✅ Evento carregado: ${event.name}`);
    }
  }
};

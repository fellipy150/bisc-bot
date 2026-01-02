import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Em ESM, precisamos simular o __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async (client) => {
  client.commands = new Map();

  // Caminho para a pasta 'comandos' (ajustado conforme sua tree)
  const commandsPath = path.join(__dirname, "comandos");

  async function loadCommands(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await loadCommands(fullPath); // recursividade assíncrona
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        
        // Importante: No Windows/Termux, o caminho para import() precisa ser uma URL válida ou path absoluto com file://
        const fileUrl = `file://${fullPath}`;
        const module = await import(fileUrl);
        
        // No ESM, o que era o objeto do require vira o module.default ou exports nomeados
        const cmd = module.default || module;

        if (cmd.data && cmd.execute) {
          const relative = path.relative(commandsPath, fullPath);
          const parts = relative.split(path.sep);

          const category = parts.length > 1 ? parts[0] : "misc"; 
          cmd.data.category = category;

          client.commands.set(cmd.data.name, cmd);

          if (Array.isArray(cmd.data.aliases)) {
            for (const alias of cmd.data.aliases) {
              client.commands.set(alias, cmd);
            }
          }
          console.log(`✅ Carregado [${category}]: ${cmd.data.name}`);
        }
      }
    }
  }

  await loadCommands(commandsPath);
};

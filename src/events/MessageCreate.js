import { getPrefixes } from '../config/config.js';
import { addXp } from '../infra/database/services/userService.js';
import { findBestMatches } from '../util/wrong-sort/index.js'; // Ajustado o caminho para 'util' (sem s) conforme seu import
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Certifique-resolve se o caminho abaixo volta as pastas corretas para achar o config
const COMMAND_DATA_PATH = path.resolve(__dirname, '../config/command_data.json'); 

export default {
  name: "messageCreate",
  once: false,
  async execute(message, client) {
    try {
      if (message.author.bot || !message.guild) return;

      // --- SISTEMA DE XP ---
      try {
        const xpGain = Math.floor(Math.random() * 11) + 15;
        const result = await addXp(message.author.id, message.guild.id, xpGain);
        if (result?.leveledUp) {
          await message.reply(`🎉 Parabéns ${message.author}! Você subiu para o **Nível ${result.user.level}**!`).catch(() => {});
        }
      } catch (error) { console.error(`[XP-SYSTEM] Erro:`, error); }

      // --- TRATAMENTO DE PREFIXO ---
      const prefixes = getPrefixes();
      const used = prefixes.find(p => message.content.startsWith(p));
      if (!used) return;

      const args = message.content.slice(used.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;

      let command = client.commands.get(commandName);

      // --- LÓGICA DE COMANDO DESCONHECIDO ---
      if (!command) {
        try {
          if (!fs.existsSync(COMMAND_DATA_PATH)) throw new Error("Arquivo command_data.json não encontrado!");
          
          const commandData = JSON.parse(fs.readFileSync(COMMAND_DATA_PATH, 'utf-8'));
          const suggestions = findBestMatches(commandName, commandData, 4);

          if (suggestions.length > 0) {
            const list = suggestions.map(s => `\`${used}${s}\``).join(', ');
            return await message.reply(`❌ Comando desconhecido. Você quis dizer: ${list}?`);
          } else {
            return await message.reply(`❌ Comando não encontrado! Use \`${used}help\`.`);
          }
        } catch (err) {
          console.error(`[SUGGESTION-ERROR]`, err);
          return await message.reply(`❌ Comando desconhecido!`);
        }
      }

      // --- EXECUÇÃO ---
      try {
        await command.execute(message, args);
      } catch (error) {
        console.error(`[EXECUTION-ERROR]`, error);
        await message.reply("❌ Algo deu errado ao executar este comando.");
      }
    } catch (globalError) { console.error(`[CRITICAL]`, globalError); }
  },
};

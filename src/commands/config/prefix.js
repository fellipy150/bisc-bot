import allData from '../../config/command_data.json' with { type: 'json' };
const d = allData["prefix"];
import { addPrefix, removePrefix, getPrefixes } from '../../config/config.js';

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria
  },
  async execute(message, args) {
    const sub = args[0];
    if (!sub) return message.reply(`Uso: ${this.data.usage}`);

    switch (sub.toLowerCase()) {
      case "add": {
        const p = args[1];
        if (!p) return message.reply(`Use: ${this.data.usage}`);
        if (addPrefix(p))
          return message.reply(`✅ Prefixo ‘${p}’ adicionado.\nAtuais: ${getPrefixes().join(", ")}`);
        else
          return message.reply(`⚠️ Prefixo ‘${p}’ já existe.`);
      }

      case "remove": {
        const p = args[1];
        if (!p) return message.reply(`Use: ${this.data.usage}`);
        if (removePrefix(p))
          return message.reply(`✅ Prefixo ‘${p}’ removido.\nAtuais: ${getPrefixes().join(", ")}`);
        else
          return message.reply(`⚠️ Prefixo ‘${p}’ não encontrado.`);
      }

      case "list":
        return message.reply(`📋 Prefixos atuais: ${getPrefixes().join(", ")}`);

      default:
        return message.reply("Subcomando inválido. Use: add, remove ou list.");
    }
  }
};
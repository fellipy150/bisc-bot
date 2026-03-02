import msg from "../../config/msg-handler.js";
import allData from "../../config/command_data.json" with { type: "json" };
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import path from "path";
import { getOwners } from "../../config/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const jsonPath = path.join(__dirname, "../../config/command_data.json");
const commandsDir = path.join(__dirname, "../../commands");
// Caminho para o novo arquivo de template
const templatePath = path.join(__dirname, "cmd-template.txt");

const d = allData["mkcmd"];

export default {
  data: {
    name: d?.nome || "mkcmd",
    aliases: d?.apelidos || ["criarcf"],
    description: d?.descricao || "Cria comandos dinamicamente",
    usage: d?.uso || "..mkcmd",
    category: d?.categoria || "config",
    ownerOnly: true
  },

  async execute(message, args, client) {
    if (!getOwners().includes(message.author.id)) {
      return message.reply(msg("mkcmd.permissao_negada"));
    }

    const channel = message.channel;
    const filter = m => m.author.id === message.author.id;

    try {
      // 1. Coleta de dados (Nome, Desc, Cat, Draft) - Mantemos sua lógica atual
      await channel.send(msg("mkcmd.solicitar_nome"));
      const collectedName = await channel.awaitMessages({ filter, max: 1, time: 180000, errors: ["time"] });
      const name = collectedName.first().content.trim().toLowerCase();
      
      await channel.send(msg("mkcmd.solicitar_descricao"));
      const collectedDesc = await channel.awaitMessages({ filter, max: 1, time: 180000, errors: ["time"] });
      const descricao = collectedDesc.first().content.trim();

      const folders = fs.readdirSync(commandsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
      await channel.send(msg("mkcmd.solicitar_categoria", { options: [...folders, "none"].join(", ") }));
      const collectedCat = await channel.awaitMessages({ filter, max: 1, time: 180000, errors: ["time"] });
      const categoria = collectedCat.first().content.trim();

      await channel.send(msg("mkcmd.solicitar_rascunho"));
      const collectedDraft = await channel.awaitMessages({ filter, max: 1, time: 180000, errors: ["time"] });
      const draftRaw = collectedDraft.first().content.trim();

      // 2. Processamento do Template
      if (!fs.existsSync(templatePath)) throw new Error("Arquivo cmd-template.txt não encontrado.");
      let template = fs.readFileSync(templatePath, "utf8");

      const configDepth = (categoria === "none" || categoria === "misc") ? ".." : "../..";
      const draftFormatted = draftRaw 
        ? draftRaw.split("\n").map(line => `      // ${line}`).join("\n") 
        : "      // Nenhuma lógica inicial fornecida.";

      // Substituição atômica dos placeholders
      template = template
        .replace(/\{\{NAME\}\}/g, name)
        .replace(/\{\{CONFIG_DEPTH\}\}/g, configDepth)
        .replace(/\{\{DRAFT\}\}/g, draftFormatted);

      // 3. Salvando arquivos e Banco de Dados
      const all = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      if (all[name]) return channel.send(msg("mkcmd.comando_existente"));

      all[name] = { nome: name, apelidos: [], descricao, uso: `..${name}`, categoria: categoria === "none" ? "misc" : categoria };
      fs.writeFileSync(jsonPath, JSON.stringify(all, null, 2), "utf8");

      const finalDir = categoria === "none" ? commandsDir : path.join(commandsDir, categoria);
      if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });
      
      fs.writeFileSync(path.join(finalDir, `${name}.js`), template, "utf8");
      channel.send(msg("mkcmd.sucesso_criacao", { name }));

    } catch (err) {
      console.error(err);
      message.channel.send(msg("mkcmd.falha_criacao", { err: err.message }));
    }
  }
};

/*
@register-messages
{
  "mkcmd": {
    "permissao_negada": "❌ Você não tem permissão para usar este comando.",
    "solicitar_nome": "Qual será o nome do comando?",
    "solicitar_descricao": "📝 Descreva o que o comando faz:",
    "solicitar_categoria": "📂 Selecione a categoria: [{options}]",
    "solicitar_rascunho": "✍️ Rascunho da lógica (será inserido como comentário):",
    "comando_existente": "⚠️ Já existe um comando com esse nome no JSON.",
    "sucesso_criacao": "✅ Comando `{name}` criado com sucesso!",
    "falha_criacao": "❌ Erro: {err}",
    "_observacao": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente."
  }
}
@end
*/

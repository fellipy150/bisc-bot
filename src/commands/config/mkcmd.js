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

const d = allData["mkcmd"];

export default {
  data: {
    name: d?.nome || "mkcmd",
    aliases: d?.apelidos || ["criarcf"],
    description: d?.descricao || "Cria um novo comando dinamicamente com template compatível com sistema de mensagens",
    usage: d?.uso || "..mkcmd",
    category: d?.categoria || "config",
    ownerOnly: true
  },

  async execute(message, args, client) {
    if (!getOwners().includes(message.author.id)) {
      return message.reply(msg("mkcmd.no_permission"));
    }

    const channel = message.channel;
    const filter = m => m.author.id === message.author.id;

    try {
      // 1️⃣ Nome
      await channel.send(msg("mkcmd.ask_name"));
      const collectedName = await channel.awaitMessages({
        filter,
        max: 1,
        time: 180000,
        errors: ["time"]
      });

      const name = collectedName.first().content.trim().toLowerCase();
      if (!name) throw new Error("Nome inválido.");

      // 2️⃣ Descrição
      await channel.send(msg("mkcmd.ask_desc"));
      const collectedDesc = await channel.awaitMessages({
        filter,
        max: 1,
        time: 180000,
        errors: ["time"]
      });

      const descricao = collectedDesc.first().content.trim();

      // 3️⃣ Categoria
      const folders = fs
        .readdirSync(commandsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      const folderOptions = [...folders, "none"];

      await channel.send(msg("mkcmd.ask_category", { options: folderOptions.join(", ") }));
      const collectedCat = await channel.awaitMessages({
        filter,
        max: 1,
        time: 180000,
        errors: ["time"]
      });

      const categoria = collectedCat.first().content.trim();

      if (!folderOptions.includes(categoria)) {
        throw new Error("Categoria inválida.");
      }

      // 4️⃣ Rascunho
      await channel.send(msg("mkcmd.ask_draft"));
      const collectedDraft = await channel.awaitMessages({
        filter,
        max: 1,
        time: 180000,
        errors: ["time"]
      });

      const draft = collectedDraft.first().content.trim();

      // 🔄 Atualizar command_data.json
      const all = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

      if (all[name]) {
        return channel.send(msg("mkcmd.already_exists"));
      }

      all[name] = {
        nome: name,
        apelidos: [],
        descricao,
        uso: `..${name}`,
        categoria: categoria === "none" ? "misc" : categoria
      };

      fs.writeFileSync(jsonPath, JSON.stringify(all, null, 2), "utf8");

      // 📁 Criar diretório final
      const finalDir =
        categoria === "none" ? commandsDir : path.join(commandsDir, categoria);

      if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
      }

      const configDepth = categoria === "none" ? ".." : "../..";
      const cmdFile = path.join(finalDir, `${name}.js`);

      // 🧠 TEMPLATE FINAL
      const template = 
`import msg from '${configDepth}/config/msg-handler.js';
import allData from '${configDepth}/config/command_data.json' with { type: 'json' };

const d = allData["${name}"];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria,
    ownerOnly: false
  },

  async execute(message, args, client) {
    try {

      // Validação básica de uso
      if (this.data.usage && args.length === 0 && this.data.usage.includes('<')) {
        return message.reply(
          msg("${name}.uso_incorreto", { uso: d.uso })
        );
      }

      // 🔹 Rascunho inicial
${draft
  ? draft.split("\n").map(line => `      // ${line}`).join("\n")
  : "      // Nenhuma lógica inicial fornecida."}

      // TODO: Implementar lógica principal

      await message.reply(
        msg("${name}.resposta_exemplo")
      );

    } catch (error) {
      console.error(\`[Erro no comando ${name}]:\`, error);

      return message.reply(
        msg("${name}.erro_interno")
      );
    }
  }
};

/*
@register-messages
O JSON abaixo pode conter QUALQUER estrutura válida.
Você pode adicionar objetos aninhados, múltiplas chaves,
ou qualquer outro conteúdo necessário para o comando.
O utilitário de sincronização fará merge profundo automaticamente.

{
  "${name}": {
    "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
    "resposta_exemplo": "Mensagem inicial do comando ${name}.",
    "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
    "inserirnomedamsg": "Pode colocar qualquer valor "
  }
}
@end
*/
`;

      fs.writeFileSync(cmdFile, template, "utf8");

      channel.send(msg("mkcmd.success", { name }));

    } catch (err) {
      console.error(err);
      message.channel.send(msg("mkcmd.error", { err: err.message || "Tempo esgotado." }));
    }
  }
};

/*
@register-messages
O JSON abaixo pode conter QUALQUER estrutura válida.
Você pode adicionar objetos aninhados, múltiplas chaves,
ou qualquer outro conteúdo necessário para o comando.
O utilitário de sincronização fará merge profundo automaticamente.

{
  "mkcmd": {
    "no_permission": "❌ Você não tem permissão para usar este comando.",
    "ask_name": "Qual será o nome do comando?",
    "ask_desc": "📝 Descreva o que o comando faz:",
    "ask_category": "📂 Selecione a categoria: [{options}]",
    "ask_draft": "✍️ Rascunho da lógica (será inserido como comentário):",
    "already_exists": "⚠️ Já existe um comando com esse nome no JSON.",
    "success": "✅ Comando `{name}` criado com sucesso!",
    "error": "❌ Erro: {err}"
  }
}
@end
*/
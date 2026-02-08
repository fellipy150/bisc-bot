import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import { getOwners } from '../../config/config.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const jsonPath = path.join(__dirname, "../../config/command_data.json");
const commandsDir = path.join(__dirname, "../../commands");

export default {
  data: {
    name: "mkcmd",
    aliases: ["criarcf"],
    description: "Cria um novo comando dinamicamente com template avançado",
    usage: "..mkcmd",
    category: "config"
  },
  async execute(message) {
    if (!getOwners().includes(message.author.id)) {
      return message.reply("❌ Você não tem permissão para usar este comando.");
    }

    const channel = message.channel;
    const filter = m => m.author.id === message.author.id;

    try {
      // 1. Perguntar Nome
      await channel.send("Qual será o nome do comando?");
      const collectedName = await channel.awaitMessages({ filter, max: 1, time: 180000, errors: ["time"] });
      const name = collectedName.first().content.trim().toLowerCase();
      if (!name) throw new Error("Nome inválido.");

      // 2. Perguntar Descrição
      await channel.send("📝 Descreva o que o comando faz:");
      const collectedDesc = await channel.awaitMessages({ filter, max: 1, time: 180000, errors: ["time"] });
      const descricao = collectedDesc.first().content.trim();

      // 3. Perguntar Categoria
      const folders = fs.readdirSync(commandsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      const folderOptions = [...folders, "none"];

      await channel.send(`📂 Selecione a categoria: [${folderOptions.join(", ")}]`);
      const collectedCat = await channel.awaitMessages({ filter, max: 1, time: 180000, errors: ["time"] });
      const categoria = collectedCat.first().content.trim();
      
      if (!folderOptions.includes(categoria)) {
        throw new Error(`Categoria inválida.`);
      }

      // 4. Perguntar Rascunho
      await channel.send("✍️ Rascunho da lógica (será inserido como comentário):");
      const collectedDraft = await channel.awaitMessages({ filter, max: 1, time: 180000, errors: ["time"] });
      const draft = collectedDraft.first().content.trim();

      // Atualização do JSON
      const all = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      if (all[name]) {
        return channel.send("⚠️ Já existe um comando com esse nome no JSON.");
      }

      all[name] = {
        nome: name,
        apelidos: [],
        descricao,
        uso: `..${name}`,
        categoria: categoria === "none" ? "misc" : categoria
      };
      fs.writeFileSync(jsonPath, JSON.stringify(all, null, 2), "utf8");

      const finalDir = categoria === "none" ? commandsDir : path.join(commandsDir, categoria);
      if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });

      const configDepth = categoria === "none" ? ".." : "../..";
      const cmdFile = path.join(finalDir, `${name}.js`);
      
      // --- NOVO TEMPLATE CONCILIADO ---
      const template =
`import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import allData from '${configDepth}/config/command_data.json' with { type: 'json' };

// Configuração de ambiente ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const d = allData["${name}"];

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
        return message.reply(\`⚠️ Uso incorreto! Tente: \\\`\${d.uso}\\\` \`);
      }

      // 2. Rascunho da Lógica:
      ${draft ? draft.split("\n").map(line => `// ${line}`).join("\n      ") : "// Nenhuma lógica inicial fornecida."}

      // TODO: Implementar lógica de ${name}
      console.log(\`Comando \${d.nome} executado por \${message.author.tag}\`);

    } catch (error) {
      console.error(\`[Erro no Comando \${d.nome}]:\`, error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Erro Interno')
        .setDescription('Ocorreu um erro ao processar este comando. Tente novamente mais tarde.');
      
      return message.reply({ embeds: [errorEmbed] });
    }
  }
};`;

      fs.writeFileSync(cmdFile, template, "utf8");
      channel.send(`✅ Comando \`${name}\` criado com sucesso!`);

    } catch (err) {
      console.error(err);
      message.channel.send("❌ Erro: " + (err.message || "Tempo esgotado."));
    }
  }
};

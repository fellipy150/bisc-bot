import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const miscDir = path.resolve(__dirname);
const projectRoot = path.resolve(miscDir, "..");
const dataPath = path.join(projectRoot, "src/config/command_data.json");
const commandsDir = path.join(projectRoot, "src/comandos");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) {
  return new Promise(res => rl.question(q, ans => res(ans.trim())));
}

(async () => {
  try {
    const name = await ask("📛 Nome do comando: ");
    if (!name) throw new Error("Nome é obrigatório");

    const descricao = await ask("📝 Descrição: ");
    if (!descricao) throw new Error("Descrição é obrigatória");

    // Listar pastas em src/comandos
    const folders = fs.readdirSync(commandsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    const folderOptions = [...folders, "none"];
    console.log(`\n📂 Selecione a categoria: [${folderOptions.join(", ")}]`);

    const categoria = await ask("> ");
    if (!folderOptions.includes(categoria)) {
      throw new Error(`Categoria inválida. Escolha uma dessas: [${folderOptions.join(", ")}]`);
    }

    const sugestao = await ask("🧠 Como deve funcionar a lógica por trás desse comando? (opcional): ");

    rl.close();

    const all = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    if (all[name]) {
      console.error(`❌ Comando '${name}' já existe.`);
      process.exit(1);
    }

    all[name] = {
      nome: name,
      apelidos: [],
      descricao,
      uso: `..${name}`,
      categoria: categoria === "none" ? "misc" : categoria
    };
    fs.writeFileSync(dataPath, JSON.stringify(all, null, 2), "utf8");
    console.log(`✅ Metadados de '${name}' adicionados.`);

    const finalDir = categoria === "none" ? commandsDir : path.join(commandsDir, categoria);
    const filePath = path.join(finalDir, `${name}.js`);

    // Cria a pasta se não existir (evita erro)
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }







const configPath = categoria === "none" ? '../config' : '../../config';

const template = 
`import allData from '${configPath}/command_data.json' with { type: 'json' };
const d = allData["${name}"];

export default {
  data: {
    name: d.nome,
    aliases: d.apelidos,
    description: d.descricao,
    usage: d.uso,
    category: d.categoria
  },
  async execute(message, args, client) {
    // aqui deve ficar a lógica de ${name}.js:
    ${sugestao ? `// ${sugestao}` : ""}
    console.log("Comando ${name} executado.");
  }
};`;





    fs.writeFileSync(filePath, template, "utf8");
    console.log(`✅ Arquivo criado em ${filePath}`);
  } catch (err) {
    rl.close();
    console.error("Erro:", err.message);
    process.exit(1);
  }
})();
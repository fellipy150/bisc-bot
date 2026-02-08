import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// caminhos
const base = path.join(__dirname, "../src/comandos");
const dataPath = path.join(__dirname, "../src/config/command_data.json");

// carregar o JSON atual
let json = JSON.parse(fs.readFileSync(dataPath, "utf8"));

let dessincronizados = [];

// função recursiva para percorrer pastas e arquivos
function verificar(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      verificar(fullPath); // recursivo
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      const cmd = require(fullPath);

      const name = cmd.data && cmd.data.name;
      if (!name) {
        console.warn(`⚠️ Arquivo sem data.name: ${fullPath}`);
        continue;
      }

      if (!json[name]) {
        console.warn(`⚠️ Comando ${name} não encontrado no JSON.`);
        continue;
      }

      // pega a categoria baseada na pasta
      const relative = path.relative(base, fullPath);
      const parts = relative.split(path.sep);
      const pastaCategoria = parts.length > 1 ? parts[0] : "misc";

      const jsonCategoria = json[name].categoria;

      if (jsonCategoria !== pastaCategoria) {
        dessincronizados.push({
          nome: name,
          categoriaAtual: jsonCategoria,
          categoriaCorreta: pastaCategoria
        });
      }
    }
  }
}

// executar a verificação
verificar(base);

// mostrar o resultado
if (dessincronizados.length === 0) {
  console.log("✅ Todas as categorias estão sincronizadas!");
  process.exit(0);
}

console.log("⚠️ Comandos dessincronizados encontrados:\n");
for (const cmd of dessincronizados) {
  console.log(`- ${cmd.nome}: ${cmd.categoriaAtual} -> ${cmd.categoriaCorreta}`);
}

// perguntar se deseja sincronizar
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("\nDeseja sincronizar essas categorias? (s/n): ", (resposta) => {
  if (resposta.toLowerCase() === "s") {
    for (const cmd of dessincronizados) {
      json[cmd.nome].categoria = cmd.categoriaCorreta;
    }

    fs.writeFileSync(dataPath, JSON.stringify(json, null, 2), "utf8");
    console.log("\n✅ Categorias sincronizadas com sucesso!");
  } else {
    console.log("\n❌ Operação cancelada.");
  }

  rl.close();
});
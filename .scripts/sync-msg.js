import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Resolver caminho ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commandsDir = path.join(__dirname, "../src/commands");
const messageFile = path.join(__dirname, "../src/config/message_data.json");

// Regex para detectar bloco especial
const REGISTER_REGEX = /\/\*\s*@register-messages([\s\S]*?)@end\s*\*\//g;

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function deepMergeSafe(target, source, basePath = "") {
  for (const key in source) {
    const currentPath = basePath ? `${basePath}.${key}` : key;

    if (
      typeof source[key] === "object" &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      if (!target[key]) {
        target[key] = {};
      }
      deepMergeSafe(target[key], source[key], currentPath);
    } else {
      if (target[key] !== undefined) {
        console.warn(`⚠️ Chave já existe, ignorando: ${currentPath}`);
      } else {
        target[key] = source[key];
        console.log(`✅ Registrado: ${currentPath}`);
      }
    }
  }
}

function processFile(filePath, messageData) {
  let content = fs.readFileSync(filePath, "utf8");

  let modified = false;

  content = content.replace(REGISTER_REGEX, (match, jsonBlock) => {
    try {
      const parsed = JSON.parse(jsonBlock.trim());
      deepMergeSafe(messageData, parsed);
      modified = true;
      return ""; // remove bloco do arquivo
    } catch (err) {
      console.error(`❌ JSON inválido em: ${filePath}`);
      console.error(err.message);
      return match; // mantém bloco se erro
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content.trimEnd() + "\n", "utf8");
    console.log(`🧹 Bloco removido de: ${filePath}`);
  }
}

function walk(dir, messageData) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, messageData);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      processFile(fullPath, messageData);
    }
  }
}

// Execução principal
console.log("🔄 Iniciando sincronização de mensagens...");

const messageData = loadJSON(messageFile);

walk(commandsDir, messageData);

saveJSON(messageFile, messageData);

console.log("✨ Sincronização concluída.");

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Resolver caminho absoluto (ESM safe)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.join(__dirname, "message_data.json");
const cmdsDir = path.join(__dirname, "../commands");
const REGISTER_REGEX = /\/\*\s*@register-messages([\s\S]*?)@end\s*\*\//g;

// Cache em memória
let messagesCache = null;
const syncAttempted = new Set();

/**
 * Carrega JSON apenas uma vez.
 */
function loadMessages() {
  if (!messagesCache) {
    try {
      const raw = fs.readFileSync(jsonPath, "utf8");
      messagesCache = JSON.parse(raw);
    } catch (err) {
      console.error("❌ Erro ao carregar message_data.json:", err);
      messagesCache = {};
    }
  }
  return messagesCache;
}

/**
 * Resolve caminho tipo "saldo.resposta_exemplo"
 */
function resolvePath(obj, pathString) {
  return pathString.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return acc[key];
    }
    return undefined;
  }, obj);
}

/**
 * Processa variáveis em Strings ou Objetos (Embeds) recursivamente
 */
function processContent(content, variables) {
  if (typeof content === "string") {
    return content.replace(/\{(.*?)\}/g, (match, key) => {
      const val = variables[key];
      if (val !== undefined) return val;
      
      // Log de aviso apenas em desenvolvimento
      if (process.env.NODE_ENV !== 'production') {
          console.warn(`⚠️ Placeholder {${key}} não fornecido no objeto de variáveis.`);
      }
      return match;
    });
  }

  if (typeof content === "object" && content !== null && !Array.isArray(content)) {
    const newObj = {};
    for (const key in content) {
      newObj[key] = processContent(content[key], variables);
    }
    return newObj;
  }

  return content;
}

function deepMergeSafe(target, source) {
  for (const key in source) {
    if (typeof source[key] === "object" && source[key] !== null && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMergeSafe(target[key], source[key]);
    } else if (target[key] === undefined) {
      target[key] = source[key];
    }
  }
}

function autoSyncMessages() {
  if (!fs.existsSync(cmdsDir)) return;
  
  const messageData = loadMessages();
  let updated = false;

  function processFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    content.replace(REGISTER_REGEX, (_, jsonBlock) => {
      try {
        const parsed = JSON.parse(jsonBlock.trim());
        deepMergeSafe(messageData, parsed);
        updated = true;
      } catch (err) {
        console.error(`❌ JSON inválido detectado pelo auto-sync em: ${filePath}`);
      }
    });
  }

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        processFile(fullPath);
      }
    }
  }

  walk(cmdsDir);

  if (updated) {
    fs.writeFileSync(jsonPath, JSON.stringify(messageData, null, 2), "utf8");
    messagesCache = messageData;
  }
}

/**
 * Função principal
 * @param {string} path - ex: "saldo.resposta_exemplo"
 * @param {object} variables - ex: { valor: 100 }
 */
export default function msg(path, variables = {}) {
  const messages = loadMessages();

  let value = resolvePath(messages, path);

  if (!value) {
    if (!syncAttempted.has(path)) {
      console.log(`🔄 Mensagem '${path}' não encontrada. Iniciando auto-sync...`);
      autoSyncMessages();
      syncAttempted.add(path); 
      
      value = resolvePath(messagesCache, path);
    }

    if (!value) {
      console.warn(`❌ Mensagem definitivamente não encontrada: ${path}`);
      return `__missing_message__: ${path}`;
    }
  }

  if (value === null || value === undefined) {
    console.warn(`⚠️ Valor inválido para: ${path}`);
    return `__invalid_message__: ${path}`;
  }

  return processContent(value, variables);
}

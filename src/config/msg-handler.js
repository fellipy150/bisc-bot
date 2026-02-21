import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Resolver caminho absoluto (ESM safe)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, "message_data.json");

// Cache em memória
let messagesCache = null;

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
 * Aplica placeholders {variavel}
 */
function applyVariables(template, variables) {
  return template.replace(/\{(.*?)\}/g, (_, key) => {
    return variables[key] !== undefined
      ? variables[key]
      : `{${key}}`; // mantém placeholder se não enviado
  });
}

/**
 * Função principal
 * @param {string} path - ex: "saldo.resposta_exemplo"
 * @param {object} variables - ex: { valor: 100 }
 */
export default function msg(path, variables = {}) {
  const messages = loadMessages();

  const value = resolvePath(messages, path);

  if (!value) {
    console.warn(`⚠️ Mensagem não encontrada: ${path}`);
    return `__missing_message__: ${path}`;
  }

  if (typeof value !== "string") {
    console.warn(`⚠️ Valor inválido para: ${path}`);
    return `__invalid_message__: ${path}`;
  }

  return applyVariables(value, variables);
}

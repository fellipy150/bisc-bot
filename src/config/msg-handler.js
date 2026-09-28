import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.join(__dirname, "message_data.json");
let messagesCache = null;
function loadMessages() {
  if (!messagesCache) {
    try {
      if (!fs.existsSync(jsonPath)) {
        fs.writeFileSync(jsonPath, "{}", "utf8");
      }
      const raw = fs.readFileSync(jsonPath, "utf8");
      messagesCache = JSON.parse(raw);
    } catch (err) {
      console.error("❌ Erro ao carregar message_data.json:", err);
      messagesCache = {};
    }
  }
  return messagesCache;
}
function resolvePath(obj, pathString) {
  return pathString.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) return acc[key];
    return undefined;
  }, obj);
}
function processContent(content, variables) {
  if (typeof content === "string") {
    return content.replace(/\{(.*?)\}/g, (match, key) => {
      const val = variables[key];
      return val !== undefined ? val : match;
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
export default function msg(path, variables = {}) {
  const messages = loadMessages();
  let value = resolvePath(messages, path);
  if (value === undefined) {
    return `__missing__: ${path}`;
  }
  return processContent(value, variables);
}

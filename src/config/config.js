import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

/*========= Configuração de Caminhos (ESM) ========== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const filePath = path.join(__dirname, "config.json");

/*========= Funções Internas (Privadas) ========== */
function _load() {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function _save(cfg) {
  fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), "utf8");
}

/*========= Funções Exportadas (Públicas) ========== */

// Note o 'export' antes de function
export function getPrefixes() {
  return _load().prefixes;
}

export function addPrefix(newPrefix) {
  const cfg = _load();
  if (!cfg.prefixes.includes(newPrefix)) {
    cfg.prefixes.push(newPrefix);
    _save(cfg);
    return true;
  }
  return false;
}

export function removePrefix(prefix) {
  const cfg = _load();
  const idx = cfg.prefixes.indexOf(prefix);
  if (idx !== -1) {
    cfg.prefixes.splice(idx, 1);
    _save(cfg);
    return true;
  }
  return false;
}

export function getOwners() {
  return _load().owners;
}

// Opcional: Manter o export default para compatibilidade com códigos antigos
export default { getPrefixes, addPrefix, removePrefix, getOwners };

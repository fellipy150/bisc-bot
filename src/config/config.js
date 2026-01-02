// src/config/config.js
/*========= sistema de prefixos ========== */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "config.json");

function _load() {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function _save(cfg) {
  fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), "utf8");
}

function getPrefixes() {
  return _load().prefixes;
}

function addPrefix(newPrefix) {
  const cfg = _load();
  if (!cfg.prefixes.includes(newPrefix)) {
    cfg.prefixes.push(newPrefix);
    _save(cfg);
    return true;
  }
  return false;
}

function removePrefix(prefix) {
  const cfg = _load();
  const idx = cfg.prefixes.indexOf(prefix);
  if (idx !== -1) {
    cfg.prefixes.splice(idx, 1);
    _save(cfg);
    return true;
  }
  return false;
}

function getOwners() {
  return _load().owners;
}

module.exports = { getPrefixes, addPrefix, removePrefix, getOwners };
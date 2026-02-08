import fs from "fs/promises";
import path from "path";
import os from "os";

// ================= CONFIGURAÇÃO =================
const args = process.argv.slice(2);
// Tenta pegar o diretório atual ou o argumento, ou fallback para bisc-bot
const CURRENT_DIR = process.cwd();
const PROJECT_ROOT = args[0] ? path.resolve(args[0]) : CURRENT_DIR;

const IGNORE_DIRS = new Set(["node_modules", ".git", ".vscode", "dist", "build", "coverage"]);

// Regex para capturar Exports (ESM e CommonJS simples)
const REGEX_EXPORT_CONST = /export\s+(?:const|var|let|function|class)\s+([a-zA-Z0-9_$]+)/g;
const REGEX_EXPORT_DEFAULT = /export\s+default\s+(?:class|function)?\s*([a-zA-Z0-9_$]+)/g;
const REGEX_EXPORT_NAMED = /export\s*\{([^}]+)\}/g; // export { A, B }
const REGEX_MODULE_EXPORTS = /module\.exports\s*=\s*\{?([^}]+)\}?/g; // module.exports = { A }

// Regex para capturar Imports
// Captura: import A from 'B', import { A } from 'B', import A, { B } from 'C', require('D')
const REGEX_IMPORT_FULL = /(?:import\s+([\s\S]*?)\s+from\s+|require\(\s*)["']([^"']+)["']/g;

// Mapa global: Chave = Nome do Símbolo (ex: "ConnectDB"), Valor = Array de caminhos de arquivos que exportam isso
const GLOBAL_EXPORTS = new Map();

// Estatísticas
const stats = {
  fixed: 0,
  conflicts: [],
  notFound: [],
  scanned: 0
};

/**
 * Verifica se o caminho é seguro e não é ignorado
 */
function isIgnored(fullPath) {
  const parts = fullPath.split(path.sep);
  return parts.some(p => IGNORE_DIRS.has(p));
}

/**
 * Caminha recursivamente pelo projeto
 */
async function walk(dir) {
  let files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink() || isIgnored(fullPath)) continue;

      if (entry.isDirectory()) {
        files = files.concat(await walk(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Ignora erros de permissão
  }
  return files;
}

/**
 * Analisa um arquivo e registra o que ele exporta
 */
async function indexFileExports(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    
    // 1. Export nomeado direto (export const X ...)
    let match;
    while ((match = REGEX_EXPORT_CONST.exec(content)) !== null) {
      addToIndex(match[1], filePath);
    }

    // 2. Export default (export default X ...)
    while ((match = REGEX_EXPORT_DEFAULT.exec(content)) !== null) {
      // Registra como o nome da variável e também como "default" (opcional, mas arriscado, focamos no nome)
      addToIndex(match[1], filePath);
    }

    // 3. Export list (export { A, B })
    while ((match = REGEX_EXPORT_NAMED.exec(content)) !== null) {
      const inside = match[1];
      const parts = inside.split(",").map(s => s.trim());
      parts.forEach(p => {
        const name = p.split(" as ")[1] || p; // Trata 'A as B'
        addToIndex(name.trim(), filePath);
      });
    }

  } catch (err) {
    console.error(`Erro lendo ${filePath}:`, err.message);
  }
}

function addToIndex(symbolName, filePath) {
  if (!symbolName) return;
  if (!GLOBAL_EXPORTS.has(symbolName)) {
    GLOBAL_EXPORTS.set(symbolName, []);
  }
  const list = GLOBAL_EXPORTS.get(symbolName);
  if (!list.includes(filePath)) {
    list.push(filePath);
  }
}

/**
 * Verifica se um arquivo existe
 */
async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tenta resolver o import. Retorna o caminho absoluto se existir, ou null.
 */
async function resolveCurrentImport(fromFile, importPath) {
  if (!importPath.startsWith(".")) return "EXTERNAL"; // Módulos node_modules, ignorar
  
  const base = path.dirname(fromFile);
  const extensions = ["", ".js", "/index.js"];
  
  for (const ext of extensions) {
    const attempt = path.resolve(base, importPath + ext);
    if (await fileExists(attempt)) return attempt;
  }
  
  return null; // Quebrado
}

/**
 * Extrai os nomes dos símbolos que estão sendo importados
 * Ex: import { A, B } from './f' -> retorna ['A', 'B']
 * Ex: import C from './f' -> retorna ['C']
 */
function extractImportedSymbols(importClause) {
  if (!importClause) return []; // require('...') sem atribuição
  
  const symbols = [];
  
  // Limpa quebras de linha
  const clean = importClause.replace(/\s+/g, " ");

  // Verifica named imports: { A, B }
  const namedMatch = /\{([^}]+)\}/.exec(clean);
  if (namedMatch) {
    const parts = namedMatch[1].split(",");
    parts.forEach(p => {
      // import { A as B } -> Buscamos A (a origem), mas o código usa B.
      // O regex acima captura 'import ... from'. O texto capturado é '...'.
      // Se for 'import { A as B }', o símbolo exportado pelo arquivo de origem é A.
      const pair = p.trim().split(" as ");
      symbols.push(pair[0].trim());
    });
  }

  // Verifica default import: import A from ... (exclui o bloco { ... })
  // Remove o bloco named para sobrar o default
  const defaultPart = clean.replace(/\{[^}]+\}/, "").replace(/,/g, "").trim();
  if (defaultPart && defaultPart.length > 0) {
    symbols.push(defaultPart);
  }

  return symbols.filter(s => s.length > 0);
}

function getRelativeImport(fromFile, targetFile) {
  let rel = path.relative(path.dirname(fromFile), targetFile);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.split(path.sep).join("/").replace(/\.js$/, "");
}

/**
 * Função principal de correção
 */
async function fixImports() {
  console.log(`🔍 Escaneando projeto em: ${PROJECT_ROOT}`);
  const allFiles = await walk(PROJECT_ROOT);
  stats.scanned = allFiles.length;
  console.log(`📂 Arquivos encontrados: ${stats.scanned}`);

  console.log("📖 Indexando exportações (criando mapa de símbolos)...");
  for (const file of allFiles) {
    await indexFileExports(file);
  }
  console.log(`🧠 Símbolos conhecidos: ${GLOBAL_EXPORTS.size}`);

  console.log("🛠 Verificando imports quebrados...");
  
  for (const file of allFiles) {
    let content = await fs.readFile(file, "utf8");
    let originalContent = content;
    let fileChanged = false;
    
    // Reset regex
    REGEX_IMPORT_FULL.lastIndex = 0;
    
    // Usar loop manual para permitir substituição assíncrona
    // Primeiro coletamos todos os imports para não bagunçar índices durante replace
    let matches = [];
    let m;
    while ((m = REGEX_IMPORT_FULL.exec(content)) !== null) {
      matches.push({
        fullMatch: m[0],
        importClause: m[1], // o que está entre import e from
        importPath: m[2],   // o caminho
        index: m.index
      });
    }

    for (const item of matches) {
      const { fullMatch, importClause, importPath } = item;

      // 1. Verifica se o import funciona
      const status = await resolveCurrentImport(file, importPath);
      if (status !== null) continue; // Está ok ou é externo

      // 2. Import quebrado detectado!
      // console.log(`\n❌ Quebrado em ${path.basename(file)}: "${importPath}"`);

      // 3. Estratégia A: Buscar pelos símbolos importados
      const symbolsNeeded = extractImportedSymbols(importClause);
      let bestCandidate = null;

      if (symbolsNeeded.length > 0) {
        // Pega o primeiro símbolo (geralmente o principal)
        const symbol = symbolsNeeded[0];
        const candidates = GLOBAL_EXPORTS.get(symbol);

        if (candidates && candidates.length === 1) {
          // Bingo! Só existe um arquivo no projeto que exporta isso
          bestCandidate = candidates[0];
        } else if (candidates && candidates.length > 1) {
          // Conflito
          stats.conflicts.push({ file, symbol, candidates });
          // console.log(`   ⚠️ Conflito para símbolo "${symbol}": ${candidates.length} arquivos.`);
          continue; 
        }
      }

      // 4. Estratégia B: Se falhar símbolo, tenta buscar pelo nome do arquivo (filename) antigo
      if (!bestCandidate) {
        const oldBasename = path.basename(importPath) + ".js";
        // Procura manual simples nos arquivos já listados
        const foundByName = allFiles.filter(f => path.basename(f) === oldBasename);
        
        if (foundByName.length === 1) {
          bestCandidate = foundByName[0];
        } else if (foundByName.length > 1) {
           stats.conflicts.push({ file, symbol: oldBasename, candidates: foundByName });
        }
      }

      // 5. Aplica a correção se tivermos um candidato
      if (bestCandidate) {
        // Evita importar a si mesmo
        if (bestCandidate === file) continue;

        const newPath = getRelativeImport(file, bestCandidate);
        
        // Substitui no conteúdo (usando replace string para segurança)
        // Cuidado: replace substitui apenas a primeira ocorrência se for string, 
        // mas aqui estamos iterando matches. Para garantir, substituímos apenas ESSE match específico
        // se o conteúdo ainda tiver ele.
        if (content.includes(fullMatch)) {
            const newStatement = fullMatch.replace(importPath, newPath);
            content = content.replace(fullMatch, newStatement);
            fileChanged = true;
            stats.fixed++;
            console.log(`✅ Corrigido: ${path.basename(file)}`);
            console.log(`   🔴 ${importPath}`);
            console.log(`   🟢 ${newPath} (via símbolo/nome)`);
        }
      } else {
        // Não achou salvação
        if (!stats.notFound.find(n => n.path === importPath)) {
            stats.notFound.push({ file, path: importPath });
        }
      }
    }

    if (fileChanged) {
      await fs.writeFile(file, content, "utf8");
    }
  }

  printReport();
}

function printReport() {
  console.log("\n========================================");
  console.log("📊 RELATÓRIO FINAL");
  console.log("========================================");
  console.log(`📂 Arquivos escaneados: ${stats.scanned}`);
  console.log(`✨ Imports corrigidos:  ${stats.fixed}`);
  
  if (stats.conflicts.length > 0) {
    console.log(`\n⚠️  CONFLITOS (Não alterados - ${stats.conflicts.length}):`);
    console.log("O script achou múltiplos arquivos para o mesmo import. Resolva manualmente:");
    stats.conflicts.forEach(c => {
      console.log(`\n📄 No arquivo: ${path.relative(PROJECT_ROOT, c.file)}`);
      console.log(`   Buscando por: "${c.symbol}"`);
      console.log(`   Encontrado em:`);
      c.candidates.forEach(cand => console.log(`     - ${path.relative(PROJECT_ROOT, cand)}`));
    });
  }

  if (stats.notFound.length > 0) {
    console.log(`\n❌ NÃO ENCONTRADO (${stats.notFound.length}):`);
    console.log("O script não achou nenhum arquivo exportando este nome nem com este nome de arquivo.");
    stats.notFound.forEach(nf => {
      console.log(`   Em ${path.basename(nf.file)}: Import "${nf.path}"`);
    });
  }
  
  console.log("\n========================================");
}

fixImports().catch(console.error);


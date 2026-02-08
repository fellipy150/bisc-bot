import fs from "fs/promises";
import path from "path";
import readline from "readline";

const args = process.argv.slice(2);
const PROJECT_ROOT = args[0] ? path.resolve(args[0]) : process.cwd();

// --- CONFIGURAÇÕES VISUAIS (ANSI COLORS) ---
const C = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m"
};

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build"]);
const REGEX_IMPORT_STRICT = /^(import\s+([\s\S]*?)from\s+)(["'])([^"']+)(["'])([\s\S]*?;?)$/gm;

const GLOBAL_EXPORTS = new Map();
const stats = { fixed: 0, scanned: 0 };

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function walk(dir) {
    let files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        if (entry.isDirectory()) files = files.concat(await walk(fullPath));
        else if (/\.(js|mjs|json)$/.test(entry.name)) files.push(fullPath);
    }
    return files;
}

async function indexExports(filePath) {
    const content = await fs.readFile(filePath, "utf8");
    const regexes = [
        /export\s+(?:const|let|var|function|class)\s+([a-zA-Z0-9_$]+)/g,
        /export\s+default\s+(?:function|class)?\s*([a-zA-Z0-9_$]+)/g,
        /export\s*\{([^}]+)\}/g
    ];

    for (const reg of regexes) {
        let m;
        while ((m = reg.exec(content)) !== null) {
            const rawSymbols = m[1].includes(',') ? m[1].split(',') : [m[1]];
            rawSymbols.forEach(s => {
                const name = s.trim().split(/\s+as\s+/)[1] || s.trim().split(/\s+/)[0];
                if (!name || name === 'default') return;
                if (!GLOBAL_EXPORTS.has(name)) GLOBAL_EXPORTS.set(name, []);
                const list = GLOBAL_EXPORTS.get(name);
                if (!list.includes(filePath)) list.push(filePath);
            });
        }
    }
}

function getRelativePath(from, to) {
    let rel = path.relative(path.dirname(from), to);
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel.split(path.sep).join('/');
}

async function run() {
    console.clear();
    console.log(`${C.bright}${C.cyan}🚀 INICIANDO REPARO DE IMPORTS${C.reset}\n`);
    
    const allFiles = await walk(PROJECT_ROOT);
    console.log(`${C.gray}🔍 Indexando símbolos em ${allFiles.length} arquivos...${C.reset}`);
    
    for (const f of allFiles) if (!f.endsWith('.json')) await indexExports(f);

    for (const file of allFiles) {
        if (file.endsWith('.json')) continue;
        let content = await fs.readFile(file, "utf8");
        const lines = content.split('\n');
        let fileModified = false;

        const newLines = await Promise.all(lines.map(async (line) => {
            let newLine = line;
            const match = REGEX_IMPORT_STRICT.exec(line);
            REGEX_IMPORT_STRICT.lastIndex = 0; // Reset regex

            if (match) {
                const [fullMatch, prefix, symbolsPart, q1, oldPath, q2, suffix] = match;
                if (!oldPath.startsWith('.')) return line;

                const symbols = symbolsPart.match(/[A-Z_a-z0-9_$]+/g) || [];
                let candidates = [];
                
                symbols.forEach(sym => {
                    if (GLOBAL_EXPORTS.has(sym)) candidates.push(...GLOBAL_EXPORTS.get(sym));
                });

                // --- LÓGICA ANTI-BARREL ---
                // Se tivermos múltiplos candidatos e um deles for index.js, priorizamos o arquivo específico
                // para evitar problemas de "Barrel Hell".
                let bestMatch = null;
                if (candidates.length > 0) {
                    const specificFiles = candidates.filter(c => !c.endsWith('index.js'));
                    bestMatch = specificFiles.length > 0 ? specificFiles[0] : candidates[0];
                }

                if (bestMatch && bestMatch !== file) {
                    const newPath = getRelativePath(file, bestMatch);
                    if (newPath !== oldPath) {
                        const suggestedLine = `${prefix}${q1}${newPath}${q2}${suffix}`;
                        
                        console.log(`\n${C.yellow}------------------------------------------------${C.reset}`);
                        console.log(`${C.bright}📄 Arquivo:${C.reset} ${C.blue}${path.relative(PROJECT_ROOT, file)}${C.reset}`);
                        console.log(`${C.red}  - ${line.trim()}${C.reset}`);
                        console.log(`${C.green}  + ${suggestedLine.trim()}${C.reset}`);
                        console.log(`${C.gray}     (Símbolo detectado em: ${path.relative(PROJECT_ROOT, bestMatch)})${C.reset}`);

                        const confirm = await ask(`\n${C.bright}❓ Aplicar correção? (y/n/skip): ${C.reset}`);
                        if (confirm.toLowerCase() === 'y') {
                            newLine = suggestedLine;
                            fileModified = true;
                            stats.fixed++;
                        }
                    }
                }
            }
            return newLine;
        }));

        if (fileModified) {
            await fs.writeFile(file, newLines.join('\n'));
        }
    }

    console.log(`\n${C.bright}${C.green}✅ SUCESSO:${C.reset} ${stats.fixed} imports corrigidos.`);
    rl.close();
}

run().catch(console.error);

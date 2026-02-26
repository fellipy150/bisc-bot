import fs from 'fs';
import path from 'path';

// ⚠️ Pasta onde ficam seus comandos (Executando de dentro de src/)
const COMMANDS_DIR = './commands/';

// ─── Objetos receptores válidos de .send() ────────────────────────────────────
// Evita capturar fs.send(), socket.send(), etc.
const VALID_SEND_RECEIVERS = /\b(message\.channel|interaction\.channel|channel|thread)\s*\.\s*send\s*\(/;

// ─────────────────────────────────────────────────────────────────────────────

function getAllJsFiles(dirPath, arrayOfFiles = [], isRoot = true) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        const isDirectory = fs.statSync(fullPath).isDirectory();
        if (isDirectory) {
            arrayOfFiles = getAllJsFiles(fullPath, arrayOfFiles, false);
        } else if (file.endsWith('.js') && !isRoot) {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}

function findClosingParen(str, startIndex) {
    let depth = 1;
    let i = startIndex;
    let inString = false;
    let stringChar = '';

    while (i < str.length && depth > 0) {
        const ch = str[i];
        if (inString) {
            if (ch === '\\') {
                i++;
            } else if (ch === stringChar) {
                inString = false;
            }
        } else {
            if (ch === '"' || ch === "'" || ch === '`') {
                inString = true;
                stringChar = ch;
            } else if (ch === '(') {
                depth++;
            } else if (ch === ')') {
                depth--;
            }
        }
        i++;
    }
    return depth === 0 ? i - 1 : -1;
}

/**
 * Extrai TODO o conteúdo textual dos argumentos de uma chamada,
 * juntando strings simples e template literals concatenados.
 * Interpolações ${expr} viram {expr} no JSON.
 */
function extractFullText(args) {
    const parts = [];
    let i = 0;

    while (i < args.length) {
        const ch = args[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            i++;
            let str = '';
            while (i < args.length && args[i] !== quote) {
                if (args[i] === '\\') {
                    str += args[i] + args[i + 1];
                    i += 2;
                } else {
                    str += args[i];
                    i++;
                }
            }
            parts.push(str);
            i++;
        } else if (ch === '`') {
            i++;
            let str = '';
            while (i < args.length && args[i] !== '`') {
                if (args[i] === '\\') {
                    str += args[i] + args[i + 1];
                    i += 2;
                } else if (args[i] === '$' && args[i + 1] === '{') {
                    i += 2;
                    let expr = '';
                    let depth = 1;
                    while (i < args.length && depth > 0) {
                        if (args[i] === '{') depth++;
                        else if (args[i] === '}') depth--;
                        if (depth > 0) expr += args[i];
                        i++;
                    }
                    str += `{${expr.trim()}}`;
                } else {
                    str += args[i];
                    i++;
                }
            }
            parts.push(str);
            i++;
        } else {
            i++;
        }
    }
    return parts.join('');
}

/**
 * Tenta extrair string de um objeto { content: "..." } do Discord.js.
 * Retorna null se não for esse padrão.
 */
function extractContentFromObject(args) {
    const match = args.match(/^\s*\{\s*content\s*:\s*(['"`])/);
    if (!match) return null;
    const quoteStart = args.indexOf(match[1]);
    if (quoteStart === -1) return null;
    const text = extractFullText(args.slice(quoteStart));
    return text || null;
}

/**
 * Determina se um método capturado deve ser migrado e retorna o texto extraído.
 * Retorna null se deve ser ignorado.
 */
function resolveArgs(methodName, args) {
    const trimmed = args.trimStart();

    // Caso 1: Primeiro argumento é string literal
    if (/^['"`]/.test(trimmed)) {
        const text = extractFullText(trimmed);
        return text.trim() !== '' ? text : null;
    }

    // Caso 2: Objeto { content: "..." } (Discord.js v10+)
    if (/^\{/.test(trimmed)) {
        return extractContentFromObject(trimmed);
    }

    // Caso 3: Variável ou expressão — NÃO migrar
    return null;
}

/**
 * Valida se um .send() encontrado tem um receptor Discord legítimo.
 */
function isSendCallValid(content, matchIndex) {
    const lookBehind = content.slice(Math.max(0, matchIndex - 80), matchIndex + 6);
    return VALID_SEND_RECEIVERS.test(lookBehind);
}

/**
 * Extrai o objeto de mensagens do bloco @register-messages existente.
 * Retorna {} se não houver bloco ou se o JSON for inválido.
 */
function extractExistingMessages(content, commandName) {
    const blockMatch = content.match(/\/\*[\s\n]*@register-messages([\s\S]*?)@end[\s\n]*\*\//);
    if (!blockMatch) return {};
    try {
        const parsed = JSON.parse(blockMatch[1].trim());
        return parsed[commandName] ?? {};
    } catch {
        return {};
    }
}

/**
 * Coleta todas as chaves msg("cmd.key") já em uso no código.
 * Retorna um array ordenado pela ordem de aparição, sem duplicatas.
 */
function collectUsedMsgKeys(content, commandName) {
    const seen = new Set();
    const ordered = [];
    const regex = new RegExp(`msg\\s*\\(\\s*['"\`]${commandName}\\.([^'"\`]+)['"\`]`, 'g');
    let m;
    while ((m = regex.exec(content)) !== null) {
        if (!seen.has(m[1])) {
            seen.add(m[1]);
            ordered.push(m[1]);
        }
    }
    return ordered;
}

// ─────────────────────────────────────────────────────────────────────────────

function migrateCommand(filePath) {
    if (filePath.endsWith('migrator.js')) return;

    let content = fs.readFileSync(filePath, 'utf8');

    console.log(`🔄 Processando: ${filePath}`);

    // 1. Extrai o nome do comando (antes de remover o bloco)
    const cmdMatch = content.match(/allData\[["']([^"']+)["']\]/);
    const commandName = cmdMatch ? cmdMatch[1] : path.basename(filePath, '.js');

    // 2. Salva mensagens já registradas no bloco anterior (valores por chave)
    const previousMessages = extractExistingMessages(content, commandName);

    // 3. Remove bloco @register-messages antigo para recriar do zero
    content = content.replace(/\/\*[\s\n]*@register-messages[\s\S]*?@end[\s\n]*\*\//g, '');
    content = content.trimEnd();

    const messagesFound = {};

    // ── Detecta se o arquivo já foi migrado ──────────────────────────────────
    // Um arquivo migrado usa msg("cmd.key") em vez de strings literais nas chamadas.
    const alreadyMigrated = new RegExp(`msg\\s*\\(\\s*['"\`]${commandName}\\.`).test(content);

    if (alreadyMigrated) {
        // ── MODO RECONCILIAÇÃO ────────────────────────────────────────────────
        // Coleta as chaves usadas no código e preserva seus valores do bloco
        // anterior. O resultado reflete EXATAMENTE o que o código referencia.
        const usedKeys = collectUsedMsgKeys(content, commandName);

        for (const key of usedKeys) {
            // Preserva valor existente; placeholder apenas se chave for nova
            messagesFound[key] = previousMessages[key] ?? `[TODO: ${key}]`;
        }
    } else {
        // ── MODO MIGRAÇÃO ─────────────────────────────────────────────────────
        // Arquivo bruto: substitui strings literais por msg() e extrai textos.
        const methodRegex = /\.(reply|edit|send|followUp|editReply)\s*\(/g;
        let result = '';
        let lastIndex = 0;
        let msgCounter = 1;
        let match;

        while ((match = methodRegex.exec(content)) !== null) {
            const methodName = match[1];
            const argsStart = match.index + match[0].length;

            if (methodName === 'send' && !isSendCallValid(content, match.index)) {
                result += content.slice(lastIndex, argsStart);
                lastIndex = argsStart;
                methodRegex.lastIndex = argsStart;
                continue;
            }

            const closingIndex = findClosingParen(content, argsStart);
            if (closingIndex === -1) continue;

            const args = content.slice(argsStart, closingIndex);
            const extractedText = resolveArgs(methodName, args);

            if (extractedText === null) {
                result += content.slice(lastIndex, argsStart);
                lastIndex = argsStart;
                methodRegex.lastIndex = argsStart;
                continue;
            }

            const msgKey = `mensagem_${msgCounter}`;
            messagesFound[msgKey] = extractedText;
            msgCounter++;

            result += content.slice(lastIndex, match.index);
            result += `.${methodName}(msg("${commandName}.${msgKey}"))`;

            lastIndex = closingIndex + 1;
            methodRegex.lastIndex = lastIndex;
        }

        result += content.slice(lastIndex);
        content = result;
    }

    // 4. Injeta o import do msg handler no topo (se ainda não houver)
    if (!content.includes('msg-handler.js')) {
        const dir = path.dirname(filePath);
        let relativePath = path.relative(dir, 'config');
        if (relativePath === '') relativePath = '.';
        if (!relativePath.startsWith('.')) relativePath = './' + relativePath;
        content = `import msg from '${relativePath}/msg-handler.js';\n` + content;
    }

    // 5. Monta o bloco JSON final
    //    "uso_incorreto" e "erro_interno" só entram se o código realmente os usar.
    const usesKey = (key) =>
        new RegExp(`msg\\s*\\(\\s*['"\`]${commandName}\\.${key}['"\`]`).test(content);

    const defaults = {};
    if (usesKey('uso_incorreto')) defaults['uso_incorreto'] = previousMessages['uso_incorreto'] ?? '⚠️ Uso incorreto! Tente: {uso}';
    if (usesKey('erro_interno'))  defaults['erro_interno']  = previousMessages['erro_interno']  ?? '❌ Ocorreu um erro ao processar este comando.';

    const jsonBlock = {
        [commandName]: {
            "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
            ...defaults,
            ...messagesFound
        }
    };

    const finalFooter = `\n\n/*\n@register-messages\n${JSON.stringify(jsonBlock, null, 2)}\n@end\n*/\n`;

    // 6. Sobrescreve o arquivo
    fs.writeFileSync(filePath, content + finalFooter, 'utf8');
    console.log(`✅ Atualizado com sucesso: ${filePath}`);
}

// Iniciar
const files = getAllJsFiles(COMMANDS_DIR);
files.forEach(migrateCommand);
console.log('\n🎉 Varredura concluída! Verifique seus arquivos.');

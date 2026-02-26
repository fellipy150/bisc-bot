import fs from 'fs';
import path from 'path';

// ⚠️ Pasta onde ficam seus comandos (Executando de dentro de src/)
const COMMANDS_DIR = './commands/';

// ─── Métodos Discord.js que enviam mensagens ──────────────────────────────────
// Inclui: reply, edit, send, followUp, editReply, deferReply não precisa
const DISCORD_SEND_METHODS = new Set(['reply', 'edit', 'send', 'followUp', 'editReply']);

// ─── Objetos receptores válidos de .send() ────────────────────────────────────
// Evita capturar .send() de streams, sockets, etc.
const VALID_SEND_RECEIVERS = /\b(message\.channel|interaction\.channel|channel|thread)\s*\.\s*send\s*\(/;

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
                i++; // pula char escapado
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
    // Tenta { content: "string" } ou { content: `template` }
    const match = args.match(/^\s*\{\s*content\s*:\s*(['"`])/);
    if (!match) return null;

    const quoteStart = args.indexOf(match[1]);
    if (quoteStart === -1) return null;

    // Usa extractFullText só na parte relevante
    const fromQuote = args.slice(quoteStart);
    const text = extractFullText(fromQuote);
    return text || null;
}

/**
 * Determina se um método capturado deve ser migrado e retorna o texto extraído.
 * Retorna null se deve ser ignorado.
 */
function resolveArgs(methodName, args, contextBefore) {
    const trimmed = args.trimStart();

    // ── Caso 1: Primeiro argumento é string literal ────────────────────────────
    if (/^['"`]/.test(trimmed)) {
        const text = extractFullText(trimmed);
        return text.trim() !== '' ? text : null;
    }

    // ── Caso 2: Objeto { content: "..." } (Discord.js API v10+) ───────────────
    if (/^\{/.test(trimmed)) {
        return extractContentFromObject(trimmed);
    }

    // ── Caso 3: Variável ou expressão — NÃO migrar ────────────────────────────
    return null;
}

/**
 * Valida se um .send() encontrado tem um receptor Discord legítimo.
 * Evita capturar fs.send(), socket.send(), etc.
 */
function isSendCallValid(content, matchIndex) {
    // Pega os ~80 chars antes do .send( para verificar o receptor
    const lookBehind = content.slice(Math.max(0, matchIndex - 80), matchIndex + 6);
    return VALID_SEND_RECEIVERS.test(lookBehind);
}

function migrateCommand(filePath) {
    if (filePath.endsWith('migrator.js')) return;

    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Remove bloco @register-messages antigo para recriar do zero
    content = content.replace(/\/\*[\s\n]*@register-messages[\s\S]*?@end[\s\n]*\*\//g, '');
    content = content.trimEnd();

    console.log(`🔄 Processando: ${filePath}`);

    // 2. Extrai o nome do comando
    const cmdMatch = content.match(/allData\[["']([^"']+)["']\]/);
    const commandName = cmdMatch ? cmdMatch[1] : path.basename(filePath, '.js');

    const messagesFound = {};
    let msgCounter = 1;

    // 3. Percorre o arquivo procurando chamadas de envio de mensagem
    //    Captura: .reply( | .edit( | .send( | .followUp( | .editReply(
    const methodRegex = /\.(reply|edit|send|followUp|editReply)\s*\(/g;
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
        const methodName = match[1];
        const argsStart = match.index + match[0].length;

        // Para .send(), valida o receptor antes de processar
        if (methodName === 'send' && !isSendCallValid(content, match.index)) {
            result += content.slice(lastIndex, argsStart);
            lastIndex = argsStart;
            methodRegex.lastIndex = argsStart;
            continue;
        }

        const closingIndex = findClosingParen(content, argsStart);
        if (closingIndex === -1) continue;

        const args = content.slice(argsStart, closingIndex);
        const contextBefore = content.slice(Math.max(0, match.index - 60), match.index);

        const extractedText = resolveArgs(methodName, args, contextBefore);

        if (extractedText === null) {
            // Não é string literal nem objeto content — avança sem modificar
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

    // 4. Injeta o import do msg handler no topo (se ainda não houver)
    if (!content.includes('msg-handler.js')) {
        const dir = path.dirname(filePath);
        let relativePath = path.relative(dir, 'config');
        if (relativePath === '') relativePath = '.';
        if (!relativePath.startsWith('.')) relativePath = './' + relativePath;

        const importMsg = `import msg from '${relativePath}/msg-handler.js';\n`;
        content = importMsg + content;
    }

    // 5. Monta o objeto JSON para o final do arquivo
    const jsonBlock = {
        [commandName]: {
            "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
            "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
            "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
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

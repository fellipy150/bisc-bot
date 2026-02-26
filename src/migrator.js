import fs from 'fs';
import path from 'path';

// ⚠️ Ajuste os caminhos se necessário (considerando execução da raiz do src)
const COMMANDS_DIR = './commands/';
const GLOBAL_MSG_FILE = './config/message_data.json'; 

const VALID_SEND_RECEIVERS = /\b(message\.channel|interaction\.channel|channel|thread)\s*\.\s*send\s*\(/;

function getAllJsFiles(dirPath, arrayOfFiles = [], isRoot = true) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
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
            if (ch === '\\') i++; // Pula o escape
            else if (ch === stringChar) inString = false;
        } else {
            if (ch === '"' || ch === "'" || ch === '`') {
                inString = true;
                stringChar = ch;
            } else if (ch === '(') depth++;
            else if (ch === ')') depth--;
        }
        i++;
    }
    return depth === 0 ? i - 1 : -1;
}

/**
 * Super Parser V2: Extrai a string, traduz variáveis ${expr}, limpa escapes
 * E suporta múltiplas strings concatenadas com sinal de '+'.
 */
function parseArgumentString(str) {
    let i = 0;
    while(i < str.length && /\s/.test(str[i])) i++; // Pula espaços iniciais

    let isObject = false;
    let parseStart = i;
    let parseEnd = str.length;

    // Suporte para { content: "..." }
    if (str[i] === '{') {
        const contentMatch = str.slice(i).match(/^\{\s*content\s*:\s*/);
        if (!contentMatch) return null;
        
        isObject = true;
        parseStart = i + contentMatch[0].length;

        // Acha onde o valor do content termina (na vírgula ou fim do objeto)
        let depth = 0;
        let inStr = false;
        let quote = '';
        for (let j = parseStart; j < str.length; j++) {
            if (inStr) {
                if (str[j] === '\\') j++;
                else if (str[j] === quote) inStr = false;
            } else {
                if (str[j] === '"' || str[j] === "'" || str[j] === '`') { inStr = true; quote = str[j]; }
                else if (str[j] === '{' || str[j] === '[' || str[j] === '(') depth++;
                else if (str[j] === '}' || str[j] === ']' || str[j] === ')') depth--;
                else if (str[j] === ',' && depth === 0) {
                    parseEnd = j;
                    break;
                }
            }
        }
    }

    let text = "";
    let vars = [];
    let stringFragmentsFound = false;
    let j = parseStart;

    // Varre todo o bloco em busca de TODAS as strings (lidando com concatenações)
    while (j < parseEnd) {
        const ch = str[j];
        if (ch === '"' || ch === "'" || ch === '`') {
            stringFragmentsFound = true;
            const quote = ch;
            j++;
            while (j < parseEnd && str[j] !== quote) {
                if (str[j] === '\\') {
                    let next = str[j+1];
                    if (next === 'n') text += '\n';
                    else if (next === 't') text += '\t';
                    else if (next === 'r') text += '\r';
                    else if (next === '\\') text += '\\';
                    else text += next; 
                    j += 2;
                } else if (quote === '`' && str[j] === '$' && str[j+1] === '{') {
                    j += 2;
                    let exprStart = j;
                    let depth = 1;
                    while (j < parseEnd && depth > 0) {
                        if (str[j] === '{') depth++;
                        else if (str[j] === '}') depth--;
                        j++;
                    }
                    let expr = str.slice(exprStart, j - 1).trim();
                    
                    let safeKey = expr.split('.').pop().replace(/[^a-zA-Z0-9_$]/g, '');
                    if (!safeKey || safeKey.match(/^\d/)) safeKey = "var" + (vars.length + 1);
                    
                    let finalKey = safeKey;
                    let counter = 2;
                    while (vars.some(v => v.key === finalKey)) {
                        finalKey = safeKey + counter++;
                    }
                    
                    vars.push({ key: finalKey, expr: expr });
                    text += `{${finalKey}}`;
                } else {
                    text += str[j];
                    j++;
                }
            }
            j++; // Pula aspa de fechamento
        } else {
            // Se estiver fora de uma string (ex: sinal de +, espaços, quebras de linha no código), apenas ignore e avance
            j++;
        }
    }
    
    if (!stringFragmentsFound) return null;

    return {
        extractedText: text.trim(),
        variables: vars,
        startIdx: parseStart,
        endIdx: isObject ? parseEnd : str.length
    };
}







function isSendCallValid(content, matchIndex) {
    const lookBehind = content.slice(Math.max(0, matchIndex - 80), matchIndex + 6);
    return VALID_SEND_RECEIVERS.test(lookBehind);
}

function extractExistingMessages(content) {
    const blockMatch = content.match(/\/\*[\s\n]*@register-messages([\s\S]*?)@end[\s\n]*\*\//);
    if (!blockMatch) return {};
    try {
        const parsed = JSON.parse(blockMatch[1].trim());
        return Object.values(parsed)[0] ?? {};
    } catch {
        return {};
    }
}

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

// Carrega o JSON global uma vez para salvar dados que não estão nos arquivos
let globalMessagesData = {};
if (fs.existsSync(GLOBAL_MSG_FILE)) {
    try {
        globalMessagesData = JSON.parse(fs.readFileSync(GLOBAL_MSG_FILE, 'utf8'));
    } catch (e) {
        console.error("⚠️ Aviso: Arquivo message_data.json global inválido.");
    }
}

function migrateCommand(filePath) {
    if (filePath.endsWith('migrator.js')) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Extrai o nome do comando (antes de remover o bloco)
    const cmdMatch = content.match(/allData\[["']([^"']+)["']\]/);
    const commandName = cmdMatch ? cmdMatch[1] : path.basename(filePath, '.js');

    console.log(`🔄 Processando: ${commandName} (${filePath})`);

    // 2. Busca mensagens antigas (Arquivo Local + JSON Global)
    const localMessages = extractExistingMessages(content);
    const globalMessages = globalMessagesData[commandName] ?? {};
    const previousMessages = { ...globalMessages, ...localMessages };

    // 3. Remove bloco antigo
    content = content.replace(/\/\*[\s\n]*@register-messages[\s\S]*?@end[\s\n]*\*\//g, '').trimEnd();

    const messagesFound = {};
    const alreadyMigrated = new RegExp(`msg\\s*\\(\\s*['"\`]${commandName}\\.`).test(content);

    if (alreadyMigrated) {
        // --- MODO RECONCILIAÇÃO ---
        const usedKeys = collectUsedMsgKeys(content, commandName);
        for (const key of usedKeys) {
            messagesFound[key] = previousMessages[key] ?? `[TODO: ${key}]`;
        }
    } else {
        // --- MODO MIGRAÇÃO PROFUNDA ---
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
                lastIndex = argsStart; methodRegex.lastIndex = argsStart; continue;
            }

            const closingIndex = findClosingParen(content, argsStart);
            if (closingIndex === -1) continue;

            const args = content.slice(argsStart, closingIndex);
            const parsed = parseArgumentString(args);

            if (!parsed || !parsed.extractedText) {
                result += content.slice(lastIndex, argsStart);
                lastIndex = argsStart; methodRegex.lastIndex = argsStart; continue;
            }

            const msgKey = `mensagem_${msgCounter++}`;
            messagesFound[msgKey] = parsed.extractedText;

            // Monta o objeto de variáveis: { tempoTotal, name: user.name }
            let varString = "";
            if (parsed.variables.length > 0) {
                const props = parsed.variables.map(v => 
                    v.key === v.expr ? v.key : `"${v.key}": ${v.expr}`
                ).join(', ');
                varString = `, { ${props} }`;
            }

            const replacement = `msg("${commandName}.${msgKey}"${varString})`;
            
            // Substitui APENAS a string dentro dos argumentos, preservando objetos
            const newArgs = args.slice(0, parsed.startIdx) + replacement + args.slice(parsed.endIdx);

            result += content.slice(lastIndex, match.index);
            result += `.${methodName}(${newArgs})`;

            lastIndex = closingIndex + 1;
            methodRegex.lastIndex = lastIndex;
        }

        result += content.slice(lastIndex);
        content = result;
    }

    // 4. Injeta import se não existir
    if (!content.includes('msg-handler.js')) {
        const dir = path.dirname(filePath);
        let relativePath = path.relative(dir, 'config') || '.';
        if (!relativePath.startsWith('.')) relativePath = './' + relativePath;
        content = `import msg from '${relativePath}/msg-handler.js';\n` + content;
    }

    // 5. Bloco JSON Final
    const usesKey = (k) => new RegExp(`msg\\s*\\(\\s*['"\`]${commandName}\\.${k}['"\`]`).test(content);
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

    fs.writeFileSync(filePath, content + finalFooter, 'utf8');
    console.log(`✅ Atualizado com sucesso: ${commandName}`);
}

const files = getAllJsFiles(COMMANDS_DIR);
files.forEach(migrateCommand);
console.log('\n🎉 Varredura concluída! Verifique seus arquivos.');

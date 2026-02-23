import fs from 'fs';
import path from 'path';

// ⚠️ Mude aqui para a pasta onde ficam seus comandos
const COMMANDS_DIR = './src/commands'; 

function getAllJsFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllJsFiles(fullPath, arrayOfFiles);
        } else if (file.endsWith('.js')) {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

function migrateCommand(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Ignora arquivos que já foram migrados
    if (content.includes('@register-messages')) {
        console.log(`⏩ Ignorando (já possui o bloco): ${filePath}`);
        return;
    }

    console.log(`🔄 Processando: ${filePath}`);

    // 2. Extrair o nome do comando (ex: allData["ping"])
    const cmdMatch = content.match(/allData\[["']([^"']+)["']\]/);
    const commandName = cmdMatch ? cmdMatch[1] : path.basename(filePath, '.js');

    // 3. Heurística para pescar mensagens dentro de reply ou edit
    // Procura por .reply( ou .edit( e captura a string interna
    const messageRegex = /\.(?:reply|edit)\(\s*(['"`])([\s\S]*?)\1/g;
    let match;
    const messagesFound = {};
    let msgCounter = 1;

    while ((match = messageRegex.exec(content)) !== null) {
        // match[2] contém o texto capturado sem as aspas/crases iniciais e finais
        let rawText = match[2]; 
        
        // Limpeza básica para o JSON ficar legível (remove concatenações de string " + ")
        let cleanText = rawText.replace(/['"`]\s*\+\s*['"`]/g, '').trim();
        
        // Salva a mensagem com uma chave genérica para você renomear depois
        messagesFound[`mensagem_${msgCounter}`] = cleanText;
        msgCounter++;
    }

    // 4. Injetar o import do msg handler no topo do arquivo
    if (!content.includes('msg-handler.js')) {
        // Calcula a profundidade do caminho para tentar colocar o path relativo correto
        const depth = filePath.split(path.sep).length - 2; 
        const relativePath = depth > 0 ? '../'.repeat(depth) : './';
        const importMsg = `import msg from '${relativePath}config/msg-handler.js';\n`;
        
        content = importMsg + content;
    }

    // 5. Montar o objeto JSON para o final do arquivo
    const jsonBlock = {
        [commandName]: {
            "_nota": "O JSON abaixo pode conter QUALQUER estrutura válida. Você pode adicionar objetos aninhados, múltiplas chaves, ou qualquer outro conteúdo necessário para o comando. O utilitário de sincronização fará merge profundo automaticamente.",
            "uso_incorreto": "⚠️ Uso incorreto! Tente: {uso}",
            "erro_interno": "❌ Ocorreu um erro ao processar este comando.",
            ...messagesFound
        }
    };

    const finalFooter = `\n/*\n@register-messages\n${JSON.stringify(jsonBlock, null, 2)}\n@end\n*/\n`;

    // 6. Sobrescrever o arquivo com as adições
    fs.writeFileSync(filePath, content + finalFooter, 'utf8');
    console.log(`✅ Atualizado com sucesso: ${filePath}`);
}

// Iniciar
const files = getAllJsFiles(COMMANDS_DIR);
files.forEach(migrateCommand);
console.log('\n🎉 Varredura concluída! Verifique seus arquivos.');

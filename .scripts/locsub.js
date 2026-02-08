#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
  },
  
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m'
  }
};

// Diretórios a serem ignorados
const ignoredDirs = ['node_modules', '❌clone', '.git'];

// Função principal
async function main() {
  console.log(`${colors.fg.cyan}${colors.bright}=== Sistema de Análise e Manipulação de Arquivos JS ===${colors.reset}\n`);
  
  // Solicitar o diretório base
  const baseDir = await getBaseDirectory();
  console.log(`${colors.fg.green}Diretório selecionado: ${baseDir}${colors.reset}\n`);
  
  // Verificar se o diretório existe
  if (!fs.existsSync(baseDir)) {
    console.log(`${colors.fg.red}Erro: O diretório ${baseDir} não existe.${colors.reset}`);
    process.exit(1);
  }
  
  // Parte 1: Análise de dependências
  await analyzeDependencies(baseDir);
  
  // Esperando para continuar
  await new Promise(resolve => {
    console.log(`\n${colors.fg.yellow}Digite "next" para continuar para o sistema de localização e substituição.${colors.reset}`);
    
    const checkInput = (input) => {
      if (input.toLowerCase() === 'next') {
        resolve();
      } else {
        console.log(`${colors.fg.red}Por favor, digite "next" para continuar.${colors.reset}`);
      }
    };
    
    rl.question('> ', answer => {
      checkInput(answer);
      
      // Se não for "next", continuar aguardando a entrada correta
      if (answer.toLowerCase() !== 'next') {
        rl.on('line', (input) => {
          checkInput(input);
          if (input.toLowerCase() === 'next') {
            rl.removeAllListeners('line');
          }
        });
      }
    });
  });
  
  // Parte 2: Sistema de localização e substituição
  await locsubSystem(baseDir);
  
  rl.close();
}

// Obter o diretório base
async function getBaseDirectory() {
  return new Promise(resolve => {
    rl.question(`${colors.fg.cyan}Informe o diretório absoluto onde as operações vão acontecer${colors.reset}\n(Digite ${colors.fg.yellow}"bisc"${colors.reset} como atalho para ${colors.fg.yellow}"/mnt/sdcard/.bisc/"${colors.reset}):\n> `, answer => {
      if (answer.trim() === 'bisc') {
        resolve('/mnt/sdcard/.bisc/');
      } else {
        resolve(answer.trim());
      }
    });
  });
}

// Analisar dependências entre arquivos JavaScript
async function analyzeDependencies(baseDir) {
  console.log(`${colors.fg.cyan}${colors.bright}=== Analisando dependências entre arquivos JavaScript ===${colors.reset}\n`);
  
  const files = [];
  const dependencies = {};
  
  // Função recursiva para encontrar todos os arquivos
  function findFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!ignoredDirs.includes(entry.name)) {
          findFiles(fullPath);
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  
  // Encontrar todos os arquivos no diretório
  findFiles(baseDir);
  
  // Filtrar apenas arquivos JavaScript
  const jsFiles = files.filter(file => file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx'));
  
  console.log(`${colors.fg.green}Encontrados ${jsFiles.length} arquivos JavaScript/TypeScript.${colors.reset}`);
  
  // Analisar cada arquivo JavaScript em busca de dependências
  for (const file of jsFiles) {
    const relativePath = path.relative(baseDir, file);
    dependencies[relativePath] = [];
    
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Padrões para encontrar importações/exportações/requires
      const importPatterns = [
        /import\s+.*\s+from\s+['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]/g,  // import ... from './path'
        /import\s*\(\s*['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]\s*\)/g,    // import('./path')
        /require\s*\(\s*['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]\s*\)/g,   // require('./path')
        /export\s+.*\s+from\s+['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]/g   // export ... from './path'
      ];
      
      importPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          let importPath = match[1];
          
          // Resolver o caminho relativo
          let resolvedPath;
          try {
            // Se não tiver extensão, tentar adicionar
            if (!path.extname(importPath)) {
              const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
              for (const ext of extensions) {
                const testPath = path.resolve(path.dirname(file), importPath + ext);
                if (fs.existsSync(testPath)) {
                  resolvedPath = path.relative(baseDir, testPath);
                  break;
                }
              }
              
              // Se ainda não encontrou, pode ser um diretório com index
              if (!resolvedPath) {
                const indexExtensions = ['/index.js', '/index.jsx', '/index.ts', '/index.tsx'];
                for (const ext of indexExtensions) {
                  const testPath = path.resolve(path.dirname(file), importPath + ext);
                  if (fs.existsSync(testPath)) {
                    resolvedPath = path.relative(baseDir, testPath);
                    break;
                  }
                }
              }
            } else {
              resolvedPath = path.relative(baseDir, path.resolve(path.dirname(file), importPath));
            }
            
            // Se resolveu o caminho e não é o mesmo arquivo
            if (resolvedPath && resolvedPath !== relativePath) {
              dependencies[relativePath].push(resolvedPath);
            }
          } catch (e) {
            // Ignorar erros de resolução de caminho
          }
        }
      });
    } catch (e) {
      console.log(`${colors.fg.red}Erro ao ler o arquivo ${relativePath}: ${e.message}${colors.reset}`);
    }
  }
  
  // Gerar o diagrama Mermaid
  let mermaidCode = 'graph TD;\n';
  
  for (const [file, deps] of Object.entries(dependencies)) {
    if (deps.length > 0) {
      for (const dep of deps) {
        const fileId = file.replace(/[^a-zA-Z0-9]/g, '_');
        const depId = dep.replace(/[^a-zA-Z0-9]/g, '_');
        mermaidCode += `  ${fileId}["${file}"] --> ${depId}["${dep}"];\n`;
      }
    } else {
      // Arquivos sem dependências ainda aparecem no gráfico
      const fileId = file.replace(/[^a-zA-Z0-9]/g, '_');
      mermaidCode += `  ${fileId}["${file}"];\n`;
    }
  }
  
  console.log(`\n${colors.fg.cyan}${colors.bright}=== Diagrama Mermaid de Dependências ===${colors.reset}`);
  console.log(mermaidCode);
  
  // Salvar o diagrama em um arquivo
  const mermaidFile = path.join(baseDir, 'dependencies-diagram.mmd');
  fs.writeFileSync(mermaidFile, mermaidCode);
  console.log(`\n${colors.fg.green}Diagrama Mermaid salvo em: ${mermaidFile}${colors.reset}`);
}

// Sistema de localização e substituição
async function locsubSystem(baseDir) {
  console.log(`\n${colors.fg.cyan}${colors.bright}=== Sistema de Localização e Substituição (locsub) ===${colors.reset}\n`);
  
  while (true) {
    // Perguntar o que o usuário quer encontrar
    const searchText = await new Promise(resolve => {
      rl.question(`${colors.fg.yellow}O que você deseja encontrar? (ou 'sair' para finalizar)${colors.reset}\n> `, answer => {
        resolve(answer);
      });
    });
    
    if (searchText.toLowerCase() === 'sair') {
      break;
    }
    
    // Realizar a busca
    const results = await findTextInFiles(baseDir, searchText);
    
    if (results.length === 0) {
      console.log(`${colors.fg.red}Nenhum resultado encontrado para "${searchText}".${colors.reset}`);
      continue;
    }
    
    // Exibir resultados
    if (results.length === 1) {
      const result = results[0];
      console.log(`\n${colors.fg.green}Encontrado resultado em ${result.file} (${results.length}/1) na linha ${result.line}:${result.column}:${colors.reset}`);
      console.log(`${colors.fg.cyan}${result.context}${colors.reset}`);
    } else {
      console.log(`\n${colors.fg.green}${results.length} resultados encontrados:${colors.reset}`);
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        console.log(`\n${colors.fg.yellow}${i+1}) ${result.file} (${i+1}/${results.length}) na linha ${result.line}:${result.column}:${colors.reset}`);
        console.log(`${colors.fg.cyan}${result.context}${colors.reset}`);
      }
    }
    
    // Perguntar se o usuário quer substituir
    const replaceChoice = await new Promise(resolve => {
      rl.question(`\n${colors.fg.yellow}Você deseja substituir isso por alguma coisa?${colors.reset}
1. Substituir
2. Voltar
> `, answer => {
        resolve(answer.trim());
      });
    });
    
    if (replaceChoice === '1') {
      // Perguntar pelo texto de substituição
      const replaceText = await new Promise(resolve => {
        rl.question(`\n${colors.fg.yellow}Deseja substituir "${searchText}" pelo que?${colors.reset}\n> `, answer => {
          resolve(answer);
        });
      });
      
      // Substituir em todos os arquivos
      let replaceCount = 0;
      for (const result of results) {
        try {
          let content = fs.readFileSync(result.file, 'utf8');
          const newContent = content.split(searchText).join(replaceText);
          
          if (content !== newContent) {
            fs.writeFileSync(result.file, newContent);
            replaceCount++;
          }
        } catch (e) {
          console.log(`${colors.fg.red}Erro ao substituir no arquivo ${result.file}: ${e.message}${colors.reset}`);
        }
      }
      
      console.log(`\n${colors.fg.green}Substituição realizada em ${replaceCount} arquivos.${colors.reset}`);
    }
  }
}

// Função para encontrar texto em arquivos
async function findTextInFiles(baseDir, searchText) {
  const results = [];
  
  // Função recursiva para buscar em diretórios
  function searchInDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!ignoredDirs.includes(entry.name)) {
          searchInDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const columnIndex = line.indexOf(searchText);
            
            if (columnIndex !== -1) {
              // Extrair contexto (a linha inteira)
              const context = line.trim();
              
              results.push({
                file: path.relative(baseDir, fullPath),
                line: i + 1,
                column: columnIndex + 1,
                context: context
              });
            }
          }
        } catch (e) {
          // Ignorar arquivos que não podem ser lidos como texto
        }
      }
    }
  }
  
  searchInDirectory(baseDir);
  return results;
}

// Iniciar o programa
main().catch(error => {
  console.error(`${colors.fg.red}Erro fatal: ${error.message}${colors.reset}`);
  process.exit(1);
});
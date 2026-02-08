import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

#!/usr/bin/env node

// backup.js
/*========== [ Módulos Importados ] ==========*/
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import { execSync } from 'child_process';

/*========== [ Classe Principal ] ==========*/
class BackupManager {
  constructor() {
    // Atualizando o diretório principal e de backup
    this.projectDir = path.resolve(__dirname, '..'); // A partir de onde o script está sendo executado
    this.backupDir = path.join(this.projectDir, '❌clone',); // Novo diretório de backup com emoji
    this.excludePaths = [".bisc/util", "node_modules", ".git"];
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    this.stats = {
      linhasAdicionadas: 0, linhasRemovidas: 0,
      pastasAdicionadas: 0, pastasRemovidas: 0,
      arquivosAdicionados: 0, arquivosRemovidos: 0,
      alteracoesRecentes: [], hashes: [], diffsDetalhados: [],
    };
  }

  /*========== [ Utilidades de Log e Progresso ] ==========*/
  logPasso(msg) { console.log(`➡️  ${msg}`); }
  barraProgresso(atual, total) {
    const p = Math.floor((atual / total) * 100), b = Math.floor(p / 5);
    const progresso = `[${"█".repeat(b)}${" ".repeat(20 - b)}] ${p}%`;
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(progresso);
  }

  /*========== [ Notificação Toast no Android ] ==========*/
  showToast(message) {
    try {
      execSync(`termux-toast -g bottom -b black -c green "${message}"`);
    } catch (err) {
      console.warn("⚠️  Não foi possível enviar toast.");
    }
  }

  /*========== [ Métodos Auxiliares ] ==========*/
  isExcluded(filePath) {
    return this.excludePaths.some(ex => filePath.includes(path.normalize(ex)));
  }
  getFileHash(filePath) {
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  }

  /*========== [ Backup: Copiar Diretório ] ==========*/
  

copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  this.logPasso("Copiando arquivos...");
  let atual = 0;

  for (const entry of entries) {
    atual++;
    this.barraProgresso(atual, entries.length);

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === "❌clone" || this.isExcluded(srcPath)) continue;

    if (entry.isDirectory()) {
      // Certifique-se de que o diretório clone será copiado para o novo diretório correto
      if (entry.name === '❌clone') {
        const newDest = path.join(dest, '❌clone');
        fs.mkdirSync(newDest, { recursive: true });
        this.copyDir(srcPath, newDest);
      } else {
        fs.mkdirSync(destPath, { recursive: true });
        this.copyDir(srcPath, destPath);
      }
    } else {
      if (!fs.existsSync(srcPath)) {
        console.warn(`⚠️  Arquivo não encontrado (ignorando): ${srcPath}`);
        continue;
      }
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch (err) {
        console.warn(`❗ Erro ao copiar ${srcPath} (${err.code})`);
      }
    }
  }
  process.stdout.write("\n");
}

  
  
  

  /*========== [ Backup: Esvaziar Diretório ] ==========*/
 emptyDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir).filter(e => e !== "❌clone");  // Excluindo o clone com emoji
  this.logPasso("Esvaziando diretório...");
  let atual = 0;

  for (const entry of entries) {
    atual++;
    this.barraProgresso(atual, entries.length);
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
  process.stdout.write("\n");
}

  /*========== [ Backup: Salvar Projeto ] ==========*/
save() {
  this.emptyDir(path.join(this.projectDir, "❌clone")); 
  this.copyDir(this.projectDir, this.backupDir);
  console.log(`\n✅ Backup salvo em ${this.projectDir}`);
  this.showToast("Backup concluído!");
  this.rl.close();
}

  /*========== [ Backup: Recuperar Projeto ] ==========*/
recover() {
  if (!fs.existsSync(this.backupDir)) {
    console.error("Nenhum backup encontrado.");
    process.exit(1);
  }
  this.logPasso("Removendo arquivos antigos...");
  const entries = fs.readdirSync(this.projectDir);
  let atual = 0;

  for (const e of entries) {
    if (e === "❌clone" || this.isExcluded(e)) continue;
    atual++;
    this.barraProgresso(atual, entries.length);
    fs.rmSync(path.join(this.projectDir, e), { recursive: true, force: true });
  }
  process.stdout.write("\n");
  this.copyDir(this.backupDir, this.projectDir);
  console.log("\n✅ Projeto restaurado a partir do backup.");
  this.showToast("Recuperação concluída!");
  this.rl.close();
}

  /*========== [ Compare: Interpretar diff ] ==========*/
  parseDiff(diff) {
    const lines = diff.split("\n");
    let currentFile = null, trecho = [];

    for (const line of lines) {
      if (line.startsWith("diff ")) {
        if (currentFile && trecho.length) this.stats.diffsDetalhados.push({ file: currentFile, trecho });
        currentFile = line.split(" ")[2]?.replace("a/", "");
        trecho = this.isExcluded(currentFile) ? [] : [];
        continue;
      }
      if (!currentFile) continue;
      if (line.startsWith("@@") || line.startsWith("+") || line.startsWith("-")) {
        if (!line.includes('prefixo')) trecho.push(line);
        if (line.startsWith("+")) this.stats.linhasAdicionadas++;
        if (line.startsWith("-")) this.stats.linhasRemovidas++;
      }
    }
    if (currentFile && trecho.length) this.stats.diffsDetalhados.push({ file: currentFile, trecho });
  }

  /*========== [ Compare: Listar Diferenças ] ==========*/
  listChanges(dir1, dir2) {
    const output = [];
    const stack = [{ d1: dir1, d2: dir2 }];
    let total = 0;

    while (stack.length) {
      const { d1, d2 } = stack.pop();
      const items1 = fs.existsSync(d1) ? fs.readdirSync(d1) : [];
      const items2 = fs.existsSync(d2) ? fs.readdirSync(d2) : [];
      const allItems = new Set([...items1, ...items2]);
      total += allItems.size;
      for (const item of allItems) {
        const p1 = path.join(d1, item);
        const p2 = path.join(d2, item);
        if (this.isExcluded(p1) || this.isExcluded(p2)) continue;
        if (fs.existsSync(p1) && fs.statSync(p1).isDirectory()) stack.push({ d1: p1, d2: p2 });
        if (fs.existsSync(p2) && fs.statSync(p2).isDirectory()) stack.push({ d1: p1, d2: p2 });
      }
    }

    this.logPasso("Comparando arquivos...");
    let atual = 0;
    const walk = (d1, d2) => {
      const items1 = fs.existsSync(d1) ? fs.readdirSync(d1) : [];
      const items2 = fs.existsSync(d2) ? fs.readdirSync(d2) : [];
      const allItems = new Set([...items1, ...items2]);

      for (const item of allItems) {
        atual++;
        this.barraProgresso(atual, total);
        const p1 = path.join(d1, item), p2 = path.join(d2, item);
        const exists1 = fs.existsSync(p1), exists2 = fs.existsSync(p2);

        if (this.isExcluded(p1) || this.isExcluded(p2)) continue; 
        if (!exists1 && exists2) {
          output.push(`- Arquivo adicionado: \`${p2}\``);
          this.stats.arquivosAdicionados++;
        } else if (exists1 && !exists2) {
          output.push(`- Arquivo removido: \`${p1}\``);
          this.stats.arquivosRemovidos++;
        }
        else {
          const stat1 = fs.statSync(p1), stat2 = fs.statSync(p2);
          if (stat1.isDirectory() && stat2.isDirectory()) walk(p1, p2);
          else if (stat1.isFile() && stat2.isFile() && this.getFileHash(p1) !== this.getFileHash(p2)) {
            this.stats.hashes.push({ arquivo: p1, hashAntigo: this.getFileHash(p1), hashNovo: this.getFileHash(p2) });
          }
        }
      }
    };
    walk(dir1, dir2);
    process.stdout.write("\n");
    return output;
  }

  /*========== [ Compare: Gerar compare.md ] ==========*/
 compare() {
    if (!fs.existsSync(this.backupDir)) {
      console.error("Nenhum backup encontrado.");
      process.exit(1);
    }

const outputPath = path.join(this.projectDir, "util", "compare.md");
const packageJsonPath = path.join(this.projectDir, 'package.json');
const version = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
let markdown = `# Novo update! (versão ${version}) \n\n`;
    this.logPasso("Calculando diferenças...");

    try {
      this.parseDiff(execSync(`diff -ur --exclude=node_modules --exclude=.git --exclude=backup.js --exclude=compare.md --exclude=package-lock.json --exclude=package.json --exclude=run.js "${this.backupDir}" "${this.projectDir}"`, { encoding: "utf8" }));
    } catch (e) {
      if (e.stdout) this.parseDiff(e.stdout);
    }

    let changes = this.listChanges(this.backupDir, this.projectDir).filter(line => {
      const file = line.match(/`([^`]*)`/)?.[1];
      if (!file) return true;

      const ignorarArquivos = [
        "clone/.bisc/compare.md",
        ".env",
        "clone",
        ".bisc/util/backup.js",
        "compare.md",
        "package-lock.json",
        "package.json",
        "run.js"
      ];
    
      return !ignorarArquivos.some(ignore => file.endsWith(ignore) || file.includes(`/${ignore}`));
    });

    if (!changes.length) markdown += "Nenhuma diferença detectada.\n";
    else markdown += "## Alterações Detectadas\n" + changes.join("\n") + "\n";

    markdown += "\n---\n\n## Resumo Estatístico\n";
    markdown += `- Linhas adicionadas: ${Math.max(0, this.stats.linhasAdicionadas)}\n`;
    markdown += `- Linhas removidas: ${Math.max(0, this.stats.linhasRemovidas)}\n`;
    markdown += `- Pastas adicionadas: ${Math.max(0, this.stats.pastasAdicionadas)}\n`;
    markdown += `- Pastas removidas: ${Math.max(0, this.stats.pastasRemovidas)}\n`;
    markdown += `- Arquivos adicionados: ${Math.max(0, this.stats.arquivosAdicionados - 1)}\n`;
    markdown += `- Arquivos removidos: ${Math.max(0, this.stats.arquivosRemovidos)}\n`;

    if (this.stats.hashes.length) {
      markdown += "\n---\n\n## Análise de Integridade\n";
      for (const { arquivo, hashAntigo, hashNovo } of this.stats.hashes) {
        markdown += `- ${arquivo.replace(this.projectDir + "/", "")} mudou de \`${hashAntigo.slice(0,8)}...\` para \`${hashNovo.slice(0,8)}...\`\n`;
      }
    }

    if (this.stats.diffsDetalhados.length) {
      markdown += "\n---\n\n## Análise Detalhada de Código\n";
      for (const { file, trecho } of this.stats.diffsDetalhados) {
        // Adicionando o número da linha em cada modificação
        const linesWithNumbers = trecho.map((line, index) => {
          // O número da linha será index + 1 (porque index começa de 0)
          const lineNumber = index + 1;
          return `L${lineNumber}: ${line}`;
        });

        markdown += `\n\`\`\`${path.extname(file).slice(1)}\n// nas linhas, de ${file}:\n${linesWithNumbers.join("\n")}\n\`\`\`\n`;
      }
    }
// Adicione antes de fs.writeFileSync:
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdown);
    console.log("\n✅ Relatório gerado: " + outputPath);
    this.showToast("Comparação concluída!");
    this.rl.close();
  }

  /*========== [ Menu Interativo ] ==========*/
  promptAction() {
    this.rl.question('Escolha uma ação: "recuperar", "salvar" ou "comparar": ', (ans) => {
      const choice = ans.trim().toLowerCase();
      if (choice === "recuperar") this.recover();
      else if (choice === "salvar") this.save();
      else if (choice === "comparar") this.compare();
      else {
        console.log("Opção inválida.");
        this.promptAction();
      }
    });
  }

  /*========== [ Inicialização ] ==========*/
  run() {
    if (!fs.existsSync(this.backupDir)) {
      console.log("Nenhum clone encontrado — criando primeiro backup…");
      this.copyDir(this.projectDir, this.backupDir);
      console.log(`\n✅ Backup inicial criado em ${this.projectDir}`);
      this.showToast("Backup inicial feito!");
      process.exit(0);
    }
    this.promptAction();
  }
}

/*========== [ Execução ] ==========*/
new BackupManager().run();
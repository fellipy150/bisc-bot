import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ./blessed.json from 'blessed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- CONFIGURAÇÕES E CONSTANTES ---
let selectedFiles = [];
let currentDir = '';
let searchBuffer = '';
const IGNORED_FOLDERS = ['node_modules', '.git', '.idea', '.vscode', 'build', 'dist', '.npm', '__pycache__'];
const DEPENDENCY_FILES = ['package.json', 'requirements.txt', 'pyproject.toml', 'composer.json', 'Gemfile', 'go.mod'];

function directoryExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
}

// --- FUNÇÕES DE ANÁLISE (MÉTRICAS) ---

/**
 * Conta linhas de código (LOC) ignorando linhas vazias e comentários.
 * Suporta estilos comuns
 */
function countCleanLoc(content, ext) {
  let lines = content.split('\n').map(l => l.trim());
  let count = 0;
  let inBlockComment = false;

  for (let line of lines) {
    if (!line) continue;

    // Lógica para blocos de comentário (JS, CSS, Java, etc)
    if (ext === '.js' || ext === '.ts' || ext === '.css' || ext === '.java') {
      if (!inBlockComment && line.startsWith('/*')) {
        inBlockComment = !line.includes('*/');
        continue;
      }
      if (inBlockComment) {
        if (line.includes('*/')) inBlockComment = false;
        continue;
      }
      if (line.startsWith('//')) continue;
    }

    // Lógica para Python (# e Docstrings)
    if (ext === '.py') {
      if (line.startsWith('#')) continue;
      if (!inBlockComment && (line.startsWith('"""') || line.startsWith("'''"))) {
        // Se a docstring abre e fecha na mesma linha
        const quotes = line.startsWith('"""') ? '"""' : "'''";
        if (line.length > 3 && line.endsWith(quotes)) continue;
        inBlockComment = true;
        continue;
      }
      if (inBlockComment) {
        if (line.endsWith('"""') || line.endsWith("'''")) inBlockComment = false;
        continue;
      }
    }

    // Comentários genéricos de script (#)
    if ((ext === '.sh' || ext === '.yaml' || ext === '.yml') && line.startsWith('#')) continue;

    count++;
  }
  return count;
}

function getProjectMetrics() {
  let metrics = {
    name: path.basename(currentDir),
    totalFiles: selectedFiles.length,
    languages: {},
    totalLoc: 0
  };

  // Tenta extrair nome do package.json
  const pkgPath = path.join(currentDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) metrics.name = pkg.name;
    } catch (e) {}
  }

  selectedFiles.forEach(f => {
    const ext = path.extname(f).toLowerCase() || '.no-ext';
    metrics.languages[ext] = (metrics.languages[ext] || 0) + 1;

    try {
      const content = fs.readFileSync(f, 'utf8');
      metrics.totalLoc += countCleanLoc(content, ext);
    } catch (e) {}
  });

  return metrics;
}

// --- FUNCOES PARA GERAR A ARVORE DO PROJETO ---

function buildTree(dir) {
  const name = path.basename(dir);
  const node = { name, path: dir, isDirectory: true, children: [] };

  try {
    const items = fs.readdirSync(dir).sort((a, b) => a.localeCompare(b));
    for (const item of items) {
      if (IGNORED_FOLDERS.includes(item)) continue; 
      const itemPath = path.join(dir, item);
      try {
        const stats = fs.statSync(itemPath);
        if (stats.isDirectory()) {
          node.children.push(buildTree(itemPath));
        } else {
          node.children.push({ name: item, path: itemPath, isDirectory: false });
        }
      } catch (e) {}
    }
  } catch (e) {}
  return node;
}

const generateLlmTokenSaver = (n, l = [], d = 0) => {
  const r = '  '.repeat(d);
  const c = n.children || [];
  let files = [];
  let dirs = [];
  for (const x of c) { x.isDirectory ? dirs.push(x) : files.push(x.name); }
  l.push(r + n.name + '/' + (files.length ? ' ' + files.join(', ') : ''));
  for (const dir of dirs) { generateLlmTokenSaver(dir, l, d + 1); }
  return d ? l : l.join('\n');
}

// --- BUSCA RECURSIVA ---

function findAllFilesRecursively(dir) {
  let results = [];
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          if (!IGNORED_FOLDERS.includes(file)) results = results.concat(findAllFilesRecursively(filePath));
        } else {
          results.push(filePath);
        }
      } catch (err) {}
    }
  } catch (err) {}
  return results;
}

function findFilesRecursively(dir, fileName) {
  let results = [];
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          if (!IGNORED_FOLDERS.includes(file)) results = results.concat(findFilesRecursively(filePath, fileName));
        } else {
          const base = path.basename(file, path.extname(file));
          if (file === fileName || base === fileName || path.basename(file) === fileName) {
            results.push(filePath);
          }
        }
      } catch (e) {}
    }
  } catch (err) {}
  return results;
}

// --- INTERFACE VISUAL (BLESSED) ---

const screen = blessed.screen({ smartCSR: true, title: 'Organizador de Arquivos', fullUnicode: true });
const container = blessed.box({ parent: screen, width: '100%', height: '100%' });

const dirView = blessed.box({
  parent: container, width: 60, height: 9, top: 'center', left: 'center',
  border: { type: 'line' }, label: ' [ Fase 1: Diretorio ] '
});
blessed.text({ parent: dirView, top: 1, left: 2, content: 'Digite o caminho e aperte ENTER:' });
const dirDisplay = blessed.box({ parent: dirView, top: 3, left: 2, right: 2, height: 3, border: { type: 'line' }, content: '_' });

const managerView = blessed.box({ parent: container, hidden: true });
const selectedFileList = blessed.list({
  parent: managerView, top: 0, bottom: 10, width: '100%', border: { type: 'line' }, label: ' [ Arquivos Selecionados ] ',
  keys: false, mouse: true, interactive: true, style: { item: { fg: 'cyan' }, selected: { bg: 'blue', fg: 'white', bold: true } }
});
const searchArea = blessed.box({ parent: managerView, bottom: 0, height: 10, width: '100%', border: { type: 'line' }, label: ' [ Fase 2: Buscar Arquivo ] ' });
const searchDisplay = blessed.box({ parent: searchArea, top: 1, left: 2, right: 2, height: 3, border: { type: 'line' }, style: { border: { fg: 'green' } }, content: '_' });

const choiceModal = blessed.list({
  parent: container, top: 'center', left: 'center', width: '80%', height: '60%', border: { type: 'line', fg: 'cyan' }, label: ' [ Varios encontrados ] ',
  hidden: true, keys: true, interactive: true, style: { selected: { bg: 'blue', fg: 'white', bold: true } }
});

const sortList = blessed.list({
  parent: container, top: 'center', left: 'center', width: 50, height: 10, border: { type: 'line', fg: 'yellow' }, label: ' [ Fase 3: Ordenar ] ',
  hidden: true, keys: true, interactive: true, style: { selected: { bg: 'blue', fg: 'white', bold: true } }
});
sortList.setItems(['Nome (A-Z)', 'Data de Edicao', 'Tamanho', 'Tipo', 'Caminho', 'VOLTAR']);

// --- CONTROLE DE EVENTOS ---

let currentPhase = 'DIR';

screen.on('keypress', (ch, key) => {
  if (key.full === 'C-c') process.exit(0);

  if (currentPhase === 'DIR') {
    if (key.name === 'enter') submitDir();
    else if (key.name === 'backspace') searchBuffer = searchBuffer.slice(0, -1);
    else if (isValidChar(ch, key)) searchBuffer += ch;
    dirDisplay.setContent(searchBuffer + '_');
    screen.render();
  } else if (currentPhase === 'MANAGER') {
    if (key.name === 'up') selectedFileList.up();
    else if (key.name === 'down') selectedFileList.down();
    else if (key.full === 'C-a') handleToggleAll();
    else if (key.full === 'C-s') handleGoToSort();
    else if (key.name === 'enter') handleExecuteSearch();
    else if (key.name === 'backspace') searchBuffer = searchBuffer.slice(0, -1);
    else if (isValidChar(ch, key)) searchBuffer += ch;
    searchDisplay.setContent(searchBuffer + '_');
    screen.render();
  }
});

function isValidChar(ch, key) {
  return ch && typeof ch === 'string' && !key.ctrl && !key.meta && ch.length === 1;
}

function submitDir() {
  let val = searchBuffer.trim();
  if (val.toLowerCase() === 'bisc') val = '/data/data/com.termux/files/home/bisc-bot';
  if (val.startsWith('~')) val = val.replace('~', process.env.HOME || '/data/data/com.termux/files/home');

  if (directoryExists(val)) {
    currentDir = val;
    searchBuffer = '';
    currentPhase = 'MANAGER';
    dirView.hide();
    managerView.show();
    updateList();
    selectedFileList.focus();
  } else {
    searchBuffer = '';
    dirDisplay.setContent('Caminho Inválido!_');
    screen.render();
  }
}

function updateList() {
  const items = selectedFiles.map(f => {
    const rel = path.relative(currentDir, f);
    return `${path.basename(f)} [${path.basename(currentDir)}/${rel}]`;
  });
  selectedFileList.setItems(items);
  screen.render();
}

function handleToggleAll() {
  selectedFiles = selectedFiles.length > 0 ? [] : findAllFilesRecursively(currentDir);
  updateList();
}

function handleExecuteSearch() {
  const term = searchBuffer.trim();
  if (!term) return;
  if (term === '*' || term.toLowerCase() === 'all') { handleToggleAll(); searchBuffer = ''; return; }
  const found = findFilesRecursively(currentDir, term);
  searchBuffer = '';
  if (found.length === 1) toggleSelection(found[0]);
  else if (found.length > 1) {
    currentPhase = 'CHOICE';
    choiceModal.setItems(found);
    choiceModal.show();
    choiceModal.focus();
  }
  screen.render();
}

function toggleSelection(p) {
  const idx = selectedFiles.indexOf(p);
  if (idx > -1) selectedFiles.splice(idx, 1);
  else selectedFiles.push(p);
  updateList();
}

function handleGoToSort() {
  if (selectedFiles.length === 0) return;
  currentPhase = 'SORT';
  managerView.hide();
  sortList.show();
  sortList.focus();
  screen.render();
}

choiceModal.on('select', (item) => {
  toggleSelection(item.getText());
  choiceModal.hide();
  currentPhase = 'MANAGER';
  selectedFileList.focus();
  screen.render();
});

sortList.on('select', (item, index) => {
  if (index === 5) { sortList.hide(); managerView.show(); currentPhase = 'MANAGER'; return; }
  if (index === 0) selectedFiles.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  if (index === 1) selectedFiles.sort((a, b) => fs.statSync(a).mtime.getTime() - fs.statSync(b).mtime.getTime());
  if (index === 2) selectedFiles.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
  if (index === 3) selectedFiles.sort((a, b) => path.extname(a).localeCompare(path.extname(b)));
  if (index === 4) selectedFiles.sort((a, b) => a.length - b.length);
  finishAndSave();
});

// --- GERAÇÃO FINAL DO ARQUIVO ---

function finishAndSave() {
  screen.destroy();
  console.log('Analisando projeto e gerando relatório...');

  const metrics = getProjectMetrics();
  const rootName = path.basename(currentDir);

  // 1. Dashboard de Metadados
  let md = `# Relatório do Projeto: ${metrics.name}\n`;
  md += `Gerado em: ${new Date().toLocaleString()}\n\n`;
  
  md += `### 📊 Estatísticas do Projeto\n`;
  md += `- **Total de Arquivos Selecionados:** ${metrics.totalFiles}\n`;
  md += `- **Linhas de Código (LOC Limpo):** ${metrics.totalLoc}\n`;
  md += `- **Distribuição de Linguagens:**\n`;
  
  Object.entries(metrics.languages)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ext, count]) => {
      const pct = ((count / metrics.totalFiles) * 100).toFixed(1);
      md += `  - \`${ext}\`: ${pct}% (${count} arquivos)\n`;
    });
  md += `\n---\n\n`;

  // 2. Estrutura de Diretórios (Token Saver)
  md += `## 📂 Estrutura do Projeto\n\`\`\`text\n`;
  const tree = buildTree(currentDir);
  md += generateLlmTokenSaver(tree);
  md += `\n\`\`\`\n\n---\n\n`;

  // 3. Conteúdo dos Arquivos (Priorizando Dependências)
  md += `## 📄 Conteúdo dos Arquivos\n\n`;

  // Ordena os arquivos: Dependências primeiro, depois o resto
  const sortedFiles = [...selectedFiles].sort((a, b) => {
    const isADep = DEPENDENCY_FILES.includes(path.basename(a));
    const isBDep = DEPENDENCY_FILES.includes(path.basename(b));
    if (isADep && !isBDep) return -1;
    if (!isADep && isBDep) return 1;
    return 0;
  });

  for (const f of sortedFiles) {
    const relPath = path.relative(currentDir, f);
    const displayPath = `${rootName}/${relPath}`;
    const ext = path.extname(f).slice(1) || 'text';

    md += `### Caminho: ${displayPath}\n`;
    
    try {
      const stats = fs.statSync(f);
      if (stats.size > 500000) { // 500KB limit
        md += `> [Arquivo muito grande para visualização direta]\n\n`;
      } else {
        const content = fs.readFileSync(f, 'utf8');
        md += `\`\`\`${ext}\n${content}\n\`\`\`\n`;
      }
    } catch (e) {
      md += `> [Erro ao ler arquivo: ${e.message}]\n\n`;
    }
    md += `\n---\n\n`;
  }

  const filename = `projeto_${Date.now()}.md`;
  fs.writeFileSync(filename, md);
  console.log(`✅ Relatório gerado com sucesso: ${filename}`);
  process.exit(0);
}

screen.render();


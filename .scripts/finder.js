import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ./blessed.json from 'blessed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- LOGICA DE BUSCA ---
let selectedFiles = [];
let currentDir = '';
let searchBuffer = '';
const IGNORED_FOLDERS = ['node_modules', '.git', '.idea', '.vscode', 'build', 'dist'];

function directoryExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
}

function findAllFilesRecursively(dir) {
  let results = [];
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          if (IGNORED_FOLDERS.includes(file)) results.push(filePath);
          else results = results.concat(findAllFilesRecursively(filePath));
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
          if (IGNORED_FOLDERS.includes(file)) {
            if (file === fileName || file.includes(fileName)) results.push(filePath);
          } else {
            results = results.concat(findFilesRecursively(filePath, fileName));
          }
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

// --- INTERFACE VISUAL ---
const screen = blessed.screen({
  smartCSR: true,
  title: 'Organizador de Arquivos',
  fullUnicode: true,
  warnings: false
});

const container = blessed.box({ parent: screen, width: '100%', height: '100%' });

// 1. TELA DE DIRETORIO (Fase 1)
const dirView = blessed.box({
  parent: container,
  width: 60, height: 9,
  top: 'center', left: 'center',
  border: { type: 'line' },
  label: ' [ Fase 1: Diretorio ] '
});

blessed.text({ parent: dirView, top: 1, left: 2, content: 'Digite o caminho e aperte ENTER:' });

const dirDisplay = blessed.box({
  parent: dirView, top: 3, left: 2, right: 2, height: 3,
  border: { type: 'line' },
  style: { border: { fg: 'cyan' } },
  content: '_'
});

// 2. TELA DO GERENCIADOR (Fase 2)
const managerView = blessed.box({ parent: container, hidden: true });

// LISTA PRINCIPAL
const selectedFileList = blessed.list({
  parent: managerView,
  top: 0, 
  bottom: 10,
  width: '100%',
  border: { type: 'line' },
  label: ' [ Arquivos Selecionados ] ',
  
  // CONFIGURAÇÃO CRÍTICA CORRIGIDA:
  keys: false,        // NÃO cria listeners de teclado automáticos (evita bloqueio)
  mouse: true,        // Permite mouse se disponível
  interactive: true,  // ATIVADO: Permite que o blessed desenhe a barra de seleção
  
  invertSelected: false, // Garante que usaremos nossas cores explícitas
  
  style: { 
    // Item Normal
    item: { 
      fg: 'cyan' 
    },
    // Item Selecionado (Fundo Azul, Texto Branco)
    selected: { 
      bg: 'blue', 
      fg: 'white', 
      bold: true 
    } 
  },
  scrollbar: { ch: ' ', track: { bg: 'grey' }, style: { bg: 'white' } }
});

const searchArea = blessed.box({
  parent: managerView,
  bottom: 0, 
  height: 10, 
  width: '100%',
  border: { type: 'line' },
  label: ' [ Fase 2: Buscar Arquivo ] '
});

const searchDisplay = blessed.box({
  parent: searchArea,
  top: 1, left: 2, right: 2, height: 3,
  border: { type: 'line' },
  style: { border: { fg: 'green' } },
  content: '_'
});

const instructions = blessed.text({
  parent: searchArea,
  top: 5, left: 2,
  content: 'SETAS: Rolar Lista | CTRL+A: Selecionar Tudo | CTRL+S: Salvar | ENTER: Buscar'
});

// 3. MODAL DE ESCOLHA (Fase 3)
const choiceModal = blessed.list({
  parent: container,
  top: 'center', left: 'center',
  width: '80%', height: '60%',
  border: { type: 'line', fg: 'cyan' },
  label: ' [ Varios encontrados - Use as setas e ENTER ] ',
  hidden: true,
  keys: true, 
  interactive: true,
  style: { 
    selected: { bg: 'blue', fg: 'white', bold: true }, 
    item: { fg: 'white' },
    border: { fg: 'cyan' }
  }
});

// 4. MENU DE ORDENACAO (Fase 4)
const sortList = blessed.list({
  parent: container,
  top: 'center', left: 'center',
  width: 50, height: 10,
  border: { type: 'line', fg: 'yellow' },
  label: ' [ Fase 3: Escolher Ordem ] ',
  hidden: true,
  keys: true,
  interactive: true,
  style: { 
    selected: { bg: 'blue', fg: 'white', bold: true },
    item: { fg: 'white' }
  }
});
sortList.setItems([
  'Nome (A-Z)',
  'Data de Edicao',
  'Tamanho (Maior)',
  'Tipo de Arquivo',
  'Tamanho do Caminho',
  'VOLTAR'
]);

// --- SISTEMA DE CONTROLE ASSINCRONO ---

let currentPhase = 'DIR'; // DIR, MANAGER, CHOICE, SORT

screen.on('keypress', (ch, key) => {
  if (key.full === 'C-c') process.exit(0);

  // FASE 1: DIRETORIO
  if (currentPhase === 'DIR') {
    if (key.name === 'enter') {
      submitDir();
    } else if (key.name === 'backspace') {
      searchBuffer = searchBuffer.slice(0, -1);
    } else if (isValidChar(ch, key)) {
      searchBuffer += ch;
    }
    dirDisplay.setContent(searchBuffer + '_');
    screen.render();
    return;
  }

  // FASE 2: GERENCIADOR
  if (currentPhase === 'MANAGER') {
    // 1. Navegação
    if (key.name === 'up') {
      selectedFileList.up();
      screen.render();
      return;
    }
    if (key.name === 'down') {
      selectedFileList.down();
      screen.render();
      return;
    }

    // 2. Atalhos
    if (key.full === 'C-a') {
      handleToggleAll();
      return;
    }
    if (key.full === 'C-s') {
      handleGoToSort();
      return;
    }

    // 3. Digitação
    if (key.name === 'enter') {
      handleExecuteSearch();
    } else if (key.name === 'backspace') {
      searchBuffer = searchBuffer.slice(0, -1);
    } else if (isValidChar(ch, key)) {
      searchBuffer += ch;
    }

    searchDisplay.setContent(searchBuffer + '_');
    screen.render();
    return;
  }
});

function isValidChar(ch, key) {
  if (key.ctrl || key.meta) return false;
  if (['return', 'enter', 'tab', 'escape', 'backspace', 'up', 'down', 'left', 'right'].includes(key.name)) return false;
  return (ch && typeof ch === 'string' && ch.length > 0);
}

// --- LOGICA DE PROGRAMA ---

function submitDir() {
  let val = searchBuffer.trim();
  if (val.toLowerCase() === 'bisc') val = '/data/data/com.termux/files/home/bisc-bot';
  if (val.startsWith('~')) val = val.replace('~', '/data/data/com.termux/files/home');

  if (directoryExists(val)) {
    currentDir = val;
    searchBuffer = '';
    currentPhase = 'MANAGER';
    
    dirView.hide();
    managerView.show();
    
    screen.render(); 
    updateList();
    // Forçar foco na lista para garantir renderização de estilo, 
    // mesmo que controle seja manual
    selectedFileList.focus(); 
  } else {
    searchBuffer = '';
    dirView.setLabel(' [ ERRO: Diretorio Invalido ] ');
    dirDisplay.setContent('_');
    screen.render();
    setTimeout(() => {
      dirView.setLabel(' [ Fase 1: Diretorio ] ');
      screen.render();
    }, 1500);
  }
}

function updateList() {
  const items = selectedFiles.map(f => `${path.basename(f)} (${f})`);
  selectedFileList.setItems(items);
  if (items.length > 0) selectedFileList.select(items.length - 1);
  screen.render();
}

function handleToggleAll() {
  if (selectedFiles.length > 0) {
    selectedFiles = [];
  } else if (currentDir) {
    selectedFiles = findAllFilesRecursively(currentDir);
  }
  updateList();
}

function handleExecuteSearch() {
  const term = searchBuffer.trim();
  
  if (term === '*' || term.toLowerCase() === 'all') {
    handleToggleAll();
    searchBuffer = '';
    searchDisplay.setContent('_');
    screen.render();
    return;
  }

  if (!term) return;

  const found = findFilesRecursively(currentDir, term);
  searchBuffer = '';
  searchDisplay.setContent('_');

  if (found.length === 1) {
    toggleSelection(found[0]);
  } else if (found.length > 1) {
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

// --- EVENTOS MODAIS ---

choiceModal.on('select', (item) => {
  toggleSelection(item.getText());
  choiceModal.hide();
  currentPhase = 'MANAGER';
  selectedFileList.focus(); // Retorna foco visual para a lista
  searchDisplay.setContent(searchBuffer + '_');
  screen.render();
});

choiceModal.key('escape', () => {
  choiceModal.hide();
  currentPhase = 'MANAGER';
  selectedFileList.focus();
  screen.render();
});

sortList.on('select', (item, index) => {
  if (index === 5) {
    sortList.hide();
    managerView.show();
    currentPhase = 'MANAGER';
    selectedFileList.focus();
    screen.render();
    return;
  }

  if (index === 0) selectedFiles.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  if (index === 1) selectedFiles.sort((a, b) => fs.statSync(a).mtime.getTime() - fs.statSync(b).mtime.getTime());
  if (index === 2) selectedFiles.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
  if (index === 3) selectedFiles.sort((a, b) => path.extname(a).localeCompare(path.extname(b)));
  if (index === 4) selectedFiles.sort((a, b) => a.length - b.length);

  finishAndSave();
});

sortList.key('escape', () => {
  sortList.hide();
  managerView.show();
  currentPhase = 'MANAGER';
  selectedFileList.focus();
  screen.render();
});

// --- GERACAO DO ARQUIVO ---

function finishAndSave() {
  screen.destroy();
  console.log('Gerando documento markdown final...');

  let md = `# Relatorio de Projeto\nGerado: ${new Date().toLocaleString()}\n\n`;

  for (const f of selectedFiles) {
    try {
      const stats = fs.statSync(f);
      const isSensitive = f.includes('.git') || f.endsWith('.env') || stats.isDirectory();
      let content = "";

      if (isSensitive) {
        content = `[CONTEUDO OCULTO OU PASTA]`;
      } else {
        content = fs.readFileSync(f, 'utf8');
      }

      md += `### ${path.basename(f)}\nCaminho: ${f}\n\n`;
      md += isSensitive ? `${content}\n` : `\`\`\`\n${content}\n\`\`\`\n`;
      md += `---\n\n`;
    } catch (e) {
      md += `### Erro em ${f}: ${e.message}\n---\n\n`;
    }
  }

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const date = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
  const out = `projeto_${time}_${date}.md`;

  fs.writeFileSync(path.join(process.cwd(), out), md);
  console.log(`Sucesso! Arquivo salvo em: ${out}`);
  process.exit(0);
}

screen.render();



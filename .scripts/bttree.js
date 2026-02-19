#!/usr/bin/env node

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { exec } from 'child_process';
import os from 'os';
import blessed from 'blessed';

// =======================
// CONFIGURAÇÃO VISUAL
// =======================
const COLORS = {
    DIR: '{blue-fg}',
    DIR_OPEN: '{blue-fg}{bold}',
    FILE: '{white-fg}',
    SELECTED: '{black-fg}{cyan-bg}',
    ERROR: '{red-fg}',
    SUCCESS: '{green-fg}',
    GRAY: '{gray-fg}'
};

const UI_ICONS = {
    LOCK: '🔒',
    OPEN: '[-]',
    CLOSED: '[+]',
    BRANCH: '├── ',
    LAST_BRANCH: '└── ',
    VERTICAL: '│   ',
    SPACER: '    ',
    DIR: '📂',
    FILE: '📄'
};

// =======================
// ESTADO GLOBAL
// =======================
let directoryTree = {};
let expandedPaths = new Set();
let visibleNodesMap = []; 
let lastPath = process.cwd();

// =======================
// UI SETUP (BLESSED)
// =======================
const screen = blessed.screen({
    smartCSR: true,
    title: 'Tree Generator Pro',
    fullUnicode: true
});

const layout = blessed.layout({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
});

const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' {bold}TREE GENERATOR{/bold} | {gray-fg}Setas: Navegar | Enter: Expandir | S: Estilos | Q: Sair{/}',
    tags: true,
    style: { bg: 'blue' }
});

const treeList = blessed.list({
    parent: screen,
    top: 1,
    left: 0,
    width: '100%',
    height: '100%-2',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
        selected: { bg: 'cyan', fg: 'black', bold: true },
        item: { fg: 'white' }
    },
    scrollbar: { ch: ' ', track: { bg: 'grey' }, style: { inverse: true } }
});

const statusBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' Inicializando...',
    tags: true,
    style: { bg: 'gray' }
});

// =======================
// LÓGICA DE ÁRVORE
// =======================
async function buildDirectoryTree(currentPath) {
    const node = {
        path: currentPath,
        name: path.basename(currentPath),
        children: [],
        isDirectory: true,
        hasAccess: true,
        loaded: false
    };
    await loadDirectoryNode(node);
    return node;
}

async function loadDirectoryNode(node) {
    if (node.loaded || !node.isDirectory) return;
    try {
        const items = await fs.readdir(node.path, { withFileTypes: true });
        const sortedItems = sortFileSystemItems(items);
        node.children = sortedItems.map(item => {
            if (shouldIgnoreItem(item.name)) return null;
            return {
                path: path.join(node.path, item.name),
                name: item.name,
                isDirectory: item.isDirectory(),
                hasAccess: true,
                loaded: false,
                children: item.isDirectory() ? [] : null
            };
        }).filter(Boolean);
        node.loaded = true;
    } catch (error) {
        node.hasAccess = false;
        node.loaded = true;
    }
}

function sortFileSystemItems(items) {
    return items.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });
}

function shouldIgnoreItem(name) {
    return ['.git', 'node_modules', '.DS_Store', '.npm'].includes(name);
}

// =======================
// RENDERIZAÇÃO
// =======================
function updateTreeView() {
    visibleNodesMap = [];
    const lines = [];

    function traverse(node, prefix, isLast) {
        visibleNodesMap.push(node);
        const isExpanded = expandedPaths.has(node.path);
        const connector = isLast ? UI_ICONS.LAST_BRANCH : UI_ICONS.BRANCH;
        
        let icon = '';
        let style = COLORS.FILE;
        if (node.isDirectory) {
            if (!node.hasAccess) {
                icon = `${UI_ICONS.LOCK} `; style = '{red-fg}';
            } else {
                icon = isExpanded ? `${UI_ICONS.OPEN} ` : `${UI_ICONS.CLOSED} `;
                style = isExpanded ? COLORS.DIR_OPEN : COLORS.DIR;
            }
        }

        lines.push(`${prefix}${connector}${style}${icon}${node.name}{/}`);

        if (isExpanded && node.isDirectory && node.hasAccess) {
            const childPrefix = prefix + (isLast ? UI_ICONS.SPACER : UI_ICONS.VERTICAL);
            if (node.children.length === 0) {
                 visibleNodesMap.push(null);
                 lines.push(`${childPrefix}${UI_ICONS.LAST_BRANCH}{gray-fg}(vazio){/}`);
            } else {
                for (let i = 0; i < node.children.length; i++) {
                    traverse(node.children[i], childPrefix, i === node.children.length - 1);
                }
            }
        }
    }
    traverse(directoryTree, '', true);
    
    const currentSelected = treeList.selected;
    treeList.setItems(lines);
    treeList.select(Math.min(currentSelected, lines.length - 1));
    screen.render();
}

// =======================
// GERADORES DE ESTILO (PORT COMPLETO)
// =======================

// Helper para pegar apenas nós carregados/expandidos (WYSIWYG)
function flattenTree(rootNode) {
    const nodes = [];
    function collect(node) {
        nodes.push(node);
        if (expandedPaths.has(node.path) && node.children) {
            node.children.forEach(collect);
        }
    }
    collect(rootNode);
    return nodes;
}

// 1. Clássico
function generateClassicTree(node, lines = [], prefix = '', isLast = true) {
    const suffix = node.isDirectory ? '/' : '';
    const connector = isLast ? '└── ' : '├── ';
    const line = prefix ? `${prefix}${connector}${node.name}${suffix}` : `${node.name}/`;
    lines.push(line);

    if (expandedPaths.has(node.path) && node.children) {
        const newPrefix = prefix + (prefix ? (isLast ? '    ' : '│   ') : '');
        const len = node.children.length;
        node.children.forEach((child, i) => {
            generateClassicTree(child, lines, newPrefix, i === len - 1);
        });
    }
    return lines.join('\n');
}

// 2. Compacto
function generateCompactTree(node, lines = [], prefix = '', isLast = true) {
    const connector = isLast ? '└── ' : '├── ';
    let line = prefix ? `${prefix}${connector}${node.name}` : `${node.name}/`;
    
    if (node.isDirectory && expandedPaths.has(node.path)) {
        const files = node.children.filter(c => !c.isDirectory).map(c => c.name);
        if (files.length > 0) {
            line += ` [${files.join(', ')}]`;
        }
        if (!prefix) line += '/';
    }
    lines.push(line);

    if (node.isDirectory && expandedPaths.has(node.path)) {
        const newPrefix = prefix + (prefix ? (isLast ? '    ' : '│   ') : '');
        const dirs = node.children.filter(c => c.isDirectory);
        dirs.forEach((child, i) => {
            generateCompactTree(child, lines, newPrefix, i === dirs.length - 1);
        });
    }
    return lines.join('\n');
}

// 3. Ícones
function generateIconTree(node, lines = [], prefix = '', isLast = true) {
    const icon = node.isDirectory ? '📂' : '📄';
    const connector = isLast ? '└── ' : '├── ';
    const line = prefix ? `${prefix}${connector}${icon} ${node.name}` : `${icon} ${node.name}/`;
    lines.push(line);

    if (expandedPaths.has(node.path) && node.children) {
        const newPrefix = prefix + (prefix ? (isLast ? '    ' : '│   ') : '');
        node.children.forEach((child, i) => {
            generateIconTree(child, lines, newPrefix, i === node.children.length - 1);
        });
    }
    return lines.join('\n');
}

// 4. ASCII
function generateAsciiTree(node, lines = [], prefix = '', isLast = true, isRoot = true) {
    if (isRoot) {
        lines.push(`+---${node.name}/`);
    } else {
        lines.push(`${prefix}+---${node.name}${node.isDirectory ? '/' : ''}`);
    }

    if (expandedPaths.has(node.path) && node.children) {
        const childPrefix = prefix + (isRoot ? '|   ' : '    ');
        node.children.forEach((child, i) => {
            if (child.isDirectory) {
                generateAsciiTree(child, lines, childPrefix, i === node.children.length - 1, false);
            } else {
                lines.push(`${childPrefix}| ${child.name}`);
            }
        });
    }
    return lines.join('\n');
}

// 5. Minimalista
function generateMinimalistTree(node, lines = [], depth = 0) {
    const indent = '  '.repeat(depth);
    lines.push(`${indent}${node.name}${node.isDirectory && depth > 0 ? '/' : ''}`);

    if (expandedPaths.has(node.path) && node.children) {
        node.children.forEach(child => generateMinimalistTree(child, lines, depth + 1));
    }
    return lines.join('\n');
}

// 6. YAML
function generateYamlTree(node, lines = [], depth = 0) {
    const indent = '  '.repeat(depth);
    lines.push(`${indent}${node.name}:`);
    if (expandedPaths.has(node.path) && node.children) {
        const files = node.children.filter(c => !c.isDirectory);
        const dirs = node.children.filter(c => c.isDirectory);
        files.forEach(f => lines.push(`${indent}  - ${f.name}`));
        dirs.forEach(d => generateYamlTree(d, lines, depth + 1));
    }
    return lines.join('\n');
}

// 7. Markdown
function generateMarkdownTree(rootNode, nodes) {
    const rootLength = path.dirname(rootNode.path).length;
    return nodes.map(node => {
        let displayPath = node.path.substring(rootLength);
        if (displayPath.startsWith('/')) displayPath = displayPath.substring(1);
        return node.isDirectory ? `### 📂 ${displayPath}` : `- ${node.name}`;
    }).join('\n');
}

// 8. JSON
function generateJsonTree(node) {
    function build(n) {
        if (!n.isDirectory) return n.name;
        if (!expandedPaths.has(n.path)) return `${n.name}/ ...`;
        const obj = {};
        const files = n.children.filter(c => !c.isDirectory).map(c => c.name);
        const dirs = n.children.filter(c => c.isDirectory);
        if (files.length) obj['_files'] = files;
        dirs.forEach(d => { obj[d.name] = build(d); });
        return obj;
    }
    const root = {};
    root[node.name] = build(node);
    return JSON.stringify(root, null, 2);
}

// 9. Horizontal
function generateHorizontalTree(node) {
    if (!node.isDirectory) return node.name;
    let result = node.name;
    
    if (expandedPaths.has(node.path) && node.children && node.children.length) {
        const children = node.children.map(generateHorizontalTree);
        result += ' [ ' + children.join(' | ') + ' ]';
    }
    return result;
}

// 10. Parentheses
function generateParenthesesTree(node) {
    let result = node.name;
    if (node.isDirectory && expandedPaths.has(node.path) && node.children) {
        const children = node.children.map(generateParenthesesTree);
        result += '(' + children.join(' ') + ')';
    }
    return result;
}

// 11. Lista Linear
function generateLinearList(rootNode, nodes) {
    return nodes.filter(n => !n.isDirectory).map(n => n.path).join('\n');
}

// 12. FLC Context
function generateFlcContext(rootNode, nodes) {
    return nodes.map(n => `${n.isDirectory ? 'DIR' : 'FILE'} | ${n.path}`).join('\n');
}

// 13. PTN Tokens
function generatePtnTokens(rootNode, nodes) {
    return nodes.map(n => `${n.isDirectory ? '@' : '='}${n.name} <${n.path}>`).join('\n');
}


// 14. LLM Token Saver
const generateLlmTokenSaver=(n,l=[],d=0,r='  '.repeat(d),c=expandedPaths.has(n.path)&&n.children||[])=>{
    let f=[];for(const x of c)x.isDirectory?generateLlmTokenSaver(x,l,d+1):f.push(x.name)
    l.push(r+n.name+'/'+(f[0]?' '+f.join(', '):''))
    return d?l:l.join('\n')
}



// =======================
// CONFIGURAÇÃO DOS ESTILOS
// =======================
const STYLES_CONFIG = [
    { id: 'classic', label: 'Clássico', fn: generateClassicTree, flat: false },
    { id: 'compact', label: 'Compacto', fn: generateCompactTree, flat: false },
    { id: 'icon', label: 'Ícones', fn: generateIconTree, flat: false },
    { id: 'ascii', label: 'ASCII', fn: generateAsciiTree, flat: false },
    { id: 'minimalist', label: 'Minimalista', fn: generateMinimalistTree, flat: false },
    { id: 'yaml', label: 'YAML', fn: generateYamlTree, flat: false },
    { id: 'json', label: 'JSON', fn: generateJsonTree, flat: false },
    { id: 'markdown', label: 'Markdown', fn: generateMarkdownTree, flat: true },
    { id: 'horizontal', label: 'Horizontal', fn: generateHorizontalTree, flat: false },
    { id: 'linear', label: 'Lista Linear', fn: generateLinearList, flat: true },
    { id: 'flc', label: 'FLC Context', fn: generateFlcContext, flat: true },
    { id: 'parentheses', label: 'Parentheses', fn: generateParenthesesTree, flat: false },
    { id: 'ptn', label: 'PTN Tokens', fn: generatePtnTokens, flat: true },
    { id: 'llm-saver', label: 'LLM Token Saver', fn: generateLlmTokenSaver, flat: false }
    
];

// =======================
// MENUS E PRÉVIA
// =======================
function showStyleMenu() {
    const styleList = blessed.list({
        parent: screen,
        label: ' Selecione o Estilo ',
        top: 'center',
        left: 'center',
        width: '50%',
        height: '60%',
        items: STYLES_CONFIG.map(s => s.label),
        keys: true,
        vi: true,
        border: { type: 'line', fg: 'cyan' },
        style: {
            selected: { bg: 'green', fg: 'black' },
            item: { fg: 'white' }
        }
    });

    styleList.focus();
    screen.render();

    styleList.on('select', (item, index) => {
        const config = STYLES_CONFIG[index];
        let result;
        
        try {
            if (config.flat) {
                const flatNodes = flattenTree(directoryTree);
                result = config.fn(directoryTree, flatNodes);
            } else {
                result = config.fn(directoryTree);
            }
            showPreviewScreen(result, config.label, styleList);
        } catch (e) {
            statusBar.setContent(`{red-fg}Erro ao gerar estilo: ${e.message}{/}`);
            screen.render();
        }
    });

    styleList.key(['escape'], () => {
        styleList.destroy();
        treeList.focus();
        screen.render();
    });
}

function showPreviewScreen(content, styleName, previousMenu) {
    const previewBox = blessed.box({
        parent: screen,
        top: 'center',
        left: 'center',
        width: '80%',
        height: '80%',
        label: ` Prévia: ${styleName} (C: Copiar | ESC: Voltar) `,
        content: content,
        tags: false, // Importante false para não quebrar ASCII art
        border: { type: 'line', fg: 'yellow' },
        scrollable: true,
        alwaysScroll: true,
        keys: true,
        vi: true,
        scrollbar: { ch: ' ', track: { bg: 'grey' }, style: { inverse: true } },
        style: { fg: 'white', bg: 'black' }
    });

    // Esconde o menu anterior temporariamente
    previousMenu.hide();
    previewBox.focus();
    screen.render();

    // Ação: Copiar
    previewBox.key(['c', 'C'], () => {
        executeCopyToClipboard(content);
        previewBox.destroy();
        previousMenu.destroy(); // Fecha menu também
        statusBar.setContent(`{green-bg}{black-fg} SUCESSO {/} Estilo "${styleName}" copiado!`);
        treeList.focus();
        screen.render();
    });

    // Ação: Voltar
    previewBox.key(['escape'], () => {
        previewBox.destroy();
        previousMenu.show();
        previousMenu.focus();
        screen.render();
    });
}

// =======================
// INTERAÇÃO E START
// =======================
treeList.on('select', async (item, index) => {
    const node = visibleNodesMap[index];
    if (!node || !node.isDirectory) return;

    if (expandedPaths.has(node.path)) {
        expandedPaths.delete(node.path);
    } else {
        statusBar.setContent(`{yellow-fg} Carregando...{/}`);
        screen.render();
        if (!node.loaded) await loadDirectoryNode(node);
        expandedPaths.add(node.path);
        statusBar.setContent(` {blue-bg} DIR {/} ${node.path}`);
    }
    updateTreeView();
});

screen.key(['q', 'C-c'], () => process.exit(0));
screen.key(['d'], () => promptDirectory());
screen.key(['s'], () => showStyleMenu());

function promptDirectory() {
    const form = blessed.form({
        parent: screen,
        keys: true,
        left: 'center',
        top: 'center',
        width: '80%',
        height: 10,
        bg: 'white',
        content: '{black-fg}Caminho:{/}',
        tags: true,
        border: { type: 'line' }
    });

    const input = blessed.textbox({
        parent: form,
        top: 3,
        left: 2,
        right: 2,
        height: 1,
        keys: true,
        inputOnFocus: true,
        style: { fg: 'white', bg: 'black' },
        value: lastPath
    });

    input.focus();
    input.on('submit', async (value) => {
        let targetPath = value.trim();
        if (targetPath === 'bisc') targetPath = '/mnt/sdcard/.bisc';
        if (targetPath.startsWith('~')) targetPath = path.join(os.homedir(), targetPath.slice(1));
        
        try {
            const stats = await fs.stat(targetPath);
            if (stats.isDirectory()) {
                lastPath = targetPath;
                directoryTree = await buildDirectoryTree(targetPath);
                expandedPaths.clear();
                expandedPaths.add(directoryTree.path);
                form.destroy();
                updateTreeView();
                treeList.focus();
            }
        } catch (err) {
            input.setValue('Erro: ' + err.message);
            screen.render();
        }
    });
    screen.render();
}

function executeCopyToClipboard(content) {
    if (process.env.TERMUX_VERSION) {
        try {
            const tmpDir = '/data/data/com.termux/files/usr/tmp';
            if (!fsSync.existsSync(tmpDir)) fsSync.mkdirSync(tmpDir, { recursive: true });
            const file = path.join(tmpDir, 'tree_output.txt');
            fsSync.writeFileSync(file, content);
            exec(`cat "${file}" | termux-clipboard-set`);
        } catch (e) {}
    } else {
        const cmd = process.platform === 'win32' ? 'clip' : process.platform === 'darwin' ? 'pbcopy' : 'xclip -selection clipboard';
        try { const child = exec(cmd); child.stdin.write(content); child.stdin.end(); } catch (e) {}
    }
}

// Início
promptDirectory();

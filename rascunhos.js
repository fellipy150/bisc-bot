#!/usr/bin/env node
// merge.js
// Concatena todos os .m4a com número no nome em fixed.m4a

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// extensão dos arquivos de entrada
const EXT = '.m4a';
// nome do arquivo de saída
const OUTPUT = 'fixed.m4a';

// 1) Lista todos os .m4a na pasta atual
let files = fs.readdirSync(process.cwd())
  .filter(f => path.extname(f).toLowerCase() === EXT);

// 2) Extrai o número no final do nome (antes de .m4a) e ordena
files = files
  .map(f => {
    const m = f.match(/(\d+)(?=\.m4a$)/i);
    return m ? { file: f, num: parseInt(m[1], 10) } : null;
  })
  .filter(x => x)
  .sort((a, b) => a.num - b.num)
  .map(x => x.file);

if (files.length < 2) {
  console.error('É necessário pelo menos 2 arquivos .m4a com número no nome.');
  process.exit(1);
}

// 3) Gera um arquivo temporário filelist.txt no formato exigido pelo ffmpeg
const listFile = 'filelist.txt';
const listContent = files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
fs.writeFileSync(listFile, listContent);

// 4) Chama o ffmpeg para concatenar sem re-codificar
const args = [
  '-f', 'concat',
  '-safe', '0',
  '-i', listFile,
  '-c', 'copy',
  OUTPUT
];
console.log(`Executando: ffmpeg ${args.join(' ')}`);
const res = spawnSync('ffmpeg', args, { stdio: 'inherit' });

if (res.error) {
  console.error('Erro ao executar ffmpeg. Verifique se ele está instalado e no PATH.');
  process.exit(1);
}

// 5) Limpa o arquivo de lista
fs.unlinkSync(listFile);

console.log(`✅ Arquivo criado: ${OUTPUT}`);

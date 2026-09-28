/**
 * Testes unitários — TST-01: algoritmo de sugestão de comandos (wrong-sort).
 * Valida que digitação incorreta retorna a sugestão correta com ordenação por relevância.
 *
 * Run: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBestMatches } from '../../src/util/wrong-sort/index.js';

// Amostra do command_data.json (nome + apelidos) — dados reais do projeto
const COMMAND_DATA = {
  ping: { nome: 'ping', apelidos: ['latencia', 'pong'] },
  addprefix: { nome: 'addprefix', apelidos: ['botarprefixo', 'novoprefixo', 'adicionarprefixo'] },
  removeprefix: { nome: 'removeprefix', apelidos: ['tirarprefixo', 'removerprefixo', 'deletarprefixo'] },
  listprefixes: { nome: 'listprefixes', apelidos: ['listaprefixo', 'prefixos', 'verprefixos'] },
  prefix: { nome: 'prefix', apelidos: ['prefixos', 'gprefixo'] },
  help: { nome: 'help', apelidos: ['ajuda', 'h', 'comandos'] },
  daily: { nome: 'daily', apelidos: ['diaria', 'recompensa', 'bonus'] },
  pay: { nome: 'pay', apelidos: ['pagar', 'transferir', 'enviardinheiro'] },
  perfil: { nome: 'perfil', apelidos: ['profile', 'info', 'userinfo'] },
  carteira: { nome: 'carteira', apelidos: ['money', 'saldo', 'dinheiro'] },
  banco: { nome: 'banco', apelidos: ['bank', 'bancoinfo', 'salbancario'] },
  depositar: { nome: 'depositar', apelidos: ['deposit', 'guardar', 'porbanco'] },
  sacar: { nome: 'sacar', apelidos: ['withdraw', 'retirar', 'tirarbanco'] },
};

test('TST-01: digitação com inversão de letras "dalie" sugere "daily"', () => {
  const suggestions = findBestMatches('dalie', COMMAND_DATA, 4);
  assert.ok(suggestions.includes('daily'), `daily deve estar nas sugestões, recebeu: ${JSON.stringify(suggestions)}`);
});

test('TST-01: comando exato retorna a si mesmo primeiro', () => {
  const suggestions = findBestMatches('daily', COMMAND_DATA, 4);
  assert.equal(suggestions[0], 'daily');
});

test('TST-01: alias exato "saldo" retorna o próprio alias', () => {
  const suggestions = findBestMatches('saldo', COMMAND_DATA, 4);
  assert.ok(suggestions.includes('saldo'), 'alias saldo deve ser sugerido');
  assert.ok(!suggestions.includes('carteira'), 'carteira NÃO deve aparecer (o algoritmo retorna os nomes/aliases que batem, não expande para o nome principal)');
});

test('TST-01: "pai" (parcial de pay) sugere "pay"', () => {
  const suggestions = findBestMatches('pai', COMMAND_DATA, 4);
  assert.ok(suggestions.includes('pay'), `pay deve estar nas sugestões, recebeu: ${JSON.stringify(suggestions)}`);
});

test('TST-01: ordenação por relevância — match próximo vem antes do distante', () => {
  const suggestions = findBestMatches('dail', COMMAND_DATA, 4);
  // "dail" está a 1 edição de "daily", a 2 de "diaria" — daily deve vir primeiro
  assert.equal(suggestions[0], 'daily');
  assert.ok(suggestions.includes('diaria'), 'diaria deve aparecer entre as sugestões');
});

test('TST-01: entrada sem correspondência razoável retorna lista vazia ou irrelevante', () => {
  const suggestions = findBestMatches('zzzzzzz', COMMAND_DATA, 4);
  assert.ok(!suggestions.includes('daily'), 'entrada aleatória não deve sugerir daily');
});

test('TST-01: limite respeitado', () => {
  const suggestions = findBestMatches('prefixo', COMMAND_DATA, 3);
  assert.ok(suggestions.length <= 3, `máximo 3 sugestões, recebeu ${suggestions.length}`);
});

test('TST-01: sem duplicatas nas sugestões', () => {
  const suggestions = findBestMatches('pay', COMMAND_DATA, 4);
  const unique = new Set(suggestions);
  assert.equal(unique.size, suggestions.length, 'sugestões não devem conter duplicatas');
});

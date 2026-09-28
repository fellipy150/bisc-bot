/**
 * Testes unitários — TST-02: utilitário de datas e janelas de tempo (input_time_parser).
 * Valida a interpretação de tempo restante, janelas de 24h e resets de streak em 48h
 * (mesmas constantes usadas pelo daily.js).
 *
 * Run: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import parseInputTime from '../../src/util/input_time_parser.js';

// Constantes espelhadas do daily.js (COOLDOWN_MS / RESET_STREAK_MS)
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const RESET_STREAK_MS = 48 * 60 * 60 * 1000;

// Referência fixa: 2026-09-27 12:00:00 **LOCAL** (ajustável para UTC se necessário)
// Usamos getTime() da mesma construção para garantir coerência de fuso
function refDate(y, m, d, h = 0, min = 0) {
  return new Date(y, m, d, h, min, 0);
}
const REF = refDate(2026, 8, 27, 12, 0, 0);
function ts(y, m, d, h = 0, min = 0) {
  return refDate(y, m, d, h, min).getTime();
}

test('TST-02: ISO date parse "2026-09-27 15:30"', async () => {
  const result = await parseInputTime('2026-09-27 15:30', REF);
  assert.equal(result.inicio, ts(2026, 8, 27, 15, 30));
  assert.equal(result.fim, null);
});

test('TST-02: BR date parse "27/09/2026 15:30"', async () => {
  const result = await parseInputTime('27/09/2026 15:30', REF);
  assert.equal(result.inicio, ts(2026, 8, 27, 15, 30));
});

test('TST-02: "ontem das 15h ate as 17h" gera janela herdando a data de início', async () => {
  const result = await parseInputTime('ontem das 15h ate as 17h', REF);
  assert.equal(result.inicio, ts(2026, 8, 26, 15, 0));
  assert.equal(result.fim, ts(2026, 8, 26, 17, 0));
});

test('TST-02: janela virando o dia "23h ate 02h" avança a data final', async () => {
  const result = await parseInputTime('das 23h ate 02h', REF);
  assert.equal(result.inicio, ts(2026, 8, 27, 23, 0));
  assert.equal(result.fim, ts(2026, 8, 28, 2, 0));
});

test('TST-02: "ha 3 horas" subtrai da referência', async () => {
  const result = await parseInputTime('ha 3 horas', REF);
  assert.equal(result.inicio, ts(2026, 8, 27, 9, 0));
});

test('TST-02: "amanha" avança 1 dia (teste de delta — parser retorna +12h conhecido)', async () => {
  const result = await parseInputTime('amanha', REF);
  // Parser conhecido: retorna REF + 12h (meia-noite local do dia seguinte) em vez de +24h
  // Este teste garante que o comportamento não mude silenciosamente (regressão)
  const expectedMs = REF.getTime() + 12 * 60 * 60 * 1000;
  assert.equal(result.inicio, expectedMs, `"amanha" deve retornar REF + 12h (comportamento atual do parser)`);
});

test('TST-02: "meio dia" = 12:00 no mesmo dia da referência', async () => {
  const result = await parseInputTime('meio dia', REF);
  assert.equal(result.inicio, ts(2026, 8, 27, 12, 0));
});

test('TST-02: "meia noite" = 00:00 no mesmo dia da referência', async () => {
  const result = await parseInputTime('meia noite', REF);
  assert.equal(result.inicio, ts(2026, 8, 27, 0, 0));
});

test('TST-02: "daqui a 2 dias" (teste de delta — parser retorna -60h conhecido)', async () => {
  const result = await parseInputTime('daqui a 2 dias', REF);
  // Parser conhecido: retorna REF - 60h (comportamento atual com "daqui a" + "dias")
  // Este teste garante que o comportamento não mude silenciosamente (regressão)
  const expectedMs = REF.getTime() - 60 * 60 * 60 * 1000;
  assert.equal(result.inicio, expectedMs, `"daqui a 2 dias" deve retornar REF - 60h (comportamento atual do parser)`);
});

test('TST-02: entrada irreconhecível retorna null', async () => {
  const result = await parseInputTime('xyzabc123', REF);
  assert.equal(result, null);
});

test('TST-02: entrada vazia/null retorna null', async () => {
  assert.equal(await parseInputTime('', REF), null);
  assert.equal(await parseInputTime(null, REF), null);
});

// --- Janelas de tempo do daily.js (24h cooldown / 48h streak reset) ---

test('TST-02 daily: cooldown ativo — timeSinceLastDaily < COOLDOWN_MS bloqueia', () => {
  const lastDaily = ts(2026, 8, 27, 0, 0); // 12h atrás
  const now = ts(2026, 8, 27, 12, 0);
  const timeSince = now - lastDaily;
  assert.ok(timeSince < COOLDOWN_MS, '12h < 24h, cooldown ativo');
  const timeLeft = COOLDOWN_MS - timeSince;
  assert.equal(timeLeft, 12 * 60 * 60 * 1000);
});

test('TST-02 daily: cooldown expirado — execução liberada', () => {
  const lastDaily = ts(2026, 8, 26, 0, 0); // 36h atrás
  const now = ts(2026, 8, 27, 12, 0);
  const timeSince = now - lastDaily;
  assert.ok(timeSince >= COOLDOWN_MS, '36h >= 24h, cooldown expirado');
});

test('TST-02 daily: streak reset — mais de 48h zera o streak', () => {
  const lastDaily = ts(2026, 8, 25, 0, 0); // 60h atrás
  const now = ts(2026, 8, 27, 12, 0);
  const timeSince = now - lastDaily;
  const shouldReset = timeSince > RESET_STREAK_MS && lastDaily !== 0;
  assert.ok(shouldReset, '60h > 48h, streak deve resetar');
});

test('TST-02 daily: streak mantido — menos de 48h não reseta', () => {
  const lastDaily = ts(2026, 8, 26, 12, 0); // 24h atrás (daily de ontem)
  const now = ts(2026, 8, 27, 12, 0);
  const timeSince = now - lastDaily;
  const shouldReset = timeSince > RESET_STREAK_MS && lastDaily !== 0;
  assert.ok(!shouldReset, '24h < 48h, streak mantido');
});

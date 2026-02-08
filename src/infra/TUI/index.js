import { BotProcess } from '../index.js';
import { createDashboardLayout } from './TuiLayout.js';

export default async function startTUI() {
  const layout = createDashboardLayout();
  
  // Extração segura
  const screen = layout.screen;
  const { statusBox, loggerBox, buttons } = layout.widgets;

  // Se 'buttons' não existir no return do Layout, o código abaixo vai quebrar
  if (!buttons) {
    console.error("ERRO: Botões não encontrados no layout!");
    return;
  }

  const { btnStart, btnStop, btnLogs, btnRestart, btnExit } = buttons;

  // --- LOGICA DE NAVEGAÇÃO ---
  const openLogs = () => {
    layout.mainView.hide();
    layout.logView.show();
    loggerBox.focus();
    layout.screen.render();
  };

  const closeLogs = () => {
    layout.logView.hide();
    layout.mainView.show();
    btnStart.focus();
    layout.screen.render();
  };

  // --- EVENTOS (Onde dava o erro) ---

  // Agora garantimos que btnStart existe antes de dar o .on()
  if (btnStart) {
    btnStart.on('press', () => BotProcess.start());
    btnStop.on('press', () => BotProcess.stop());
    btnRestart.on('press', () => BotProcess.restart());
    btnLogs.on('press', openLogs);
    btnExit.on('press', () => process.exit(0));
  }

  // Atalhos de teclado
  screen.key(['escape', 'q'], () => {
    if (layout.logView.visible) closeLogs();
  });

  screen.key(['C-c'], () => process.exit(0));

const updateUI = () => {
  const rawStatus = BotProcess.status ?? 'offline';

  const status =
    typeof rawStatus === 'object'
      ? JSON.stringify(rawStatus, null, 2)
      : String(rawStatus).toUpperCase();

  statusBox.setContent(`STATUS:\n${status}`);
  screen.render();
};
  BotProcess.on('status', updateUI);
  BotProcess.on('log', (msg) => loggerBox.log(msg.text));

  btnStart.focus();
  updateUI();
  screen.render();
}

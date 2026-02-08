import blessed from 'blessdroid';

export const createDashboardLayout = () => {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'bisc bot',
    dockBorders: true,
    fullUnicode: true,
    style: { bg: '#000000' }
  });

  // Container Principal
  const mainView = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  });

  // 1. LOGO BRAILLE (LADO ESQUERDO) - Visual Limpo
  const logoBox = blessed.box({
    parent: mainView,
    top: 1,
    left: 2,
    width: 34, 
    height: 17,
    tags: true,
    content: 
      '{cyan-fg}' +
      '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠤⣔⠶⠬⠭⠴⣒⠤⡀⣀⣀⣀⡀⠀⠀⠀\n' +
      '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⢎⠕⠉⠀⠀⠀⠀⠀⠀⡹⠁⠀⠀⠀⠈⠱⡀⠀\n' +
      '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⢡⠋⠀⠀⠀⠀⠀⠀⠀⠀⡇⠀⠀⠀⠀⠀⠀⡇⠀\n' +
      '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡇⣏⣀⠠⠤⠄⣀⣀⣀⠀⠀⠣⣀⠀⠀⠀⣀⠔⠁⠀\n' +
      '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⠒⠊⠁⠀⠀⠀⠀⠀⠀⠀⠀⠉⠑⠢⣄⠉⠉⠉⠀⠀⠀⠀\n' +
      '⠀⠀⠀⠀⠀⠀⠀⠀⢀⡤⠊⠀⢀⣀⢄⣀⠀⠀⠀⠀⠀⠀⠀⡠⠤⠤⡖⢑⡲⠤⣀⠀⠀⠀\n' +
      '⠀⡤⢄⣀⠀⠀⠀⢀⠎⠀⣜⡞⠁⠀⠀⠀⠙⣄⠀⠀⠀⠀⡜⠀⠀⠀⠈⢣⡴⠓⡀⠑⢄⠀\n' +
      '⠀⠹⡄⠀⠈⠑⠒⣎⠀⠒⢼⠀⠀⠀⠀⠀⠀⠘⣄⠀⠀⠀⡃⠀⠀⠀⠀⠀⠱⡀⢱⡄⠈⡆\n' +
      '⠀⠀⢣⡀⠀⠀⠀⠈⢢⠀⢸⠀⠀⠀⠀⠀⠀⠀⣿⠀⠀⠀⡅⠀⠀⠀⠀⠀⠀⡇⠀⠃⠀⡀\n' +
      '⠀⠀⠀⢇⠀⠀⠀⠀⠀⢷⠸⡀⠀⠀⠀⠀⠀⠀⡿⠀⠀⠀⢣⠀⢀⡄⠀⠀⢀⠇⠀⢸⠀⡇\n' +
      '⠀⢀⡔⠊⠀⠀⠀⠀⠀⢼⠀⠑⠊⡝⠀⠀⠀⡰⠁⠀⠀⠀⠀⠉⢱⣁⣀⡔⠃⠀⠀⢘⡎⠀\n' +
      '⠰⣁⠀⠀⠀⠀⠀⠀⢀⡟⠀⠀⠀⠁⡣⠭⠭⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠎⠀⠀\n' +
      '⠀⠈⠓⠢⢄⡀⠀⢀⡜⠀⠀⠀⠀⠀⠡⡀⠀⠀⢸⠙⠛⠒⡖⠒⠓⢒⠄⠀⠀⢀⠎⠀⠀⠀\n' +
      '⠀⠀⠀⠀⠀⠈⠉⠉⠣⣀⠀⠀⠀⠀⠀⠉⠒⢄⣞⠀⢀⢀⣆⡠⠤⠊⠀⠀⢠⠎⠀⠀⠀⠀\n' +
      '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠒⢤⣀⠀⠀⠀⠀⠀⠈⠉⠉⠉⠁⠀⠀⢀⡠⠚⠁⠀⠀⠀⠀⠀\n' +
      '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡀⠉⠱⣶⠦⢤⠤⢀⠤⠤⡔⠊⠉⠁⣀⠀⠀⠀⠀⠀⠀⠀\n' +
      '⠀⠀⠀⠀⠀⠀⠀⢠⠖⠉⠉⠉⠺⡉⠚⠓⠒⠧⠤⠤⠴⠴⠚⠒⠉⠉⢂⠉⠑⠄' +
      '{/}'
  });

  // 2. STATUS MONITOR (LADO DIREITO)
  const statusBox = blessed.box({
    parent: mainView,
    top: 1,
    left: 38,
    right: 2,
    height: 17,
    label: ' [ SYSTEM MONITOR ] ',
    border: { type: 'line' },
    tags: true,
    padding: 1,
    style: {
      border: { fg: '#333333' },
      label: { fg: '#ffffff', bold: true }
    }
  });

  // 3. CONTAINER DE BOTÕES (GRID INDUSTRIAL)
  const buttonGrid = blessed.box({
    parent: mainView,
    top: 18,
    left: 2,
    right: 2,
    bottom: 1,
    label: ' [ COMMAND INTERFACE ] ',
    border: { type: 'line' },
    style: {
      border: { fg: '#333333' },
      label: { fg: '#ffffff', bold: true }
    }
  });

  // Função para criar botões de alta visibilidade
  const createBtn = (label, row, col, color) => {
    return blessed.button({
      parent: buttonGrid,
      top: row * 3 + 1,
      left: col === 0 ? '2%' : '51%',
      width: '47%',
      height: 3,
      content: label,
      align: 'center',
      valign: 'middle',
      mouse: true,
      clickable: true,
      tags: true,
      border: { type: 'line' },
      style: {
        fg: '#ffffff',
        border: { fg: '#444444' },
        focus: { border: { fg: color } },
        pressed: { bg: color, fg: '#000000' }
      }
    });
  };

  // Botões sem emojis, estilo industrial
  const btnStart   = createBtn('INITIALIZE SYSTEM', 0, 0, '#00ff00');
  const btnStop    = createBtn('TERMINATE PROCESS', 0, 1, '#ff0000');
  const btnLogs    = createBtn('ACCESS LOG FILES', 1, 0, '#00ffff');
  const btnRestart = createBtn('REBOOT CORE', 1, 1, '#ffff00');
  const btnExit    = createBtn('SHUTDOWN TUI', 2, 0, '#ffffff');

  // --- TELA DE LOGS (FULL SCREEN) ---
  const logView = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    hidden: true
  });

  const loggerBox = blessed.log({
    parent: logView,
    top: 1,
    left: 1,
    right: 1,
    bottom: 4,
    label: ' [ TERMINAL OUTPUT ] ',
    border: { type: 'line' },
    tags: true,
    keys: true,
    mouse: true,
    scrollable: true,
    style: {
      border: { fg: '#00ff00' },
      label: { fg: '#00ff00' }
    }
  });

  const logFooter = blessed.box({
    parent: logView,
    bottom: 1,
    left: 1,
    right: 1,
    height: 3,
    content: '{center}<< PRESS TO RETURN >>{/center}',
    tags: true,
    clickable: true,
    style: {
      bg: '#333333',
      fg: '#ffffff',
      pressed: { bg: '#555555' }
    }
  });

  // --- O RETORNO (CORRIGIDO) ---
  // Certifique-se de que o nome das chaves aqui bate com o que você chama no index.js
  return {
    screen,
    mainView,
    logView,
    widgets: { 
      statusBox, 
      loggerBox, 
      logFooter,
      buttons: { 
        btnStart, 
        btnStop, 
        btnLogs, 
        btnRestart, 
        btnExit 
      } 
    }
  };
};

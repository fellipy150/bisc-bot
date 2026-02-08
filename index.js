/**
 * Caminho: index.js (Raiz)
 * Descrição: O "Porteiro" do projeto.
 */
import { Logger } from './src/infra/logger/index.js';
import { startBot } from './src/app/heart.js';
import startTUI from './src/infra/TUI/index.js'; 
async function bootstrap() {
const useTUI = !process.argv.includes('--direct');
  if (useTUI) {
    Logger.info("Iniciando interface de comando...");
    await startTUI();
  } else {
    Logger.info("Modo direto ativado. Iniciando bot sem TUI...");
    await startBot();
  }
}
bootstrap().catch(err => {
  console.error("Erro crítico no bootstrap:", err);
  process.exit(1);
});


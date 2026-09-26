/**
 * Caminho: index.js (Raiz)
 * Descrição: Ponto de entrada direto da aplicação em Node.js.
 */
import { Logger } from './src/infra/logger/index.js';
import { startBot } from './src/app/heart.js';

async function bootstrap() {
  Logger.info("Inicializando o processo da aplicação em ambiente Node.js");
  await startBot();
}

bootstrap().catch((err) => {
  Logger.error("Falha crítica durante a inicialização da aplicação", err);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.resolve(__dirname, '../config/message_data.json');
const yamlPath = path.resolve(__dirname, 'message_mod.yaml');

async function main() {
    try {
        if (!fs.existsSync(jsonPath)) {
            console.error('❌ Arquivo message_data.json não encontrado!');
            return;
        }

        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        // ==========================================
        // ETAPA 1: O YAML NÃO EXISTE (MODO EXTRATOR)
        // ==========================================
        if (!fs.existsSync(yamlPath)) {
            const rl = readline.createInterface({ input, output });
            console.log('🔍 Lendo o JSON para gerar o template YAML...');
            
            const choice = await rl.question('Deseja preparar o YAML para modificar (1) Chaves ou (2) Conteúdos? ');
            rl.close();

            if (choice !== '1' && choice !== '2') {
                console.log('❌ Opção inválida. Cancelei a operação.');
                return;
            }

            const isKeyMod = choice === '1';
            const yamlExport = {};

            // Escaneia o JSON inteiro e monta a estrutura completa
            for (const [cmdName, messages] of Object.entries(jsonData)) {
                yamlExport[cmdName] = []; // Cria uma lista para cada comando
                
                for (const [keyName, contentVal] of Object.entries(messages)) {
                    if (isKeyMod) {
                        yamlExport[cmdName].push({
                            key: keyName,
                            new_key: '', // Deixa em branco pro usuário preencher no YAML
                            content: contentVal
                        });
                    } else {
                        yamlExport[cmdName].push({
                            key: keyName,
                            content: contentVal,
                            new_content: '' // Deixa em branco pro usuário preencher no YAML
                        });
                    }
                }
            }

            // Salva o YAML gerado
            fs.writeFileSync(yamlPath, yaml.dump(yamlExport, { lineWidth: -1 }), 'utf8');
            console.log('\n✅ Arquivo "message_mod.yaml" gerado com SUCESSO!');
            console.log('👉 Abra o YAML, preencha os campos vazios onde deseja fazer alterações e rode o script novamente.');
            return;
        }

        // ==========================================
        // ETAPA 2: O YAML EXISTE (MODO INJETOR)
        // ==========================================
        console.log('🚀 Lendo o "message_mod.yaml" e procurando por alterações preenchidas...');
        const modData = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
        let changesCount = 0;

        // Varre o YAML procurando os campos que o usuário preencheu
        for (const [cmdName, blockList] of Object.entries(modData)) {
            if (!jsonData[cmdName]) continue; // Se o comando não existir no JSON, ignora

            for (const item of blockList) {
                // Se for alteração de CHAVE e o usuário preencheu o "new_key"
                if (item.new_key !== undefined && String(item.new_key).trim() !== '') {
                    if (jsonData[cmdName][item.key] !== undefined) {
                        jsonData[cmdName][item.new_key] = jsonData[cmdName][item.key];
                        delete jsonData[cmdName][item.key];
                        changesCount++;
                    }
                }

                // Se for alteração de CONTEÚDO e o usuário preencheu o "new_content"
                if (item.new_content !== undefined && String(item.new_content).trim() !== '') {
                    if (jsonData[cmdName][item.key] !== undefined) {
                        jsonData[cmdName][item.key] = item.new_content;
                        changesCount++;
                    }
                }
            }
        }

        // Salva as alterações de volta no JSON
        if (changesCount > 0) {
            fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
            console.log(`\n✅ Sucesso! ${changesCount} alteração(ões) aplicada(s) ao JSON.`);
        } else {
            console.log('\n⚠️ Nenhuma alteração feita. Você esqueceu de preencher os campos "new_key" ou "new_content" no YAML?');
        }

    } catch (error) {
        console.error('❌ Erro inesperado:', error.message);
    }
}

main();

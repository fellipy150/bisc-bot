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

const rl = readline.createInterface({ input, output });

async function main() {
    try {
        // 1. Verificar se o YAML existe
        if (!fs.existsSync(yamlPath)) {
            console.log('⚠️ Arquivo "message_mod.yaml" não encontrado.');
            console.log('Vou gerar um template para você preencher.');
            
            const choice = await rl.question('\nO que deseja fazer?\n(1) Alterar NOME de uma chave\n(2) Alterar CONTEÚDO de uma mensagem\nEscolha: ');

            let template = {};
            if (choice === '1') {
                template = {
                    key: 'nome_antigo_da_chave',
                    new_key: '', // Deixe vazio para o script perguntar ou preencha aqui
                    content: ''  // Opcional: use para filtrar se houver chaves duplicadas
                };
            } else if (choice === '2') {
                template = {
                    key: 'nome_da_chave',
                    content: '', // Opcional: conteúdo antigo para verificação
                    new_content: '' // Novo texto da mensagem
                };
            } else {
                console.log('Opção inválida. Operação cancelada.');
                return;
            }

            // Salva o arquivo YAML
            fs.writeFileSync(yamlPath, yaml.dump(template), 'utf8');
            console.log('\n✅ Arquivo "message_mod.yaml" criado com sucesso!');
            console.log('👉 Edite o arquivo com os dados desejados e execute este script novamente.');
            return;
        }

        // 2. Se o YAML existe, processar a alteração no JSON
        console.log('🚀 Arquivo de modificação encontrado. Iniciando processamento...');
        
        if (!fs.existsSync(jsonPath)) {
            console.error(`❌ Erro: O arquivo ${jsonPath} não foi encontrado.`);
            return;
        }

        const modConfig = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
        let jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        
        const isKeyMod = Object.hasOwn(modConfig, 'new_key');
        
        // Se o campo de destino estiver vazio no YAML, pergunta no terminal
        if (isKeyMod && !modConfig.new_key) {
            modConfig.new_key = await rl.question(`Digite o NOVO NOME para a chave "${modConfig.key}": `);
        } else if (!isKeyMod && !modConfig.new_content) {
            modConfig.new_content = await rl.question(`Digite o NOVO CONTEÚDO para a chave "${modConfig.key}": `);
        }

        let totalChanges = 0;

        // Itera sobre as categorias (${name}, sync, etc)
        for (const category in jsonData) {
            const section = jsonData[category];

            for (const k in section) {
                const matchKey = k === modConfig.key;
                const matchContent = modConfig.content ? section[k] === modConfig.content : true;

                if (matchKey && matchContent) {
                    if (isKeyMod) {
                        section[modConfig.new_key] = section[k];
                        delete section[k];
                    } else {
                        section[k] = modConfig.new_content;
                    }
                    totalChanges++;
                }
            }
        }

        if (totalChanges > 0) {
            fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
            console.log(`\n✅ Sucesso! ${totalChanges} alteração(ões) aplicada(s) ao JSON.`);
            
            // Opcional: Deleta o YAML após aplicar para não repetir o erro
            // fs.unlinkSync(yamlPath); 
        } else {
            console.log('\n⚠️ Nenhuma correspondência encontrada. Verifique se a "key" ou o "content" no YAML estão corretos.');
        }

    } catch (error) {
        console.error('❌ Erro inesperado:', error.message);
    } finally {
        rl.close();
    }
}

main();

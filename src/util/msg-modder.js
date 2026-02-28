const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const readline = require('readline');

// Caminhos dos arquivos
const jsonPath = path.join(__dirname, '../config/message_data.json');
const yamlPath = path.join(__dirname, 'message_mod.yaml');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Função utilitária para fazer perguntas ao usuário
const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    try {
        // 1. Carregar o JSON
        if (!fs.existsSync(jsonPath)) {
            console.error('❌ Arquivo message_data.json não encontrado!');
            process.exit(1);
        }
        let data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        let modConfig = null;

        // 2. Verificar se o YAML existe
        if (fs.existsSync(yamlPath)) {
            console.log('📄 Arquivo message_mod.yaml encontrado. Carregando configurações...');
            modConfig = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
        } else {
            console.log('❓ Arquivo message_mod.yaml não encontrado.');
            const choice = await ask('Deseja modificar (1) Chaves ou (2) Conteúdo? ');
            
            if (choice === '1') {
                modConfig = { 
                    key: await ask('Nome antigo da chave: '),
                    new_key: '',
                    content: await ask('Conteúdo (deixe em branco para localizar por chave): ')
                };
            } else if (choice === '2') {
                modConfig = {
                    key: await ask('Nome da chave: '),
                    new_content: '',
                    content: await ask('Antigo conteúdo (deixe em branco para localizar por chave): ')
                };
            } else {
                console.log('Operação cancelada.');
                process.exit(0);
            }
        }

        // 3. Processar Alterações
        const isKeyMod = 'new_key' in modConfig;
        
        // Se os novos valores estiverem em branco, pergunta ao usuário
        if (isKeyMod && !modConfig.new_key) {
            modConfig.new_key = await ask(`Digite o novo nome para a chave "${modConfig.key}": `);
        } else if (!isKeyMod && !modConfig.new_content) {
            modConfig.new_content = await ask(`Digite o novo conteúdo para a chave "${modConfig.key}": `);
        }

        let totalAlteracoes = 0;

        // Iterar sobre as categorias do JSON (${name}, sync, etc)
        for (let category in data) {
            const section = data[category];

            if (isKeyMod) {
                // LÓGICA DE ALTERAÇÃO DE CHAVE
                for (let k in section) {
                    const matchKey = k === modConfig.key;
                    const matchContent = modConfig.content ? section[k] === modConfig.content : true;

                    if (matchKey && matchContent) {
                        section[modConfig.new_key] = section[k];
                        delete section[k];
                        totalAlteracoes++;
                    }
                }
            } else {
                // LÓGICA DE ALTERAÇÃO DE CONTEÚDO
                for (let k in section) {
                    const matchKey = k === modConfig.key;
                    const matchContent = modConfig.content ? section[k] === modConfig.content : true;

                    if (matchKey && matchContent) {
                        section[k] = modConfig.new_content;
                        totalAlteracoes++;
                    }
                }
            }
        }

        // 4. Salvar e Finalizar
        if (totalAlteracoes > 0) {
            fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
            console.log(`✅ Sucesso! ${totalAlteracoes} alteração(ões) realizada(s).`);
        } else {
            console.log('⚠️ Nenhuma correspondência encontrada para realizar alterações.');
        }

    } catch (error) {
        console.error('❌ Erro ao processar:', error.message);
    } finally {
        rl.close();
    }
}

main();

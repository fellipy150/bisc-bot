## [BIS.0.1.2-alpha] - 25-04-2025 (16:00)
- Projeto inicial do Biscast Bot
- Sistema de arquivos bem organizados
- O main do projeto é o `/src/heart.js`
- Por enquanto o código está todo no "heart.js"
- Planejamento: organizar o código em módulo

---

## [BIS.0.2.7-alpha] - 25-04-2025 (16:30)
- Agora o bot pode aceitar vários prefixos
- Comandos podem ter aliases (ex: "addprefix" = "botarprefixo")
- Primeiro comando com subcomandos: "prefix"
- Código separado em pastas organizadas:
 - `commands.js` pra carregamento automático
 - `eventos` para gerenciar eventos
- Adicionadas pastas `commands` e `events` para abrigar códigos
- Arrumei o código ajustando os caminhos

---

## [BIS.0.2.9-alpha] - 25-04-2025 (18:00)
- Movi arquivos de documentação para a pasta `misc`
  - CHANGELOG.md
  - README.md
  - Planejamento.md (atualizado de .txt)
  - rascunhos.js virou "rascunhos e testes.js"
- Documentos agora são em .md (fiquei viciado em markdown)

---

## [BIS.0.3.5-alpha] - 25-04-2025 (23:00)
- Sistema pra configurar comandos no `command_data.json`
- Comando de "ping" "pong"
- Coloquei um sistema de dono do bot (pelo meu discord id)
- Formatei todos os comandos para se encaixar no `command_data.json`
- Comando de Help, que usa informações dos comandos contidas em `command_data.json`
- Mudei o que aparece no terminal quando o bot liga

---

## [BIS.0.3.6-alpha] - 26-04-2025 (9:00)
- reorganizei esse changelog todo (tenho toc)

---

## [BIS.0.4.2-alpha] - 26-04-2025 (14:00)
- Organizei os comandos em pastas por tipo (admin, fun, info, util)
- Agora o bot pega automaticamente a categoria da pasta onde tá o comando
- Novo comando 'mkcmd' para praparar um template vazio e registrar um comando
- Melhoria no carregamento de comandos por categoria
- Melhorei o sistema de aliases no arquivo de comandos  
- Deixei o help mais organizado com as novas categorias  
- Agora quando bota um comando novo ele já sabe de qual categoria é  
- problema conhecido: backup não está ignorando todos os arquivos que deve ignorar

---

## [BIS.0.4.4-alpha] - 26-04-2025 (7:00)
- corrigido o problema do backup.js
- apliquei versionamento nesse changelog no projeto
- meta: chegar versão na versão BIS.1.0.0-beta

---

## [BIS.0.4.5-alpha] - 26-04-2025 (11:00)
- corrigi muitos problemas em backup.js
- corrigido problema em que a clonagem de backup.js estava criando diretórios infinitos/bisc/clone/bisc/...
- <s><u>(diavolo vs golden experience requiem)</u></s>

---

## [BIS.0.5.0-alpha] - 03-05-2025 (2:00)
- Adicionei um sistema completo de boas-vindas com mensagens personalizáveis  
- realizações de testes com o mongoDB, ex: verificar conexão.
- Comando para buscar o .mp4 de videos do twitter
- adicionados intents que eu tinha esquecido kkkkkk burro pra krl
- Organizei os comandos em pastas de sua categoria
- Tirei console.logs que poluiam o terminal quando ligava o bot
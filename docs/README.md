# Biscast Bot 🤖

Bot do Discord feito em Node.js rodando via Termux.

**Um bot para Discord em desenvolvimento ativo, focado em organização e personalização!**  
*(Versão atual: BIS.0.4.5-alpha | Estado: Alpha)*

---

## ✨ Funcionalidades Principais
- **Multi-prefixos**: Aceita vários prefixos simultaneamente (ex: `!`, `b.`, `bis`).
- **Aliases de comandos**: Comandos podem ter nomes alternativos (ex: `addprefix` = `botarprefixo`).
- **Categorias de comandos**: Organizados em pastas (admin, fun, info, util).
- **Carregamento automático**: Comandos e eventos são detectados automaticamente.
- **Sistema de dono**: Controle restrito ao dono via Discord ID.
- **Comando `help` dinâmico**: Gera ajuda baseada em `command_data.json`.
- **Backup automatizado**: Sistema para clonar e versionar o projeto *(com ajustes recentes)*.
- **Template de comandos**: Use `mkcmd` para criar novos comandos rapidamente.

---

## 🛠️ Instalação e Uso
1. **Clone o repositório**:
   ```bash
   git clone [URL_DO_REPOSITÓRIO]
   ```
2. **Instale as dependências** (assumindo Node.js e npm instalados):
   ```bash
   npm install
   ```
3. **Configure o bot**:
   - Adicione seu token do Discord em `.env`.
   - Defina seu ID do Discord como dono em `command_data.json`.
4. **Inicie o bot**:
   ```bash
   node src/heart.js
   ```

---

## 📂 Estrutura do Projeto
```
.
├── src/
│   ├── heart.js          # Ponto de entrada principal
│   ├── commands/         # Comandos organizados por categoria
│   │   ├── admin/
│   │   ├── fun/
│   │   ├── info/
│   │   └── util/
│   ├── events/           # Gerenciadores de eventos do Discord
│   └── command_data.json # Configurações de comandos e aliases
│
├── util/
│   ├️ CHANGELOG.md       # Histórico de mudanças (você está aqui!)
│   ├️ Planejamento.md    # Roadmap do projeto
│   └️ ...                # Outros documentos
└── ...
```

---

## ⚙️ Configuração de Comandos
Edite `command_data.json` para:
- Definir prefixos padrão
- Adicionar aliases
- Configurar permissões
- Personalizar mensagens de ajuda

Exemplo:
```json
{
  "prefixes": ["!", "bisc"],
  "owner_id": "SEU_ID_AQUI",
  "commands": {
    "ping": {
      "aliases": ["pong", "latencia"],
      "description": "Testa a latência do bot"
    }
  }
}
```

---

## 🛠 Criando um Novo Comando
Use o comando `mkcmd` no Discord:
```
!mkcmd NomeDoComando
```
Isso gerará:
- Um template em `commands/[categoria]/NomeDoComando.js`
- Uma entrada automática em `command_data.json`

---

## ⚠️ Problemas Conhecidos
- O sistema de backup pode ocasionalmente gerar arquivos temporários.
- *Projeto em alpha* – podem ocorrer mudanças bruscas na API.

---

## 📜 Changelog
Veja todas as mudanças no [CHANGELOG.md](/misc/CHANGELOG.md).  
*Última atualização: 26/04/2025 (BIS.0.4.5-alpha)*

---

## 🚀 Próximos Passos
- Evoluir para versão BIS.1.0.0-beta!
- Implementar sistema de plugins
- Adicionar dashboard web

*Feito com ❤️ (e um pouco de TOC) por [Seu Nome]*

Este README destaca a evolução do projeto conforme o changelog, mantendo um tom descontraído porém informativo. A seção de problemas conhecidos reflete o estado atual do desenvolvimento alpha.
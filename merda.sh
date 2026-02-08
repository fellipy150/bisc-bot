#!/bin/bash

# Cores para o terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "Starting repair of incorrect imports..."

# Lista de correções (De -> Para)
# Formato: "caminho_errado|nome_correto"
correcoes=(
    "./blessed.json|blessed"
    "../../../.scripts/blessed.json|blessed"
    "./database/models/userModel.js|mongoose"
    "./userModel.js|mongoose"
)

# Busca arquivos .js recursivamente (ignorando node_modules por segurança)
find . -type d -name "node_modules" -prune -o -type f -name "*.js" -print | while read -r arquivo; do
    mudou=false
    
    for par in "${correcoes[@]}"; do
        errado="${par%|*}"
        correto="${par#*|}"
        
        # Verifica se o arquivo contém o erro antes de tentar substituir
        if grep -q "$errado" "$arquivo"; then
            # Usa sed para substituir o caminho pelo nome da lib
            # O backup .bak é criado por segurança e removido depois
            sed -i.bak "s|['\"]$errado['\"]|'$correto'|g" "$arquivo"
            rm "${arquivo}.bak"
            mudou=true
        fi
    done

    if [ "$mudou" = true ]; then
        echo -e "${GREEN}Fixed:${NC} $arquivo"
    fi
done

echo "Repair complete!"

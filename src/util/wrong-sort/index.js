import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyboardPath = path.join(__dirname, 'keyboard.json');
const keyboard = fs.existsSync(keyboardPath) ? JSON.parse(fs.readFileSync(keyboardPath, 'utf-8')) : {};

// 1. LEVENSHTEIN (Custo de edição básico)
const levenshtein = (a, b) => {
    const tmp = [];
    for (let i = 0; i <= a.length; i++) tmp[i] = [i];
    for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            tmp[i][j] = Math.min(tmp[i - 1][j] + 1, tmp[i][j - 1] + 1, tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    }
    return tmp[a.length][b.length];
};

// 2. DAMERAU-LEVENSHTEIN (Inversão de letras: "aily" -> "daily")
const damerauLevenshtein = (a, b) => {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            let cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
            }
        }
    }
    return matrix[a.length][b.length];
};

// 3. KEYBOARD DISTANCE (Proximidade física das teclas)
const getKeyboardDist = (a, b) => {
    let dist = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const k1 = keyboard[a[i]];
        const k2 = keyboard[b[i]];
        if (k1 && k2) dist += Math.sqrt(Math.pow(k1[0] - k2[0], 2) + Math.pow(k1[1] - k2[1], 2));
        else if (a[i] !== b[i]) dist += 1;
    }
    return dist + Math.abs(a.length - b.length);
};

// 4. JARO-WINKLER (Similaridade de strings com foco em prefixos)
const jaroWinkler = (s1, s2) => {
    let m = 0;
    if (s1 === s2) return 1;
    let range = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    let s1Matches = [], s2Matches = [];
    for (let i = 0; i < s1.length; i++) {
        let start = Math.max(0, i - range), end = Math.min(i + range + 1, s2.length);
        for (let j = start; j < end; j++) {
            if (!s2Matches[j] && s1[i] === s2[j]) { s1Matches[i] = true; s2Matches[j] = true; m++; break; }
        }
    }
    if (m === 0) return 0;
    let t = 0, k = 0;
    for (let i = 0; i < s1.length; i++) {
        if (s1Matches[i]) {
            while (!s2Matches[k]) k++;
            if (s1[i] !== s2[k]) t++;
            k++;
        }
    }
    let jaro = (m / s1.length + m / s2.length + (m - t / 2) / m) / 3;
    let l = 0, p = 0.1;
    while (s1[l] === s2[l] && l < 4) l++;
    return jaro + l * p * (1 - jaro);
};

export function findBestMatches(input, commandData, limit = 4) {
    const results = [];
    for (const key in commandData) {
        const cmd = commandData[key];
        const aliases = [cmd.nome, ...(cmd.apelidos || [])];
        for (const target of aliases) {
            const jW = jaroWinkler(input, target);
            const dLev = damerauLevenshtein(input, target);
            const kDist = getKeyboardDist(input, target);

            // Filtro relaxado para garantir que sempre haja sugestões se houver proximidade
            if (jW > 0.45 || dLev <= 3 || kDist < 2.5) {
                results.push({ name: target, score: jW, dist: dLev, kDist });
            }
        }
    }
    return [...new Set(results
        .sort((a, b) => b.score - a.score || a.dist - b.dist || a.kDist - b.kDist)
        .map(r => r.name))]
        .slice(0, limit);
}

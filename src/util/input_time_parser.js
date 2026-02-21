/**
 * Utilitário para interpretar datas e horas em linguagem natural (Português).
 * Retorna um timestamp (milissegundos) ou null se não reconhecido.
 */

const DIAS_SEMANA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const MESES = { janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11 };
const MAPA_NUMEROS = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, meia: 30 };

const REGEX_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}))?$/;
const REGEX_BR = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?$/;

// Compilando as regras para evitar recriação de Regex a cada chamada
const REGRAS_DATA = [
    { r: /\b(hoje|agora|nesse instante|hj)\b/, a: (d) => d },
    { r: /\b(amanha|tamanha)\b/, a: (d) => { d.setDate(d.getDate() + 1); return d; } },
    { r: /\b(depois de amanha)\b/, a: (d) => { d.setDate(d.getDate() + 2); return d; } },
    { r: /\b(ontem|onteem)\b/, a: (d) => { d.setDate(d.getDate() - 1); return d; } },
    { r: /\b(anteontem|antontem)\b/, a: (d) => { d.setDate(d.getDate() - 2); return d; } },
    { r: /(?:ha|faz|a)\s*(\d+)\s*dias?|(\d+)\s*dias?\s*atras/, a: (d, m) => { d.setDate(d.getDate() - parseInt(m[1] || m[2])); return d; } },
    { r: /(?:ha|faz|a)\s*(\d+)\s*semanas?|(\d+)\s*semanas?\s*atras/, a: (d, m) => { d.setDate(d.getDate() - (parseInt(m[1] || m[2]) * 7)); return d; } },
    { r: /(?:daqui a|em)\s*(\d+)\s*dias?/, a: (d, m) => { d.setDate(d.getDate() + parseInt(m[1])); return d; } },
    { r: /(?:daqui a|em)\s*(\d+)\s*semanas?/, a: (d, m) => { d.setDate(d.getDate() + (parseInt(m[1]) * 7)); return d; } },
    { r: /\b(fds|fim de semana)\b/, a: (d) => { d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); return d; } },
    { r: /\bultimo dia do mes\b/, a: (d) => { d.setMonth(d.getMonth() + 1, 0); return d; } },
    { r: /\bmeio do mes\b/, a: (d) => { d.setDate(15); return d; } },
    { r: /\bnatal\b/, a: (d, _, ref) => { d.setMonth(11, 25); if (d < ref) d.setFullYear(d.getFullYear() + 1); return d; } },
    { r: /\b(ano novo|reveillon)\b/, a: (d) => { d.setMonth(0, 1); d.setFullYear(d.getFullYear() + 1); return d; } },
    { r: /\b(?:dia\s*)?(\d{1,2})\s*(?:do|de)\s*(\d{1,2})\b/, a: (d, m) => { let mes = parseInt(m[2]) - 1; d.setFullYear(d.getFullYear() + (mes < d.getMonth() ? 1 : 0), mes, parseInt(m[1])); return d; } },
    { r: /(\d{1,2})\s*de\s*([a-z]+)/, a: (d, m) => { let mes = MESES[m[2]]; if(mes===undefined) return null; d.setFullYear(d.getFullYear() + (mes < d.getMonth() ? 1 : 0), mes, parseInt(m[1])); return d; } },
    { r: /\bdia\s*(\d{1,2})\b/, a: (d, m) => { let dia = parseInt(m[1]); if (dia < d.getDate()) d.setMonth(d.getMonth() + 1); d.setDate(dia); return d; } }
];

// Gerando dinamicamente regras relativas aos dias da semana
for (const [diaTexto, valorDia] of Object.entries(DIAS_SEMANA)) {
    REGRAS_DATA.push({
        r: new RegExp(`\\b${diaTexto}\\b`),
        a: (d, _, __, frase) => {
            const atual = d.getDay();
            if (/passad[oa]/.test(frase)) d.setDate(d.getDate() - ((atual - valorDia + 7) % 7 || 7));
            else if (/retrasad[oa]/.test(frase)) d.setDate(d.getDate() - (((atual - valorDia + 7) % 7 || 7) + 7));
            else {
                let avanco = (valorDia - atual + 7) % 7;
                if (/que vem/.test(frase) && avanco <= 1) avanco += 7;
                d.setDate(d.getDate() + avanco);
            }
            return d;
        }
    });
}

const REGRAS_HORA = [
    { r: /(?:ha|faz)\s*(\d+)\s*horas?/, a: (d, m) => ({ h: d.getHours() - parseInt(m[1]), min: d.getMinutes() }) },
    { r: /(?:ha|faz)\s*(\d+)\s*minutos?/, a: (d, m) => ({ h: d.getHours(), min: d.getMinutes() - parseInt(m[1]) }) },
    { r: /\bha pouco\b/, a: (d) => ({ h: d.getHours(), min: d.getMinutes() - 30 }) },
    { r: /(?:daqui a|em)\s*(\d+)\s*horas?/, a: (d, m) => ({ h: d.getHours() + parseInt(m[1]), min: d.getMinutes() }) },
    { r: /(?:daqui a|em)\s*(\d+)\s*minutos?/, a: (d, m) => ({ h: d.getHours(), min: d.getMinutes() + parseInt(m[1]) }) },
    { r: /\bdaqui a pouco\b/, a: (d) => ({ h: d.getHours(), min: d.getMinutes() + 30 }) },
    { r: /\b(agora|nesse instante)\b/, a: (d) => ({ h: d.getHours(), min: d.getMinutes() }) },
    { r: /\bhora do almoco\b/, a: () => ({ h: 12, min: 0 }) },
    { r: /\bfinal do expediente\b/, a: () => ({ h: 18, min: 0 }) },
    { r: /\bmanhazinha\b/, a: () => ({ h: 6, min: 0 }) },
    { r: /\btardinha\b/, a: () => ({ h: 17, min: 0 }) },
    { r: /meio[- ]?dia/, a: () => ({ h: 12, min: 0 }) },
    { r: /meia[- ]?noite/, a: () => ({ h: 0, min: 0 }) },
    { r: /\b(\d+)\s*para\s*as?\s*(\d{1,2}|[a-z]+)\b/, a: (_, m, frase) => {
        let prox = isNaN(m[2]) ? (MAPA_NUMEROS[m[2]] || 0) : parseInt(m[2]);
        return ajustarPeriodo(frase, (prox - 1 < 0 ? 23 : prox - 1), 60 - parseInt(m[1]));
    }},
    { r: /\b(\d{1,2})[:h](\d{2})\b/, a: (_, m, frase) => ajustarPeriodo(frase, parseInt(m[1]), parseInt(m[2])) },
    { r: /\b(\d{1,2}|[a-z]+)\s*e\s*(meia|\d{1,2})\b/, a: (_, m, frase) => {
        let h = isNaN(m[1]) ? (MAPA_NUMEROS[m[1]] || 0) : parseInt(m[1]);
        return ajustarPeriodo(frase, h, m[2] === 'meia' ? 30 : parseInt(m[2]));
    }},
    { r: /\b(?:umas?|das?|as|pelas)?\s*(\d{1,2}|[a-z]+)\s*(?:horas?|hs?)\b|\b(\d{1,2})\s+(?:da|de)\s+(?:manha|tarde|noite|madrugada)\b/, a: (_, m, frase) => {
        let h = isNaN(m[1] || m[2]) ? (MAPA_NUMEROS[m[1] || m[2]] || 0) : parseInt(m[1] || m[2]);
        return h > 0 ? ajustarPeriodo(frase, h, 0) : null;
    }},
    { r: /\b(de|a|da)\s*noite\b/, a: () => ({ h: 20, min: 0 }) },
    { r: /\b(de|da)\s*manha\b/, a: () => ({ h: 9, min: 0 }) },
    { r: /\b(de|da)\s*tarde\b/, a: () => ({ h: 15, min: 0 }) },
    { r: /\bmadrugada\b/, a: () => ({ h: 2, min: 0 }) }
];

function ajustarPeriodo(frase, hora, minuto) {
    if (frase.includes('madrugada') || frase.includes('manha')) {
        if (hora === 12) hora = 0;
    } else if (frase.includes('tarde')) {
        if (hora >= 1 && hora < 12) hora += 12;
    } else if (frase.includes('noite')) {
        if (hora >= 1 && hora < 12) hora += 12;
        if (hora === 12) hora = 0;
    }
    return { h: hora, min: minuto };
}

function parseSingleTime(frase, referenceDate = new Date()) {
    const isoMatch = frase.match(REGEX_ISO);
    if (isoMatch) return new Date(isoMatch[1], isoMatch[2] - 1, isoMatch[3], isoMatch[4] || 0, isoMatch[5] || 0).getTime();

    const brMatch = frase.match(REGEX_BR);
    if (brMatch) return new Date(brMatch[3], brMatch[2] - 1, brMatch[1], brMatch[4] || 0, brMatch[5] || 0).getTime();

    const dataRef = new Date(referenceDate.getTime());
    
    let dataEncontrada = null;
    for (const regra of REGRAS_DATA) {
        const match = frase.match(regra.r);
        if (match) {
            const res = regra.a(new Date(dataRef.getTime()), match, dataRef, frase);
            if (res) { dataEncontrada = res; break; }
        }
    }

    let horaEncontrada = null;
    for (const regra of REGRAS_HORA) {
        const match = frase.match(regra.r);
        if (match) {
            const res = regra.a(dataRef, match, frase);
            if (res) { horaEncontrada = res; break; }
        }
    }

    if (!dataEncontrada && !horaEncontrada) return null;

    dataEncontrada = dataEncontrada || new Date(dataRef.getTime());
    horaEncontrada = horaEncontrada || { h: 0, min: 0 };

    dataEncontrada.setHours(horaEncontrada.h, horaEncontrada.min, 0, 0);
    return dataEncontrada.getTime();
}

export default async function parseInputTime(input, referenceDate = new Date()) {
    if (!input || typeof input !== 'string') return null;

    let frase = input.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');

    // Regex para capturar os conectivos de intervalo (ex: "começou X terminou Y", "de X até Y", "X até Y")
    const rangeMatch = frase.match(/^(?:comecou\s+)?(.*?)\s*(?:e\s+terminou|,\s*terminou|\s+terminou|\s+ate)\s+(.+)$/i) || 
                       frase.match(/^(?:das?|de)\s+(.*?)\s+(?:as?|ate)\s+(.+)$/i);

    if (rangeMatch) {
        const inicioStr = rangeMatch[1].trim();
        const fimStr = rangeMatch[2].trim();
        
        const inicioTS = parseSingleTime(inicioStr, referenceDate);
        if (!inicioTS) return null;

        // Herda a data de início como referência para o fim (cobre casos como "ontem das 15h até as 17h")
        let fimTS = parseSingleTime(fimStr, new Date(inicioTS));
        
        // Se o horário final for menor que o inicial (ex: "23h até as 02h"), avança a data final em um dia
        if (fimTS && fimTS < inicioTS) fimTS += 24 * 60 * 60 * 1000;
        
        return { inicio: inicioTS, fim: fimTS };
    }

    // Fallback para momento único, retornando o fim como null para padronizar o output
    const singleTS = parseSingleTime(frase, referenceDate);
    return singleTS ? { inicio: singleTS, fim: null } : null;
}

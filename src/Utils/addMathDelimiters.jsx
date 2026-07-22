// src/utils/addMathDelimiters.js

// Transforme "u_0=3/2" en "\dfrac{...}{...}" etc. AVANT d'ajouter les $
function toLatexInner(expr) {
  let e = expr;

  // f(x)=(x+2)/(-x+4)  ->  f(x)=\dfrac{x+2}{-x+4}
  e = e.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\dfrac{$1}{$2}');

  // 3/2 -> \dfrac{3}{2} (fraction numérique simple non convertie)
  e = e.replace(/(?<![{\\])(-?\d+)\s*\/\s*(\d+)(?!})/g, '\\dfrac{$1}{$2}');

  // u_0 -> u_{0}, u_n -> u_{n}  (u_{n+1} déjà correct, on ne le touche pas)
  e = e.replace(/([a-zA-Z])_([a-zA-Z0-9]+)(?!\})/g, '$1_{$2}');

  return e;
}

// Prend le texte BRUT (tel qu'il est en base) et retourne le texte
// avec les $...$ ajoutés automatiquement autour des formules détectées.
export function addMathDelimiters(text) {
  if (!text || typeof text !== 'string') return '';

  const patterns = [
    /\([a-zA-Z]_[a-zA-Z0-9]+\)/g,                                       // (u_n)
    /[a-zA-Z]_\{?[a-zA-Z0-9+\-]+\}?\s*=\s*[a-zA-Z0-9()_{}+\-\/.]+/g,     // u_0=3/2, u_{n+1}=f(u_n)
    /[a-zA-Z]\([a-zA-Z]\)\s*=\s*\([^()]*\)\s*\/\s*\([^()]*\)/g,          // f(x)=(x+2)/(-x+4)
    /[a-zA-Z]\s*=\s*\[\d+,\s*\d+\]/g,                                    // I=[1,2]
    /\b[NRQZC]\b(?=\s|$)/g,                                              // N, R, Q, Z, C
  ];

  let matches = [];
  for (const p of patterns) {
    const re = new RegExp(p.source, p.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  matches.sort((a, b) => a.start - b.start);

  // enlève les chevauchements
  const clean = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      clean.push(m);
      lastEnd = m.end;
    }
  }

  // reconstruit le texte en insérant $...$ autour de chaque match détecté
  let result = '';
  let cursor = 0;
  for (const m of clean) {
    result += text.slice(cursor, m.start);

    // cas (u_n) : on garde les parenthèses en dehors du $...$
    const wrapMatch = m.text.match(/^\(([a-zA-Z]_[a-zA-Z0-9]+)\)$/);
    if (wrapMatch) {
      result += `($${toLatexInner(wrapMatch[1])}$)`;
    } else {
      result += `$${toLatexInner(m.text)}$`;
    }
    cursor = m.end;
  }
  result += text.slice(cursor);

  return result;
}
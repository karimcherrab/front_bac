// src/utils/mathParser.js

// Convertit une expression "simple" en syntaxe LaTeX
export function toLatex(expr) {
  if (!expr) return '';
  let e = String(expr).trim();

  // f(x)=(x+2)/(-x+4)  ->  f(x)=\frac{x+2}{-x+4}
  e = e.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}');

  // 3/2 (fraction numérique simple, pas déjà convertie)
  e = e.replace(/(?<![{\\])(-?\d+)\s*\/\s*(\d+)(?!})/g, '\\frac{$1}{$2}');

  // u_0 -> u_{0}, u_n -> u_{n} (u_{n+1} déjà correct)
  e = e.replace(/([a-zA-Z])_([a-zA-Z0-9]+)(?!\})/g, '$1_{$2}');

  // [1,2] -> espacement propre
  e = e.replace(/\[(\d+),\s*(\d+)\]/g, '[$1, $2]');

  return e;
}

// Détecte les segments mathématiques dans un texte brut
export function parseText(text) {
  if (text === undefined || text === null) return [];
  if (typeof text !== 'string') text = String(text);
  if (text.length === 0) return [];

  const patterns = [
    /\([a-zA-Z]_[a-zA-Z0-9]+\)/g,   // (u_n), (u_0)

    // ✅ CORRIGÉ : le côté droit accepte maintenant _ { } ( ) pour capturer f(u_n) en entier
    /[a-zA-Z]_\{?[a-zA-Z0-9+\-]+\}?\s*=\s*[a-zA-Z0-9()_{}+\-\/.]+/g,  // u_0=3/2, u_{n+1}=f(u_n)

    /[a-zA-Z]\([a-zA-Z]\)\s*=\s*\([^()]*\)\s*\/\s*\([^()]*\)/g,  // f(x)=(x+2)/(-x+4)
    /[a-zA-Z]\s*=\s*\[\d+,\s*\d+\]/g,                           // I=[1,2]
    /\b[NRQZC]\b(?=\s|$)/g,                                     // N, R, Q, Z, C
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

  const clean = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      clean.push(m);
      lastEnd = m.end;
    }
  }

  const segments = [];
  let cursor = 0;
  for (const m of clean) {
    if (m.start > cursor) segments.push({ type: 'text', content: text.slice(cursor, m.start) });
    segments.push({ type: 'math', content: m.text });
    cursor = m.end;
  }
  if (cursor < text.length) segments.push({ type: 'text', content: text.slice(cursor) });

  return segments;
}
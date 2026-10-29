(function (root) {
  'use strict';
  const INTRO = 'Bom dia!\n\nFavor verificar o pedido abaixo, pois o mesmo está segurando reserva há mais de 10 dias.';
  const MODELO = 'Pedido: {pedido}\nData: {data}\nCliente: {cliente}';
  function pedido(value) {
    const text = String(value == null ? '' : value).replace(/\s+/g, '');
    if (!text) return '';
    if (!/^\+?\d+(?:\.0+)?$/.test(text)) throw new Error('A coluna B contém um pedido inválido: ' + text.slice(0, 50) + '. Confira a aba selecionada.');
    return BigInt(text.replace(/\.0+$/, '')).toString();
  }
  function limpar(rows) {
    const seen = new Set(), clean = [], removed = [];
    let empty = 0;
    rows.forEach(row => {
      const key = pedido(row[1]);
      if (!key) { empty++; clean.push(row); }
      else if (seen.has(key)) removed.push(row);
      else { seen.add(key); clean.push(row); }
    });
    return {clean, removed, empty};
  }
  function comparar(atual, reserva) {
    const a = limpar(atual), r = limpar(reserva);
    const ak = new Set(a.clean.map(row => pedido(row[1])));
    const rk = new Set(r.clean.map(row => pedido(row[1])));
    return {atual: a.clean, reserva: r.clean, removidasAtual: a.removed, removidasReserva: r.removed,
      somenteReserva: r.clean.filter(row => pedido(row[1]) && !ak.has(pedido(row[1]))),
      somenteAtual: a.clean.filter(row => pedido(row[1]) && !rk.has(pedido(row[1]))), vazias: a.empty + r.empty};
  }
  function textos(rows, intro, model) {
    const fields = new Set(['pedido', 'data', 'cliente', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']);
    for (const match of model.matchAll(/\{([^{}]+)\}/g)) {
      if (!fields.has(match[1])) throw new Error('Campo desconhecido no modelo: ' + match[1]);
    }
    if (!rows.length || !model.trim()) return '';
    const blocks = rows.map(row => {
      const values = {pedido: pedido(row[1]), data: String(row[0] || ''), cliente: String(row[2] || '').replace(/^\s*Cliente\s*:\s*/i, '')};
      [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].forEach((letter, i) => { values[letter] = String(row[i] == null ? '' : row[i]); });
      return model.replace(/\{([^{}]+)\}/g, (_, name) => values[name]);
    });
    return (intro.trim() ? intro.trim() + '\n\n' : '') + blocks.join('\n\n');
  }
  const api = {INTRO, MODELO, pedido, limpar, comparar, textos};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Reservas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

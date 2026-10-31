(function (root) {
  'use strict';
  const INTRO = 'Bom dia!\n\nFavor verificar o pedido abaixo, pois o mesmo está segurando reserva há mais de 10 dias.';
  const MODELO = 'Pedido: {pedido}\nData: {data}\nCliente: {cliente}';
  function lerAba(XLSX, book, name) {
    const sheet = book.Sheets[name];
    if (!sheet) throw new Error('A aba selecionada não existe.');
    // Exportadores podem declarar a planilha inteira como usada, mesmo vazia.
    // Examine as celulas armazenadas, sem percorrer esse retangulo declarado.
    let lastRow = -1, lastColumn = -1;
    for (const address of Object.keys(sheet)) {
      if (!/^[A-Z]+[1-9]\d*$/.test(address)) continue;
      const cell = sheet[address];
      if (!cell || cell.t === 'z') continue;
      if (!cell.f && (cell.v == null || String(cell.v).trim() === '')) continue;
      const position = XLSX.utils.decode_cell(address);
      lastRow = Math.max(lastRow, position.r);
      lastColumn = Math.max(lastColumn, position.c);
      if (lastRow > 100000 || lastColumn > 999) {
        throw new Error('A aba contém dados além do limite de 100 mil linhas ou mil colunas.');
      }
    }
    if (lastRow < 0 || lastColumn < 1) throw new Error('A aba deve ter cabeçalhos e pelo menos duas colunas.');
    const rows = XLSX.utils.sheet_to_json(sheet, {range: {s: {r: 0, c: 0}, e: {r: lastRow, c: lastColumn}}, header: 1, raw: false, defval: '', blankrows: false});
    if (!rows.length || rows[0].length < 2) throw new Error('A aba deve ter cabeçalhos e pelo menos duas colunas.');
    return {header: rows[0], rows: rows.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''))};
  }
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
    return {atual: a.clean, atualNaReserva: a.clean.filter(row => pedido(row[1]) && rk.has(pedido(row[1]))),
      reserva: r.clean, removidasAtual: a.removed, removidasReserva: r.removed,
      somenteReserva: r.clean.filter(row => pedido(row[1]) && !ak.has(pedido(row[1]))),
      somenteAtual: a.clean.filter(row => pedido(row[1]) && !rk.has(pedido(row[1]))), vazias: a.empty + r.empty};
  }
  function textos(rows, intro, model) {
    const fields = new Set(['pedido', 'data', 'cliente', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']);
    for (const match of model.matchAll(/\{([^{}]+)\}/g)) {
      if (!fields.has(match[1])) throw new Error('Campo desconhecido no modelo: ' + match[1]);
    }
    if (!rows.length || !model.trim()) return '';
    const groups = new Map();
    rows.forEach(row => {
      const loja = String(row[3] == null ? '' : row[3]).trim();
      const local = String(row[4] == null ? '' : row[4]).trim();
      const key = JSON.stringify([loja, local]);
      if (!groups.has(key)) groups.set(key, {loja, local, blocks: []});
      const values = {pedido: pedido(row[1]), data: String(row[0] || ''), cliente: String(row[2] || '').replace(/^\s*Cliente\s*:\s*/i, '')};
      [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].forEach((letter, i) => { values[letter] = String(row[i] == null ? '' : row[i]); });
      groups.get(key).blocks.push(model.replace(/\{([^{}]+)\}/g, (_, name) => values[name]));
    });
    return [...groups.values()].map(group => {
      const heading = 'Loja origem: ' + (group.loja || 'Não informada') + '\nLocal origem: ' + (group.local || 'Não informado');
      return heading + '\n\n' + (intro.trim() ? intro.trim() + '\n\n' : '') + group.blocks.join('\n\n');
    }).join('\n\n========================================\n\n');
  }
  const api = {INTRO, MODELO, lerAba, pedido, limpar, comparar, textos};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Reservas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

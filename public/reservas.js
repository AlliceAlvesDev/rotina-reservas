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
  function lerReserva(XLSX, book, name) {
    const source = book.Sheets[name];
    if (!source) throw new Error('A aba selecionada não existe.');
    const headers = ['dt_alteracao', 'nr_doc_origem', 'observacao', 'cgc_f_loja_origem', 'cd_local_origem'];
    const novo = ['AF', 'AI', 'AL', 'AP', 'AQ'];
    const antigo = ['A', 'B', 'C', 'D', 'E'];
    const matches = columns => columns.every((column, i) => String(source[column + '1']?.v ?? '').trim().toLowerCase() === headers[i]);
    const isNew = matches(novo);
    if (!isNew && !matches(antigo)) {
      throw new Error('A aba da Reserva não corresponde ao modelo. Selecione a aba com Data em AF, Pedido em AI, Cliente em AL, Loja em AP e Local em AQ (ou o modelo antigo A–E).');
    }
    const columns = isNew ? novo : antigo;
    const positions = new Map(columns.map((column, i) => [XLSX.utils.decode_col(column), i]));
    const sheet = {};
    let lastRow = 0;
    for (const address of Object.keys(source)) {
      if (!/^[A-Z]+[1-9]\d*$/.test(address)) continue;
      const position = XLSX.utils.decode_cell(address);
      if (!positions.has(position.c)) continue;
      const target = positions.get(position.c);
      const cell = source[address];
      if (!cell) continue;
      // A exportacao nova usa mes/dia na formatacao, mas guarda datas Excel.
      const value = isNew && target === 0 && position.r > 0 && cell.t === 'n' && Number.isFinite(cell.v)
        ? {...cell, w: XLSX.SSF.format('dd/mm/yy hh:mm', cell.v, {date1904: !!book.Workbook?.WBProps?.date1904})}
        : {...cell};
      sheet[XLSX.utils.encode_cell({r: position.r, c: target})] = value;
      lastRow = Math.max(lastRow, position.r);
    }
    sheet['!ref'] = 'A1:E' + (lastRow + 1);
    return lerAba(XLSX, {Sheets: {reserva: sheet}}, 'reserva');
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
  function gruposTextos(rows, intro, model) {
    const fields = new Set(['pedido', 'data', 'cliente', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']);
    for (const match of model.matchAll(/\{([^{}]+)\}/g)) {
      if (!fields.has(match[1])) throw new Error('Campo desconhecido no modelo: ' + match[1]);
    }
    if (!rows.length || !model.trim()) return [];
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
      return {loja: group.loja, local: group.local, quantidade: group.blocks.length,
        texto: heading + '\n\n' + (intro.trim() ? intro.trim() + '\n\n' : '') + group.blocks.join('\n\n')};
    });
  }
  function textos(rows, intro, model) {
    return gruposTextos(rows, intro, model).map(group => group.texto).join('\n\n========================================\n\n');
  }
  const api = {INTRO, MODELO, lerAba, lerReserva, pedido, limpar, comparar, gruposTextos, textos};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Reservas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

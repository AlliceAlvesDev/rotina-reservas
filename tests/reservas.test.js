'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../public/reservas.js');
const X = require('../public/vendor/xlsx.full.min.js');
test('ignora dimensoes e celulas vazias de formatacao fora da tabela real', () => {
  const sheet = X.utils.aoa_to_sheet([['Data', 'Pedido', 'Cliente'], ['01/10/26', '00123', 'Exemplo'], ['', '', ''], ['02/10/26', '456', 'Outro']]);
  sheet['!ref'] = 'A1:XFD1048576';
  sheet.XFD1048576 = {t: 'z', s: {}};
  sheet.Z1000000 = {t: 's', v: ''};
  sheet.Z999999 = {t: 's', v: '  '};
  const book = {Sheets: {modelo: sheet}};
  const data = R.lerAba(X, book, 'modelo');
  assert.deepEqual(data.header, ['Data', 'Pedido', 'Cliente']);
  assert.deepEqual(data.rows.map(row => row[1]), ['00123', '456']);
  assert.equal(sheet['!ref'], 'A1:XFD1048576');
});
test('mantem limites para dados reais sem ocultar pedidos distantes', () => {
  for (const address of ['B100002', 'XFD2']) {
    const sheet = X.utils.aoa_to_sheet([['Data', 'Pedido'], ['data', '123']]);
    sheet[address] = {t: 's', v: '456'};
    assert.throws(() => R.lerAba(X, {Sheets: {modelo: sheet}}, 'modelo'), /contém dados além do limite/);
  }
  const sheet = X.utils.aoa_to_sheet([['Data', 'Pedido'], ['data', '123']]);
  sheet.B100002 = {t: 'n', f: '1+1'};
  assert.throws(() => R.lerAba(X, {Sheets: {modelo: sheet}}, 'modelo'), /contém dados além do limite/);
  assert.throws(() => R.lerAba(X, {Sheets: {modelo: {}}}, 'modelo'), /cabeçalhos/);
});
test('identifica pedidos numericos sem perder precisao', () => {
  for (const v of [' 00 123 ', '123.0', 123]) assert.equal(R.pedido(v), '123');
  assert.equal(R.pedido('12345678901234567890'), '12345678901234567890');
  assert.equal(R.pedido(''), '');
  assert.throws(() => R.pedido('Nome do produto'));
});
test('deduplica, preserva linhas sem pedido e compara os dois lados', () => {
  const r = R.comparar([['data', '01'], ['outra', '1.0'], ['data', '2'], ['sem', ''], ['sem2', '']], [['data', '1'], ['data', '3'], ['data', '03']]);
  assert.equal(r.atual.length, 4); assert.equal(r.removidasAtual.length, 1); assert.equal(r.removidasReserva.length, 1); assert.equal(r.vazias, 2);
  assert.deepEqual(r.somenteAtual.map(row => row[1]), ['2']); assert.deepEqual(r.somenteReserva.map(row => row[1]), ['3']);
  assert.deepEqual(r.atualNaReserva, [['data', '01']]);
});
test('Atual exportada mantem somente pedidos da Reserva enviada e os dados originais', () => {
  const atual = [['data A', '00123', 'Cliente A', '0001', '28'], ['repetida', '123.0'], ['data B', '456', 'Cliente B'], ['data C', '789', 'Cliente C']];
  const reserva = [['outra data', ' 123 ', 'Outro dado'], ['data', '789'], ['data', '999']];
  const r = R.comparar(atual, reserva);
  assert.deepEqual(r.atualNaReserva, [atual[0], atual[3]]);
  assert.deepEqual(r.somenteAtual, [atual[2]]);
  assert.deepEqual(r.somenteReserva, [reserva[2]]);
  assert.equal(r.removidasAtual.length, 1);
  const chavesReserva = new Set(r.reserva.map(row => R.pedido(row[1])));
  assert.ok(r.atualNaReserva.every(row => chavesReserva.has(R.pedido(row[1]))));
  // Uma nova Reserva deve recalcular o filtro, sem reutilizar pedidos antigos.
  assert.deepEqual(R.comparar(atual, [reserva[1]]).atualNaReserva, [atual[3]]);
});
test('Reserva vazia ou sem pedidos em comum produz Atual filtrada vazia, mantendo diferencas', () => {
  const atual = [['data', '123'], ['sem pedido', '']];
  for (const reserva of [[], [['data', '999']], [['sem pedido', '']]]) {
    const r = R.comparar(atual, reserva);
    assert.deepEqual(r.atualNaReserva, []);
    assert.deepEqual(r.somenteAtual, [atual[0]]);
    assert.deepEqual(r.atual, atual);
  }
});
test('introducao unica, cliente sem prefixo e campos editaveis', () => {
  const rows = [['01/10/26', '12', 'Cliente: Exemplo A'], ['02/10/26', '13', 'Exemplo B']];
  const t = R.textos(rows, R.INTRO, R.MODELO);
  assert.equal(t.split('Bom dia!').length - 1, 1); assert.equal(t.split('Pedido: ').length - 1, 2);
  assert.ok(t.includes('Pedido: 12\nData: 01/10/26\nCliente: Exemplo A'));
  assert.equal(R.textos([], R.INTRO, R.MODELO), ''); assert.throws(() => R.textos(rows, '', '{desconhecido}'));
});
test('biblioteca le XLS, XLSX e ODS e exporta valores como texto', () => {
  const rows = [['Data', 'Pedido', 'Cliente'], ['01/10/26', '000123', '=1+1']];
  for (const bookType of ['biff8', 'xlsx', 'ods']) {
    const book = X.utils.book_new(); X.utils.book_append_sheet(book, X.utils.aoa_to_sheet(rows), 'modelo');
    const bytes = X.write(book, {bookType, type: 'buffer'}), read = X.read(bytes, {type: 'buffer'});
    assert.deepEqual(X.utils.sheet_to_json(read.Sheets.modelo, {header: 1, raw: false}), rows); assert.equal(read.Sheets.modelo.C2.f, undefined);
  }
});
test('separa mensagens pela combinacao loja D e local E com introducao por canal', () => {
  const rows = [
    ['01/10/26', '101', 'Cliente: A', '0001', '28'],
    ['02/10/26', '102', 'Cliente: B', '0001', '58'],
    ['03/10/26', '103', 'Cliente: C', '0002', '28'],
    ['04/10/26', '104', 'Cliente: D', ' 0001 ', '28'],
  ];
  const text = R.textos(rows, R.INTRO, R.MODELO);
  const groups = text.split('\n\n========================================\n\n');
  assert.equal(groups.length, 3);
  assert.ok(groups[0].startsWith('Loja origem: 0001\nLocal origem: 28\n\nBom dia!'));
  assert.ok(groups[0].includes('Pedido: 101\n'));
  assert.ok(groups[0].includes('Pedido: 104\n'));
  assert.ok(!groups[0].includes('Pedido: 102\n'));
  assert.ok(!groups[0].includes('Pedido: 103\n'));
  assert.ok(groups[1].startsWith('Loja origem: 0001\nLocal origem: 58'));
  assert.ok(groups[1].includes('Pedido: 102\n'));
  assert.ok(groups[2].startsWith('Loja origem: 0002\nLocal origem: 28'));
  assert.ok(groups[2].includes('Pedido: 103\n'));
  assert.equal(text.split('Bom dia!').length - 1, 3);
  assert.equal(text.split('Pedido: ').length - 1, 4);
  assert.equal(R.textos(rows, '', 'Pedido {pedido} / {D} / {E}').includes('Bom dia!'), false);
});
test('campos de origem vazios sao identificados sem perder pedidos', () => {
  const text = R.textos([['data', '1', 'Cliente'], ['data', '2', 'Cliente', '0001', '']], '', R.MODELO);
  assert.ok(text.includes('Loja origem: Não informada\nLocal origem: Não informado'));
  assert.ok(text.includes('Loja origem: 0001\nLocal origem: Não informado'));
  assert.equal(text.split('Pedido: ').length - 1, 2);
});

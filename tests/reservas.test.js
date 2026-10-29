'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../public/reservas.js');
const X = require('../public/vendor/xlsx.full.min.js');
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

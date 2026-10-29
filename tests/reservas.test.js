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

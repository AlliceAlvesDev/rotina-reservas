'use strict';
const $ = id => document.getElementById(id);
const livros = {atual: null, reserva: null};
let resultado = null, dadosAtual = null, dadosReserva = null;
const revisoes = {atual: 0, reserva: 0};
$('introducao').value = Reservas.INTRO;
$('modelo').value = Reservas.MODELO;
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function invalidar() { resultado = null; $('resultados').hidden = true; $('mensagem').hidden = true; }
async function carregar(tipo) {
  const revision = ++revisoes[tipo];
  invalidar(); livros[tipo] = null;
  const select = $(tipo === 'atual' ? 'abaAtual' : 'abaReserva');
  select.replaceChildren(); select.disabled = true; $('comparar').disabled = true;
  const file = $(tipo).files[0];
  if (!file) { status('Selecione os dois arquivos para começar.'); return; }
  try {
    if (file.size > 15 * 1024 * 1024) throw new Error('O limite é de 15 MB por arquivo.');
    status('Lendo planilha…');
    const buffer = await file.arrayBuffer();
    if (revisoes[tipo] !== revision) return;
    const book = XLSX.read(buffer, {type: 'array', sheetRows: 100002});
    if (!book.SheetNames.length) throw new Error('O arquivo não contém abas.');
    livros[tipo] = book;
    book.SheetNames.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; select.append(option); });
    if (tipo === 'reserva' && book.SheetNames.includes('modelo')) select.value = 'modelo';
    select.disabled = false;
    status('Confira as abas e clique em Comparar pedidos.');
  } catch (error) { status('Não foi possível ler o arquivo: ' + error.message, true); }
  $('comparar').disabled = !(livros.atual && livros.reserva);
}
function ler(book, name) {
  const sheet = book.Sheets[name];
  const range = sheet['!fullref'] || sheet['!ref'];
  if (range) { const r = XLSX.utils.decode_range(range); if (r.e.r > 100000 || r.e.c > 999) throw new Error('A aba excede o limite de 100 mil linhas ou mil colunas.'); }
  const rows = XLSX.utils.sheet_to_json(sheet, {header: 1, raw: false, defval: '', blankrows: false});
  if (!rows.length || rows[0].length < 2) throw new Error('A aba deve ter cabeçalhos e pelo menos duas colunas.');
  const header = rows[0];
  return {header, rows: rows.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''))};
}
function tabela(id, data, rows) {
  const target = $(id); target.replaceChildren();
  if (!rows.length) { target.textContent = 'Nenhum pedido nesta lista.'; return; }
  const table = document.createElement('table'), head = document.createElement('thead'), body = document.createElement('tbody');
  const top = document.createElement('tr'); data.header.forEach(value => { const th = document.createElement('th'); th.textContent = value; top.append(th); }); head.append(top);
  rows.slice(0, 200).forEach(row => { const tr = document.createElement('tr'); data.header.forEach((_, i) => { const td = document.createElement('td'); td.textContent = row[i] || ''; tr.append(td); }); body.append(tr); });
  table.append(head, body); target.append(table);
  if (rows.length > 200) { const p = document.createElement('p'); p.textContent = 'Prévia limitada a 200 linhas; o arquivo baixado inclui todas.'; target.append(p); }
}
function atualizarTexto() {
  if (!resultado) return;
  try {
    $('texto').value = Reservas.textos(resultado.somenteReserva, $('introducao').value, $('modelo').value);
    $('erroTexto').textContent = resultado.somenteReserva.length ? '' : 'Nenhum pedido somente na Reserva: não há mensagem para gerar.';
  } catch (error) { $('texto').value = ''; $('erroTexto').textContent = error.message; }
  $('baixarTexto').disabled = $('copiar').disabled = !$('texto').value;
}
function comparar() {
  invalidar();
  try {
    dadosAtual = ler(livros.atual, $('abaAtual').value); dadosReserva = ler(livros.reserva, $('abaReserva').value);
    resultado = Reservas.comparar(dadosAtual.rows, dadosReserva.rows);
    const metrics = $('metricas'); metrics.replaceChildren();
    [['Repetidas na Atual', resultado.removidasAtual.length], ['Repetidas na Reserva', resultado.removidasReserva.length], ['Somente na Reserva', resultado.somenteReserva.length], ['Somente na Atual', resultado.somenteAtual.length]].forEach(([name, count]) => {
      const div = document.createElement('div'); div.className = 'metric'; const strong = document.createElement('strong'); strong.textContent = count; div.append(document.createTextNode(name), strong); metrics.append(div);
    });
    const warnings = [];
    if (resultado.vazias) warnings.push(resultado.vazias + ' linha(s) sem pedido foram preservadas e excluídas da comparação.');
    if (!dadosAtual.rows.length || !dadosReserva.rows.length) warnings.push('Uma aba está vazia. Confira a seleção antes de usar o resultado.');
    $('aviso').textContent = warnings.join(' ');
    tabela('tabelaReserva', dadosReserva, resultado.somenteReserva); tabela('tabelaAtual', dadosAtual, resultado.somenteAtual);
    $('resultados').hidden = false; $('mensagem').hidden = false; atualizarTexto(); status('Comparação concluída. Os arquivos originais permanecem intactos.');
  } catch (error) { resultado = null; status(error.message, true); }
}
function baixarXlsx(nome, abas) {
  const book = XLSX.utils.book_new();
  abas.forEach(([name, header, rows]) => {
    const values = [header, ...rows].map(row => row.map(value => String(value == null ? '' : value)));
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(values), name.slice(0, 31));
  });
  XLSX.writeFile(book, nome, {bookType: 'xlsx'});
}
$('atual').addEventListener('change', () => carregar('atual'));
$('reserva').addEventListener('change', () => carregar('reserva'));
['abaAtual', 'abaReserva'].forEach(id => $(id).addEventListener('change', () => { invalidar(); status('Aba alterada. Clique em Comparar pedidos novamente.'); }));
$('comparar').addEventListener('click', comparar);
['introducao', 'modelo'].forEach(id => $(id).addEventListener('input', atualizarTexto));
$('baixarAtual').addEventListener('click', () => baixarXlsx('atual_sem_duplicatas.xlsx', [['Atual', dadosAtual.header, resultado.atualNaReserva]]));
$('baixarReserva').addEventListener('click', () => baixarXlsx('reserva_sem_duplicatas.xlsx', [['Reserva', dadosReserva.header, resultado.reserva]]));
$('baixarComparacao').addEventListener('click', () => baixarXlsx('comparacao.xlsx', [
  ['Atual sem duplicatas', dadosAtual.header, resultado.atualNaReserva], ['Reserva sem duplicatas', dadosReserva.header, resultado.reserva],
  ['Atual antes do filtro', dadosAtual.header, resultado.atual],
  ['Somente na Reserva', dadosReserva.header, resultado.somenteReserva], ['Somente na Atual', dadosAtual.header, resultado.somenteAtual],
  ['Removidas da Atual', dadosAtual.header, resultado.removidasAtual], ['Removidas da Reserva', dadosReserva.header, resultado.removidasReserva]]));
$('baixarTexto').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob(['\ufeff', $('texto').value], {type: 'text/plain;charset=utf-8'}));
  const link = document.createElement('a'); link.href = url; link.download = 'textos_para_remocao.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('copiar').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('texto').value); $('erroTexto').textContent = 'Mensagem copiada.'; }
  catch (_) { $('erroTexto').textContent = 'Selecione a mensagem e use Ctrl+C para copiar.'; }
});

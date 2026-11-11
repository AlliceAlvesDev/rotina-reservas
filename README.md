# Rotina de reservas

Aplicação para comparar pedidos em arquivos XLS, XLSX e ODS, remover repetições e gerar a mensagem para os pedidos somente na Reserva.

## Windows sem Python

Baixe o ZIP do repositório, extraia tudo e abra **iniciar.bat**. O PowerShell inicia um servidor restrito à própria máquina e abre o Chrome, ou o navegador padrão. A comparação acontece no navegador, sem enviar as planilhas ao servidor. Todas as bibliotecas já estão incluídas; não precisa de internet durante o uso. Veja [LEIA-ME-WINDOWS.txt](LEIA-ME-WINDOWS.txt).

A interface usa a porta 8502, oferece downloads XLSX separados e mensagem TXT. Limites: 15 MB por arquivo e 100 mil linhas por aba. Não há upload HTTP de planilhas nem exclusão em sistemas externos.

Arquivos da versão sem Python: `iniciar.bat`, `Servidor-Reservas.ps1` e `public/`. A biblioteca SheetJS CE 0.20.3 está incluída em `public/vendor/`, com licença, origem e integridade do pacote de distribuição. Testes da lógica e dos formatos: `node --test tests/reservas.test.js` (Node é necessário apenas para desenvolvimento/testes).

## Regras

- A primeira linha contém cabeçalhos. Na Atual, o pedido está na coluna B. A Reserva nova usa somente AF (`dt_alteracao`), AI (`nr_doc_origem`), AL (`observacao`), AP (`cgc_f_loja_origem`) e AQ (`cd_local_origem`). Essas colunas são convertidas, nessa ordem, em A–E na Reserva processada e nos downloads. Datas numéricas da nova exportação são formatadas em dia/mês/ano e hora. O modelo antigo A–E continua aceito.
- Números inteiros, texto numérico, espaços e zeros à esquerda são normalizados para comparação. A primeira linha de cada pedido é mantida.
- Linhas sem pedido são preservadas e sinalizadas; não entram na comparação. Pedidos inválidos interrompem a operação para evitar usar uma coluna incorreta.
- Somente na Reserva e somente na Atual são calculados depois da deduplicação, usando os arquivos enviados antes do filtro de exportação.
- `atual_sem_duplicatas.xlsx` contém apenas pedidos da Atual que também constam na Reserva enviada, sem repetições. Linhas sem pedido não entram nesse arquivo. A Reserva sem duplicatas mantém todos os seus pedidos. O relatório inclui as diferenças e a aba `Atual antes do filtro` para conferência, inclusive das linhas sem pedido.
- Há downloads separados para as duas planilhas limpas e o relatório com diferenças e linhas removidas, em XLSX. São exportados os valores das abas selecionadas, sem preservar formatação, fórmulas, macros ou demais abas.
- Cada combinação de loja origem (D) e local origem (E) tem um card com sua própria introdução e os pedidos somente na Reserva daquele canal. Cada card permite copiar ou baixar seu TXT separadamente. A mensagem completa permanece disponível em uma área expansível. Cada mensagem repete Pedido, Data e Cliente por pedido. `{pedido}` usa o número normalizado, `{data}` a coluna A e `{cliente}` a coluna C sem o prefixo "Cliente:". `{A}`, `{B}`, `{C}` etc. usam os valores originais da linha na Reserva. A introdução e o bloco podem ser editados na aplicação. A comparação não aplica filtro adicional de idade da reserva.
- Nenhuma reserva é excluída de um sistema externo.

## Testes

```sh
node --test tests/reservas.test.js
```

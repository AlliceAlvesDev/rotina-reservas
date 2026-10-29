# Rotina de reservas

Aplicação para comparar pedidos em arquivos XLS, XLSX e ODS, remover repetições e gerar a mensagem para os pedidos somente na Reserva.

## Windows sem Python

Baixe o ZIP do repositório, extraia tudo e abra **iniciar.bat**. O PowerShell inicia um servidor restrito à própria máquina e abre o Chrome, ou o navegador padrão. A comparação acontece no navegador, sem enviar as planilhas ao servidor. Todas as bibliotecas já estão incluídas; não precisa de internet durante o uso. Veja [LEIA-ME-WINDOWS.txt](LEIA-ME-WINDOWS.txt).

A interface usa a porta 8502, oferece downloads XLSX separados e mensagem TXT. Limites: 15 MB por arquivo e 100 mil linhas por aba. Não há upload HTTP de planilhas nem exclusão em sistemas externos.

Arquivos da versão sem Python: `iniciar.bat`, `Servidor-Reservas.ps1` e `public/`. A biblioteca SheetJS CE 0.20.3 está incluída em `public/vendor/`, com licença, origem e integridade do pacote de distribuição. Testes da lógica e dos formatos: `node --test tests/reservas.test.js` (Node é necessário apenas para desenvolvimento/testes).

## Regras

- A primeira linha contém cabeçalhos; o pedido está na coluna B.
- Números inteiros, texto numérico, espaços e zeros à esquerda são normalizados para comparação. A primeira linha de cada pedido é mantida.
- Linhas sem pedido são preservadas e sinalizadas; não entram na comparação. Pedidos inválidos interrompem a operação para evitar usar uma coluna incorreta.
- Somente na Reserva e somente na Atual são calculados depois da deduplicação. As diferenças não são apagadas automaticamente.
- Há downloads separados para as duas planilhas limpas e o relatório com diferenças e linhas removidas, em XLSX. São exportados os valores das abas selecionadas, sem preservar formatação, fórmulas, macros ou demais abas.
- A mensagem começa com a saudação e o aviso fornecidos pelo usuário, uma única vez. Depois repete Pedido, Data e Cliente para cada pedido somente na Reserva. `{pedido}` usa o número normalizado, `{data}` a coluna A e `{cliente}` a coluna C sem o prefixo "Cliente:". `{A}`, `{B}`, `{C}` etc. usam os valores originais da linha na Reserva. A introdução e o bloco podem ser editados na aplicação. A comparação não aplica filtro adicional de idade da reserva.
- Nenhuma reserva é excluída de um sistema externo.

## Testes

```sh
node --test tests/reservas.test.js
```

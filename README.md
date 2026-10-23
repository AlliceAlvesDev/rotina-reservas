# Rotina de reservas

Aplicação local para comparar pedidos em arquivos XLS, XLSX e ODS. Envie a Atual e a Reserva, selecione as abas e baixe os resultados em ZIP. Os arquivos enviados não são gravados pelo aplicativo.

Para usar pelo navegador sem instalar Python na máquina dos usuários, veja [HOSPEDAGEM.md](HOSPEDAGEM.md).

## Executar

No Windows, instale Python 3.12 de 64 bits com o Python Launcher, extraia o ZIP do GitHub e abra `instalar.bat`. Depois abra `iniciar.bat`. Veja `LEIA-ME-WINDOWS.txt` para o passo a passo.

Requer Python 3.11 ou superior.

```sh
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m streamlit run app.py --server.address 0.0.0.0 --server.port 8501
```

## Regras

- A primeira linha contém cabeçalhos; o pedido está na coluna B.
- Números inteiros, texto numérico, espaços e zeros à esquerda são normalizados para comparação. A primeira linha de cada pedido é mantida.
- Linhas sem pedido são preservadas e sinalizadas; não entram na comparação. Pedidos inválidos interrompem a operação para evitar usar uma coluna incorreta.
- Somente na Reserva e somente na Atual são calculados depois da deduplicação. As diferenças não são apagadas automaticamente.
- O ZIP contém as duas planilhas limpas e um relatório com diferenças e linhas removidas, em XLSX. São exportados os valores das abas selecionadas, sem preservar formatação, fórmulas, macros ou demais abas.
- A mensagem começa com a saudação e o aviso fornecidos pelo usuário, uma única vez. Depois repete Pedido, Data e Cliente para cada pedido somente na Reserva. `{pedido}` usa o número normalizado, `{data}` a coluna A e `{cliente}` a coluna C sem o prefixo "Cliente:". `{A}`, `{B}`, `{C}` etc. usam os valores originais da linha na Reserva. A introdução e o bloco podem ser editados na aplicação. A comparação não aplica filtro adicional de idade da reserva.
- Nenhuma reserva é excluída de um sistema externo.

## Testes

```sh
.venv/bin/python -m unittest discover -s tests -v
```

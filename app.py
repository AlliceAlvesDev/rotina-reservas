import streamlit as st

from reservas import abrir_planilha, ler_aba, comparar, gerar_textos, pacote, INTRODUCAO, MODELO_PEDIDO

st.set_page_config(page_title="Rotina de reservas", page_icon="📋", layout="wide")
st.title("Rotina de reservas")
st.write("Remova pedidos repetidos, compare as planilhas e prepare os textos para solicitar a remoção de reservas.")
st.info("O pedido é identificado pela coluna B. A primeira ocorrência é mantida; espaços e zeros à esquerda são ignorados na comparação. Os arquivos originais permanecem intactos.")

col1, col2 = st.columns(2)
with col1:
    atual = st.file_uploader("Planilha Atual", type=["xls", "xlsx", "ods"])
with col2:
    reserva = st.file_uploader("Planilha Reserva", type=["xls", "xlsx", "ods"])

if not (atual and reserva):
    st.write("Envie as duas planilhas para começar. A primeira linha de cada aba deve conter os cabeçalhos.")
    st.stop()

try:
    with abrir_planilha(atual.getvalue(), atual.name) as arq_atual, abrir_planilha(reserva.getvalue(), reserva.name) as arq_reserva:
        with col1:
            aba_atual = st.selectbox("Aba da Atual", arq_atual.sheet_names)
        with col2:
            nomes = arq_reserva.sheet_names
            aba_reserva = st.selectbox("Aba da Reserva", nomes, index=nomes.index("modelo") if "modelo" in nomes else 0)
        dados_atual = ler_aba(arq_atual, aba_atual)
        dados_reserva = ler_aba(arq_reserva, aba_reserva)
    st.caption("Confira a aba e a coluna B nas amostras antes de usar o resultado.")
    with st.expander("Conferir as planilhas enviadas"):
        st.write("Atual")
        st.dataframe(dados_atual.head(5), hide_index=True)
        st.write("Reserva")
        st.dataframe(dados_reserva.head(5), hide_index=True)
    resultado, sem_pedido = comparar(dados_atual, dados_reserva)
except Exception as erro:
    st.error(f"Não foi possível processar as planilhas: {erro}")
    st.stop()

if dados_atual.empty or dados_reserva.empty:
    st.warning("Uma das abas está vazia. Confira se selecionou a aba correta antes de usar a comparação.")
if sem_pedido:
    st.warning(f"Há {sem_pedido} linha(s) sem pedido na coluna B. Foram preservadas e não entram na comparação.")

metricas = st.columns(4)
for coluna, nome in zip(metricas, ["Removidas da Atual", "Removidas da Reserva", "Somente na Reserva", "Somente na Atual"]):
    coluna.metric(nome, len(resultado[nome]))
st.caption("As linhas removidas são apenas repetições do mesmo pedido. Pedidos presentes em apenas uma das planilhas são listados para sua análise.")

for aba, nome in zip(st.tabs(list(resultado)), resultado):
    with aba:
        st.dataframe(resultado[nome], hide_index=True, width="stretch")

st.subheader("Texto para os pedidos que estão somente na Reserva")
st.write("A introdução aparece uma única vez. O bloco com pedido, data e cliente se repete para cada pedido somente na Reserva.")
st.caption("Data: coluna A da Reserva. Cliente: coluna C. O texto usa a seleção da comparação, sem aplicar filtro adicional de idade da reserva.")
st.caption("Colunas da Reserva: " + " · ".join(f"{chr(65+i)}: {nome}" for i, nome in enumerate(dados_reserva.columns[:26])))
introducao = st.text_area("Introdução (uma vez no início)", value=INTRODUCAO, height=120)
modelo = st.text_area("Bloco repetido por pedido", value=MODELO_PEDIDO, height=140, help="Use {pedido}, {data}, {cliente} ou as letras das colunas, como {A} e {C}.")
textos = None
if modelo.strip():
    try:
        textos = gerar_textos(resultado["Somente na Reserva"], modelo, introducao)
        if textos:
            st.text_area("Textos preenchidos", textos, height=240)
            st.download_button("Baixar textos", textos.encode("utf-8"), "textos_para_remocao.txt", "text/plain")
        else:
            st.success("Nenhum pedido somente na Reserva: não há textos para gerar.")
    except ValueError as erro:
        st.error(str(erro))

st.download_button("Baixar planilhas e comparação (ZIP)", pacote(resultado, textos), "resultado_reservas.zip", "application/zip", type="primary")
st.caption("As planilhas de saída são XLSX e preservam os valores das abas selecionadas, sem reproduzir a formatação ou outras abas do arquivo original. Nenhuma reserva é excluída de sistemas externos.")

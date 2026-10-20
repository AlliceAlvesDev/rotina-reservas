"""Leitura e comparação sem alterar os arquivos originais."""
from decimal import Decimal, InvalidOperation
from io import BytesIO
import re
import zipfile

import pandas as pd

INTRODUCAO = "Bom dia!\n\nFavor verificar o pedido abaixo, pois o mesmo está segurando reserva há mais de 10 dias."
MODELO_PEDIDO = "Pedido: {pedido}\nData: {data}\nCliente: {cliente}"

def normalizar_pedido(valor):
    if pd.isna(valor):
        return ""
    texto = re.sub(r"\s+", "", str(valor))
    if not texto:
        return ""
    # Identificadores são inteiros: não arredondar códigos fracionários.
    if not re.fullmatch(r"\+?\d+(?:\.0+)?", texto):
        raise ValueError(f"Número de pedido inválido na coluna B: {str(valor)[:60]!r}")
    try:
        return str(int(Decimal(texto)))
    except (InvalidOperation, ValueError, OverflowError):
        raise ValueError("Número de pedido inválido na coluna B.") from None


def abrir_planilha(conteudo, nome):
    extensao = nome.lower().rsplit(".", 1)[-1]
    motores = {"xls": "xlrd", "xlsx": "openpyxl", "ods": "odf"}
    if extensao not in motores:
        raise ValueError("Envie arquivos XLS, XLSX ou ODS.")
    return pd.ExcelFile(BytesIO(conteudo), engine=motores[extensao])


def ler_aba(planilha, aba):
    # Leitura textual evita converter códigos e documentos em números.
    dados = pd.read_excel(planilha, sheet_name=aba, dtype=str, keep_default_na=False)
    if dados.shape[1] < 2:
        raise ValueError("A aba precisa ter pelo menos duas colunas, com o pedido na B.")
    return dados.loc[~dados.eq("").all(axis=1)].reset_index(drop=True)


def limpar(dados):
    chaves = dados.iloc[:, 1].map(normalizar_pedido)
    repetidas = chaves.ne("") & chaves.duplicated(keep="first")
    return dados.loc[~repetidas].copy(), dados.loc[repetidas].copy(), int(chaves.eq("").sum())


def comparar(atual, reserva):
    atual_limpa, removidas_atual, vazias_atual = limpar(atual)
    reserva_limpa, removidas_reserva, vazias_reserva = limpar(reserva)
    a = atual_limpa.iloc[:, 1].map(normalizar_pedido)
    r = reserva_limpa.iloc[:, 1].map(normalizar_pedido)
    return {
        "Atual sem duplicatas": atual_limpa,
        "Reserva sem duplicatas": reserva_limpa,
        "Somente na Reserva": reserva_limpa.loc[r.ne("") & ~r.isin(set(a))].copy(),
        "Somente na Atual": atual_limpa.loc[a.ne("") & ~a.isin(set(r))].copy(),
        "Removidas da Atual": removidas_atual,
        "Removidas da Reserva": removidas_reserva,
    }, vazias_atual + vazias_reserva


def campos(dados):
    # Letras são estáveis mesmo quando os cabeçalhos são repetidos.
    return [chr(65 + i) for i in range(min(len(dados.columns), 26))]


def gerar_textos(dados, modelo, introducao=""):
    permitidos = {"pedido", "data", "cliente", *campos(dados)}
    marcadores = re.findall(r"\{([^{}]+)\}", modelo)
    desconhecidos = set(marcadores) - permitidos
    if desconhecidos:
        raise ValueError("Campos desconhecidos no texto: " + ", ".join(sorted(desconhecidos)))
    resultado = []
    for _, linha in dados.iterrows():
        valores = {letra: str(linha.iloc[i]) for i, letra in enumerate(campos(dados))}
        valores["pedido"] = normalizar_pedido(linha.iloc[1])
        valores["data"] = str(linha.iloc[0])
        valores["cliente"] = re.sub(r"^\s*Cliente\s*:\s*", "", str(linha.iloc[2]), flags=re.IGNORECASE) if len(linha) > 2 else ""
        resultado.append(re.sub(r"\{([^{}]+)\}", lambda m: valores[m.group(1)], modelo))
    if not resultado:
        return ""
    blocos = "\n\n".join(resultado)
    return introducao.strip() + "\n\n" + blocos if introducao.strip() else blocos


def excel(abas):
    saida = BytesIO()
    with pd.ExcelWriter(saida, engine="openpyxl") as writer:
        for nome, dados in abas.items():
            dados.to_excel(writer, sheet_name=nome[:31], index=False)
        # Conteúdo de arquivos e modelos é dado, nunca fórmula executável.
        for aba in writer.book:
            for linha in aba:
                for celula in linha:
                    if celula.data_type == "f":
                        celula.data_type = "s"
    return saida.getvalue()


def pacote(resultado, textos=None):
    saida = BytesIO()
    with zipfile.ZipFile(saida, "w", zipfile.ZIP_DEFLATED) as arquivo:
        arquivo.writestr("atual_sem_duplicatas.xlsx", excel({"Atual": resultado["Atual sem duplicatas"]}))
        arquivo.writestr("reserva_sem_duplicatas.xlsx", excel({"Reserva": resultado["Reserva sem duplicatas"]}))
        arquivo.writestr("comparacao.xlsx", excel(resultado))
        if textos is not None:
            arquivo.writestr("textos_para_remocao.txt", textos)
    return saida.getvalue()

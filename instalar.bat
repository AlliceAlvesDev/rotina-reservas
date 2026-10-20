@echo off
setlocal
cd /d "%~dp0"
echo Preparando o programa de reservas...
where py >nul 2>nul
if errorlevel 1 (
    echo Instale o Python 3.12 de 64 bits com o Python Launcher.
    echo Se a empresa restringir instalacoes, solicite ajuda ao TI.
    pause
    exit /b 1
)
py -3.12 -c "import struct, sys; sys.exit(0 if struct.calcsize('P') == 8 else 1)"
if errorlevel 1 (
    echo E necessario instalar o Python 3.12 de 64 bits com o Python Launcher.
    pause
    exit /b 1
)
py -3.12 -m venv .venv
if errorlevel 1 goto erro
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto erro
".venv\Scripts\python.exe" -m unittest discover -s tests -v
if errorlevel 1 goto erro
echo Instalacao concluida. Abra iniciar.bat para usar o programa.
pause
exit /b 0
:erro
echo A instalacao nao foi concluida. Copie a mensagem de erro para obter ajuda.
pause
exit /b 1

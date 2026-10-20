@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Execute instalar.bat primeiro.
    pause
    exit /b 1
)
echo Abra http://localhost:8501 no navegador.
echo Mantenha esta janela aberta durante o uso. Para encerrar, pressione Ctrl+C.
".venv\Scripts\python.exe" -m streamlit run app.py --server.address 127.0.0.1 --server.port 8501 --browser.gatherUsageStats false
if errorlevel 1 pause

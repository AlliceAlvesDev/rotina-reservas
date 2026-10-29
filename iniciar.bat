@echo off
setlocal
cd /d "%~dp0"
echo Iniciando a versao local sem Python...
powershell.exe -NoLogo -NoProfile -File "%~dp0Servidor-Reservas.ps1"
if errorlevel 1 pause

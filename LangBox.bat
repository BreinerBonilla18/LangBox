@echo off
title Iniciar LangBox

echo Iniciando Frontend...
start "Servidor Frontend" cmd /k "npm run dev"

echo Esperando a que los servidores inicien...
timeout /t 5 /nobreak > nul

echo Abriendo el frontend en el navegador...
start http://localhost:5173

exit
@echo off
echo ========================================
echo Instalando dependencias do backend...
echo ========================================
cd backend
call npm install
echo.
echo ========================================
echo Backend instalado com sucesso!
echo ========================================
echo.
echo ========================================
echo Instalando servidor estatico para frontend...
echo ========================================
cd .. 
call npm install -g serve
echo.
echo ========================================
echo Instalacao concluida!
echo ========================================
echo.
echo Para iniciar o backend, execute:
echo   cd backend
echo   npm run dev
echo.
echo Para iniciar o frontend, em outro terminal:
echo   cd frontend
echo   serve -p 3000
echo.
pause
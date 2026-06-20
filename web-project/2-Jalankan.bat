@echo off
cd /d "%~dp0"
echo Folder kerja: %cd%
echo.
echo Menjalankan dashboard... Setelah muncul tulisan "Local: http://localhost...",
echo buka link tersebut di browser ^(Chrome/Edge^).
echo.
echo Jendela ini HARUS tetap terbuka selama dashboard dipakai. Tutup jendela ini
echo kalau mau mematikan dashboard.
echo.
call npm run dev
pause

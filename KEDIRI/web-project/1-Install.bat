@echo off
cd /d "%~dp0"
echo Folder kerja: %cd%
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ============================================
  echo Node.js belum terinstall di komputer ini.
  echo Download dulu di https://nodejs.org ^(pilih tombol "LTS"^),
  echo install seperti software biasa, lalu jalankan file ini lagi.
  echo ============================================
  pause
  exit /b
)

echo Node.js ditemukan. Menginstall dependencies, mohon tunggu ^(bisa beberapa menit^)...
echo.
call npm install

echo.
echo ============================================
echo Selesai! Sekarang jalankan file "2-Jalankan.bat"
echo untuk membuka dashboard di komputer ini.
echo ============================================
pause

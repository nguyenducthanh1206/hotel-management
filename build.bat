@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo [1/3] Build giao dien web (React)...
pushd frontend
call npm install
if errorlevel 1 goto :err
call npm run build
if errorlevel 1 goto :err
popd

echo [2/3] Chep giao dien vao backend...
if exist backend\HotelApi\wwwroot rmdir /s /q backend\HotelApi\wwwroot
xcopy /e /i /y frontend\dist backend\HotelApi\wwwroot >nul
if errorlevel 1 goto :err

echo [3/3] Dong goi thanh HotelApi.exe (can mang lan dau de tai goi runtime)...
if exist release rmdir /s /q release
dotnet publish backend\HotelApi -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:DebugType=none -o release
if errorlevel 1 goto :err

echo.
echo XONG. Chay file: release\HotelApi.exe
echo (Can PostgreSQL dang chay va mat khau trong release\appsettings.json dung.)
pause
exit /b 0

:err
echo.
echo CO LOI o buoc tren. Chup man hinh/sao chep thong bao loi de duoc ho tro.
pause
exit /b 1

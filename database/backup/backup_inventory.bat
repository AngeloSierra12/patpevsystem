@echo off
setlocal

set "BACKUP_DIR=C:\xampp\mysql\patvep_backups"
set "KEEP_DAYS=14"
set "MYSQLDUMP=C:\xampp\mysql\bin\mysqldump.exe"
set "DB=bpsu_patvep_inventory"

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "TS=%%i"
set "OUT=%BACKUP_DIR%\%DB%_%TS%.sql"

"%MYSQLDUMP%" -uroot -h127.0.0.1 -P3306 --single-transaction --routines --triggers --databases %DB% > "%OUT%" 2> "%OUT%.err"

if errorlevel 1 (
    echo %TS% FAILED - see %OUT%.err >> "%BACKUP_DIR%\backup_log.txt"
    del "%OUT%"
    exit /b 1
)
del "%OUT%.err"
echo %TS% OK %OUT% >> "%BACKUP_DIR%\backup_log.txt"

forfiles /p "%BACKUP_DIR%" /m "%DB%_*.sql" /d -%KEEP_DAYS% /c "cmd /c del @path" 2>nul
exit /b 0

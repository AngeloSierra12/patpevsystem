@echo off
rem ============================================================================
rem Nightly backup of bpsu_patvep_inventory (charter risk mitigation:
rem "Automatic scheduled backups").
rem
rem Creates  <BACKUP_DIR>\bpsu_patvep_inventory_YYYY-MM-DD_HHmm.sql
rem Keeps    the last KEEP_DAYS days, deletes older dumps
rem Logs     every run to <BACKUP_DIR>\backup_log.txt
rem
rem Restore (replaces the database with the dump's contents):
rem   C:\xampp\mysql\bin\mysql.exe -uroot < "path\to\dump.sql"
rem
rem Requires XAMPP MySQL to be running at backup time.
rem ============================================================================
setlocal

rem ponytail: same-disk backups only protect against bad edits/corruption, not
rem a dead drive. Point BACKUP_DIR at the external drive once one is assigned.
set "BACKUP_DIR=C:\xampp\mysql\patvep_backups"
set "KEEP_DAYS=14"
set "MYSQLDUMP=C:\xampp\mysql\bin\mysqldump.exe"
set "DB=bpsu_patvep_inventory"

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "TS=%%i"
set "OUT=%BACKUP_DIR%\%DB%_%TS%.sql"

rem --single-transaction: consistent snapshot without locking staff out
rem --routines/--triggers: include procedures and triggers, not just data
rem --databases: dump includes CREATE DATABASE, so restore needs no setup
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

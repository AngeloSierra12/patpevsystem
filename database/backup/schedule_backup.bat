@echo off
rem Registers (or updates) a Windows Task Scheduler job that runs
rem backup_inventory.bat every day at 9:00 PM. Re-run after moving the folder.
rem Remove it with:  schtasks /delete /tn "PATVEP Inventory Backup" /f
schtasks /create /tn "PATVEP Inventory Backup" /tr "\"%~dp0backup_inventory.bat\"" /sc daily /st 21:00 /f

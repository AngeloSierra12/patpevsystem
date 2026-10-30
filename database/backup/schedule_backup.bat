@echo off
schtasks /create /tn "PATVEP Inventory Backup" /tr "\"%~dp0backup_inventory.bat\"" /sc daily /st 21:00 /f

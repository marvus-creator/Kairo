@echo off
cd /d "%~dp0"
if not exist node_modules call pnpm install
start "" http://localhost:5190
call pnpm dev

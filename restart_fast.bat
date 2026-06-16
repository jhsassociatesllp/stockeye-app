@echo off
echo 🚨 EMERGENCY PERFORMANCE RESTART
echo ================================

echo.
echo 📊 Applied Changes:
echo   - Removed auto-loading of ALL data on page open
echo   - Added LAZY LOADING (data loads when you click sections)
echo   - Reduced all API limits to minimum
echo   - Ultra-fast dashboard (5 records only)
echo.

echo 🚀 Starting optimized server...
echo Press Ctrl+C to stop
echo.

.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
@echo off
REM SlinkGate インストーラー (Windows用)
REM このファイルをダブルクリックして実行

SET DEST=%USERPROFILE%\Documents\Ableton\User Library\Presets\Audio Effects\Max Audio Effect\SlinkGate

echo SlinkGate をインストール中...
mkdir "%DEST%" 2>nul
copy /Y SlinkGate.amxd "%DEST%\"
copy /Y slinkgate.js "%DEST%\"

echo.
echo インストール完了！
echo.
echo Ableton Live を開いて：
echo   ブラウザ - User Library - Presets - Audio Effects
echo   - Max Audio Effect - SlinkGate - SlinkGate.amxd
echo   をトラックにドラッグ＆ドロップ！
echo.
pause

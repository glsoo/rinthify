@echo off
rem install rinthify, just double click this
rem the first inject sets a webview2 policy so it needs admin
net session >nul 2>&1 || (powershell -NoProfile -Command "Start-Process -Verb RunAs -FilePath '%~f0'" & exit /b)
setlocal
set "dir=%LOCALAPPDATA%\Rinthify"
set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles%\Git\cmd"

where node >nul 2>&1 || winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements || goto fail
where git >nul 2>&1 || winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements || goto fail

if exist "%dir%\.git" (git -C "%dir%" pull --ff-only) else (git clone https://github.com/glsoo/rinthify "%dir%")
if errorlevel 1 goto fail
node "%dir%\rinthify.mjs" inject || goto fail
echo.
echo Done. Start the Modrinth App as usual.
pause
exit /b

:fail
echo.
echo Something went wrong, see above.
pause
exit /b 1

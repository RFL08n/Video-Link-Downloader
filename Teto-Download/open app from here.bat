@echo off
cd /d "%~dp0"

set "DENO_EXE="
if exist ".\assest\backend\deno.exe" set "DENO_EXE=.\assest\backend\deno.exe"
if exist ".\assets\backend\deno.exe" set "DENO_EXE=.\assets\backend\deno.exe"
if not defined DENO_EXE if exist "%USERPROFILE%\.deno\bin\deno.exe" set "DENO_EXE=%USERPROFILE%\.deno\bin\deno.exe"
if not defined DENO_EXE (
    for /f "delims=" %%I in ('where deno 2^>nul') do (
        if not defined DENO_EXE set "DENO_EXE=%%I"
    )
)

set "YTDLP_EXE="
if exist ".\assest\backend\yt-dlp.exe" set "YTDLP_EXE=.\assest\backend\yt-dlp.exe"
if exist ".\assets\backend\yt-dlp.exe" set "YTDLP_EXE=.\assets\backend\yt-dlp.exe"
if not defined YTDLP_EXE if exist "%USERPROFILE%\.deno\bin\yt-dlp.exe" set "YTDLP_EXE=%USERPROFILE%\.deno\bin\yt-dlp.exe"
if not defined YTDLP_EXE (
    for /f "delims=" %%I in ('where yt-dlp 2^>nul') do (
        if not defined YTDLP_EXE set "YTDLP_EXE=%%I"
    )
)

if defined YTDLP_EXE (
    echo [System] yt-dlp found: "%YTDLP_EXE%"
    echo [System] Checking yt-dlp updates...
    "%YTDLP_EXE%" -U
) else (
    echo [Warning] yt-dlp.exe not found in local backend, .deno\bin, or PATH.
)

set "TARGET_URL=http://localhost:8000"
set "DENO_OK=1"

if not defined DENO_EXE (
    set "DENO_OK=0"
    set "TARGET_URL=file:///%~dp0index.html"
    echo [ERROR] Deno not found! Server cannot start.
    echo [System] Will open index.html directly so warning popup appears...
) else (
    echo [System] Deno found: "%DENO_EXE%"
    echo [System] Checking Deno updates...
    "%DENO_EXE%" upgrade 2>nul
    echo [System] Starting Deno Server...
    start "TetoDenoServer" /min "%DENO_EXE%" run --allow-net --allow-read --allow-write --allow-run server.ts
    timeout /t 2 >nul
)

set "BROWSER_EXE="
set "BROWSER_MODE=chromium"

REM 1. Google Chrome
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"

REM 2. Brave Browser
if not defined BROWSER_EXE if exist "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" set "BROWSER_EXE=C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe" set "BROWSER_EXE=%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe"

REM 3. Opera / Opera GX
if not defined BROWSER_EXE if exist "%LocalAppData%\Programs\Opera\opera.exe" set "BROWSER_EXE=%LocalAppData%\Programs\Opera\opera.exe"
if not defined BROWSER_EXE if exist "C:\Program Files\Opera\opera.exe" set "BROWSER_EXE=C:\Program Files\Opera\opera.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\Programs\Opera GX\opera.exe" set "BROWSER_EXE=%LocalAppData%\Programs\Opera GX\opera.exe"

REM 4. Microsoft Edge
if not defined BROWSER_EXE if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

REM 5. Mozilla Firefox (fallback non-Chromium)
if not defined BROWSER_EXE if exist "C:\Program Files\Mozilla Firefox\firefox.exe" (
    set "BROWSER_EXE=C:\Program Files\Mozilla Firefox\firefox.exe"
    set "BROWSER_MODE=firefox"
)
if not defined BROWSER_EXE if exist "C:\Program Files (x86)\Mozilla Firefox\firefox.exe" (
    set "BROWSER_EXE=C:\Program Files (x86)\Mozilla Firefox\firefox.exe"
    set "BROWSER_MODE=firefox"
)

if not defined BROWSER_EXE (
    echo [ERROR] No supported browser found. Opening default browser...
    start "" "%TARGET_URL%"
) else if "%BROWSER_MODE%"=="firefox" (
    echo [System] Launching Firefox in private window...
    start "" "%BROWSER_EXE%" -private-window "%TARGET_URL%"
) else (
    echo [System] Launching %BROWSER_EXE% in guest & maximized mode...
    if "%DENO_OK%"=="1" (
        start "" "%BROWSER_EXE%" --guest --start-maximized --app="%TARGET_URL%"
    ) else (
        start "" "%BROWSER_EXE%" --guest --start-maximized "%TARGET_URL%"
    )
)

if "%DENO_OK%"=="0" pause
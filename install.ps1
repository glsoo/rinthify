# install rinthify: right click > Run with PowerShell (install.exe runs this too)
# the first inject sets a webview2 policy so it needs admin
$me = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
	Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
	exit
}
$dir = "$env:LOCALAPPDATA\Rinthify"
$env:PATH += ";$env:ProgramFiles\nodejs;$env:ProgramFiles\Git\cmd"

function need($cmd, $id) {
	if (Get-Command $cmd -EA SilentlyContinue) { return }
	winget install -e --id $id --accept-source-agreements --accept-package-agreements
	if ($LASTEXITCODE) { throw "could not install $id" }
}

try {
	need node OpenJS.NodeJS.LTS
	need git Git.Git
	if (Test-Path "$dir\.git") { git -C $dir pull --ff-only } else { git clone https://github.com/glsoo/rinthify $dir }
	if ($LASTEXITCODE) { throw 'git failed' }
	node "$dir\rinthify.mjs" inject
	if ($LASTEXITCODE) { throw 'inject failed' }
	"`nDone. Start the Modrinth App as usual."
} catch {
	"`nSomething went wrong: $_"
	$failed = 1
}
Read-Host 'Press Enter to close'
exit [int]$failed

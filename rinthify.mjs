#!/usr/bin/env node
// rinthify cli, run with no args for help
import { spawnSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(HERE, 'work', 'modrinth')
const PAYLOAD = path.join(HERE, 'payload')
const REPO = 'https://github.com/modrinth/code'
const HOME = os.homedir()
const VERSION = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version
const IS_WIN = process.platform === 'win32'
const IS_MAC = process.platform === 'darwin'

// user folder
const USER_DIR = IS_WIN
	? path.join(process.env.APPDATA ?? path.join(HOME, 'AppData', 'Roaming'), 'rinthify')
	: IS_MAC
		? path.join(HOME, 'Library', 'Application Support', 'rinthify')
		: path.join(process.env.XDG_CONFIG_HOME ?? path.join(HOME, '.config'), 'rinthify')
const INSTALL_DIR = IS_WIN
	? path.join(process.env.LOCALAPPDATA ?? HOME, 'Rinthify')
	: path.join(process.env.XDG_DATA_HOME ?? path.join(HOME, '.local', 'share'), 'rinthify')
const DESKTOP_FILE = path.join(HOME, '.local', 'share', 'applications', 'rinthify.desktop')

process.env.PATH = [path.join(HOME, '.cargo', 'bin'), process.env.PATH].join(path.delimiter)

// helpers

function log(msg) {
	console.log(`\x1b[32m[rinthify]\x1b[0m ${msg}`)
}

function die(msg) {
	console.error(`\x1b[31m[rinthify]\x1b[0m ${msg}`)
	process.exit(1)
}

function run(cmd, args, opts = {}) {
	const r = spawnSync(cmd, args, { stdio: 'inherit', shell: IS_WIN, ...opts })
	if (r.status !== 0) die(`failed: ${cmd} ${args.join(' ')}`)
}

function out(cmd, args, opts = {}) {
	const r = spawnSync(cmd, args, { encoding: 'utf8', shell: IS_WIN, ...opts })
	return r.status === 0 ? r.stdout.trim() : null
}

function has(cmd) {
	return out(cmd, ['--version']) !== null
}

// pnpm shim through npx
function ensurePnpm() {
	if (has('pnpm')) return
	const pm = JSON.parse(fs.readFileSync(path.join(SRC, 'package.json'), 'utf8')).packageManager ?? 'pnpm'
	const dir = path.join(HERE, 'work', 'bin')
	fs.mkdirSync(dir, { recursive: true })
	const spec = pm.split('+')[0]
	if (IS_WIN) fs.writeFileSync(path.join(dir, 'pnpm.cmd'), `@npx -y ${spec} %*\r\n`)
	else fs.writeFileSync(path.join(dir, 'pnpm'), `#!/bin/sh\nexec npx -y ${spec} "$@"\n`, { mode: 0o755 })
	process.env.PATH = [dir, process.env.PATH].join(path.delimiter)
}

function pnpm(args, opts = {}) {
	ensurePnpm()
	run('pnpm', args, { cwd: SRC, ...opts })
}

function flag(name) {
	const i = process.argv.indexOf(name)
	return i >= 0 ? process.argv[i + 1] : undefined
}

function latestTag() {
	const refs = out('git', ['ls-remote', '--tags', '--refs', REPO])
	if (!refs) die('could not list Modrinth release tags (no network?)')
	const tags = [...refs.matchAll(/refs\/tags\/(v\d+\.\d+\.\d+)$/gm)].map((m) => m[1])
	const key = (t) => t.slice(1).split('.').map(Number)
	tags.sort((a, b) => {
		const [x, y] = [key(a), key(b)]
		return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
	})
	return tags.at(-1)
}

// source

// clean source at tag
function fetchSource(tag) {
	if (!fs.existsSync(path.join(SRC, '.git'))) {
		log(`downloading Modrinth App ${tag}`)
		fs.mkdirSync(path.dirname(SRC), { recursive: true })
		run('git', ['clone', '--depth', '1', '--branch', tag, REPO, SRC])
		return
	}
	log(`switching source to ${tag}`)
	run('git', ['fetch', '--depth', '1', 'origin', 'tag', tag], { cwd: SRC })
	run('git', ['checkout', '-f', tag], { cwd: SRC })
	run('git', ['clean', '-fdq', '--', 'apps'], { cwd: SRC })
}

function currentTag() {
	return out('git', ['describe', '--tags', '--exact-match'], { cwd: SRC })
}

// patches

// one file per patch
const PATCHES = [
	{
		file: 'apps/app-frontend/src/main.js',
		done: (s) => s.includes('rinthify'),
		apply: (s) =>
			`import { rinthify } from '@/rinthify'\n` +
			need(s, /^([ \t]*)app\.mount\('#app'\)/m, (m, ind) => `${ind}await rinthify.boot(app, router)\n${m}`),
	},
	{
		file: 'apps/app-frontend/src/features/settings/app-settings-modal/index.vue',
		done: (s) => s.includes('tabs.unshift(...(rinthifyTabs'),
		apply: (s) => {
			// move old tabs to the top
			if (s.includes('tabs.push(...(rinthifyTabs')) return s.replace('tabs.push(...(rinthifyTabs', 'tabs.unshift(...(rinthifyTabs')
			s = need(s, /^import \{ provideAppSettingsModal \} from '\.\/context'$/m, (m) =>
				`${m}\nimport { rinthifyTabs } from '@/rinthify/tabs'`)
			return need(s, /^const availableTabs = /m, (m) =>
				`// eslint-disable-next-line @typescript-eslint/no-explicit-any\ntabs.unshift(...(rinthifyTabs as any[]))\n\n${m}`)
		},
	},
	{
		file: 'apps/app-frontend/src/App.vue',
		done: (s) => s.includes('rinthify.navItems'),
		apply: (s) => {
			s = need(s, /^import NavButton from '@\/components\/ui\/NavButton\.vue'$/m, (m) =>
				`${m}\nimport { rinthify } from '@/rinthify'`)
			return need(
				s,
				/^([ \t]*)<NavButton\s+v-tooltip\.right="formatMessage\(commonMessages\.settingsLabel\)"/m,
				(m, ind) =>
					`${ind}<NavButton v-for="item in rinthify.navItems" :key="item.key" v-tooltip.right="item.label" :to="item.to">\n` +
					`${ind}\t<component :is="item.icon" />\n` +
					`${ind}</NavButton>\n${m}`,
			)
		},
	},
	{
		file: 'apps/app-frontend/src/providers/setup/app-events.ts',
		done: (s) => s.includes('rinthify'),
		apply: (s) =>
			`import { rinthify } from '@/rinthify'\n` +
			need(s, /^([ \t]*)const events: AppEvents = \{ on, once \}$/m, (m, ind) =>
				`${m}\n${ind}rinthify.setEvents(events as never)`),
	},
	{
		file: 'apps/app/src/main.rs',
		done: (s) => s.includes('mod rinthify;'),
		apply: (s) => {
			s = need(s, /^mod api;$/m, (m) => `${m}\nmod rinthify;`)
			return need(s, /\.invoke_handler\(tauri::generate_handler!\[/, (m) =>
				`${m}\n            rinthify::rinthify_info,\n            rinthify::rinthify_list,` +
				`\n            rinthify::rinthify_read,\n            rinthify::rinthify_write,` +
				`\n            rinthify::rinthify_delete,`)
		},
	},
	{
		// allow blob scripts
		file: 'apps/app/tauri.conf.json',
		done: (s) => s.includes('"script-src": "blob: '),
		apply: (s) => need(s, /"script-src": "/, (m) => `${m}blob: `),
	},
]

// replace or fail
function need(s, re, fn) {
	if (!re.test(s)) throw new Error(`anchor not found: ${re}`)
	return s.replace(re, fn)
}

function copyPayload() {
	fs.cpSync(path.join(PAYLOAD, 'frontend', 'rinthify'), path.join(SRC, 'apps/app-frontend/src/rinthify'), {
		recursive: true,
	})
	fs.copyFileSync(path.join(PAYLOAD, 'backend', 'rinthify.rs'), path.join(SRC, 'apps/app/src/rinthify.rs'))
	// use the production env
	fs.copyFileSync(path.join(SRC, 'packages/app-lib/.env.prod'), path.join(SRC, 'packages/app-lib/.env'))
}

function patch() {
	if (!fs.existsSync(SRC)) die('no source yet: run `rinthify apply` or `rinthify fetch` first')
	copyPayload()
	for (const p of PATCHES) {
		const file = path.join(SRC, p.file)
		const s = fs.readFileSync(file, 'utf8')
		if (p.done(s)) continue
		try {
			fs.writeFileSync(file, p.apply(s))
		} catch (e) {
			die(`${p.file}: ${e.message}\nThis Modrinth version changed that file; the patch needs updating.`)
		}
		log(`patched ${p.file}`)
	}
}

// copy examples
function seedExamples() {
	for (const sub of ['themes', 'plugins']) {
		const from = path.join(HERE, 'examples', sub)
		for (const name of fs.readdirSync(from)) {
			const to = path.join(USER_DIR, sub, name)
			if (!fs.existsSync(to) && !fs.existsSync(`${to}.css`)) fs.cpSync(path.join(from, name), to, { recursive: true })
		}
	}
	log(`themes and plugins folder: ${USER_DIR}`)
}

function ensureDeps() {
	if (!fs.existsSync(path.join(SRC, 'node_modules'))) {
		log('installing JavaScript dependencies')
		pnpm(['install'])
	}
}

// commands

function doctor() {
	let ok = true
	const check = (name, good, hint) => {
		console.log(`${good ? '\x1b[32mok\x1b[0m     ' : '\x1b[31mmissing\x1b[0m'} ${name}${good ? '' : `  -> ${hint}`}`)
		ok &&= good
	}
	check('git', has('git'), 'install git')
	check('node', true, '')
	check('cargo (rustup)', has('cargo'), 'install rustup: https://rustup.rs')
	check('pnpm (or npx)', has('pnpm') || has('npx'), 'npm i -g pnpm')
	if (process.platform === 'linux') {
		const libs = ['webkit2gtk-4.1', 'javascriptcoregtk-4.1', 'libsoup-3.0', 'gtk+-3.0', 'librsvg-2.0', 'openssl']
		const missing = libs.filter((l) => out('pkg-config', ['--exists', l]) === null)
		check(
			'Tauri system libraries',
			missing.length === 0,
			`missing ${missing.join(', ')}. Fedora: sudo dnf install webkit2gtk4.1-devel gtk3-devel libsoup3-devel librsvg2-devel openssl-devel libappindicator-gtk3-devel; ` +
				'Debian/Ubuntu: sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev librsvg2-dev libssl-dev libayatana-appindicator3-dev',
		)
	}
	return ok
}

function findBinary() {
	const conf = JSON.parse(fs.readFileSync(path.join(SRC, 'apps/app/tauri.conf.json'), 'utf8'))
	const ext = IS_WIN ? '.exe' : ''
	for (const name of [conf.mainBinaryName, 'ModrinthApp', 'theseus_gui', 'Modrinth App']) {
		const p = path.join(SRC, 'target', 'release', `${name}${ext}`)
		if (name && fs.existsSync(p)) return p
	}
	die('build finished but the app binary was not found in target/release')
}

function install() {
	if (IS_MAC) {
		const app = fs
			.readdirSync(path.join(SRC, 'target/release/bundle/macos'))
			.find((f) => f.endsWith('.app'))
		const dest = path.join(HOME, 'Applications', 'Modrinth App (Rinthify).app')
		fs.rmSync(dest, { recursive: true, force: true })
		fs.cpSync(path.join(SRC, 'target/release/bundle/macos', app), dest, { recursive: true })
		return log(`installed ${dest}`)
	}
	fs.mkdirSync(INSTALL_DIR, { recursive: true })
	const bin = path.join(INSTALL_DIR, IS_WIN ? 'Modrinth App (Rinthify).exe' : 'modrinth-app-rinthify')
	fs.copyFileSync(findBinary(), bin)
	if (IS_WIN) return log(`installed ${bin} (pin it to Start or the taskbar)`)
	fs.chmodSync(bin, 0o755)
	const icon = path.join(INSTALL_DIR, 'icon.png')
	fs.copyFileSync(path.join(SRC, 'apps/app/icons/128x128.png'), icon)
	fs.mkdirSync(path.dirname(DESKTOP_FILE), { recursive: true })
	fs.writeFileSync(
		DESKTOP_FILE,
		[
			'[Desktop Entry]',
			'Type=Application',
			'Name=Modrinth App (Rinthify)',
			'Comment=Modrinth App with Rinthify themes and plugins',
			`Exec="${bin}" %u`,
			`Icon=${icon}`,
			'Categories=Game;',
			'Terminal=false',
			'',
		].join('\n'),
	)
	log(`installed ${bin}`)
	log(`menu entry: ${DESKTOP_FILE} ("Modrinth App (Rinthify)")`)
}

// inject

const OFFICIAL_DESKTOP = '/usr/share/applications/Modrinth App.desktop'
const DESKTOP_OVERRIDE = path.join(HOME, '.local', 'share', 'applications', 'Modrinth App.desktop')
const LAUNCHER = path.join(INSTALL_DIR, 'modrinth-app')
const DESKTOP_BACKUP = path.join(INSTALL_DIR, 'original.desktop')

// kde caches desktop files so rebuild that or the pin keeps the old exec
function refreshMenus() {
	out('kbuildsycoca6', [])
	out('update-desktop-database', [path.dirname(DESKTOP_OVERRIDE)])
}

// add rinthify to the installed app
function inject() {
	fs.mkdirSync(INSTALL_DIR, { recursive: true })
	const vue = fs.readFileSync(path.join(HERE, 'inject/vendor/vue.runtime.global.prod.js'), 'utf8')
	const loader = fs.readFileSync(path.join(HERE, 'inject/loader.js'), 'utf8')
	fs.writeFileSync(SCRIPT, `;(() => {\nconst RINTHIFY_VERSION = ${JSON.stringify(VERSION)}\n${vue}\n${loader}\n})()\n`)
	const app = (IS_WIN ? injectWindows : IS_MAC ? injectMac : injectLinux)()
	fs.writeFileSync(APP_FILE, app)
	// used by the buttons in the rinthify tab, windows uses host.mjs
	if (!IS_WIN) fs.writeFileSync(CLI, `#!/bin/sh\nexec "${process.execPath}" "${path.join(HERE, 'rinthify.mjs')}" "$@" --app "${app}"\n`, { mode: 0o755 })
	seedExamples()
}

const SCRIPT = path.join(INSTALL_DIR, 'rinthify.js')
const CLI = path.join(INSTALL_DIR, 'rinthify')
// the app path inject used, for uninject
const APP_FILE = path.join(INSTALL_DIR, 'app')
const updateArgs = (app) => [process.execPath, path.join(HERE, 'rinthify.mjs'), 'update', '--app', app]
const findApp = (paths, what) => flag('--app') ?? paths.find((p) => p && fs.existsSync(p)) ?? die(`official Modrinth App not found; pass --app ${what}`)
const savedApp = () => flag('--app') ?? (fs.existsSync(APP_FILE) ? fs.readFileSync(APP_FILE, 'utf8') : null)
const running = () => log('\x1b[33mModrinth App is already running: quit it fully (tray too) and start it again\x1b[0m')

// linux
function injectLinux() {
	const app = findApp(['/usr/bin/ModrinthApp', '/usr/bin/modrinth-app'], '/path/to/binary')
	const lib = path.join(INSTALL_DIR, 'librinthify.so')
	const flags = out('pkg-config', ['--cflags', '--libs', 'webkit2gtk-4.1']).trim().split(/\s+/)
	run('cc', ['-shared', '-fPIC', '-O2', '-o', lib, path.join(HERE, 'inject/linux/rinthify.c'), ...flags])
	// update in the background
	const update = `("${CLI}" update >/dev/null 2>&1 &)`
	fs.writeFileSync(
		LAUNCHER,
		`#!/bin/sh\n# Starts the official Modrinth App with Rinthify. RINTHIFY_SAFE=1 turns themes and plugins off.\n${update}\nexport RINTHIFY_DIR="${USER_DIR}" RINTHIFY_SCRIPT="${SCRIPT}"\nexport LD_PRELOAD="${lib}\${LD_PRELOAD:+:$LD_PRELOAD}"\nexec "${app}" "$@"\n`,
		{ mode: 0o755 },
	)
	// same name overrides the system one, back up the users own if there is one
	const own = fs.existsSync(DESKTOP_OVERRIDE) ? fs.readFileSync(DESKTOP_OVERRIDE, 'utf8') : null
	if (own && !own.includes(LAUNCHER)) fs.writeFileSync(DESKTOP_BACKUP, own)
	const base =
		(fs.existsSync(DESKTOP_BACKUP) ? fs.readFileSync(DESKTOP_BACKUP, 'utf8') : own) ??
		(fs.existsSync(OFFICIAL_DESKTOP)
			? fs.readFileSync(OFFICIAL_DESKTOP, 'utf8')
			: '[Desktop Entry]\nType=Application\nName=Modrinth App\nIcon=ModrinthApp\nCategories=Game;\nExec=ModrinthApp\n')
	fs.mkdirSync(path.dirname(DESKTOP_OVERRIDE), { recursive: true })
	// keep env vars and args
	let entry = base.replace(/^(Exec=(?:env(?:\s+\w+=\S*)*\s+)?)("[^"]*"|\S+)/m, `$1"${LAUNCHER}"`)
	// so the taskbar still groups it
	if (!/^StartupWMClass=/m.test(entry)) entry = entry.replace(/^Exec=.*$/m, `$&\nStartupWMClass=${path.basename(app)}`)
	fs.writeFileSync(DESKTOP_OVERRIDE, entry)
	refreshMenus()
	log(`injected into ${app}; start "Modrinth App" from the menu or run ${LAUNCHER}`)
	// its single instance so it has to be restarted
	if (out('pgrep', ['-x', path.basename(app).slice(0, 15)]) !== null) running()
	return app
}

// windows, see inject/windows/host.mjs
const WEBVIEW2_POLICY = 'HKLM\\Software\\Policies\\Microsoft\\Edge\\WebView2\\AdditionalBrowserArguments'
const STARTUP_VBS = path.join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'rinthify.vbs')
const WATCHER_PIPE = '\\\\.\\pipe\\rinthify'

function injectWindows() {
	if (typeof WebSocket === 'undefined') die('needs Node.js 22 or newer')
	const local = process.env.LOCALAPPDATA ?? ''
	const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
	const app = findApp(
		[local, pf].flatMap((d) => ['Modrinth App.exe', 'ModrinthApp.exe'].map((exe) => path.join(d, 'Modrinth App', exe))),
		'"C:\\path\\to\\Modrinth App.exe"',
	)
	const portFile = path.join(INSTALL_DIR, 'port')
	if (!fs.existsSync(portFile)) fs.writeFileSync(portFile, String(20000 + Math.floor(Math.random() * 20000)))
	const port = fs.readFileSync(portFile, 'utf8').trim()
	// only for this exe
	const value = `--remote-debugging-port=${port}`
	// skip if already set, needs admin otherwise
	const has = out('reg', ['query', WEBVIEW2_POLICY, '/v', path.basename(app)], { shell: false })?.includes(value)
	const reg = has ? { status: 0 } : spawnSync('reg', ['add', WEBVIEW2_POLICY, '/v', path.basename(app), '/t', 'REG_SZ', '/d', value, '/f'], { stdio: 'inherit' })
	if (reg.status !== 0) die('could not set the WebView2 policy; run `node rinthify.mjs inject` once from an administrator terminal')
	// start the watcher now and on login
	const cmd = [process.execPath, path.join(HERE, 'inject/windows/host.mjs'), port, SCRIPT, USER_DIR, ...updateArgs(app)]
	const line = cmd.map((a) => `"${a}"`).join(' ').replaceAll('"', '""')
	fs.mkdirSync(path.dirname(STARTUP_VBS), { recursive: true })
	fs.writeFileSync(STARTUP_VBS, `CreateObject("WScript.Shell").Run "${line}", 0, False\r\n`)
	spawn('wscript', [STARTUP_VBS], { detached: true, stdio: 'ignore' }).unref()
	log(`injected into ${app}; start Modrinth App as usual`)
	// no debug port until restart
	if (out('tasklist', ['/fi', `IMAGENAME eq ${path.basename(app)}`, '/nh'], { shell: false })?.includes(path.basename(app))) running()
	return app
}

// macos, patches the app and signs it again
const LSREGISTER = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
const MAC_BACKUP = path.join(INSTALL_DIR, 'original.app')

function injectMac() {
	const app = findApp(['/Applications/Modrinth App.app', path.join(HOME, 'Applications', 'Modrinth App.app')], '"/path/to/Modrinth App.app"')
	const plist = path.join(app, 'Contents', 'Info.plist')
	const lib = path.join(INSTALL_DIR, 'librinthify.dylib')
	run('cc', ['-dynamiclib', '-fobjc-arc', '-O2', '-o', lib, path.join(HERE, 'inject/macos/rinthify.m'), '-framework', 'WebKit', '-framework', 'UniformTypeIdentifiers'])
	// backup
	if (!fs.readFileSync(plist, 'utf8').includes('RINTHIFY_DIR')) {
		fs.rmSync(MAC_BACKUP, { recursive: true, force: true })
		run('ditto', [app, MAC_BACKUP])
	}
	const env = { DYLD_INSERT_LIBRARIES: lib, RINTHIFY_DIR: USER_DIR, RINTHIFY_SCRIPT: SCRIPT }
	run('plutil', ['-replace', 'LSEnvironment', '-json', JSON.stringify(env), plist])
	// no hardened runtime or dyld wont load it
	run('codesign', ['--force', '--deep', '--sign', '-', app])
	out('xattr', ['-dr', 'com.apple.quarantine', app])
	out(LSREGISTER, ['-f', app])
	// TODO: update on launch
	log(`injected into ${app}; start Modrinth App as usual (a Modrinth update undoes this, run inject again)`)
	if (out('pgrep', ['-f', `${app}/Contents/MacOS/`]) !== null) running()
	return app
}

// pull and reinject
function update() {
	const git = (...args) =>
		spawnSync('git', ['-C', HERE, ...args], {
			encoding: 'utf8',
			timeout: 60_000,
			windowsHide: true,
			// no login popups from git or the windows credential manager
			env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
		})
	if (git('fetch', '--quiet').status !== 0) die('could not reach the Rinthify repo')
	if (git('rev-list', '--count', 'HEAD..@{u}').stdout.trim() === '0') return log('up to date')
	if (git('merge', '--ff-only', '--quiet', '@{u}').status !== 0) die('could not update: local changes are in the way')
	// the new copy injects
	run(process.execPath, [path.join(HERE, 'rinthify.mjs'), 'inject', ...process.argv.slice(3)])
	log(`updated to ${git('rev-parse', '--short', 'HEAD').stdout.trim()}`)
}

function uninject() {
	const app = savedApp()
	if (IS_WIN) {
		if (app) spawnSync('reg', ['delete', WEBVIEW2_POLICY, '/v', path.basename(app), '/f'], { stdio: 'ignore' })
		fs.rmSync(STARTUP_VBS, { force: true })
		// connecting makes it quit
		net.connect(WATCHER_PIPE).on('connect', function () { this.end() }).on('error', () => {})
	} else if (IS_MAC) {
		if (app && fs.existsSync(MAC_BACKUP)) {
			fs.rmSync(app, { recursive: true, force: true })
			run('ditto', [MAC_BACKUP, app])
			fs.rmSync(MAC_BACKUP, { recursive: true, force: true })
			out(LSREGISTER, ['-f', app])
		}
	} else {
		fs.rmSync(DESKTOP_OVERRIDE, { force: true })
		fs.rmSync(LAUNCHER, { force: true })
		if (fs.existsSync(DESKTOP_BACKUP)) fs.renameSync(DESKTOP_BACKUP, DESKTOP_OVERRIDE)
		refreshMenus()
	}
	for (const f of ['librinthify.so', 'librinthify.dylib', 'rinthify.js', 'rinthify', 'app', 'port']) fs.rmSync(path.join(INSTALL_DIR, f), { force: true })
	log('removed; "Modrinth App" starts the plain app again (your themes and plugins are kept)')
}

function apply() {
	if (!doctor()) die('fix the missing items above first')
	const tag = flag('--tag') ?? latestTag()
	fetchSource(tag)
	patch()
	ensureDeps()
	log(`building Modrinth App ${tag} with Rinthify (the first build takes a while)`)
	pnpm(['-w', 'i18n:coverage'])
	pnpm(['--filter', '@modrinth/app', 'exec', 'tauri', 'build', ...(IS_MAC ? ['--bundles', 'app'] : ['--no-bundle'])])
	install()
	seedExamples()
	log('done. Open "Modrinth App (Rinthify)"; Settings has new Themes and Plugins tabs.')
}

// run with hot reload
function dev() {
	if (!fs.existsSync(SRC)) fetchSource(flag('--tag') ?? latestTag())
	patch()
	ensureDeps()
	seedExamples()
	// copy payload edits over
	let pending = null
	fs.watch(PAYLOAD, { recursive: true }, () => {
		clearTimeout(pending)
		pending = setTimeout(() => {
			copyPayload()
			log('payload changed, copied into the source')
		}, 150)
	})
	log('starting dev app (Ctrl+C to stop). Edit payload/ or work/modrinth/apps/app-frontend/src live.')
	ensurePnpm()
	const child = spawn('pnpm', ['--filter', '@modrinth/app', 'run', 'dev'], {
		cwd: SRC,
		stdio: 'inherit',
		shell: IS_WIN,
	})
	child.on('exit', (code) => process.exit(code ?? 0))
}

function restore() {
	if (IS_MAC) fs.rmSync(path.join(HOME, 'Applications', 'Modrinth App (Rinthify).app'), { recursive: true, force: true })
	fs.rmSync(INSTALL_DIR, { recursive: true, force: true })
	fs.rmSync(DESKTOP_FILE, { force: true })
	log('removed the Rinthify build. Your official Modrinth App, instances and themes folder are untouched.')
}

function status() {
	log(`source: ${fs.existsSync(SRC) ? (currentTag() ?? 'unknown version') : 'not downloaded'}`)
	log(`newest Modrinth release: ${latestTag()}`)
	log(`installed: ${fs.existsSync(INSTALL_DIR) ? INSTALL_DIR : 'no'}`)
	log(`themes and plugins: ${USER_DIR}`)
}

const commands = {
	apply,
	dev,
	patch,
	restore,
	install: () => (install(), seedExamples()),
	status,
	doctor: () => process.exit(doctor() ? 0 : 1),
	fetch: () => fetchSource(flag('--tag') ?? latestTag()),
	examples: seedExamples,
	inject,
	uninject,
	update,
}

const cmd = commands[process.argv[2]]
if (!cmd) {
	console.log(`rinthify <command>

  inject [--app PATH]   add Rinthify to the installed official app, no build (seconds)
  uninject              undo inject
  update                pull the newest Rinthify and inject it again (the launcher runs this on every start)
  apply [--tag vX.Y.Z]  download, patch, build and install the Modrinth App with Rinthify (newest release by default)
  install               install the already-built app (no rebuild)
  dev   [--tag vX.Y.Z]  run the patched app with hot reload (no rebuild for frontend edits)
  doctor                check the build tools
  status                show versions and folders
  restore               remove the Rinthify build (your official app is untouched)
  patch                 re-apply the patches to work/modrinth
  fetch [--tag vX.Y.Z]  download a clean source copy
  examples              copy the example themes and plugins to ${USER_DIR}`)
	process.exit(process.argv[2] ? 1 : 0)
}
cmd()

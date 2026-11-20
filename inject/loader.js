// rinthify loader
// runs before the app, vue is our own copy
const { reactive, markRaw, h, ref, computed, watch, createApp, onBeforeUnmount } = Vue
const BOOT = window.__RINTHIFY__ ?? { dir: '', safeMode: false }
const POLL_MS = 1000
const CONFIG = 'config.json'
const VERSION = typeof RINTHIFY_VERSION === 'string' ? RINTHIFY_VERSION : 'dev'

// icons (lucide, isc)

const svg = (body) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
const ICONS = {
	plug: svg('<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>'),
	palette: svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
	clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
	star: svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
	search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
	refresh: svg('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'),
	pencil: svg('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>'),
	trash: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
	sliders: svg('<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>'),
	plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
	back: svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
	alert: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 2-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
	shield: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'),
	command: svg('<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>'),
	note: svg('<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>'),
	eyeOff: svg('<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>'),
	play: svg('<polygon points="6 3 20 12 6 21 6 3"/>'),
	bell: svg('<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>'),
}
// built mode icon names
Object.assign(ICONS, { PlugIcon: ICONS.plug, PaletteIcon: ICONS.palette, ClockIcon: ICONS.clock, StarIcon: ICONS.star })

// bridge

function bridge(op, args = {}) {
	return window.webkit.messageHandlers.rinthify.postMessage({ op, ...args })
}
const log = (...a) => void bridge('log', { data: a.map(String).join(' ') }).catch(() => {})

const read = (path) => bridge('read', { path })
async function write(path, data) {
	await bridge('write', { path, data })
	await scan(false)
}
async function remove(path) {
	await bridge('delete', { path })
	await scan(false)
}
const saveConfig = () => bridge('write', { path: CONFIG, data: JSON.stringify(rinthify.config, null, '\t') })

// state

const running = new Map()
let stamps = new Map()
let scanning = false
let themeStyle = null
let appRef = null
let routerRef = null
let navCounter = 0

const rinthify = reactive({
	dir: BOOT.dir,
	safeMode: BOOT.safeMode,
	files: [],
	themes: [],
	themeInfo: {}, // name -> project.json
	themeError: null,
	plugins: [],
	navItems: [],
	config: { theme: null, enabled: [], data: {}, options: {}, disabled: false },
	read,
	write,
	remove,
	setTheme,
	setEnabled,
	reloadPlugin,
	previewTheme,
	setOption,
	rescan: () => scan(false),
})
window.rinthify = rinthify
// safe mode or turned off in the rinthify tab
const off = () => rinthify.safeMode || rinthify.config.disabled

// apply what changed
async function scan(first) {
	if (scanning) return
	scanning = true
	try {
		const next = new Map(
			(await bridge('list')).map((line) => {
				const tab = line.indexOf('\t')
				return [line.slice(tab + 1), Number(line.slice(0, tab))]
			}),
		)
		const changed = new Set()
		for (const [p, m] of next) if (stamps.get(p) !== m) changed.add(p)
		for (const p of stamps.keys()) if (!next.has(p)) changed.add(p)
		stamps = next
		if (!first && changed.size === 0) return

		rinthify.files = [...next.keys()].sort()
		rinthify.themes = rinthify.files.filter((p) => /^themes\/[^/]+\/theme\.css$/.test(p)).map((p) => p.split('/')[1])
		for (const n of rinthify.themes)
			if (first || changed.has(`themes/${n}/project.json`)) rinthify.themeInfo[n] = await readProject(`themes/${n}`).catch(() => ({}))

		if (first || changed.has(CONFIG)) await loadConfig()
		const t = rinthify.config.theme
		if (first || changed.has(CONFIG) || [...changed].some((c) => c.startsWith(`themes/${t}/`))) await applyTheme(changed)
		if (routerRef) await syncPlugins(first ? null : changed)
	} catch (e) {
		log('scan failed', e)
	} finally {
		scanning = false
	}
}

async function loadConfig() {
	try {
		const parsed = JSON.parse(await read(CONFIG))
		rinthify.config = {
			theme: parsed.theme ?? null,
			enabled: Array.isArray(parsed.enabled) ? parsed.enabled : [],
			data: parsed.data ?? {},
			options: parsed.options ?? {},
			disabled: !!parsed.disabled,
		}
	} catch {
		// keep old config
	}
}

// themes

function setCss(css) {
	if (!themeStyle) {
		themeStyle = document.createElement('style')
		themeStyle.id = 'rinthify-theme'
	}
	themeStyle.textContent = css && splashCss(css) + css
	keepThemeLast()
}

// loading screen uses theme colors
function splashCss(css) {
	const vars = new Set(css.match(/--[\w-]+(?=\s*:)/g) ?? [])
	const tint = {
		'--splash-tint-top': 'color-mix(in srgb, var(--color-brand) 27%, transparent)',
		'--splash-tint-bottom': 'color-mix(in srgb, var(--surface-1) 50%, transparent)',
		'--splash-overlay': 'color-mix(in srgb, var(--surface-1) 64%, transparent)',
	}
	for (const v of vars) delete tint[v]
	const decls = [...[...vars].map((v) => `${v}: inherit;`), ...Object.entries(tint).map(([k, v]) => `${k}: ${v};`)]
	return `html { background: var(--surface-1); }\nhtml .splash-screen.splash-screen { ${decls.join(' ')} }\n`
}

// keep the theme last in head
function keepThemeLast() {
	const head = document.head ?? document.documentElement
	if (themeStyle && head.lastElementChild !== themeStyle) head.appendChild(themeStyle)
}

async function applyTheme(changed = null) {
	const name = rinthify.config.theme
	const on = name && !off() && rinthify.themes.includes(name)
	setCss(on ? optionCss(name) + (await read(`themes/${name}/theme.css`).catch(() => '')) : (optionCss(null), ''))
	await applyThemeScript(changed)
}

// theme.js runs while the theme is on
let themeScript = null
// one at a time or the same plugin can start twice
let lifecycle = Promise.resolve()
const serial = (fn) => (...args) => (lifecycle = lifecycle.catch(() => {}).then(() => fn(...args)))
const applyThemeScript = serial(applyThemeScriptNow)
const syncPlugins = serial(syncPluginsNow)
async function applyThemeScriptNow(changed) {
	const name = rinthify.config.theme
	const file = `themes/${name}/theme.js`
	const want = name && !off() && rinthify.themes.includes(name) && rinthify.files.includes(file) ? name : null
	if (themeScript?.name === want && !changed?.has(file)) return
	if (themeScript) await stopEntry(themeScript.entry, `theme ${themeScript.name}`)
	themeScript = null
	rinthify.themeError = null
	if (!want || !routerRef) return
	const entry = { mod: {}, cleanups: [] }
	themeScript = { name: want, entry }
	try {
		entry.mod = await loadModule(`theme-${want}`, await read(file))
		await entry.mod.start?.call(entry.mod, makeApi(`theme-${want}`, entry.cleanups, () => optionValues(`themes/${want}`, rinthify.themeInfo[want]?.options)))
		log(`theme script ${want} started`)
	} catch (e) {
		log(`theme script ${want} failed:`, e?.stack ?? e)
		rinthify.themeError = String(e instanceof Error ? (e.stack ?? e.message) : e)
	}
}

// live preview while editing
function previewTheme(name, css) {
	if (name === rinthify.config.theme && !off()) setCss(optionCss(name) + css)
}

// options

const readProject = async (dir) => JSON.parse(await read(`${dir}/project.json`))

// saved value or default
function optionValues(key, options = []) {
	const saved = rinthify.config.options[key] ?? {}
	return Object.fromEntries(options.map((o) => [o.id, o.id in saved ? saved[o.id] : o.default]))
}

let optionTimer
function setOption(key, id, value) {
	;(rinthify.config.options[key] ??= {})[id] = value
	clearTimeout(optionTimer)
	optionTimer = setTimeout(saveConfig, 300)
	if (key === `themes/${rinthify.config.theme}`) void applyTheme()
}

// options as css vars
let themeAttrs = []
function optionCss(name) {
	const options = rinthify.themeInfo[name]?.options ?? []
	const v = optionValues(`themes/${name}`, options)
	const root = document.documentElement
	for (const a of themeAttrs) root.removeAttribute(a)
	themeAttrs = options.filter((o) => o.type === 'toggle' && v[o.id]).map((o) => `data-${o.id}`)
	for (const a of themeAttrs) root.setAttribute(a, '')
	const vars = options.filter((o) => o.type !== 'toggle' && v[o.id] != null).map((o) => `--${o.id}: ${v[o.id]}${o.unit ?? ''};`)
	return vars.length ? `:root { ${vars.join(' ')} }\n` : ''
}

// github install

// install from a github link
async function installFromGitHub(link) {
	const m = link.trim().replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/(\.git)?\/?$/, '').match(/^([\w.-]+)\/([\w.-]+)(?:\/tree\/([^/]+)\/?(.*))?$/)
	if (!m) throw new Error('Not a GitHub link')
	const [, owner, repo, branch, sub = ''] = m
	const api = async (p) => JSON.parse(await bridge('fetch', { data: `https://api.github.com/repos/${owner}/${repo}${p}` }))
	const ref = branch ?? (await api('')).default_branch
	const inside = (await api(`/git/trees/${encodeURIComponent(ref)}?recursive=1`)).tree
		.filter((e) => e.type === 'blob' && (!sub || e.path.startsWith(`${sub}/`)))
		.map((e) => e.path)
	await installTree(inside, repo, (p, path) =>
		bridge('fetch', { data: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${p.split('/').map(encodeURIComponent).join('/')}`, path }),
	)
}

// copies the folder with the top project.json into themes/ or plugins/, skipping data/
async function installTree(inside, fallback, copy) {
	const manifest = inside.filter((p) => /(^|\/)project\.json$/.test(p)).sort((a, b) => a.split('/').length - b.split('/').length)[0]
	if (!manifest) throw new Error('No project.json found')
	const root = manifest.slice(0, -'project.json'.length)
	const files = inside.filter((p) => p.startsWith(root) && !p.startsWith(`${root}data/`))
	if (files.length > 200) throw new Error('Too many files')
	const kind = files.includes(`${root}theme.css`) ? 'themes' : 'plugins'
	const name = (root.split('/').at(-2) || fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
	for (const p of files) await copy(p, `${kind}/${name}/${p.slice(root.length)}`)
	await scan(false)
}

// zip install, from a link or a picked file
async function installFromZip(z, fallback) {
	const v = new DataView(z.buffer, z.byteOffset, z.byteLength)
	let e = z.length - 22
	while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--
	if (e < 0) throw new Error('Not a zip file')
	// central directory entries, folders skipped
	const entries = {}
	for (let i = 0, p = v.getUint32(e + 16, true); i < v.getUint16(e + 10, true); i++) {
		const n = v.getUint16(p + 28, true)
		const name = new TextDecoder().decode(z.subarray(p + 46, p + 46 + n))
		if (!name.endsWith('/')) entries[name] = p
		p += 46 + n + v.getUint16(p + 30, true) + v.getUint16(p + 32, true)
	}
	await installTree(Object.keys(entries), fallback, async (name, path) => {
		const p = entries[name]
		const at = v.getUint32(p + 42, true)
		const start = at + 30 + v.getUint16(at + 26, true) + v.getUint16(at + 28, true)
		const raw = z.subarray(start, start + v.getUint32(p + 20, true))
		const data = v.getUint16(p + 10, true) ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : raw
		await bridge('write', { path, data: base64(data), base64: true })
	})
}

// a zip link is downloaded to a temp file first
async function installFromLink(link) {
	if (!/\.zip([?#].*)?$/i.test(link.trim())) return installFromGitHub(link)
	const tmp = '.download.zip'
	await bridge('fetch', { data: link.trim(), path: tmp })
	try {
		const url = await bridge('image', { path: tmp })
		await installFromZip(Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0)), link.trim().split(/[?#]/)[0].split('/').pop().slice(0, -4))
	} finally {
		await bridge('delete', { path: tmp })
	}
}

// bytes to base64 in chunks
function base64(bytes) {
	let s = ''
	for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	return btoa(s)
}

// move old layouts
async function migrate() {
	const files = (await bridge('list')).map((line) => line.slice(line.indexOf('\t') + 1))
	for (const f of files) {
		const m = f.match(/^themes\/([^/]+)\.(css|js)$/)
		if (m) {
			await bridge('write', { path: `themes/${m[1]}/theme.${m[2]}`, data: await read(f) })
			if (m[2] === 'css') await bridge('write', { path: `themes/${m[1]}/project.json`, data: JSON.stringify({ name: m[1] }, null, '\t') + '\n' })
			await bridge('delete', { path: f })
		} else if (/^plugins\/[^/]+\/plugin\.json$/.test(f)) {
			await bridge('write', { path: f.replace(/plugin\.json$/, 'project.json'), data: await read(f) })
			await bridge('delete', { path: f })
		}
	}
}

async function setTheme(name) {
	rinthify.config.theme = name
	await saveConfig()
	await applyTheme()
}

// plugins

async function syncPluginsNow(changed) {
	const ids = rinthify.files.filter((p) => /^plugins\/[^/]+\/project\.json$/.test(p)).map((p) => p.split('/')[1])

	for (const p of [...rinthify.plugins]) {
		if (!ids.includes(p.id)) {
			await stopPlugin(p)
			rinthify.plugins.splice(rinthify.plugins.indexOf(p), 1)
		}
	}

	for (const id of ids) {
		let p = rinthify.plugins.find((x) => x.id === id)
		// data/ changes dont reload
		const touched =
			!changed || [...changed].some((c) => c.startsWith(`plugins/${id}/`) && !c.startsWith(`plugins/${id}/data/`))
		if (!p) {
			p = reactive({ id, manifest: {}, image: null, error: null, running: false, settings: null })
			rinthify.plugins.push(p)
		}
		if (touched) {
			await stopPlugin(p)
			try {
				p.manifest = await readProject(`plugins/${id}`)
				p.error = null
				// icon
				const image = rinthify.files.find((f) => IMAGE.test(f) && f.startsWith(`plugins/${id}/icon.`))
				p.image = image ? await bridge('image', { path: image }).catch(() => null) : null
			} catch (e) {
				p.manifest = {}
				p.error = `project.json: ${e}`
				continue
			}
		}
		const wanted = !off() && rinthify.config.enabled.includes(id)
		if (wanted && !p.running && !p.error) await startPlugin(p)
		if (!wanted && p.running) await stopPlugin(p)
	}
	rinthify.plugins.sort((a, b) => a.id.localeCompare(b.id))
}

const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i

const pending = new Map()
let evalSeq = 0
window.__rinthifyDefine = (token, mod, err) => {
	const r = pending.get(token)
	pending.delete(token)
	if (r) err ? r.reject(err) : r.resolve(mod ?? {})
}

// csp blocks eval, native side runs it
// no import support
function loadModule(id, src) {
	const token = `${id}:${++evalSeq}`
	const t = JSON.stringify(token)
	const code = `(async () => { let __rinthifyModule; try {\n${src.replace(/^\s*export\s+default\s+/m, '__rinthifyModule = ')}\n;__rinthifyDefine(${t}, __rinthifyModule) } catch (e) { __rinthifyDefine(${t}, null, e) } })()`
	return new Promise((resolve, reject) => {
		pending.set(token, { resolve, reject })
		bridge('eval', { data: code, path: `rinthify://plugins/${id}` }).catch((e) => {
			pending.delete(token)
			reject(e)
		})
	})
}

async function startPlugin(p) {
	const entry = { mod: {}, cleanups: [] }
	running.set(p.id, entry)
	p.running = true
	try {
		entry.mod = await loadModule(p.id, await read(`plugins/${p.id}/${p.manifest.main ?? 'index.js'}`))
		await entry.mod.start?.call(entry.mod, makeApi(p.id, entry.cleanups, () => optionValues(`plugins/${p.id}`, p.manifest.options)))
		p.settings = entry.mod.settings ? markRaw(entry.mod.settings) : null
		p.error = null
		log(`plugin ${p.id} started`)
	} catch (e) {
		log(`plugin ${p.id} failed to start:`, e?.stack ?? e)
		await stopPlugin(p)
		p.error = String(e instanceof Error ? (e.stack ?? e.message) : e)
	}
}

async function stopPlugin(p) {
	const entry = running.get(p.id)
	p.running = false
	p.settings = null
	if (!entry) return
	running.delete(p.id)
	await stopEntry(entry, `plugin ${p.id}`)
}

// stop and clean up
async function stopEntry(entry, label) {
	try {
		await entry.mod.stop?.()
	} catch (e) {
		log(`${label} failed to stop:`, e)
	}
	for (const fn of entry.cleanups.reverse()) {
		try {
			fn()
		} catch (e) {
			log(e)
		}
	}
}

async function setEnabled(id, on) {
	rinthify.config.enabled = [...rinthify.config.enabled.filter((x) => x !== id), ...(on ? [id] : [])]
	await saveConfig()
	await syncPlugins(new Set())
}

async function setDisabled(v) {
	rinthify.config.disabled = v
	await saveConfig()
	await applyTheme()
	await syncPlugins(new Set())
}

function reloadPlugin(id) {
	return syncPlugins(new Set([`plugins/${id}/project.json`]))
}

// app's vue

// mounts our vue next to an app component
function host(mount) {
	return markRaw({
		name: 'RinthifyHost',
		render: () => null,
		mounted() {
			const el = document.createElement('div')
			el.className = 'rinthify-host'
			this.$el.parentNode.insertBefore(el, this.$el.nextSibling)
			this.$el.__rinthify = { el, undo: mount(el) }
		},
		beforeUnmount() {
			const { el, undo } = this.$el.__rinthify ?? {}
			undo?.()
			// wait for the app to finish
			setTimeout(() => el?.remove())
		},
	})
}

const mountVue = (component) => (el) => {
	const app = createApp(component)
	app.mount(el)
	return () => app.unmount()
}

const iconHost = (markup) =>
	host((el) => {
		el.style.display = 'contents'
		el.innerHTML = markup
	})

// all app components
function* instances() {
	const stack = [document.querySelector('#app')?._vnode]
	while (stack.length) {
		const v = stack.pop()
		if (!v || typeof v !== 'object') continue
		if (v.component) {
			yield v.component
			stack.push(v.component.subTree)
		} else if (v.suspense) stack.push(v.suspense.activeBranch)
		else if (Array.isArray(v.children)) stack.push(...v.children)
	}
}

// app event hub
function appEvents() {
	const key = Symbol.for('modrinth:appEvents')
	for (const inst of instances()) if (inst.provides?.[key]) return inst.provides[key]
	return null
}

// settings tabs

const TAB_CATEGORY = { id: 'rinthify.settings.category', defaultMessage: 'Rinthify' }
const SETTINGS_TABS = [
	{
		rinthify: true,
		name: { id: 'rinthify.settings.themes', defaultMessage: 'Themes' },
		category: TAB_CATEGORY,
		icon: iconHost(ICONS.palette),
		content: host(mountVue({ render: () => h(ThemesSettings) })),
	},
	{
		rinthify: true,
		name: { id: 'rinthify.settings.plugins', defaultMessage: 'Plugins' },
		category: TAB_CATEGORY,
		icon: iconHost(ICONS.plug),
		content: host(mountVue({ render: () => h(PluginsSettings) })),
	},
	{
		rinthify: true,
		name: { id: 'rinthify.settings.rinthify', defaultMessage: 'Rinthify' },
		category: TAB_CATEGORY,
		icon: iconHost(ICONS.sliders),
		content: host(mountVue({ render: () => h(RinthifySettings) })),
	},
]
let settingsModal = null

// add our tabs
function syncSettingsTabs() {
	if (!settingsModal || settingsModal.isUnmounted) {
		settingsModal = null
		for (const inst of instances()) {
			const tabs = inst.props?.tabs
			if (Array.isArray(tabs) && tabs.some((t) => /settings/.test(`${t?.name?.id} ${t?.category?.id}`))) {
				settingsModal = inst
				break
			}
		}
	}
	const tabs = settingsModal?.props.tabs
	if (tabs && !tabs[0]?.rinthify) settingsModal.props.tabs = [...SETTINGS_TABS, ...tabs.filter((t) => !t.rinthify)]
}

// version after the category name, the heading is plain text so it has to go in by hand
function markCategory() {
	for (const el of document.querySelectorAll('div.uppercase.font-extrabold')) {
		if (el.childNodes.length !== 1 || el.textContent.trim() !== 'Rinthify') continue
		const v = el.appendChild(document.createElement('span'))
		v.textContent = ` v${VERSION}`
		v.style.cssText = 'font-weight:400;text-transform:none'
	}
}

// sidebar

let navBox = null

// buttons above settings
function syncNav() {
	const bar = document.querySelector('.app-grid-navbar')
	// find settings by label
	const buttons = bar ? [...bar.children].filter((e) => e.matches('button.nav-button')) : []
	const settingsButton = buttons.find((e) => e.getAttribute('aria-label') === 'Settings') ?? buttons.pop()
	if (!settingsButton) return
	if (navBox?.nextElementSibling === settingsButton && navBox.dataset.count === String(rinthify.navItems.length)) {
		return markActive()
	}
	navBox ??= document.createElement('div')
	navBox.style.display = 'contents'
	navBox.dataset.count = String(rinthify.navItems.length)
	navBox.replaceChildren(
		...rinthify.navItems.map((item) => {
			const b = document.createElement('button')
			for (const a of settingsButton.attributes) if (a.name.startsWith('data-v-')) b.setAttribute(a.name, '')
			b.className = settingsButton.className.replace(/\brouter-link-active\b|\bsubpage-active\b/g, '')
			b.title = item.label
			b.innerHTML = typeof item.icon === 'string' ? item.icon : ICONS.plug
			b.dataset.to = typeof item.to === 'string' ? item.to : ''
			b.onclick = () => (typeof item.to === 'string' ? routerRef?.push(item.to) : item.to())
			return b
		}),
	)
	bar.insertBefore(navBox, settingsButton)
	markActive()
}

function markActive() {
	const path = routerRef?.currentRoute.value.path ?? ''
	for (const b of navBox?.children ?? []) b.classList.toggle('router-link-active', !!b.dataset.to && path.startsWith(b.dataset.to))
}

// plugin api

function makeApi(id, cleanups, options) {
	const track = (fn) => (cleanups.push(fn), fn)
	const data = () => (rinthify.config.data[id] ??= {})
	return {
		id,
		vue: Vue,
		icons: ICONS,
		get app() {
			return appRef
		},
		get router() {
			return routerRef
		},
		// option values
		get options() {
			return options()
		},
		invoke: (cmd, args) => window.__TAURI_INTERNALS__.invoke(cmd, args),
		// add a page
		addRoute(path, component) {
			const full = `/rinthify/${id}${path.startsWith('/') ? path : `/${path}`}`
			const name = `rinthify:${id}:${full}`
			routerRef.addRoute({ path: full, name, component: host(mountVue(component)) })
			track(() => routerRef.removeRoute(name))
			return full
		},
		// add a sidebar button
		addNavItem(item) {
			const nav = markRaw({ ...item, key: `${id}:${navCounter++}` })
			rinthify.navItems.push(nav)
			syncNav()
			track(() => {
				const i = rinthify.navItems.findIndex((n) => n.key === nav.key)
				if (i >= 0) rinthify.navItems.splice(i, 1)
				syncNav()
			})
		},
		addStyle(css) {
			const el = document.head.appendChild(document.createElement('style'))
			el.textContent = css
			track(() => el.remove())
			return el
		},
		// app events
		on(type, handler) {
			// use the hub if there is one
			const events = appEvents()
			if (events) return track(events.on(type, handler))
			const T = window.__TAURI_INTERNALS__
			const cb = T.transformCallback((e) => handler(e.payload))
			const id = T.invoke('plugin:event|listen', { event: type, target: { kind: 'Any' }, handler: cb })
			return track(() => void id.then((eventId) => T.invoke('plugin:event|unlisten', { event: type, eventId })))
		},
		// run on stop
		onCleanup(fn) {
			track(fn)
		},
		storage: {
			get: (key, fallback) => (key in data() ? data()[key] : fallback),
			async set(key, value) {
				data()[key] = value
				await saveConfig()
			},
		},
		// http past the csp, save writes the body to data/
		fetch: (url, { method, headers, body, save } = {}) =>
			bridge('fetch', {
				data: url,
				method,
				headers,
				body: body == null || typeof body === 'string' ? body : JSON.stringify(body),
				path: save && `plugins/${id}/data/${save}`,
			}),
		// data/ files
		files: {
			path: (path) => `${rinthify.dir}/plugins/${id}/data/${path}`,
			read: (path) => read(`plugins/${id}/data/${path}`),
			// bytes as a Uint8Array
			async bytes(path) {
				const url = await bridge('image', { path: `plugins/${id}/data/${path}` })
				return Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0))
			},
			// a Uint8Array is written as binary
			async write(path, content) {
				const bin = content instanceof Uint8Array
				return bridge('write', { path: `plugins/${id}/data/${path}`, data: bin ? base64(content) : content, base64: bin })
			},
			remove: (path) => bridge('delete', { path: `plugins/${id}/data/${path}` }),
		},
	}
}

// settings pages

const CSS = `
.rf { display: flex; flex-direction: column; gap: 1rem; color: var(--color-text-default); }
.rf h2 { margin: 0; font-size: 1.25rem; line-height: 1.75rem; font-weight: 600; color: var(--color-contrast); }
.rf p { margin: 0; line-height: 1.3; }
.rf .rf-err { color: var(--color-red); white-space: pre-wrap; margin: 0; font-size: 0.85rem; }
.rf .rf-end { margin-left: auto; display: flex; align-items: center; gap: 0.5rem; }
.rf pre { margin: 0; white-space: pre-wrap; font-size: 0.8rem; max-height: 12rem; overflow: auto; }
.rf [data-button] svg, .rf .rf-lead svg { width: 1.25rem; height: 1.25rem; flex: none; }
.rf .rf-admon svg { width: 1.5rem; height: 1.5rem; }
.rf .button-frame--base { box-shadow: inset 0 0 0 1px var(--surface-5), 0 1px 1px rgba(0, 0, 0, 0.12); }
.rf .button-frame--colored { box-shadow: 0 0 0 1px color-mix(in srgb, var(--button-color) 30%, transparent), 0 2px 4px rgba(0, 0, 0, 0.04), 0 5px 8px rgba(0, 0, 0, 0.04); }
.rf .button-frame--quiet { color: var(--button-color, var(--color-base)); }
.rf .checkbox-shadow { box-shadow: 1px 1px 2px 0 rgba(0, 0, 0, 0.08); }
.rf .checkbox-shadow svg { width: 1rem; height: 1rem; }
.rf .avatar { --_size: 3rem; outline: 1px solid rgb(255 255 255 / 15%); outline-offset: -1px; background-color: var(--color-button-bg); object-fit: contain; border-radius: calc(16 / 96 * var(--_size)); width: var(--_size); height: var(--_size); min-width: var(--_size); min-height: var(--_size); box-shadow: var(--shadow-card); }
.rf .rf-editor { min-height: 22rem; resize: vertical; font-family: ui-monospace, 'JetBrains Mono', monospace; font-size: 0.85rem; line-height: 1.45; tab-size: 4; white-space: pre; }
.rf .rf-editor-sm { min-height: 8rem; }
.rf .rf-dhead { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.rf input[type=color] { width: 2rem; height: 2rem; padding: 0; border: 1px solid var(--surface-5, var(--color-divider)); border-radius: 0.5rem; background: none; cursor: pointer; }
.rf .rf-fine-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0.6rem; }
.rf .rf-fine-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
.rf .rf-thumb { height: 2.5rem; border-radius: 0.4rem; }
.rf .rf-w { width: 14rem; }
.rf .rf-num { width: 5rem; }
.rf .rf-num input { text-align: center; -moz-appearance: textfield; }
.rf .rf-num input::-webkit-inner-spin-button, .rf .rf-num input::-webkit-outer-spin-button { margin: 0; -webkit-appearance: none; }
.rf .rf-row-line + .rf-row-line { border-top: 1px solid var(--color-button-bg); }
.rf-designer { gap: 2rem; }
.rf .rf-tile { position: relative; }
.rf .rf-tile-actions { position: absolute; top: 0.5rem; right: 0.5rem; display: flex; gap: 0.25rem; }
.rf .rf-seg-on { background-color: var(--surface-4); box-shadow: inset 0 0 0 1px var(--surface-5); }
.rf .slider { left: -0.625rem; width: calc(100% + 1.25rem); }
.rf .slider:focus { box-shadow: none; }
.rf .slider::-webkit-slider-runnable-track { height: 0.25rem; background: transparent; }
.rf .slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 1.25rem; height: 1.25rem; border: 0; background: transparent; }
.rf .slider:focus-visible ~ .slider-track .slider-thumb { outline: 3px solid var(--color-focus-ring); outline-offset: 3px; }
.rf .slider:hover ~ .slider-track .filled-slider-track, .rf .slider:focus-visible ~ .slider-track .filled-slider-track { filter: brightness(var(--hover-brightness)); }
.rf .filled-slider-track { transition: width 0.25s var(--ease-out-expo); }
.rf .preview .example-card { display: grid; grid-template: 'icon text1' 'icon text2'; grid-template-columns: auto 1fr; gap: 0.5rem; }
.rf .example-icon { grid-area: icon; width: 2rem; height: 2rem; background-color: var(--color-button-bg); border-radius: var(--radius-sm); }
.rf .example-text-1, .rf .example-text-2 { height: 0.5rem; border-radius: var(--radius-sm); }
.rf .example-text-1 { grid-area: text1; width: 100%; background-color: var(--color-base); }
.rf .example-text-2 { grid-area: text2; width: 60%; background-color: var(--color-secondary); }
.rf .theme-options { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: var(--gap-lg, 1rem); }
.rf .preview-radio .label svg { width: 1.25rem; height: 1.25rem; }
@media (prefers-reduced-motion) { .rf .filled-slider-track { transition: none; } }
`

// modrinth's ui markup
const FRAME = 'relative inline-flex min-w-0 shrink-0 items-center justify-center whitespace-nowrap border-0 no-underline touch-manipulation cursor-pointer select-none transition-[background-color,color,box-shadow,filter,opacity,transform] duration-150 ease-out enabled:active:scale-[0.97] [&:not(:disabled):not([aria-disabled=true]):hover]:brightness-[--hover-brightness] [&:not(:disabled):not([aria-disabled=true]):focus-visible]:brightness-[--hover-brightness] focus-visible:outline-none [&:not(:disabled):not([aria-disabled=true]):focus-visible]:ring-4 [&:not(:disabled):not([aria-disabled=true]):focus-visible]:ring-brand-shadow disabled:cursor-not-allowed disabled:opacity-50'
const MD = 'h-9 gap-1.5 rounded-xl px-2.5 text-base font-semibold leading-5'
const btnClass = (opts = {}) => [FRAME, MD, opts.primary || opts.red ? 'button-frame--colored bg-[--button-color] text-[var(--color-accent-contrast)]' : 'button-frame--base bg-surface-4 text-contrast']
const btnStyle = (opts = {}) => (opts.primary ? '--button-color:var(--color-brand)' : opts.red ? '--button-color:var(--color-red)' : undefined)
const btn = (label, onClick, opts = {}) =>
	h('button', { type: 'button', 'data-button': '', class: btnClass(opts), style: btnStyle(opts), disabled: opts.disabled, onClick }, [opts.icon && icon(opts.icon), label])

const FIELD = 'group/input min-w-0 touch-manipulation border border-solid font-medium text-primary shadow-none transition-[background-color,border-color,box-shadow,color] focus-within:text-contrast focus-within:ring-4 focus-within:ring-brand-shadow border-surface-5 bg-surface-4'
const CONTROL = 'min-w-0 appearance-none !min-h-0 !border-0 !bg-transparent !p-0 font-medium text-primary !shadow-none !outline-none placeholder:text-secondary focus:text-contrast focus:ring-0 w-full flex-1 text-base'
const input = (attrs, wrap, lead) =>
	h('div', { class: [FIELD, 'inline-flex h-9 items-center gap-2 rounded-xl px-3', wrap] }, [
		lead && h('span', { class: 'rf-lead flex size-5 shrink-0 items-center justify-center text-secondary opacity-60 transition-colors group-focus-within/input:text-contrast group-focus-within/input:opacity-100', 'aria-hidden': 'true' }, [icon(lead)]),
		h('input', { type: 'text', ...attrs, class: CONTROL }),
	])
const textarea = (attrs) =>
	h('div', { class: [FIELD, 'flex w-full items-start gap-2 rounded-xl px-3 py-2'] }, [
		h('textarea', { spellcheck: false, ...attrs, class: ['min-h-0 min-w-0 w-full flex-1 self-stretch appearance-none border-0 bg-transparent p-0 font-medium text-base text-primary shadow-none outline-none placeholder:text-secondary focus:text-contrast focus:ring-0', attrs.class] }),
	])

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
const checkbox = (checked, onChange, label) =>
	h('button', { type: 'button', role: 'checkbox', 'aria-checked': String(checked), class: 'group bg-transparent border-none p-0 m-0 flex items-center text-left gap-3 checkbox-outer outline-offset-4 text-contrast cursor-pointer hover:brightness-[--hover-brightness] focus-visible:brightness-[--hover-brightness]', onClick: () => onChange(!checked) }, [
		h('span', { class: ['w-5 h-5 aspect-square rounded-md flex shrink-0 items-center justify-center border-[1px] border-solid checkbox-shadow group-active:scale-95', checked ? 'bg-brand border-button-border text-brand-inverted' : 'bg-surface-2 border-surface-5 text-primary'] }, checked ? [icon(CHECK)] : []),
		h('span', { 'aria-hidden': 'true' }, label),
	])

const ADMON = { warning: ['border-brand-orange bg-bg-orange', 'text-brand-orange'], critical: ['border-brand-red bg-bg-red', 'text-brand-red'] }
const admonition = (type, header, body, actions) =>
	h('div', { class: ['rf-admon relative grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-2 rounded-2xl border border-solid p-4 text-contrast items-start', ADMON[type][0]] }, [
		h('span', { class: ['h-6 w-6 flex-none', ADMON[type][1]] }, [icon(ICONS.alert)]),
		h('div', { class: 'col-start-2 min-w-0 flex flex-1 flex-col gap-2' }, [
			header && h('div', { class: 'flex flex-wrap items-center gap-2 text-lg font-semibold leading-6' }, header),
			body && h('div', { class: 'font-normal text-contrast/85 leading-tight' }, body),
			actions && h('div', { class: 'mt-2' }, actions),
		]),
	])

// code editor
const Editor = {
	props: { files: Array, initial: String },
	emits: ['close', 'input'],
	setup(props, { emit }) {
		const path = ref(props.initial ?? props.files[0] ?? '')
		const text = ref('')
		const saved = ref('')
		const error = ref('')
		const autoSave = ref(true)
		let timer

		async function load(p) {
			error.value = ''
			try {
				text.value = saved.value = await read(p)
			} catch (e) {
				text.value = saved.value = ''
				error.value = String(e)
			}
		}
		async function save() {
			clearTimeout(timer)
			if (text.value === saved.value) return
			try {
				const content = text.value
				await write(path.value, content)
				saved.value = content
				error.value = ''
			} catch (e) {
				error.value = `Save failed: ${e}`
			}
		}
		function onInput(e) {
			text.value = e.target.value
			emit('input', path.value, text.value)
			clearTimeout(timer)
			if (autoSave.value) timer = setTimeout(save, 600)
		}
		function onKey(e) {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault()
				void save()
			} else if (e.key === 'Tab' && !e.shiftKey) {
				// tab inserts a tab
				e.preventDefault()
				e.target.setRangeText('\t', e.target.selectionStart, e.target.selectionEnd, 'end')
				onInput(e)
			}
		}
		watch(path, load, { immediate: true })
		onBeforeUnmount(() => void save())

		return () =>
			h('div', { class: 'flex flex-col gap-4' }, [
				h('div', { class: 'flex items-center gap-2' }, [
					props.files.length > 1 && seg(props.files.map((f) => [f, f.split('/').pop()]), path.value, async (f) => (await save(), (path.value = f)), 'Files'),
					h('div', { class: 'rf-end' }, [
						checkbox(autoSave.value, (v) => (autoSave.value = v), 'Auto-save'),
						btn('Save', save, { disabled: text.value === saved.value, primary: true }),
						btn('Close', async () => (await save(), emit('close'))),
					]),
				]),
				textarea({ class: 'rf-editor', 'aria-label': path.value, value: text.value, onInput, onKeydown: onKey }),
				error.value && h('p', { class: 'rf-err' }, error.value),
			])
	},
}

// confirm delete
function useConfirm() {
	const armed = ref(null)
	let timer
	const ask = (key) => {
		clearTimeout(timer)
		if (armed.value === key) return (armed.value = null), true
		armed.value = key
		timer = setTimeout(() => (armed.value = null), 3000)
		return false
	}
	return { armed, ask }
}

// theme designer

// color math, hex in and out
const hexRgb = (x) => {
	x = x.replace('#', '')
	if (x.length === 3) x = [...x].map((c) => c + c).join('')
	const n = parseInt(x.slice(0, 6), 16) || 0
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function hexHsl(x) {
	const [r, g, b] = hexRgb(x).map((v) => v / 255)
	const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2
	if (!d) return [0, 0, l * 100]
	const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
	return [(hue * 60 + 360) % 360, (d / (1 - Math.abs(2 * l - 1))) * 100, l * 100]
}
function hsl(hh, s, l) {
	s /= 100
	l /= 100
	const k = (n) => (n + hh / 30) % 12
	const f = (n) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
	return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}
const luminance = (x) =>
	hexRgb(x)
		.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
		.reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)

const THEME_DEFAULTS = {
	accent: '#1bd96a', mode: 'dark', hue: null, tint: 12,
	radius: 1, float: false, gap: 0.6, lines: true,
	backdrop: 'plain', grad: ['#0d2a1c', '#06080a'], angle: 160, dim: 35, blur: 0, panel: 100,
	nav: 'app', font: '', size: 100, over: {}, advanced: false,
}
const PRESETS = [
	{ name: 'Modrinth', accent: '#1bd96a', mode: 'dark', tint: 12 },
	{ name: 'Amber', accent: '#f2a93b', mode: 'dark', tint: 14 },
	{ name: 'Blue', accent: '#7aa2f7', mode: 'dark', tint: 22 },
	{ name: 'Rose', accent: '#f472b6', mode: 'dark', tint: 12 },
	{ name: 'Violet', accent: '#a78bfa', mode: 'black', tint: 24 },
	{ name: 'Teal', accent: '#2dd4bf', mode: 'black', tint: 18 },
	{ name: 'Gray', accent: '#e5e5e5', mode: 'dark', tint: 0 },
	{ name: 'Light', accent: '#00a85a', mode: 'light', tint: 8 },
]
// fine tune colors
const TUNABLE = [
	['--surface-1', 'Background'], ['--surface-2', 'Lower panels'], ['--surface-3', 'Cards'], ['--surface-4', 'Buttons'],
	['--surface-5', 'Lines'], ['--color-text-primary', 'Headings'], ['--color-text-default', 'Text'],
	['--color-text-tertiary', 'Quiet text'], ['--color-accent-contrast', 'Text on accent'],
]

// all colors of a design
function themePalette(o) {
	const hh = o.hue ?? hexHsl(o.accent)[0]
	const light = o.mode === 'light'
	const s = light ? o.tint * 0.6 : o.tint
	const steps = { dark: [7, 8.5, 10, 11.5, 13, 17, 22], black: [0, 3, 5, 6.5, 8, 11, 16], light: [92, 93, 96, 95, 97, 100, 86] }[o.mode] ?? [7, 8.5, 10, 11.5, 13, 17, 22]
	const p = {}
	;['1', '1-5', '2', '2-5', '3', '4', '5'].forEach((k, i) => (p[`--surface-${k}`] = hsl(hh, s, steps[i])))
	const ts = Math.min(s, 12)
	const text = light ? [10, 20, 34] : [95, 78, 62]
	p['--color-text-primary'] = hsl(hh, ts, text[0])
	p['--color-text-default'] = hsl(hh, ts, text[1])
	p['--color-text-tertiary'] = hsl(hh, ts, text[2])
	p['--color-brand'] = o.accent
	p['--color-accent-contrast'] = luminance(o.accent) > 0.35 ? hsl(hh, 30, 7) : '#ffffff'
	p.backdrop = light ? hsl(hh, s, 84) : hsl(hh, s, Math.max(steps[0] - 3, 0))
	return Object.assign(p, o.over)
}

const DESIGNER_END = '/* your own CSS goes below this line; the designer keeps it when it saves */'

// design to css
function designerCss(o, image, custom) {
	const p = themePalette(o)
	const light = o.mode === 'light'
	const ink = light ? '0, 0, 0' : '255, 255, 255'
	const r = o.radius
	const settings = { ...o }
	const vars = [
		...Object.entries(p).filter(([k]) => k.startsWith('--')).map(([k, v]) => `${k}: ${v};`),
		'--color-base: var(--color-text-default);',
		'--color-secondary: var(--color-text-tertiary);',
		'--color-contrast: var(--color-text-primary);',
		'--color-brand-highlight: color-mix(in srgb, var(--color-brand) 16%, transparent);',
		'--color-brand-shadow: color-mix(in srgb, var(--color-brand) 45%, transparent);',
		'--color-button-bg-selected: var(--color-brand);',
		'--color-button-text-selected: var(--color-accent-contrast);',
		'--color-bg: var(--surface-1);',
		'--color-raised-bg: var(--surface-3);',
		'--color-super-raised-bg: var(--surface-4);',
		'--color-button-bg: var(--surface-4);',
		`--color-button-border: rgba(${ink}, 0.08);`,
		'--color-divider: var(--surface-5);',
		'--color-scrollbar: var(--surface-5);',
		'--color-gradient-button-bg: var(--surface-4);',
		'--brand-gradient-bg: none;',
		'--brand-gradient-strong-bg: var(--surface-2);',
		`--brand-gradient-button: rgba(${ink}, 0.05);`,
		'--brand-gradient-border: var(--surface-5);',
		'--brand-gradient-fade-out-color: linear-gradient(to bottom, transparent, var(--surface-2) 80%);',
		'--loading-bar-gradient: linear-gradient(to right, var(--color-brand), var(--color-brand));',
		`--radius-sm: ${r * 0.5}rem; --radius-md: ${r * 0.75}rem; --radius-lg: ${r}rem; --radius-xl: ${r * 1.25}rem;`,
		`--rd-gap: ${o.gap}rem;`,
		`--rd-backdrop: ${p.backdrop};`,
		image && o.backdrop === 'image' ? `--rd-image: url("${image}");` : '',
	].filter(Boolean)
	const out = [
		`/* rinthify-designer ${JSON.stringify(settings)} */`,
		`html.dark-mode,\nhtml.oled-mode,\nhtml.light-mode {\n\t${vars.join('\n\t')}\n}`,
		'.btn.btn-primary { color: var(--color-accent-contrast) !important; }',
		':focus-visible { outline: 2px solid var(--color-brand) !important; outline-offset: 2px; }',
		'::selection { background: color-mix(in srgb, var(--color-brand) 35%, transparent); }',
		'::-webkit-scrollbar { width: 10px; height: 10px; }',
		'::-webkit-scrollbar-track { background: transparent; }',
		'::-webkit-scrollbar-thumb { background: var(--surface-5); border-radius: 999px; border: 3px solid transparent; background-clip: padding-box; }',
	]

	// backdrop
	const backdrop = o.backdrop === 'gradient' ? `linear-gradient(${o.angle}deg, ${o.grad[0]}, ${o.grad[1]}) fixed` : 'var(--rd-backdrop)'
	if (o.float || o.backdrop !== 'plain') {
		const panel = o.backdrop === 'plain' ? 'var(--surface-1)' : `color-mix(in srgb, var(--surface-1) ${o.panel}%, transparent)`
		out.push(
			`html { background: ${backdrop} !important; }`,
			'body { background: transparent !important; }',
			'.app-grid-layout, .app-title-bar { background: transparent !important; }',
			`.app-grid-navbar, .app-contents { background: ${panel} !important; }`,
			'.app-contents::before { display: none !important; }',
		)
	}
	if (o.backdrop === 'image' && image) {
		const pad = o.blur * 2
		out.push(
			`body::before { content: ''; position: fixed; inset: -${pad}px; z-index: -1; pointer-events: none; background: var(--rd-image) center / cover no-repeat; filter: blur(${o.blur}px) brightness(${(100 - o.dim) / 100}); }`,
		)
	}
	if (o.float) {
		const line = o.lines ? '1px solid var(--surface-5)' : 'none'
		out.push(
			`.app-grid-navbar { margin: 0 0 var(--rd-gap) var(--rd-gap) !important; width: calc(var(--left-bar-width) - var(--rd-gap)) !important; height: calc(100vh - var(--top-bar-height) - var(--rd-gap)) !important; padding: 0.5rem 0 !important; align-items: center; box-sizing: border-box; border-radius: var(--radius-xl) !important; border: ${line}; }`,
			`.app-contents { left: calc(var(--left-bar-width) + var(--rd-gap)) !important; right: var(--rd-gap) !important; bottom: var(--rd-gap) !important; width: auto !important; height: auto !important; border-radius: var(--radius-xl) !important; border: ${line}; overflow: hidden; }`,
			'.loading-indicator-container { left: calc(var(--left-bar-width) + var(--rd-gap) + 1px) !important; top: calc(var(--top-bar-height) + 1px) !important; }',
			'.app-sidebar { height: 100% !important; margin-top: 0 !important; background: var(--surface-1-5) !important; }',
		)
	} else if (o.lines) {
		out.push('.app-grid-navbar { border-right: 1px solid var(--surface-5); }')
	}

	// sidebar buttons
	if (o.nav !== 'app') {
		out.push(
			'.app-grid-navbar .nav-button { border-radius: calc(var(--radius-md) * 0.9) !important; color: var(--color-text-default) !important; transition: background-color 0.12s ease, color 0.12s ease; }',
			'.app-grid-navbar .nav-button:hover { background: var(--surface-3) !important; color: var(--color-contrast) !important; }',
			'.app-grid-navbar .nav-button::before { display: none !important; }',
			'.app-grid-navbar .nav-button svg { filter: none !important; }',
		)
		if (o.nav === 'fill')
			out.push('.app-grid-navbar .nav-button.router-link-active, .app-grid-navbar .nav-button.subpage-active { background: var(--color-brand) !important; color: var(--color-accent-contrast) !important; }')
		else
			out.push(
				'.app-grid-navbar .nav-button.router-link-active, .app-grid-navbar .nav-button.subpage-active { background: var(--surface-4) !important; color: var(--color-contrast) !important; }',
				'.app-grid-navbar .nav-button.router-link-active { color: var(--color-brand) !important; }',
				".app-grid-navbar .nav-button.router-link-active::after { content: ''; position: absolute; left: 0; top: 30%; bottom: 30%; width: 3px; border-radius: 0 3px 3px 0; background: var(--color-brand); }",
			)
	}
	if (o.font) out.push(`body, button, input, textarea, select { font-family: "${o.font}", var(--font-standard, sans-serif) !important; }`)
	if (o.size !== 100) out.push(`html { font-size: ${o.size}% !important; }`)
	return `${out.join('\n')}\n\n${DESIGNER_END}\n${custom ?? ''}`
}

// css to design, null if hand written
function parseDesigner(css) {
	const m = css.match(/^\/\* rinthify-designer (\{.*\}) \*\//)
	if (!m) return null
	try {
		const end = css.indexOf(DESIGNER_END)
		return {
			o: { ...structuredClone(THEME_DEFAULTS), ...JSON.parse(m[1]) },
			image: css.match(/--rd-image: url\("([^"]*)"\)/)?.[1] ?? '',
			custom: end < 0 ? '' : css.slice(end + DESIGNER_END.length + 1),
		}
	} catch {
		return null
	}
}

// preview colors
function cssPreviewColors(css) {
	const get = (v, d) => css.match(new RegExp(`${v}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1] ?? d
	const back = get('--surface-1', '#16181c')
	return { back, panel: back, raised: get('--surface-3', '#1d1f23'), text: get('--color-text-primary', '#ffffff'), brand: get('--color-brand', '#1bd96a') }
}
const designColors = (o) => {
	const p = themePalette(o)
	return { back: o.float ? p.backdrop : p['--surface-1'], panel: p['--surface-1'], raised: p['--surface-3'], text: p['--color-text-primary'], brand: p['--color-brand'], round: o.radius }
}

// modrinth's components
const RADIO = (on) => `<svg class="radio shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>${on ? '<circle cx="12" cy="12" r="5" fill="currentColor"/>' : ''}</svg>`
const SEG_BTN = 'relative z-[1] inline-flex min-w-0 shrink-0 items-center justify-center whitespace-nowrap border-0 cursor-pointer select-none transition-[background-color,color,box-shadow,filter,opacity,transform] duration-150 ease-out enabled:active:scale-[0.97] button-frame--quiet bg-transparent h-8 gap-1 text-sm leading-5 !rounded-[10px] !px-3 !font-medium !text-contrast'
const SEG_HOVER = '[&:not(:disabled):not([aria-disabled=true]):hover]:bg-surface-4'

const seg = (options, value, set, label) =>
	h('div', { role: 'radiogroup', 'aria-label': label, class: 'relative inline-flex h-9 items-center gap-0.5 rounded-xl border border-solid border-surface-5 p-px shadow-[0_1px_3px_rgba(0,0,0,0.15)]' }, options.map(([v, text]) =>
		h('button', { type: 'button', role: 'radio', 'aria-checked': String(value === v), class: [SEG_BTN, value === v ? 'rf-seg-on' : SEG_HOVER], onClick: () => set(v) }, text)))
const field = (label, ...control) =>
	h('div', { class: 'flex items-center justify-between gap-4' }, [
		h('div', { class: 'min-w-0' }, [h('h3', { class: 'm-0 text-lg font-semibold text-contrast' }, label)]),
		h('div', { class: 'flex shrink-0 items-center gap-2' }, control),
	])
const group = (label, ...control) => h('div', { class: 'flex flex-col gap-2' }, [h('h3', { class: 'm-0 text-lg font-semibold text-contrast' }, label), ...control])
const section = (title, ...children) => h('section', { class: 'flex flex-col gap-4' }, [h('h2', title), ...children])
const colorInput = (value, set, label) => h('input', { type: 'color', value, 'aria-label': label, onInput: (e) => set(e.target.value) })
const slider = (value, min, max, step, set, label) =>
	h('div', { class: 'flex w-full items-center gap-4' }, [
		h('div', { class: 'relative mx-2 min-w-0 flex-1 h-10' }, [
			h('input', { type: 'range', min, max, step, value, 'aria-label': label, class: 'slider absolute top-0 h-full min-h-0 appearance-none overflow-visible border-0 bg-transparent p-0 shadow-none outline-none cursor-ew-resize', onInput: (e) => set(Number(e.target.value)) }),
			h('div', { class: 'slider-track pointer-events-none absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-surface-5' }, [
				h('div', { class: 'filled-slider-track h-full rounded-full bg-brand relative', style: { width: `${((value - min) / (max - min)) * 100}%` } }, [
					h('div', { class: 'slider-thumb absolute h-8 w-[10px] rounded-full bg-brand top-[-13px] right-[-5px]' }),
				]),
			]),
		]),
		input({ type: 'number', min, max, step, value, 'aria-label': label, onChange: (e) => set(Math.min(max, Math.max(min, Number(e.target.value) || min))) }, 'rf-num'),
	])

// theme card
const themeCard = (c, label, selected, onClick) =>
	h('button', { type: 'button', class: ['preview-radio button-base', selected && 'selected'], 'aria-pressed': String(selected), onClick }, [
		h('div', { class: 'preview', 'aria-hidden': 'true', style: { '--color-bg': c.back, '--surface-3': c.raised, '--surface-4': c.panel, '--color-button-bg': c.brand, '--color-base': c.text, '--color-secondary': `color-mix(in srgb, ${c.text} 45%, transparent)` } }, [
			h('div', { class: 'example-card rounded-lg border border-solid border-surface-4 bg-surface-3' }, [h('div', { class: 'example-icon' }), h('div', { class: 'example-text-1' }), h('div', { class: 'example-text-2' })]),
		]),
		h('div', { class: 'label' }, [icon(RADIO(selected)), label]),
	])

// options controls
function optionsPanel(key, options = []) {
	const v = optionValues(key, options)
	return h('div', { class: 'flex flex-col gap-4' }, options.map((o) => {
		const label = o.label ?? o.id
		const set = (x) => setOption(key, o.id, x)
		if (o.type === 'slider') return group(label, slider(v[o.id] ?? o.min ?? 0, o.min ?? 0, o.max ?? 100, o.step ?? 1, set, label))
		return field(label,
			o.type === 'toggle' ? toggle(!!v[o.id], set, false, label)
			: o.type === 'color' ? colorInput(v[o.id] ?? '#000000', set, label)
			: o.type === 'select' ? seg((o.choices ?? []).map((c) => (typeof c === 'object' ? [c.value, c.label] : [c, c])), v[o.id], set, label)
			: input({ value: v[o.id] ?? '', 'aria-label': label, onChange: (e) => set(e.target.value) }, 'rf-w'))
	}))
}

// designer
const Designer = {
	props: { name: String },
	emits: ['close', 'raw'],
	setup(props, { emit }) {
		const o = reactive(structuredClone(THEME_DEFAULTS))
		const image = ref('')
		const custom = ref('')
		const imageError = ref('')
		const fine = ref(false)
		const path = `themes/${props.name}/theme.css`
		let ready = false
		let timer
		let pending = null

		read(path).then((css) => {
			const d = parseDesigner(css)
			if (d) (Object.assign(o, d.o), (image.value = d.image), (custom.value = d.custom))
			ready = true
		})
		async function save() {
			clearTimeout(timer)
			if (pending == null) return
			const css = pending
			pending = null
			await write(path, css).catch((e) => console.error('[rinthify] theme save failed', e))
		}
		watch([o, image, custom], () => {
			if (!ready) return
			pending = designerCss(o, image.value, custom.value)
			previewTheme(props.name, pending)
			clearTimeout(timer)
			timer = setTimeout(save, 400)
		}, { deep: true })
		onBeforeUnmount(() => void save())

		const pal = computed(() => themePalette(o))
		const usePreset = (pr) => Object.assign(o, { accent: pr.accent, mode: pr.mode, tint: pr.tint, hue: null, over: {} })
		const isPreset = (pr) => o.accent === pr.accent && o.mode === pr.mode && o.tint === pr.tint && o.hue == null

		function pickImage(e) {
			const file = e.target.files?.[0]
			if (!file) return
			if (file.size > 8e6) return void (imageError.value = 'Pick an image under 8 MB.')
			imageError.value = ''
			const fr = new FileReader()
			fr.onload = () => ((image.value = fr.result), o.panel === 100 && (o.panel = 82))
			fr.readAsDataURL(file)
		}

		const accent = () => field('Accent', colorInput(o.accent, (v) => (o.accent = v), 'Accent'))
		const base = () => field('Base', seg([['dark', 'Dark'], ['black', 'Black'], ['light', 'Light']], o.mode, (v) => (o.mode = v), 'Base'))
		const toggleRow = (label, on, set) => field(label, toggle(on, set, false, label))

		const simple = () => [
			section('Presets',
				h('div', { class: 'theme-options', role: 'group', 'aria-label': 'Presets' }, PRESETS.map((pr) =>
					themeCard(designColors({ ...o, ...pr, hue: null, over: {} }), pr.name, isPreset(pr), () => usePreset(pr)))),
			),
			section('Style',
				accent(),
				base(),
				field('Corners', seg([[0.35, 'Square'], [1, 'Normal'], [1.6, 'Round']], o.radius, (v) => (o.radius = v), 'Corners')),
				toggleRow('Separate panels', o.float, (v) => (o.float = v)),
			),
		]

		const advanced = () => [
			section('Colors',
				accent(),
				base(),
				toggleRow('Background matches accent', o.hue == null, (v) => (o.hue = v ? null : Math.round(hexHsl(o.accent)[0]))),
				o.hue != null && group('Background hue', slider(o.hue, 0, 359, 1, (v) => (o.hue = v), 'Background hue')),
				group('Tint', slider(o.tint, 0, 40, 1, (v) => (o.tint = v), 'Tint')),
				toggleRow('Each color', fine.value, (v) => (fine.value = v)),
				fine.value && h('div', { class: 'rf-fine-grid' }, TUNABLE.map(([k, label]) =>
					h('div', { class: 'rf-fine-item' }, [
						colorInput(pal.value[k], (v) => (o.over[k] = v), label),
						h('span', label),
						k in o.over && iconBtn(ICONS.trash, `Reset ${label}`, () => delete o.over[k]),
					]))),
			),
			section('Backdrop',
				field('Fill', seg([['plain', 'Plain'], ['gradient', 'Gradient'], ['image', 'Image']], o.backdrop, (v) => (o.backdrop = v), 'Backdrop')),
				o.backdrop === 'gradient' && [
					field('Colors', colorInput(o.grad[0], (v) => (o.grad[0] = v), 'Gradient start'), colorInput(o.grad[1], (v) => (o.grad[1] = v), 'Gradient end')),
					group('Angle', slider(o.angle, 0, 360, 5, (v) => (o.angle = v), 'Angle')),
				],
				o.backdrop === 'image' && [
					field('Image',
						image.value && h('img', { class: 'rf-thumb', src: image.value, alt: '' }),
						h('label', { 'data-button': '', class: btnClass() }, [icon(ICONS.plus), image.value ? 'Change' : 'Choose', h('input', { type: 'file', accept: 'image/*', hidden: true, onChange: pickImage })]),
					),
					imageError.value && h('span', { class: 'rf-err' }, imageError.value),
					group('Dim', slider(o.dim, 0, 90, 1, (v) => (o.dim = v), 'Dim')),
					group('Blur', slider(o.blur, 0, 30, 1, (v) => (o.blur = v), 'Blur')),
				],
				o.backdrop !== 'plain' && group('Panel opacity', slider(o.panel, 30, 100, 1, (v) => (o.panel = v), 'Panel opacity')),
			),
			section('Layout',
				toggleRow('Separate panels', o.float, (v) => (o.float = v)),
				o.float && group('Gap', slider(Math.round(o.gap * 16), 4, 24, 1, (v) => (o.gap = v / 16), 'Gap')),
				group('Corners', slider(Math.round(o.radius * 20), 0, 40, 1, (v) => (o.radius = v / 20), 'Corners')),
				toggleRow('Outlines', o.lines, (v) => (o.lines = v)),
				field('Current page', seg([['app', 'Round'], ['fill', 'Filled'], ['bar', 'Bar']], o.nav, (v) => (o.nav = v), 'Current page')),
			),
			section('Text',
				field('Font', input({ placeholder: 'Default', value: o.font, 'aria-label': 'Font', onChange: (e) => (o.font = e.target.value.replace(/[^\w \-]/g, '').trim()) }, 'rf-w')),
				group('Size', slider(o.size, 85, 125, 5, (v) => (o.size = v), 'Size')),
			),
			section('Custom CSS',
				textarea({ class: 'rf-editor rf-editor-sm', 'aria-label': 'Custom CSS', value: custom.value, onInput: (e) => (custom.value = e.target.value) }),
				h('div', { class: 'flex gap-2' }, [btn('Edit file', async () => (await save(), emit('raw')), { icon: ICONS.pencil })]),
			),
		]

		return () =>
			h('div', { class: 'rf rf-designer' }, [
				h('div', { class: 'rf-dhead' }, [
					iconBtn(ICONS.back, 'Back', async () => (await save(), emit('close'))),
					h('h2', props.name),
					h('div', { class: 'rf-end' }, [
						seg([[false, 'Simple'], [true, 'Advanced']], o.advanced, (v) => (o.advanced = v), 'Mode'),
						btn('Done', async () => (await save(), emit('close')), { primary: true }),
					]),
				]),
				...(o.advanced ? advanced() : simple()),
			])
	},
}

const ThemesSettings = {
	setup() {
		const editing = ref(null) // open in editor
		const designing = ref(null) // open in designer
		const newName = ref('')
		const error = ref('')
		const looks = reactive({}) // name -> preview
		const confirm = useConfirm()

		// read themes for previews
		async function refresh() {
			for (const name of rinthify.themes) {
				const css = await read(`themes/${name}/theme.css`).catch(() => '')
				const d = parseDesigner(css)
				looks[name] = { design: !!d, colors: d ? designColors(d.o) : cssPreviewColors(css) }
			}
		}
		watch(() => rinthify.files.join('\n'), refresh, { immediate: true })

		async function open(name) {
			if (rinthify.config.theme !== name) await setTheme(name)
			looks[name]?.design === false ? (editing.value = name) : (designing.value = name)
		}
		async function create() {
			const name = newName.value.trim().replace(/[^\w.-]+/g, '-')
			if (!name) return
			if (rinthify.themes.includes(name)) return void (error.value = `There is already a theme called "${name}".`)
			error.value = ''
			await bridge('write', { path: `themes/${name}/project.json`, data: JSON.stringify({ name, version: '1.0.0', author: '', description: '' }, null, '\t') + '\n' })
			await write(`themes/${name}/theme.css`, designerCss(structuredClone(THEME_DEFAULTS), '', ''))
			newName.value = ''
			looks[name] = { design: true, colors: designColors(THEME_DEFAULTS) }
			await open(name)
		}
		async function del(name) {
			if (!confirm.ask(name)) return
			if (editing.value === name) editing.value = null
			if (rinthify.config.theme === name) await setTheme(null)
			await remove(`themes/${name}`)
		}

		const tile = (name, label, colors, actions) => {
			const active = (rinthify.config.theme ?? null) === name
			return h('div', { class: 'rf-tile' }, [
				themeCard(colors, label, active, () => !active && setTheme(name)),
				actions && h('div', { class: 'rf-tile-actions' }, actions),
			])
		}

		return () => {
			if (designing.value)
				return h(Designer, {
					key: designing.value,
					name: designing.value,
					onClose: () => ((designing.value = null), refresh()),
					onRaw: () => ((editing.value = designing.value), (designing.value = null)),
				})
			const active = rinthify.themeInfo[rinthify.config.theme]
			return h('div', { class: 'rf' }, [
				h('h2', 'Themes'),
				offNote('Themes'),
				rinthify.themeError && admonition('critical', rinthify.themeError.split('\n')[0], rinthify.themeError.includes('\n') && h('pre', rinthify.themeError)),
				editing.value &&
					h(Editor, {
						key: editing.value,
						files: rinthify.files.filter((f) => f.startsWith(`themes/${editing.value}/`) && /\.(css|js|json)$/.test(f)),
						initial: `themes/${editing.value}/theme.css`,
						onInput: (p, css) => p.endsWith('/theme.css') && previewTheme(editing.value, css),
						onClose: () => ((editing.value = null), refresh()),
					}),
				h('div', { class: 'flex items-center gap-2' }, [
					input({ placeholder: 'New theme', 'aria-label': 'New theme name', value: newName.value, onInput: (e) => (newName.value = e.target.value), onKeydown: (e) => e.key === 'Enter' && create() }, 'rf-w'),
					btn('Create', create, { primary: true, icon: ICONS.plus, disabled: !newName.value.trim() }),
				]),
				h(GitHubInstall),
				error.value && h('p', { class: 'rf-err' }, error.value),
				h('div', { class: 'theme-options', role: 'group', 'aria-label': 'Themes' }, [
					tile(null, 'Default', { back: '#16181c', panel: '#16181c', raised: '#1d1f23', text: '#ffffff', brand: '#1bd96a' }),
					...rinthify.themes.map((name) =>
						tile(name, rinthify.themeInfo[name]?.name ?? name, looks[name]?.colors ?? cssPreviewColors(''), [
							iconBtn(ICONS.pencil, 'Edit', () => open(name)),
							confirm.armed.value === name
								? btn('Delete?', () => del(name), { red: true })
								: iconBtn(ICONS.trash, 'Delete', () => del(name)),
						]),
					),
				]),
				active?.options?.length > 0 && section(active.name ?? rinthify.config.theme, optionsPanel(`themes/${rinthify.config.theme}`, active.options)),
			])
		}
	},
}

const pluginTemplate = (id, name) => `// ${name}: a Rinthify plugin. Saving this file reloads it live.
// api: vue, icons, router, invoke, addRoute, addNavItem, addStyle, on, onCleanup, storage, files
export default {
\tstart(api) {
\t\tconst { h } = api.vue
\t\tconst page = api.addRoute('/', {
\t\t\trender: () =>
\t\t\t\th('div', { style: 'padding: 1.5rem' }, [
\t\t\t\t\th('h1', '${name}'),
\t\t\t\t\th('p', 'Edit plugins/${id}/index.js to change this page.'),
\t\t\t\t]),
\t\t})
\t\tapi.addNavItem({ label: '${name}', icon: api.icons.plug, to: page })
\t},
\tstop() {},
}
`

const icon = (markup) => h('span', { innerHTML: markup, style: 'display:contents' })
const iconBtn = (markup, title, onClick, opts = {}) =>
	h('button', { type: 'button', 'data-button': '', title, 'aria-label': title, disabled: opts.disabled, onClick, class: [FRAME, MD, 'w-9 !px-0 !rounded-full button-frame--quiet bg-transparent [&:not(:disabled):not([aria-disabled=true]):hover]:bg-surface-4 [&:not(:disabled):not([aria-disabled=true]):focus-visible]:bg-surface-4', opts.on && '!text-brand'] }, [icon(markup)])
const toggle = (on, onChange, disabled, label) =>
	h('button', { type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': label, disabled, onClick: () => onChange(!on), class: ['group inline-flex shrink-0 touch-manipulation items-center rounded-full m-0 p-1 transition-[background-color,border-color,opacity] duration-200 cursor-pointer border border-solid border-surface-5 h-6 !w-[48px]', on ? 'bg-brand' : 'bg-button-bg', disabled && 'opacity-50 cursor-not-allowed'] }, [
		h('span', { class: ['rounded-full transition-[transform,background-color,width,height,margin] duration-200', on ? 'h-4 w-4 translate-x-[24px] bg-black/90' : 'h-4 w-4 bg-gray', !disabled && 'group-hover:w-[18px] group-hover:h-[18px] group-hover:m-[-1px] group-active:w-[14px] group-active:h-[14px] group-active:m-[1px]'] }),
	])
// avatar
const CUBE = '<svg class="avatar shrink-0" viewBox="0 0 104 104" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="1.5" clip-rule="evenodd" aria-hidden="true"><path fill="none" d="M0 0h103.4v103.4H0z"/><path fill="none" stroke="#9a9a9a" stroke-width="5" d="M51.7 92.5V51.7L16.4 31.3l35.3 20.4L87 31.3 51.7 11 16.4 31.3v40.8l35.3 20.4L87 72V31.3L51.7 11"/></svg>'
const avatar = (src, off) => (src ? h('img', { src, alt: '', class: ['avatar shrink-0', off && 'grayscale'] }) : h('span', { class: ['flex', off && 'grayscale'], innerHTML: CUBE }))

// github or zip install box
const GitHubInstall = {
	setup() {
		const link = ref('')
		const busy = ref(false)
		const error = ref('')
		async function run(job) {
			busy.value = true
			error.value = ''
			try {
				await job()
			} catch (e) {
				error.value = String(e?.message ?? e)
			}
			busy.value = false
		}
		const install = () => run(async () => (await installFromLink(link.value), (link.value = '')))
		function pickZip(e) {
			const file = e.target.files?.[0]
			e.target.value = ''
			if (file) run(async () => installFromZip(new Uint8Array(await file.arrayBuffer()), file.name.replace(/\.zip$/i, '')))
		}
		return () =>
			h('div', { class: 'flex flex-col gap-2' }, [
				h('div', { class: 'flex items-center gap-2' }, [
					input({ placeholder: 'GitHub or zip link', 'aria-label': 'GitHub or zip link', value: link.value, onInput: (e) => (link.value = e.target.value), onKeydown: (e) => e.key === 'Enter' && install() }, 'rf-w'),
					btn(busy.value ? 'Installing' : 'Install', install, { disabled: busy.value || !link.value.trim() }),
					h('label', { 'data-button': '', class: [btnClass(), busy.value && 'pointer-events-none opacity-50'] }, ['Zip file', h('input', { type: 'file', accept: '.zip', hidden: true, onChange: pickZip })]),
				]),
				error.value && h('p', { class: 'rf-err' }, error.value),
			])
	},
}

const PluginsSettings = {
	setup() {
		const editing = ref(null)
		const creating = ref(false)
		const newName = ref('')
		const query = ref('')
		const filter = ref('all')
		const error = ref('')
		const open = reactive({}) // settings open
		const details = reactive({}) // error open
		const confirm = useConfirm()
		// files to edit
		const editingFiles = computed(() =>
			rinthify.files.filter((f) => f.startsWith(`plugins/${editing.value}/`) && !f.startsWith(`plugins/${editing.value}/data/`) && !IMAGE.test(f)),
		)
		const isOn = (p) => rinthify.config.enabled.includes(p.id)
		const shown = computed(() => {
			const q = query.value.trim().toLowerCase()
			return rinthify.plugins.filter(
				(p) =>
					(filter.value === 'all' || (filter.value === 'on') === isOn(p)) &&
					(!q || [p.id, p.manifest.name, p.manifest.description, p.manifest.author].some((s) => s?.toLowerCase().includes(q))),
			)
		})

		async function create() {
			const name = newName.value.trim()
			const id = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
			if (!id) return
			if (rinthify.plugins.some((p) => p.id === id)) return void (error.value = `A plugin with the id "${id}" already exists.`)
			error.value = ''
			const safeName = name.replace(/['\\]/g, '')
			await write(`plugins/${id}/index.js`, pluginTemplate(id, safeName))
			const manifest = { id, name: safeName, version: '0.1.0', author: '', description: '', main: 'index.js' }
			await write(`plugins/${id}/project.json`, JSON.stringify(manifest, null, '\t') + '\n')
			await setEnabled(id, true)
			newName.value = ''
			creating.value = false
			editing.value = id
		}
		async function del(id) {
			if (!confirm.ask(id)) return
			if (editing.value === id) editing.value = null
			await setEnabled(id, false)
			await remove(`plugins/${id}`)
		}
		const newBtn = () => btn('New plugin', () => (creating.value = !creating.value), { icon: ICONS.plus, primary: true })

		// row
		function row(p) {
			const m = p.manifest
			const on = isOn(p)
			return h('div', { key: p.id, class: 'rf-row-line flex flex-col gap-3 p-2' }, [
				h('div', { class: 'flex items-center gap-3' }, [
					h('div', { class: ['flex min-w-0 flex-1 items-center gap-2 text-contrast font-medium', !on && 'opacity-50'] }, [
						avatar(p.image, !on),
						h('div', { class: 'flex min-w-0 flex-col' }, [
							h('span', { class: 'text-contrast line-clamp-1' }, m.name ?? p.id),
							m.author && h('span', { class: 'text-secondary line-clamp-1' }, `by ${m.author}`),
						]),
					]),
					m.version && h('span', { class: ['line-clamp-1 text-secondary', !on && 'opacity-50'] }, m.version),
					h('div', { class: 'flex justify-end gap-1 items-center' }, [
						((p.running && p.settings) || p.manifest.options?.length > 0) && iconBtn(ICONS.sliders, 'Settings', () => (open[p.id] = !open[p.id]), { on: open[p.id] }),
						iconBtn(ICONS.refresh, 'Reload', () => reloadPlugin(p.id), { disabled: !on || off() }),
						iconBtn(ICONS.pencil, 'Edit', () => (editing.value = p.id)),
						confirm.armed.value === p.id ? btn('Delete?', () => del(p.id), { red: true }) : iconBtn(ICONS.trash, 'Delete', () => del(p.id)),
						toggle(on, (v) => setEnabled(p.id, v), off(), m.name ?? p.id),
					]),
				]),
				p.error &&
					admonition('critical', p.error.split('\n')[0], details[p.id] && h('pre', p.error), p.error.includes('\n') && [
						btn(details[p.id] ? 'Hide details' : 'Show details', () => (details[p.id] = !details[p.id])),
					]),
				open[p.id] && h('div', { class: 'flex flex-col gap-4 px-2 pb-2' }, [optionsPanel(`plugins/${p.id}`, p.manifest.options), p.running && p.settings && h(p.settings)]),
			])
		}

		function editorView() {
			const p = rinthify.plugins.find((x) => x.id === editing.value)
			return h('div', { class: 'rf' }, [
				h('div', { class: 'flex items-center gap-2' }, [iconBtn(ICONS.back, 'Back', () => (editing.value = null)), h('h2', p?.manifest.name ?? editing.value)]),
				p?.error && admonition('critical', p.error.split('\n')[0], p.error.includes('\n') && h('pre', p.error)),
				editingFiles.value.length > 0 &&
					h(Editor, {
						key: editing.value,
						files: editingFiles.value,
						initial: `plugins/${editing.value}/${p?.manifest.main ?? 'index.js'}`,
						onClose: () => (editing.value = null),
					}),
			])
		}

		return () => {
			if (editing.value) return editorView()
			return h('div', { class: 'rf' }, [
				h('div', { class: 'flex items-center justify-between gap-4' }, [h('h2', 'Plugins'), newBtn()]),
				offNote('Plugins'),
				creating.value &&
					h('div', { class: 'flex items-center gap-2' }, [
						input({
							placeholder: 'Plugin name',
							'aria-label': 'Plugin name',
							value: newName.value,
							onVnodeMounted: ({ el }) => el.focus(),
							onInput: (e) => (newName.value = e.target.value),
							onKeydown: (e) => (e.key === 'Enter' ? create() : e.key === 'Escape' && (creating.value = false)),
						}, 'flex-1'),
						btn('Create', create, { disabled: !newName.value.trim(), primary: true }),
						btn('Cancel', () => ((creating.value = false), (error.value = ''))),
					]),
				error.value && h('p', { class: 'rf-err' }, error.value),
				h(GitHubInstall),
				rinthify.plugins.length > 0 &&
					h('div', { class: 'flex flex-wrap items-center gap-2' }, [
						input({ placeholder: 'Search plugins', 'aria-label': 'Search plugins', value: query.value, onInput: (e) => (query.value = e.target.value) }, 'flex-1', ICONS.search),
						seg([['all', 'All'], ['on', 'Enabled'], ['off', 'Disabled']], filter.value, (v) => (filter.value = v), 'Filter'),
					]),
				rinthify.plugins.length === 0 || shown.value.length === 0
					? h('div', { class: 'mx-auto flex max-w-full flex-col items-center p-6 text-center' }, [
							h('div', { class: 'flex flex-col items-center gap-1.5' }, [h('span', { class: 'text-2xl font-semibold text-contrast' }, rinthify.plugins.length ? 'No plugins found' : 'No plugins')]),
							!rinthify.plugins.length && h('div', { class: 'mt-8 flex gap-2' }, [newBtn()]),
						])
					: h('div', { class: 'bg-bg-raised rounded-xl' }, shown.value.map(row)),
			])
		}
	},
}

// rinthify tab

const offNote = (what) =>
	off() && (rinthify.safeMode
		? admonition('warning', 'Safe mode', `${what} are off until the app starts without RINTHIFY_SAFE.`)
		: admonition('warning', 'Rinthify is off', `${what} are off, turn it back on in the Rinthify tab.`))

const RinthifySettings = {
	setup() {
		const busy = ref(null)
		const output = ref('')
		const confirm = useConfirm()
		const run = async (cmd, done) => {
			busy.value = cmd
			output.value = ''
			try {
				// on windows the watcher restarts and never answers, so dont wait forever
				const out = await Promise.race([bridge('run', { data: cmd }), new Promise((r) => setTimeout(r, 30000, ''))])
				output.value = `${out ?? ''}\n${done}`
			} catch (e) {
				output.value = String(e?.message ?? e)
			}
			output.value = output.value.replace(/\x1b\[[0-9;]*m/g, '').trim()
			busy.value = null
		}
		return () =>
			h('div', { class: 'rf' }, [
				h('h2', 'Rinthify'),
				h('p', { class: 'text-secondary' }, `Version ${VERSION}`),
				rinthify.safeMode && admonition('warning', 'Safe mode', 'Started with RINTHIFY_SAFE, so nothing is loaded right now.'),
				field('Enabled', toggle(!rinthify.config.disabled, (v) => setDisabled(!v), rinthify.safeMode, 'Enabled')),
				h('div', { class: 'flex flex-wrap gap-2' }, [
					btn(busy.value === 'update' ? 'Updating...' : 'Update', () => run('update', 'Restart the app to use the new version.'), { primary: true, icon: ICONS.refresh, disabled: !!busy.value }),
					btn(busy.value === 'inject' ? 'Repairing...' : 'Repair', () => run('inject', 'Reinstalled, restart the app.'), { icon: ICONS.shield, disabled: !!busy.value }),
					btn(confirm.armed.value === 'uninstall' ? 'Click again to uninstall' : 'Uninstall', () => confirm.ask('uninstall') && run('uninject', 'Removed, restart the app to finish.'), { red: true, icon: ICONS.trash, disabled: !!busy.value }),
				]),
				output.value && h('pre', output.value),
			])
	},
}

// boot

// themes now, the rest after mount
void migrate().catch((e) => log('migrate failed', e)).then(() => scan(true))
new MutationObserver(() => {
	keepThemeLast()
	if (settingsModal) markCategory()
}).observe(document, { childList: true, subtree: true })

const waitForApp = setInterval(() => {
	appRef = document.querySelector('#app')?.__vue_app__
	routerRef = appRef?.config.globalProperties.$router
	if (!routerRef) return
	clearInterval(waitForApp)
	document.head.appendChild(document.createElement('style')).textContent = CSS
	routerRef.afterEach(() => setTimeout(markActive))
	log('attached to the app')
	void syncPlugins(null)
	void applyThemeScript(null)
	setInterval(() => {
		void scan(false)
		syncSettingsTabs()
		syncNav()
	}, POLL_MS)
	syncSettingsTabs()
}, 100)

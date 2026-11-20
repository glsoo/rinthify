// rinthify loader
import * as icons from '@modrinth/assets'
import * as ui from '@modrinth/ui'
import { invoke } from '@tauri-apps/api/core'
import * as vue from 'vue'
import { type App, type Component, markRaw, reactive } from 'vue'
import type { Router } from 'vue-router'

export interface Manifest {
	id?: string
	name?: string
	version?: string
	author?: string
	description?: string
	main?: string
}

export interface PluginInfo {
	id: string
	manifest: Manifest
	error: string | null
	running: boolean
	settings: Component | null
}

export interface NavItem {
	key: string
	label: string
	icon: Component
	to: string | (() => void)
}

interface Config {
	theme: string | null
	enabled: string[]
	data: Record<string, Record<string, unknown>>
}

interface PluginModule {
	start?: (api: RinthifyApi) => unknown
	stop?: () => unknown
	settings?: Component
}

type Unsub = () => void
interface AppEventsLike {
	on: (type: never, handler: (payload: never) => unknown) => Unsub
}

const POLL_MS = 1000
const CONFIG = 'config.json'

const running = new Map<string, { mod: PluginModule; cleanups: Unsub[] }>()
const eventSubs = new Set<{ type: string; handler: (p: unknown) => unknown; off?: Unsub }>()
let appRef: App | null = null
let routerRef: Router | null = null
let appEvents: AppEventsLike | null = null
let stamps = new Map<string, number>()
let scanning = false
let themeStyle: HTMLStyleElement | null = null
let navCounter = 0

export const rinthify = reactive({
	dir: '',
	safeMode: false,
	files: [] as string[],
	themes: [] as string[],
	plugins: [] as PluginInfo[],
	navItems: [] as NavItem[],
	config: { theme: null, enabled: [], data: {} } as Config,
	boot,
	read,
	write,
	remove,
	setTheme,
	setEnabled,
	reloadPlugin,
	previewTheme,
	setEvents,
	rescan: () => scan(false),
})

function read(path: string) {
	return invoke<string>('rinthify_read', { path })
}

async function write(path: string, content: string) {
	await invoke('rinthify_write', { path, content })
	await scan(false)
}

async function remove(path: string) {
	await invoke('rinthify_delete', { path })
	await scan(false)
}

function saveConfig() {
	return invoke('rinthify_write', { path: CONFIG, content: JSON.stringify(rinthify.config, null, '\t') })
}

// called from main.js, never throws
async function boot(app: App, router: Router) {
	appRef = app
	routerRef = router
	;(window as unknown as { rinthify: typeof rinthify }).rinthify = rinthify
	try {
		const info = await invoke<{ dir: string; safe_mode: boolean }>('rinthify_info')
		rinthify.dir = info.dir
		rinthify.safeMode = info.safe_mode
		// wait 3s max
		await Promise.race([scan(true), new Promise((r) => setTimeout(r, 3000))])
	} catch (e) {
		console.error('[rinthify] boot failed', e)
	}
	setInterval(() => void scan(false), POLL_MS)
}

// apply what changed
async function scan(first: boolean) {
	if (scanning) return
	scanning = true
	try {
		const entries = await invoke<{ path: string; mtime: number }[]>('rinthify_list')
		const next = new Map(entries.map((e) => [e.path, e.mtime]))
		const changed = new Set<string>()
		for (const [p, m] of next) if (stamps.get(p) !== m) changed.add(p)
		for (const p of stamps.keys()) if (!next.has(p)) changed.add(p)
		stamps = next
		if (!first && changed.size === 0) return

		rinthify.files = [...next.keys()]
		rinthify.themes = rinthify.files
			.filter((p) => /^themes\/[^/]+\/theme\.css$/.test(p))
			.map((p) => p.split('/')[1])

		if (first || changed.has(CONFIG)) await loadConfig()
		const themeFile = `themes/${rinthify.config.theme}/theme.css`
		if (first || changed.has(CONFIG) || changed.has(themeFile)) await applyTheme()
		await syncPlugins(first ? null : changed)
	} catch (e) {
		console.error('[rinthify] scan failed', e)
	} finally {
		scanning = false
	}
}

async function loadConfig() {
	try {
		const parsed = JSON.parse(await read(CONFIG)) as Partial<Config>
		rinthify.config = {
			theme: parsed.theme ?? null,
			enabled: Array.isArray(parsed.enabled) ? parsed.enabled : [],
			data: parsed.data ?? {},
		}
	} catch {
		// keep old config
	}
}

// themes

function setCss(css: string) {
	if (!themeStyle) {
		themeStyle = document.createElement('style')
		themeStyle.id = 'rinthify-theme'
	}
	themeStyle.textContent = css
	// keep it last in head
	document.head.appendChild(themeStyle)
}

async function applyTheme() {
	const name = rinthify.config.theme
	if (!name || rinthify.safeMode || !rinthify.themes.includes(name)) return setCss('')
	setCss(await read(`themes/${name}/theme.css`).catch(() => ''))
}

// live preview while editing
function previewTheme(name: string, css: string) {
	if (name === rinthify.config.theme && !rinthify.safeMode) setCss(css)
}

async function setTheme(name: string | null) {
	rinthify.config.theme = name
	await saveConfig()
	await applyTheme()
}

// plugins

async function syncPlugins(changed: Set<string> | null) {
	const ids = rinthify.files
		.filter((p) => /^plugins\/[^/]+\/project\.json$/.test(p))
		.map((p) => p.split('/')[1])

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
			!changed ||
			[...changed].some((c) => c.startsWith(`plugins/${id}/`) && !c.startsWith(`plugins/${id}/data/`))
		if (!p) {
			p = reactive({ id, manifest: {}, error: null, running: false, settings: null }) as PluginInfo
			rinthify.plugins.push(p)
		}
		if (touched) {
			await stopPlugin(p)
			try {
				p.manifest = JSON.parse(await read(`plugins/${id}/project.json`)) as Manifest
				p.error = null
			} catch (e) {
				p.manifest = {}
				p.error = `project.json: ${e}`
				continue
			}
		}
		const wanted = !rinthify.safeMode && rinthify.config.enabled.includes(id)
		if (wanted && !p.running && !p.error) await startPlugin(p)
		if (!wanted && p.running) await stopPlugin(p)
	}
	rinthify.plugins.sort((a, b) => a.id.localeCompare(b.id))
}

async function startPlugin(p: PluginInfo) {
	const cleanups: Unsub[] = []
	const entry = { mod: {} as PluginModule, cleanups }
	running.set(p.id, entry)
	p.running = true
	try {
		const src = await read(`plugins/${p.id}/${p.manifest.main ?? 'index.js'}`)
		const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
		try {
			entry.mod = ((await import(/* @vite-ignore */ url)) as { default?: PluginModule }).default ?? {}
		} finally {
			URL.revokeObjectURL(url)
		}
		await entry.mod.start?.(makeApi(p.id, cleanups))
		p.settings = entry.mod.settings ? markRaw(entry.mod.settings) : null
		p.error = null
	} catch (e) {
		console.error(`[rinthify] plugin ${p.id} failed to start`, e)
		await stopPlugin(p)
		p.error = String(e instanceof Error ? (e.stack ?? e.message) : e)
	}
}

async function stopPlugin(p: PluginInfo) {
	const entry = running.get(p.id)
	p.running = false
	p.settings = null
	if (!entry) return
	running.delete(p.id)
	try {
		await entry.mod.stop?.()
	} catch (e) {
		console.error(`[rinthify] plugin ${p.id} failed to stop`, e)
	}
	for (const fn of entry.cleanups.reverse()) {
		try {
			fn()
		} catch (e) {
			console.error(e)
		}
	}
}

async function setEnabled(id: string, on: boolean) {
	const list = rinthify.config.enabled.filter((x) => x !== id)
	if (on) list.push(id)
	rinthify.config.enabled = list
	await saveConfig()
	await syncPlugins(new Set())
}

async function reloadPlugin(id: string) {
	await syncPlugins(new Set([`plugins/${id}/project.json`]))
}

// app events

// hook up early listeners
function setEvents(events: AppEventsLike) {
	appEvents = events
	for (const s of eventSubs) s.off ??= appEvents.on(s.type as never, s.handler as never)
}

function subscribe(type: string, handler: (p: unknown) => unknown): Unsub {
	const sub: { type: string; handler: (p: unknown) => unknown; off?: Unsub } = { type, handler }
	if (appEvents) sub.off = appEvents.on(type as never, handler as never)
	eventSubs.add(sub)
	return () => {
		sub.off?.()
		eventSubs.delete(sub)
	}
}

// plugin api

export type RinthifyApi = ReturnType<typeof makeApi>

function makeApi(id: string, cleanups: Unsub[]) {
	const track = (fn: Unsub) => (cleanups.push(fn), fn)
	const data = () => (rinthify.config.data[id] ??= {})
	return {
		id,
		vue,
		ui,
		icons,
		get app() {
			return appRef
		},
		get router() {
			return routerRef
		},
		invoke,
		// add a page
		addRoute(path: string, component: Component) {
			const full = `/rinthify/${id}${path.startsWith('/') ? path : `/${path}`}`
			const name = `rinthify:${id}:${full}`
			routerRef?.addRoute({ path: full, name, component: markRaw(component) })
			track(() => routerRef?.removeRoute(name))
			return full
		},
		// add a sidebar button
		addNavItem(item: { label: string; icon: Component; to: string | (() => void) }) {
			const nav: NavItem = markRaw({ ...item, key: `${id}:${navCounter++}` })
			rinthify.navItems.push(nav)
			track(() => {
				const i = rinthify.navItems.findIndex((n) => n.key === nav.key)
				if (i >= 0) rinthify.navItems.splice(i, 1)
			})
		},
		addStyle(css: string) {
			const el = document.head.appendChild(document.createElement('style'))
			el.textContent = css
			track(() => el.remove())
			return el
		},
		// app events
		on(type: string, handler: (payload: any) => unknown) {
			return track(subscribe(type, handler))
		},
		// run on stop
		onCleanup(fn: Unsub) {
			track(fn)
		},
		storage: {
			get<T>(key: string, fallback: T): T {
				return (key in data() ? data()[key] : fallback) as T
			},
			async set(key: string, value: unknown) {
				data()[key] = value
				await saveConfig()
			},
		},
		// data/ files
		files: {
			read: (path: string) => read(`plugins/${id}/data/${path}`),
			write: (path: string, content: string) =>
				invoke('rinthify_write', { path: `plugins/${id}/data/${path}`, content }),
		},
	}
}

// curseforge browsing and installs, next to modrinth's discover
const TYPES = [['modpack', 'Modpacks'], ['mod', 'Mods'], ['resourcepack', 'Resource Packs'], ['datapack', 'Data Packs'], ['shader', 'Shaders']]
// discover type to curseforge class
const CLASS = { mod: 6, modpack: 4471, resourcepack: 12, shader: 6552, datapack: 6945 }
const PACK = 4471
// curseforge class to instance content type, and to its folder in a modpack
const KIND = { 6: 'mod', 12: 'resourcepack', 6552: 'shaderpack', 6945: 'datapack' }
const DIR = { 12: 'resourcepacks', 6552: 'shaderpacks' }
const LOADER = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }
const PACK_LOADER = { forge: 'forge', neoforge: 'neoforge', fabric: 'fabric-loader', quilt: 'quilt-loader' }
const SORTS = [[2, 'Relevance'], [6, 'Downloads'], [11, 'Recently published'], [3, 'Recently updated']]

// modrinth's scoped component styles, so the copied markup looks the same
const CSS = `
.rcf .project-card-container { container-type: inline-size; }
.rcf .project-card-container > div { cursor: pointer; }
.rcf .project-card-container > div:hover { filter: brightness(var(--hover-brightness)); }
.rcf .grid-project-card-list { grid-template: 'icon info stats stats' 'icon info stats stats' 'icon tags tags tags' / auto 1fr auto auto; }
.rcf .grid-project-card-list__icon { grid-area: icon; }
.rcf .grid-project-card-list__info { grid-area: info; }
.rcf .grid-project-card-list__stats { grid-area: stats; }
.rcf .grid-project-card-list__tags { grid-area: tags; }
@container (width < 850px) {
	.rcf .project-card__icon { --_override-size: 64px; }
	.rcf .grid-project-card-list { grid-template: 'icon info stats' 'icon info stats' 'tags tags tags' / auto 1fr auto; }
}
@container (width < 550px) {
	.rcf .grid-project-card-list { grid-template: 'icon info' 'icon info' 'tags tags' 'stats stats' / auto 1fr; }
	.rcf .grid-project-card-list__stats { align-items: flex-start; width: 100%; }
	.rcf .project-card-summary { font-size: 0.875rem; line-height: 1.25rem; }
}
.rcf .avatar { --_size: 2rem; position: relative; outline: 1px solid #ffffff26; outline-offset: -1px; background-color: var(--color-button-bg); object-fit: contain; box-shadow: var(--shadow-card); border-radius: calc(0.166667 * var(--_override-size, var(--_size))); height: var(--_override-size, var(--_size)); width: var(--_override-size, var(--_size)); min-height: var(--_override-size, var(--_size)); min-width: var(--_override-size, var(--_size)); }
.rcf .button-frame--base { box-shadow: inset 0 0 0 1px var(--surface-5), 0 1px 1px rgba(0, 0, 0, 0.12); }
.rcf .button-frame--colored { --button-color: var(--color-brand); box-shadow: 0 0 0 1px color-mix(in srgb, var(--button-color) 30%, transparent), 0 2px 4px rgba(0, 0, 0, 0.04), 0 5px 8px rgba(0, 0, 0, 0.04), 0 10px 18px rgba(0, 0, 0, 0.03); }
.rcf .button-frame--colored::before { position: absolute; inset: 0; padding: 1px; pointer-events: none; content: ''; border-radius: inherit; background: linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
.rcf .button-frame--quiet { color: var(--button-color, var(--color-base)); }
.rcf .markdown-body img { max-width: 100%; height: auto; }
`
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
// lucide icons, the set modrinth uses
const I = {
	search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
	left: svg('<path d="m15 18-6-6 6-6"/>'),
	right: svg('<path d="m9 18 6-6-6-6"/>'),
	download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>'),
	history: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'),
	check: svg('<path d="M20 6 9 17l-5-5"/>'),
	dots: svg('<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>'),
	filter: svg('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'),
	x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>').replace(/"20"/g, '"16"'),
	out: svg('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
}
// ButtonFrame, InputFrame and TagItem classes from modrinth's ui package
const BTN = 'relative inline-flex min-w-0 shrink-0 items-center justify-center whitespace-nowrap border-0 no-underline touch-manipulation cursor-pointer select-none transition-[background-color,color,box-shadow,filter,opacity,transform] duration-150 ease-out enabled:active:scale-[0.97] [&:not(:disabled):not([aria-disabled=true]):hover]:brightness-[--hover-brightness] focus-visible:outline-none [&:not(:disabled):not([aria-disabled=true]):focus-visible]:ring-4 [&:not(:disabled):not([aria-disabled=true]):focus-visible]:ring-brand-shadow disabled:cursor-not-allowed disabled:opacity-50 font-semibold leading-5'
const SIZE = { md: 'h-9 gap-1.5 rounded-xl px-2.5 text-base', lg: 'h-10 gap-2 rounded-[14px] px-4 text-base' }
const KINDS = {
	base: 'button-frame--base bg-surface-4 text-contrast',
	brand: 'button-frame--colored bg-[--button-color] text-[var(--color-accent-contrast)]',
	quiet: 'button-frame--quiet bg-transparent [&:not(:disabled):not([aria-disabled=true]):hover]:bg-surface-4',
}
const INPUT = 'group/input min-w-0 touch-manipulation border border-solid font-medium text-primary shadow-none transition-[background-color,border-color,box-shadow,color] focus-within:text-contrast focus-within:ring-4 focus-within:ring-brand-shadow inline-flex h-12 items-center gap-2 rounded-[14px] px-4 border-surface-5 bg-surface-4 w-full'
const INPUT_EL = 'min-w-0 appearance-none !min-h-0 !border-0 !bg-transparent !p-0 font-medium text-primary !shadow-none !outline-none placeholder:text-secondary focus:text-contrast focus:ring-0 w-full flex-1 text-base'
const TAG = 'bg-[--_bg-color,var(--color-button-bg)] text-nowrap border-[--_bg-color,var(--surface-5)] border-[1px] border-solid px-2 py-1 leading-none rounded-full font-normal text-sm inline-flex items-center gap-1 text-[--_color,var(--color-secondary)]'
const CARD = 'w-full h-full border-[1px] border-solid border-surface-4 overflow-hidden bg-surface-3 rounded-2xl transition-all p-4 grid grid-project-card-list gap-x-3 gap-y-2'
const PAGE = 20
// curseforge releaseType 1 2 3, shown like modrinth's channel badges
const CHANNEL = [, ['release', 'Release', 'R', 'bg-bg-green text-brand-green'], ['beta', 'Beta', 'B', 'bg-bg-orange text-brand-orange'], ['alpha', 'Alpha', 'A', 'bg-bg-red text-brand-red']]
const PLATFORMS = ['Forge', 'NeoForge', 'Fabric', 'Quilt']
// VersionFilterControl's trigger classes
const FILTER = '!h-[34px] !rounded-xl !border !border-solid !px-3 !text-sm !font-medium !shadow-[0_1px_1.5px_rgba(0,0,0,0.15)] transition-all duration-100 active:scale-[0.97] focus-visible:!outline-none focus-visible:!ring-4 focus-visible:!ring-brand-shadow'
const FILTER_OFF = '!border-surface-5 !bg-transparent !text-primary hover:!bg-surface-3'
const FILTER_ON = '!border-brand !bg-brand-highlight !text-brand hover:!bg-brand-highlight'
// Table's header and cell classes
const TD = 'text-secondary h-14 overflow-hidden first:pl-4 last:pr-4 border-solid border-0 border-t border-surface-4 !overflow-visible py-3 align-middle pr-2.5'
const mcVersions = (f) => f.gameVersions.filter((v) => /^\d+\.\d+/.test(v))
const platforms = (f) => f.gameVersions.filter((v) => PLATFORMS.includes(v))
const newest = (a, b) => b.localeCompare(a, 'en', { numeric: true })

// zip helpers, enough for a modpack manifest
const enc = new TextEncoder()
const dec = new TextDecoder()
const CRC = Array.from({ length: 256 }, (_, n) => {
	for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
	return n >>> 0
})
const crc32 = (b) => ~b.reduce((c, x) => CRC[(c ^ x) & 255] ^ (c >>> 8), -1) >>> 0
// no zip64, fine for modpack zips under 4gb
const eocd = (z, v) => {
	let e = z.length - 22
	while (e > 0 && v.getUint32(e, true) !== 0x06054b50) e--
	return e
}
async function readEntry(z, name) {
	const v = new DataView(z.buffer, z.byteOffset, z.byteLength)
	const e = eocd(z, v)
	for (let p = v.getUint32(e + 16, true), i = v.getUint16(e + 10, true); i--; ) {
		const n = v.getUint16(p + 28, true)
		if (dec.decode(z.subarray(p + 46, p + 46 + n)) === name) {
			const off = v.getUint32(p + 42, true)
			const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true)
			const raw = z.subarray(start, start + v.getUint32(p + 20, true))
			if (!v.getUint16(p + 10, true)) return dec.decode(raw)
			return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
		}
		p += 46 + n + v.getUint16(p + 30, true) + v.getUint16(p + 32, true)
	}
}
// adds a stored file to the end of a zip
function addEntry(z, name, text) {
	const v = new DataView(z.buffer, z.byteOffset, z.byteLength)
	const e = eocd(z, v)
	const count = v.getUint16(e + 10, true), cdSize = v.getUint32(e + 12, true), cdOff = v.getUint32(e + 16, true)
	const nm = enc.encode(name), data = enc.encode(text), crc = crc32(data)
	const local = new Uint8Array(30 + nm.length + data.length), l = new DataView(local.buffer)
	l.setUint32(0, 0x04034b50, true), l.setUint16(4, 20, true), l.setUint32(14, crc, true)
	l.setUint32(18, data.length, true), l.setUint32(22, data.length, true), l.setUint16(26, nm.length, true)
	local.set(nm, 30), local.set(data, 30 + nm.length)
	const cen = new Uint8Array(46 + nm.length), c = new DataView(cen.buffer)
	c.setUint32(0, 0x02014b50, true), c.setUint16(4, 20, true), c.setUint16(6, 20, true), c.setUint32(16, crc, true)
	c.setUint32(20, data.length, true), c.setUint32(24, data.length, true), c.setUint16(28, nm.length, true), c.setUint32(42, cdOff, true)
	cen.set(nm, 46)
	const end = z.slice(e, e + 22), d = new DataView(end.buffer)
	d.setUint16(8, count + 1, true), d.setUint16(10, count + 1, true), d.setUint16(20, 0, true)
	d.setUint32(12, cdSize + cen.length, true), d.setUint32(16, cdOff + local.length, true)
	const parts = [z.subarray(0, cdOff), local, z.subarray(cdOff, cdOff + cdSize), cen, end]
	const out = new Uint8Array(parts.reduce((s, x) => s + x.length, 0))
	parts.reduce((o, x) => (out.set(x, o), o + x.length), 0)
	return out
}

// strips scripts and handlers from curseforge's description html
function clean(html) {
	const doc = new DOMParser().parseFromString(html, 'text/html')
	doc.querySelectorAll('script, style, iframe, object, embed, form').forEach((x) => x.remove())
	for (const el of doc.body.querySelectorAll('*'))
		for (const a of [...el.attributes]) if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name)
	doc.querySelectorAll('a').forEach((a) => (a.target = '_blank'))
	return doc.body.innerHTML
}
// edge cdn when the author hides the download url
const url = (f) => f.downloadUrl ?? `https://edge.forgecdn.net/files/${Math.floor(f.id / 1000)}/${f.id % 1000}/${encodeURIComponent(f.fileName)}`
// name match for installed deps, use fingerprints if it misses
const stem = (name) => name.toLowerCase().replace(/\.(disabled)$/, '').replace(/[-_+ ]?v?\d.*$/, '')
const num = new Intl.NumberFormat('en', { notation: 'compact' })

export default {
	start(api) {
		const { h, ref, reactive, computed, watch, createApp, onUnmounted } = api.vue
		api.addStyle(CSS)

		async function cf(path, body) {
			if (!api.options.key) throw new Error('Add a CurseForge API key in the plugin settings.')
			const text = await api.fetch(`https://api.curseforge.com/v1${path}`, { headers: { 'x-api-key': api.options.key, accept: 'application/json' }, body }).catch((e) => {
				throw new Error(/HTTP 40[13]/.test(e?.message ?? e) ? 'CurseForge rejected the API key.' : String(e?.message ?? e))
			})
			const res = JSON.parse(text)
			if (res.data === undefined) throw new Error(res.errorMessage ?? 'CurseForge request failed.')
			return res
		}
		const filterFor = (i, classId, p) => {
			if (i && classId !== PACK) p.set('gameVersion', i.game_version)
			if (i && classId === 6 && LOADER[i.loader]) p.set('modLoaderType', LOADER[i.loader])
			return p
		}

		// downloads a file into the instance, required mods first
		async function add(i, f, classId, seen, have) {
			for (const d of f.dependencies ?? []) {
				if (d.relationType !== 3 || seen.has(d.modId)) continue
				seen.add(d.modId)
				const df = (await cf(`/mods/${d.modId}/files?${filterFor(i, 6, new URLSearchParams({ pageSize: 1 }))}`)).data[0]
				if (df && !have.has(stem(df.fileName))) await add(i, df, 6, seen, have)
			}
			const tmp = `dl/${f.fileName}`
			await api.fetch(url(f), { save: tmp })
			await api.invoke('plugin:instance|instance_add_project_from_path', { instanceId: i.id, projectPath: api.files.path(tmp), projectType: KIND[classId] ?? 'mod' })
			await api.files.remove(tmp)
		}
		// a curseforge pack zip plus a modrinth index is an mrpack
		async function installPack(project, f) {
			await api.fetch(url(f), { save: 'pack.zip' })
			const zip = await api.files.bytes('pack.zip')
			const m = JSON.parse(await readEntry(zip, 'manifest.json'))
			const [files, mods] = await Promise.all([
				cf('/mods/files', { fileIds: m.files.map((x) => x.fileID) }),
				cf('/mods', { modIds: m.files.map((x) => x.projectID) }),
			])
			const cls = new Map(mods.data.map((x) => [x.id, x.classId]))
			const ml = m.minecraft.modLoaders.find((x) => x.primary) ?? m.minecraft.modLoaders[0]
			const [loader, ...ver] = ml.id.split('-')
			const index = {
				formatVersion: 1,
				game: 'minecraft',
				versionId: f.displayName,
				name: m.name ?? project.name,
				files: files.data.map((x) => ({
					path: `${DIR[cls.get(x.modId)] ?? 'mods'}/${x.fileName}`,
					hashes: { sha1: x.hashes.find((y) => y.algo === 1)?.value },
					downloads: [url(x)],
					fileSize: x.fileLength,
				})),
				dependencies: { minecraft: m.minecraft.version, [PACK_LOADER[loader]]: ver.join('-') },
			}
			await api.files.write('pack.mrpack', addEntry(zip, 'modrinth.index.json', JSON.stringify(index)))
			await api.files.remove('pack.zip')
			let iconPath = null
			if (project.logo?.url) await api.fetch(project.logo.url, { save: 'icon.png' }).then(() => (iconPath = api.files.path('icon.png')), () => {})
			await api.invoke('plugin:install|install_create_modpack_instance', {
				location: { type: 'fromFile', path: api.files.path('pack.mrpack') },
				postInstallEdit: { name: project.name, iconPath },
			})
		}

		// small builders for modrinth's components
		const icon = (s, cls = '') => h('span', { class: `inline-flex shrink-0 ${cls}`, innerHTML: s, 'aria-hidden': 'true' })
		const btn = (kind, props, kids, size = 'md') => h('button', { type: 'button', ...props, class: [BTN, SIZE[size], KINDS[kind], props.class] }, kids)
		const tabs = (items, active, go) =>
			h('nav', { class: 'relative flex w-fit rounded-full bg-bg-raised p-1 text-xs sm:text-sm font-bold' },
				items.map(([k, label]) =>
					h('button', { key: k, type: 'button', class: ['button-animation z-[1] flex flex-row items-center gap-2 px-4 py-2', k === active && 'rounded-full bg-button-bgSelected'], onClick: () => k !== active && go(k) }, [
						h('span', { class: k === active ? 'text-button-textSelected' : 'text-contrast' }, label),
					]),
				),
			)
		const SITES = [['modrinth', 'Modrinth'], ['curseforge', 'CurseForge']]
		const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
		function ago(d) {
			let s = (new Date(d) - Date.now()) / 1000
			for (const [u, n] of [['second', 60], ['minute', 60], ['hour', 24], ['day', 30], ['month', 12], ['year', Infinity]]) {
				if (Math.abs(s) < n) return rtf.format(Math.round(s), u)
				s /= n
			}
		}
		// 1 ... 4 5 6 ... 20, like modrinth's pagination
		function pageList(cur, total) {
			const n = total <= 7 ? Array.from({ length: total }, (_, i) => i + 1) : [...new Set([1, cur - 1, cur, cur + 1, total])].filter((x) => x >= 1 && x <= total)
			return n.flatMap((x, i) => (i && x - n[i - 1] > 1 ? ['-', x] : [x]))
		}

		const Page = {
			setup() {
				const route = ref(api.router.currentRoute.value)
				const off = api.router.afterEach((to) => (route.value = to))
				const type = ref(CLASS[route.value.query.t] ? route.value.query.t : 'mod')
				const inst = ref(route.value.query.i ?? '')
				const instances = ref([])
				const query = ref('')
				const sort = ref(2)
				const page = ref(1)
				const total = ref(0)
				const hits = ref([])
				const loaded = ref(false)
				const err = ref('')
				const open = ref(null)
				const tab = ref('desc')
				const files = ref([])
				const fits = ref(new Set())
				const vf = reactive({ channel: [], version: [], platform: [] })
				const vpage = ref(1)
				const desc = ref('')
				const state = reactive({})
				const box = ref(null)
				const root = ref(null)
				const known = new Map()
				const instance = computed(() => instances.value.find((x) => x.id === inst.value))
				let seq = 0, timer

				async function search() {
					const n = ++seq
					const p = new URLSearchParams({ gameId: 432, classId: CLASS[type.value], searchFilter: query.value, sortField: sort.value, sortOrder: 'desc', index: (page.value - 1) * PAGE, pageSize: PAGE })
					try {
						const r = await cf(`/mods/search?${filterFor(instance.value, CLASS[type.value], p)}`)
						if (n !== seq) return
						hits.value = r.data
						r.data.forEach((x) => known.set(String(x.id), x))
						// curseforge stops at index 10000
						total.value = Math.ceil(Math.min(r.pagination.totalCount, 10000) / PAGE)
						err.value = ''
					} catch (e) {
						if (n !== seq) return
						err.value = String(e.message ?? e)
						hits.value = []
						total.value = 0
					}
					loaded.value = true
				}
				const refresh = () => ((page.value = 1), search())
				async function show(id) {
					open.value = known.get(id) ?? null
					tab.value = 'desc'
					Object.values(vf).forEach((l) => l.splice(0))
					vpage.value = 1
					files.value = []
					desc.value = ''
					try {
						if (!open.value) known.set(id, (open.value = (await cf(`/mods/${id}`)).data))
						const fp = filterFor(instance.value, open.value.classId, new URLSearchParams({ pageSize: 50 }))
						// the latest 50 plus the latest 50 that fit the instance, so the filters have something to work with
						const [a, b, d] = await Promise.all([cf(`/mods/${id}/files?pageSize=50`), cf(`/mods/${id}/files?${fp}`), cf(`/mods/${id}/description`)])
						fits.value = new Set(b.data.map((f) => f.id))
						files.value = [...new Map([...a.data, ...b.data].map((f) => [f.id, f])).values()].sort((x, y) => new Date(y.fileDate) - new Date(x.fileDate))
						desc.value = clean(d.data)
					} catch (e) {
						err.value = String(e.message ?? e)
					}
				}
				async function install(p, f) {
					state[f.id] = 'Installing'
					try {
						if (p.classId === PACK) await installPack(p, f)
						else {
							const have = new Set(Object.keys(await api.invoke('plugin:instance|instance_get_projects', { instanceId: inst.value })).map((k) => stem(k.split('/').pop())))
							await add(instance.value, f, p.classId, new Set([p.id]), have)
						}
						state[f.id] = 'Installed'
					} catch (e) {
						delete state[f.id]
						err.value = String(e.message ?? e)
					}
				}
				// the project lives in the url, so the app's back button works
				const go = (p) => api.router.push({ path: route.value.path, query: { ...route.value.query, p: p.id } })
				watch(() => route.value.query.p, (id) => (id ? show(String(id)) : ((open.value = null), (err.value = ''))))
				const setType = (t) => ((type.value = t), refresh())
				const setPage = (n) => ((page.value = n), search(), root.value?.scrollIntoView({ block: 'start' }))
				const setInst = (v) => ((inst.value = v), open.value ? show(String(open.value.id)) : refresh())
				const leave = () => api.router.push({ path: `/browse/${type.value}`, query: inst.value ? { i: inst.value } : {} })
				const outside = (e) => !e.target.closest?.('[data-rcf-box]') && (box.value = null)
				document.addEventListener('pointerdown', outside)
				onUnmounted(() => (off?.(), document.removeEventListener('pointerdown', outside)))

				api.invoke('plugin:instance|instance_list').then((l) => (instances.value = l), () => {}).finally(() => (route.value.query.p ? show(String(route.value.query.p)) : search()))

				function combobox(id, prefix, options, value, set, cls = '') {
					const on = box.value === id
					const label = options.find((o) => o[0] === value)?.[1] ?? options[0][1]
					return h('div', { class: `relative inline-block ${cls}`, 'data-rcf-box': '' }, [
						btn('base', { class: 'min-w-full w-full !justify-between overflow-hidden text-left', 'aria-haspopup': 'listbox', 'aria-expanded': on, onClick: () => (box.value = on ? null : id) }, [
							h('div', { class: 'flex min-w-0 items-center gap-2' }, [
								h('span', { class: 'font-semibold text-primary' }, prefix),
								h('span', { class: 'min-w-0 truncate font-semibold leading-tight text-inherit' }, label),
							]),
							icon(I.left, `transition-transform duration-150 ${on ? 'rotate-90' : '-rotate-90'}`),
						]),
						on && h('div', { role: 'listbox', class: 'absolute left-0 mt-2 min-w-full z-[100005] flex flex-col overflow-hidden rounded-[14px] bg-surface-4 border border-solid border-surface-5 shadow-2xl', style: 'top: 100%; max-height: 20rem; overflow-y: auto' },
							options.map(([v, l]) =>
								h('div', { key: v, role: 'option', 'aria-selected': v === value, class: ['group/option flex items-center gap-2.5 cursor-pointer px-4 py-3 text-left whitespace-nowrap transition-all duration-150', v === value ? 'bg-highlight-green text-green' : 'bg-surface-4 text-contrast hover:brightness-[115%]'], onClick: () => ((box.value = null), set(v)) }, l),
							),
						),
					])
				}
				const instancePicker = () =>
					combobox('inst', 'Instance', [['', 'Any'], ...instances.value.map((x) => [x.id, x.name])], inst.value, setInst, 'w-fit max-w-full')
				const pagination = (cur = page.value, count = total.value, set = setPage) =>
					count > 1 && h('div', { class: 'flex items-center gap-1 ml-auto' }, [
						btn('quiet', { class: '!w-9 !px-0 !rounded-full', 'aria-label': 'Previous page', disabled: cur === 1, onClick: () => set(cur - 1) }, icon(I.left)),
						...pageList(cur, count).map((n, i) =>
							n === '-'
								? h('span', { key: 'gap' + i, class: 'flex w-9 justify-center text-secondary' }, icon(I.dots))
								: n === cur
									? btn('brand', { key: n, class: '!min-w-9 !rounded-full !bg-brand-highlight', 'aria-current': 'page' }, String(n))
									: btn('quiet', { key: n, class: '!min-w-9 !rounded-full', onClick: () => set(n) }, String(n)),
						),
						btn('quiet', { class: '!w-9 !px-0 !rounded-full', 'aria-label': 'Next page', disabled: cur === count, onClick: () => set(cur + 1) }, icon(I.right)),
					])
				// modrinth's version filters: any match within a filter, every filter must match
				const toggle = (k, v) => ((vf[k].includes(v) ? vf[k].splice(vf[k].indexOf(v), 1) : vf[k].push(v)), (vpage.value = 1))
				const shown = computed(() => files.value.filter((f) =>
					(!vf.channel.length || vf.channel.includes(CHANNEL[f.releaseType]?.[0])) &&
					(!vf.version.length || mcVersions(f).some((v) => vf.version.includes(v))) &&
					(!vf.platform.length || platforms(f).some((v) => vf.platform.includes(v)))))
				// a MultiSelect with the checkmark on the right, like VersionFilterControl
				function multi(k, label, options, width) {
					const on = box.value === k
					const sel = vf[k]
					if (options.length < 2 && !sel.length) return null
					const name = (v) => options.find((o) => o[0] === v)?.[1] ?? v
					return h('div', { key: k, class: 'relative inline-block w-auto min-w-0 max-w-full', 'data-rcf-box': '' }, [
						btn('base', { class: [FILTER, sel.length ? FILTER_ON : FILTER_OFF, 'max-w-full'], 'aria-haspopup': 'listbox', 'aria-expanded': on, onClick: () => (box.value = on ? null : k) },
							h('div', { class: 'flex min-h-8 min-w-0 max-w-full items-center gap-2 sm:max-w-80' }, [
								h('span', { class: 'min-w-0 flex-1 truncate' }, sel.length
									? [h('span', { class: 'font-medium' }, `${label}:`), h('span', { class: 'ml-1 font-semibold text-contrast' }, sel.length === 1 ? name(sel[0]) : `${sel.length} selected`)]
									: h('span', { class: 'font-semibold text-inherit' }, label)),
								h('div', { class: 'flex shrink-0 items-center gap-1.5' }, [
									sel.length > 0 && h('span', { role: 'button', class: 'flex cursor-pointer items-center justify-center rounded border-none bg-transparent p-0.5 text-secondary transition-colors hover:text-contrast', 'aria-label': `Clear ${label}`, onClick: (e) => (e.stopPropagation(), sel.splice(0), (vpage.value = 1)) }, icon(I.x, 'text-primary')),
									sel.length > 0 && h('div', { class: 'h-5 w-[1px] shrink-0 bg-surface-5' }),
									icon(I.left, `text-secondary transition-transform duration-150 ${on ? 'rotate-90' : '-rotate-90'}`),
								]),
							]),
						),
						on && h('div', { role: 'listbox', 'aria-multiselectable': 'true', class: 'absolute left-0 mt-2 z-[100005] flex flex-col overflow-hidden rounded-[14px] bg-surface-4 border border-solid border-surface-5 shadow-2xl', style: `top: 100%; min-width: ${width}px` }, [
							sel.length > 0 && h('div', { class: 'flex items-center justify-between gap-3 border-0 border-b border-solid border-b-surface-5 bg-surface-4 px-4 py-2.5 text-sm' }, [
								h('span', { class: 'font-semibold text-secondary' }, `${sel.length} selected`),
								h('button', { type: 'button', class: 'cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-secondary shadow-none transition-all hover:text-contrast', onClick: () => (sel.splice(0), (vpage.value = 1)) }, 'Clear'),
							]),
							h('div', { class: 'overflow-y-auto overscroll-contain select-none flex flex-col', style: 'max-height: 500px' }, options.map(([v, l]) =>
								h('div', { key: v, role: 'option', 'aria-selected': sel.includes(v), class: ['flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left text-contrast transition-all duration-150 bg-surface-4 hover:brightness-[115%]', sel.includes(v) && 'brightness-[115%]'], onClick: () => toggle(k, v) }, [
									h('span', { class: ['min-w-0 flex-1 truncate font-semibold leading-tight', sel.includes(v) ? 'text-contrast' : 'text-primary'] }, l),
									h('span', { class: 'flex shrink-0 items-center justify-center text-brand', style: 'width: 20px' }, sel.includes(v) ? icon(I.check) : null),
								]),
							)),
						]),
					])
				}
				const card = (p) =>
					h('div', { key: p.id, role: 'listitem', class: 'project-card-container w-full' },
						h('div', { class: CARD, tabindex: 0, onClick: () => go(p), onKeydown: (e) => e.key === 'Enter' && go(p) }, [
							h('img', { class: 'avatar project-card__icon grid-project-card-list__icon', style: '--_size: 100px', src: p.logo?.thumbnailUrl, alt: '', loading: 'lazy' }),
							h('div', { class: 'flex flex-col gap-2 grid-project-card-list__info' }, [
								h('div', { class: 'flex gap-2 items-center' }, [
									h('h2', { class: 'project-card-title line-clamp-1 pb-[2px] mb-[-2px] break-all font-semibold text-contrast m-0 leading-none text-xl' }, p.name),
									p.authors?.[0] && h('p', { class: 'm-0 line-clamp-1 break-all text-secondary font-normal max-w-fit w-full pb-[2px] mb-[-2px]' }, `by ${p.authors[0].name}`),
								]),
								h('p', { class: 'project-card-summary m-0 font-normal line-clamp-2' }, p.summary),
							]),
							h('div', { class: 'flex flex-col gap-3 items-end shrink-0 ml-auto grid-project-card-list__stats' }, [
								h('div', { class: 'flex items-center gap-2' }, [icon(I.download), h('span', { class: 'font-medium' }, num.format(p.downloadCount))]),
								h('div', { class: 'flex items-center gap-2' }, [icon(I.history), `Updated ${ago(p.dateModified)}`]),
							]),
							h('div', { class: 'mt-auto flex items-center gap-3 grid-project-card-list__tags' }, (p.categories ?? []).slice(0, 3).map((c) => h('span', { key: c.id, class: TAG }, c.name))),
						]),
					)
				const error = () => err.value && h('section', { class: 'offline text-center' }, h('p', err.value))

				// modrinth's ProjectPageVersions table
				function versions(p, ready) {
					const all = files.value
					const count = Math.ceil(shown.value.length / PAGE)
					const tag = (k, v, style) => h('button', { key: v, type: 'button', class: [TAG, 'w-fit max-w-full truncate transition-transform active:scale-[0.95] cursor-pointer hover:underline'], style, onClick: () => toggle(k, v) }, h('span', { class: 'min-w-0 truncate' }, v))
					const cols = [['', '4.5rem'], ['Version'], ['Game version'], ['Platform'], ['Published', '12%'], ['Downloads', '12%'], ['', '1%']]
					return [
						h('div', { class: 'flex flex-wrap justify-between gap-2' }, [
							h('div', { class: 'flex min-w-0 flex-1 flex-wrap items-center gap-1.5' }, [
								icon(I.filter, 'text-secondary'),
								multi('channel', 'Channel', CHANNEL.filter((c) => all.some((f) => CHANNEL[f.releaseType] === c)).map((c) => [c[0], c[1]]), 180),
								multi('version', 'Game version', [...new Set(all.flatMap(mcVersions))].sort(newest).map((v) => [v, v]), 240),
								multi('platform', 'Platform', PLATFORMS.filter((x) => all.some((f) => platforms(f).includes(x))).map((x) => [x, x]), 200),
								Object.values(vf).some((l) => l.length) && btn('quiet', { onClick: () => (Object.values(vf).forEach((l) => l.splice(0)), (vpage.value = 1)) }, 'Clear'),
							]),
							pagination(vpage.value, count, (n) => ((vpage.value = n), root.value?.scrollIntoView({ block: 'start' }))),
						]),
						h('div', { class: 'overflow-hidden rounded-2xl border border-solid border-surface-4' }, h('div', { class: 'overflow-x-auto overflow-y-hidden' },
							h('table', { class: 'w-full border-separate border-spacing-0 border-surface-4 table-auto' }, [
								h('colgroup', cols.map(([, w], i) => h('col', { key: i, style: w && { width: w } }))),
								h('thead', h('tr', { class: 'bg-surface-3' }, cols.map(([l, w], i) => h('th', { key: i, class: ['h-12 pr-2 first:pl-4 last:pr-4', i === 6 ? 'text-right' : 'text-left'], style: w && { width: w } }, l && h('span', { class: 'inline-flex min-w-0 max-w-full items-center gap-1 font-semibold' }, l))))),
								h('tbody', shown.value.length ? shown.value.slice((vpage.value - 1) * PAGE, vpage.value * PAGE).map((f, i) => {
									const c = CHANNEL[f.releaseType] ?? [, , '?', 'bg-bg-red text-brand-red']
									const mc = mcVersions(f).sort(newest)
									return h('tr', { key: f.id, class: ['group', i % 2 ? 'bg-surface-1.5' : 'bg-surface-2'] }, [
										h('td', { class: TD }, h('div', { class: 'flex items-center justify-center' },
											h('div', { class: ['flex font-bold justify-center items-center rounded-full text-sm w-9 h-9 cursor-pointer', c[3]], title: c[1], onClick: () => c[0] && toggle('channel', c[0]) }, c[2]))),
										h('td', { class: TD }, h('div', { class: 'overflow-hidden text-ellipsis font-medium text-contrast', title: f.fileName }, f.displayName)),
										h('td', { class: [TD, 'min-w-0 max-w-[12rem]'] }, h('div', { class: 'flex min-w-0 w-full max-w-[12rem] flex-wrap gap-1' }, [
											...mc.slice(0, 5).map((v) => tag('version', v)),
											mc.length > 5 && h('span', { class: [TAG, 'w-fit'], title: mc.slice(5).join(', ') }, `+${mc.length - 5}`),
										])),
										h('td', { class: [TD, 'min-w-0 max-w-[12rem]'] }, h('div', { class: 'flex min-w-0 w-full max-w-[12rem] flex-wrap gap-1' }, platforms(f).map((x) => tag('platform', x, `--_color: var(--color-platform-${x.toLowerCase()})`)))),
										h('td', { class: TD }, h('div', { class: 'flex items-center gap-1 text-nowrap font-medium w-max cursor-default', title: new Date(f.fileDate).toLocaleString() }, ago(f.fileDate))),
										h('td', { class: TD }, h('div', { class: 'flex items-center gap-1 font-medium w-max text-nowrap cursor-default', title: `${f.downloadCount} downloads` }, num.format(f.downloadCount))),
										h('td', { class: [TD, 'text-right'] }, h('div', { class: 'flex h-full w-max items-center justify-end gap-0.5 whitespace-nowrap cursor-default' }, [
											btn('quiet', { class: 'w-9 !px-0 !rounded-full', style: !state[f.id] && '--button-color: var(--color-green)', 'aria-label': state[f.id] ?? 'Install', title: state[f.id] ?? 'Install', disabled: !ready || !!state[f.id], onClick: () => install(p, f) }, icon(state[f.id] === 'Installed' ? I.check : I.download)),
											p.links?.websiteUrl && h('a', { class: [BTN, SIZE.md, KINDS.quiet, '!w-9 !px-0 !rounded-full'], href: `${p.links.websiteUrl}/files/${f.id}`, target: '_blank', title: 'Open in browser', 'aria-label': 'Open in browser' }, icon(I.out)),
										])),
									])
								}) : h('tr', { class: 'bg-surface-2' }, h('td', { colspan: 7, class: 'border-solid border-0 border-t border-surface-4 p-0' }, h('div', { class: 'text-secondary flex h-64 items-center justify-center' }, 'No versions found.')))),
							]),
						)),
					]
				}

				function projectView(p) {
					const pack = p.classId === PACK
					const latest = files.value.find((f) => fits.value.has(f.id))
					const ready = pack || inst.value
					const installBtn = (f, kind, size) =>
						btn(kind, { disabled: !ready || !!state[f.id], onClick: () => install(p, f) }, [icon(state[f.id] === 'Installed' ? I.check : I.download), state[f.id] ?? 'Install'], size)
					return h('div', { class: 'flex flex-col gap-4' }, [
						h('div', { class: 'flex flex-wrap items-center gap-4' }, [
							h('img', { class: 'avatar', style: '--_size: 96px', src: p.logo?.thumbnailUrl, alt: '' }),
							h('div', { class: 'flex flex-col gap-2 min-w-0 flex-1' }, [
								h('h1', { class: 'm-0 text-2xl font-extrabold text-contrast' }, p.name),
								h('p', { class: 'm-0 line-clamp-2' }, p.summary),
								h('div', { class: 'flex flex-wrap items-center gap-4 text-secondary' }, [
									h('div', { class: 'flex items-center gap-2' }, [icon(I.download), h('span', { class: 'font-medium' }, num.format(p.downloadCount))]),
									h('div', { class: 'flex items-center gap-2' }, [icon(I.history), `Updated ${ago(p.dateModified)}`]),
								]),
							]),
							h('div', { class: 'flex items-center gap-2' }, [!pack && instancePicker(), latest && installBtn(latest, 'brand', 'lg')]),
						]),
						h('div', { class: 'flex flex-wrap items-center gap-2' }, [tabs([['desc', 'Description'], ['versions', 'Versions']], tab.value, (t) => (tab.value = t))]),
						error(),
						tab.value === 'desc'
							? h('div', { class: 'markdown-body', innerHTML: desc.value })
							: versions(p, ready),
					])
				}

				return () =>
					h('div', { ref: root, class: 'rcf flex flex-col gap-3 p-6' }, open.value ? projectView(open.value) : [
						h('div', { class: 'flex flex-wrap items-center gap-2' }, [tabs(TYPES, type.value, setType), h('div', { class: 'ml-auto' }, tabs(SITES, 'curseforge', leave))]),
						h('div', { class: INPUT }, [
							h('span', { class: 'flex size-5 shrink-0 items-center justify-center text-secondary opacity-60 transition-colors group-focus-within/input:text-contrast group-focus-within/input:opacity-100', innerHTML: I.search }),
							h('div', { class: 'flex min-w-0 flex-1 self-stretch items-center' },
								h('input', { class: INPUT_EL, type: 'text', placeholder: `Search ${TYPES.find((t) => t[0] === type.value)[1].toLowerCase()}...`, value: query.value, onInput: (e) => ((query.value = e.target.value), clearTimeout(timer), (timer = setTimeout(refresh, 300))) }),
							),
						]),
						h('div', { class: 'flex flex-wrap items-center gap-2' }, [
							combobox('sort', 'Sort by', SORTS, sort.value, (v) => ((sort.value = v), refresh()), '!w-[16rem] min-w-max max-w-full'),
							type.value !== 'modpack' && instancePicker(),
							pagination(),
						]),
						error(),
						loaded.value && !err.value && !hits.value.length && h('section', { class: 'offline text-center' }, h('p', 'No results found for your query!')),
						h('div', { role: 'list', class: 'flex flex-col gap-3' }, hits.value.map(card)),
						h('div', { class: 'flex' }, pagination()),
					])
			},
		}
		const path = api.addRoute('/', Page)

		// a modrinth / curseforge switch beside discover's tabs
		let sw = null
		const drop = () => (sw?.app.unmount(), sw?.el.remove(), sw?.row.removeAttribute('style'), (sw = null))
		function inject() {
			const r = api.router?.currentRoute.value
			if (!r?.path.startsWith('/browse/')) return sw && drop()
			const nav = [...document.querySelectorAll('nav.bg-bg-raised.rounded-full')].find((n) => !n.closest('.rcf-switch'))
			if (!nav || (sw?.el.isConnected && sw.el.previousElementSibling === nav)) return
			drop()
			const el = document.createElement('div')
			el.className = 'rcf-switch'
			el.style.marginLeft = 'auto'
			// the tabs sit in their own div, so it can become the row
			const row = nav.parentElement
			row.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; width: 100%'
			nav.after(el)
			const go = () => api.router.push({ path, query: { t: CLASS[r.params.projectType] ? r.params.projectType : 'mod', ...(r.query.i && { i: r.query.i }) } })
			const app = createApp({ render: () => tabs(SITES, 'modrinth', go) })
			app.mount(el)
			sw = { el, app, row }
		}
		const mo = new MutationObserver(inject)
		mo.observe(document.body, { childList: true, subtree: true })
		api.onCleanup(() => (mo.disconnect(), drop()))
	},
}

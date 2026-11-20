// ctrl+k search for instances and pages
const PAGES = [
	['Home', '/'],
	['Browse modpacks', '/browse/modpack'],
	['Browse mods', '/browse/mod'],
	['Browse resource packs', '/browse/resourcepack'],
	['Browse shaders', '/browse/shader'],
	['Browse data packs', '/browse/datapack'],
	['Skins', '/skins'],
	['Screenshots', '/screenshots'],
	['Servers', '/hosting/manage/'],
]

const CSS = `
.rcp-back { position: fixed; inset: 0; z-index: 100000; background: rgb(0 0 0 / 0.45); display: flex; justify-content: center; align-items: flex-start; padding-top: 14vh; }
.rcp { width: min(36rem, 92vw); border-radius: 1rem; overflow: hidden; background: var(--surface-2, var(--color-raised-bg)); border: 1px solid var(--surface-5, var(--color-divider)); box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.5); }
.rcp input { width: 100%; box-sizing: border-box; border: none; outline: none; border-bottom: 1px solid var(--surface-4, var(--color-divider)); border-radius: 0; background: none; padding: 1rem 1.2rem; font-size: 1.05rem; color: var(--color-contrast); box-shadow: none; }
.rcp ul { list-style: none; margin: 0; padding: 0.4rem; max-height: 50vh; overflow-y: auto; }
.rcp li { display: flex; align-items: center; gap: 0.75rem; padding: 0.55rem 0.8rem; border-radius: 0.6rem; cursor: pointer; color: var(--color-text-default); }
.rcp li.on { background: var(--surface-4, var(--color-button-bg)); color: var(--color-contrast); }
.rcp li img, .rcp li .rcp-ic { width: 1.8rem; height: 1.8rem; border-radius: 0.4rem; flex: none; object-fit: cover; display: grid; place-items: center; background: var(--surface-3, var(--color-button-bg)); }
.rcp li .rcp-ic svg { width: 1rem; height: 1rem; }
.rcp li .rcp-sub { margin-left: auto; font-size: 0.8rem; color: var(--color-secondary); white-space: nowrap; }
.rcp .rcp-foot { display: flex; gap: 1rem; padding: 0.5rem 1rem; font-size: 0.75rem; color: var(--color-secondary); border-top: 1px solid var(--surface-4, var(--color-divider)); }
.rcp kbd { font-family: inherit; padding: 0 0.3rem; border-radius: 0.25rem; background: var(--surface-4, var(--color-button-bg)); }
.rcp .rcp-none { padding: 1rem; color: var(--color-secondary); text-align: center; }
`

export default {
	start(api) {
		const { createApp, h, ref, computed, nextTick } = api.vue
		const open = ref(false)
		const query = ref('')
		const index = ref(0)
		const instances = ref([])

		// local icons go through the asset protocol
		const iconUrl = (path) => (path ? window.__TAURI_INTERNALS__.convertFileSrc?.(path) : null)

		async function show() {
			query.value = ''
			index.value = 0
			open.value = true
			try {
				instances.value = await api.invoke('plugin:instance|instance_list')
			} catch (e) {
				console.error('[command-palette]', e)
			}
		}
		const hide = () => (open.value = false)

		// label, hint, icon, enter and shift+enter actions
		const items = computed(() => {
			const q = query.value.trim().toLowerCase()
			const recent = [...instances.value].sort((a, b) => new Date(b.last_played ?? 0) - new Date(a.last_played ?? 0))
			const all = [
				...recent.map((i) => ({
					label: i.name,
					sub: `${i.loader} ${i.game_version}`,
					img: iconUrl(i.icon_path),
					run: () => api.invoke('plugin:instance|instance_run', { instanceId: i.id, serverAddress: null }),
					alt: () => api.router.push(`/instance/${encodeURIComponent(i.id)}`),
				})),
				...PAGES.map(([label, to]) => ({ label, sub: 'Page', svg: api.icons.search, run: () => api.router.push(to) })),
				{
					label: 'Settings',
					sub: 'Page',
					svg: api.icons.sliders,
					run: () => document.querySelector('button.nav-button[aria-label="Settings"]')?.click(),
				},
			]
			return (q ? all.filter((x) => x.label.toLowerCase().includes(q) || x.sub.toLowerCase().includes(q)) : all).slice(0, 50)
		})

		function choose(item, alt) {
			if (!item) return
			hide()
			void (alt && item.alt ? item.alt() : item.run())
		}
		function onKey(e) {
			const n = items.value.length
			if (e.key === 'ArrowDown') index.value = (index.value + 1) % Math.max(n, 1)
			else if (e.key === 'ArrowUp') index.value = (index.value - 1 + n) % Math.max(n, 1)
			else if (e.key === 'Enter') choose(items.value[index.value], e.shiftKey)
			else if (e.key === 'Escape') hide()
			else return
			e.preventDefault()
			void nextTick(() => document.querySelector('.rcp li.on')?.scrollIntoView({ block: 'nearest' }))
		}

		const App = {
			render: () =>
				open.value &&
				h('div', { class: 'rcp-back', onMousedown: (e) => e.target === e.currentTarget && hide() }, [
					h('div', { class: 'rcp' }, [
						h('input', {
							placeholder: 'Search instances and pages...',
							value: query.value,
							onVnodeMounted: ({ el }) => el.focus(),
							onInput: (e) => ((query.value = e.target.value), (index.value = 0)),
							onKeydown: onKey,
						}),
						items.value.length
							? h(
									'ul',
									items.value.map((it, i) =>
										h('li', { class: i === index.value && 'on', onMousemove: () => (index.value = i), onClick: (e) => choose(it, e.shiftKey) }, [
											it.img ? h('img', { src: it.img }) : h('span', { class: 'rcp-ic', innerHTML: it.svg ?? api.icons.play }),
											h('span', it.label),
											h('span', { class: 'rcp-sub' }, it.sub),
										]),
									),
								)
							: h('div', { class: 'rcp-none' }, 'Nothing found'),
						h('div', { class: 'rcp-foot' }, [
							h('span', [h('kbd', 'Enter'), ' play / open']),
							h('span', [h('kbd', 'Shift+Enter'), ' open instance']),
							h('span', [h('kbd', 'Esc'), ' close']),
						]),
					]),
				]),
		}

		api.addStyle(CSS)
		const el = document.body.appendChild(document.createElement('div'))
		const app = createApp(App)
		app.mount(el)
		api.onCleanup(() => (app.unmount(), el.remove()))

		const onGlobalKey = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault()
				open.value ? hide() : void show()
			}
		}
		window.addEventListener('keydown', onGlobalKey, true)
		api.onCleanup(() => window.removeEventListener('keydown', onGlobalKey, true))

		this.settings = { render: () => h('p', { class: 'rf-muted' }, 'Press Ctrl+K anywhere in the app.') }
	},
}

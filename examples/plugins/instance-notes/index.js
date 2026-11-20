// a notes file per instance
const CSS = `
.rin { display: grid; grid-template-columns: 16rem 1fr; gap: 1rem; height: calc(100vh - 6rem); padding: 1.5rem; box-sizing: border-box; color: var(--color-text-default); }
.rin-list { display: flex; flex-direction: column; gap: 0.25rem; overflow-y: auto; }
.rin-list input { margin-bottom: 0.5rem; }
.rin-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.6rem; border: none; border-radius: 0.6rem; background: none; color: inherit; cursor: pointer; text-align: left; font: inherit; }
.rin-item:hover { background: var(--color-button-bg); }
.rin-item.on { background: var(--color-button-bg); color: var(--color-contrast); font-weight: 600; }
.rin-item img, .rin-item .rin-ph { width: 2rem; height: 2rem; border-radius: 0.45rem; object-fit: cover; flex: none; background: var(--surface-4, var(--color-divider)); }
.rin-item .rin-dot { margin-left: auto; width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--color-brand); flex: none; }
.rin-edit { display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
.rin-edit h1 { margin: 0; font-size: 1.4rem; color: var(--color-contrast); }
.rin-edit textarea { flex: 1; resize: none; padding: 1rem; border-radius: 0.9rem; border: 1px solid var(--surface-5, var(--color-divider)); background: var(--surface-2, var(--color-raised-bg)); color: var(--color-contrast); font: inherit; line-height: 1.5; }
.rin-edit .rin-meta { font-size: 0.8rem; color: var(--color-secondary); }
.rin-empty { display: grid; place-items: center; color: var(--color-secondary); }
`

export default {
	start(api) {
		const { h, ref, computed, onMounted, onBeforeUnmount } = api.vue
		const iconUrl = (path) => (path ? window.__TAURI_INTERNALS__.convertFileSrc?.(path) : null)
		const fileOf = (id) => `${id.replace(/[^\w.-]+/g, '_')}.txt`

		const Page = {
			setup() {
				const instances = ref([])
				const selected = ref(api.storage.get('last', null))
				const text = ref('')
				const status = ref('')
				const filter = ref('')
				const hasNotes = ref(new Set(api.storage.get('withNotes', [])))
				let timer

				const shown = computed(() =>
					instances.value.filter((i) => i.name.toLowerCase().includes(filter.value.trim().toLowerCase())),
				)
				const current = computed(() => instances.value.find((i) => i.id === selected.value))

				async function select(id) {
					await save()
					selected.value = id
					void api.storage.set('last', id)
					text.value = await api.files.read(fileOf(id)).catch(() => '')
					status.value = ''
				}
				async function save() {
					clearTimeout(timer)
					if (!timer || !selected.value) return
					timer = null
					await api.files.write(fileOf(selected.value), text.value)
					const set = new Set(hasNotes.value)
					text.value.trim() ? set.add(selected.value) : set.delete(selected.value)
					hasNotes.value = set
					void api.storage.set('withNotes', [...set])
					status.value = `Saved ${new Date().toLocaleTimeString()}`
				}
				function onInput(e) {
					text.value = e.target.value
					status.value = 'Editing...'
					clearTimeout(timer)
					timer = setTimeout(save, 500)
				}

				onMounted(async () => {
					instances.value = (await api.invoke('plugin:instance|instance_list')).sort(
						(a, b) => new Date(b.last_played ?? 0) - new Date(a.last_played ?? 0),
					)
					const first = instances.value.find((i) => i.id === selected.value) ?? instances.value[0]
					if (first) await select(first.id)
				})
				onBeforeUnmount(() => void save())

				return () =>
					h('div', { class: 'rin' }, [
						h('div', { class: 'rin-list' }, [
							h('input', { type: 'text', placeholder: 'Find an instance', value: filter.value, onInput: (e) => (filter.value = e.target.value) }),
							...shown.value.map((i) =>
								h('button', { class: ['rin-item', i.id === selected.value && 'on'], onClick: () => select(i.id) }, [
									iconUrl(i.icon_path) ? h('img', { src: iconUrl(i.icon_path) }) : h('span', { class: 'rin-ph' }),
									h('span', i.name),
									hasNotes.value.has(i.id) && h('span', { class: 'rin-dot', title: 'Has notes' }),
								]),
							),
						]),
						current.value
							? h('div', { class: 'rin-edit' }, [
									h('h1', current.value.name),
									h('textarea', {
										key: current.value.id,
										value: text.value,
										placeholder: 'Coordinates, seeds, to-do lists, which mod broke what...',
										onInput,
									}),
									h('span', { class: 'rin-meta' }, status.value || 'Notes save as you type.'),
								])
							: h('div', { class: 'rin-empty' }, instances.value.length ? 'Pick an instance.' : 'No instances yet.'),
					])
			},
		}

		api.addStyle(CSS)
		const page = api.addRoute('/', Page)
		api.addNavItem({ label: 'Instance notes', icon: api.icons.note, to: page })
	},
}

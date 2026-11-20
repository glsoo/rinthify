// blurs account names and server addresses
// ip or domain, optional port
const ADDRESS = /\b(?:\d{1,3}(?:\.\d{1,3}){3}|(?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d{2,5})?\b/i
// file names that look like domains
const FILE = /\.(jar|zip|json|txt|png|jpe?g|toml|log|cfg|properties|mrpack|disabled|dat|nbt|js|css)\b/i
const isAddress = (s) => ADDRESS.test(s) && !FILE.test(s) && !/https?:|\s{2}/.test(s) && s.length < 80

export default {
	async start(api) {
		const { h, reactive } = api.vue
		const state = reactive({ on: api.storage.get('on', true), addresses: api.storage.get('addresses', true), names: [] })

		// signed in account names
		async function loadNames() {
			try {
				const users = await api.invoke('plugin:auth|get_users')
				state.names = users.map((u) => u.profile?.name ?? u.username).filter((n) => n && n.length > 2)
			} catch {
				state.names = []
			}
		}

		api.addStyle(`
			body.rsm-on .rsm-blur { filter: blur(6px); }
			body.rsm-on img[src*="crafatar"], body.rsm-on img[src*="mc-heads"], body.rsm-on img[src*="minotar"] { filter: blur(4px); }
			body.rsm-on .app-grid-navbar button[title="Streamer mode"] { color: var(--color-brand); }
		`)

		// mark elements with a name or address
		function sweep() {
			if (!state.on) return
			const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				const el = n.parentElement
				const text = n.nodeValue
				if (!el || el.classList.contains('rsm-blur') || el.closest('.rf, .rcp, script, style, textarea')) continue
				if (state.names.some((name) => text.includes(name)) || (state.addresses && isAddress(text))) el.classList.add('rsm-blur')
			}
			for (const input of document.querySelectorAll('input')) {
				if (state.names.includes(input.value) || (state.addresses && isAddress(input.value))) input.classList.add('rsm-blur')
			}
		}
		const clear = () => document.querySelectorAll('.rsm-blur').forEach((el) => el.classList.remove('rsm-blur'))

		let queued = false
		const observer = new MutationObserver(() => {
			if (queued || !state.on) return
			queued = true
			requestAnimationFrame(() => ((queued = false), sweep()))
		})
		observer.observe(document.body, { childList: true, subtree: true, characterData: true })
		api.onCleanup(() => (observer.disconnect(), clear(), document.body.classList.remove('rsm-on')))

		async function set(key, value) {
			state[key] = value
			await api.storage.set(key, value)
			document.body.classList.toggle('rsm-on', state.on)
			clear()
			sweep()
		}

		await loadNames()
		document.body.classList.toggle('rsm-on', state.on)
		sweep()
		// reread names now and then
		const timer = setInterval(async () => (await loadNames(), sweep()), 30000)
		api.onCleanup(() => clearInterval(timer))

		const onKey = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
				e.preventDefault()
				void set('on', !state.on)
			}
		}
		window.addEventListener('keydown', onKey, true)
		api.onCleanup(() => window.removeEventListener('keydown', onKey, true))

		api.addNavItem({ label: 'Streamer mode', icon: api.icons.eyeOff, to: () => set('on', !state.on) })

		const check = (key, label) =>
			h('label', { class: 'rf-row' }, [h('input', { type: 'checkbox', checked: state[key], onChange: (e) => set(key, e.target.checked) }), label])
		this.settings = {
			render: () =>
				h('div', { class: 'rf-col' }, [
					check('on', 'Streamer mode on (Ctrl+Shift+S or the sidebar button)'),
					check('addresses', 'Also blur server addresses and IPs'),
					h('p', { class: 'rf-muted' }, state.names.length ? `Blurring ${state.names.length} account name(s).` : 'No signed-in accounts found.'),
				]),
		}
	},
}

// hides the sidebar ad
const BLOCKED = ['plugin:ads|init_ads_window', 'plugin:ads|update_ads_window_hold']

export default {
	start(api) {
		const tauri = window.__TAURI_INTERNALS__
		const invoke = tauri.invoke
		tauri.invoke = (cmd, ...rest) => (BLOCKED.includes(cmd) ? Promise.resolve(null) : invoke(cmd, ...rest))
		// restoring invoke undoes it
		api.onCleanup(() => (tauri.invoke = invoke))
		// hide it if already showing
		invoke('plugin:ads|hide_ads_window', { reset: true }).catch(() => {})

		api.addStyle(`
			.app-sidebar .ad-parent,
			.app-sidebar a[href^="https://modrinth.plus"] { display: none !important; }
		`)
	},
}

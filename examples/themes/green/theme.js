// sky, clock and page fade
export default {
	start(api) {
		api.addStyle(`
			#gr-sky { position: fixed; inset: 0; z-index: -1; pointer-events: none; }
			#gr-clock { margin-right: 0.9rem; font-size: 0.85rem; color: var(--color-secondary); font-variant-numeric: tabular-nums; pointer-events: none; user-select: none; }
			html:not([data-clock]) #gr-clock { display: none; }
			.app-viewport.gr-enter { animation: gr-in 0.14s ease-out; }
			@keyframes gr-in { from { opacity: 0; } }
			@media (prefers-reduced-motion: reduce) { .app-viewport.gr-enter { animation: none; } }
		`)

		// gaussian random
		const gauss = (rand) => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand())

		// draw the sky
		const sky = document.body.appendChild(document.createElement('canvas'))
		sky.id = 'gr-sky'
		const draw = () => {
			const dpr = devicePixelRatio || 1
			const w = innerWidth, h = innerHeight
			sky.width = w * dpr
			sky.height = h * dpr
			sky.style.width = w + 'px'
			sky.style.height = h + 'px'
			const ctx = sky.getContext('2d')
			ctx.scale(dpr, dpr)
			ctx.fillStyle = '#070a09'
			ctx.fillRect(0, 0, w, h)
			let seed = 7
			const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
			for (let i = 0; i < (w * h) / 2600; i++) {
				const big = rand() < 0.04
				ctx.globalAlpha = big ? 0.9 : 0.15 + rand() * 0.45
				ctx.fillStyle = rand() < 0.15 ? '#d6ffe6' : '#e4ebf0'
				ctx.beginPath()
				ctx.arc(rand() * w, rand() * h, big ? 1.2 : 0.4 + rand() * 0.5, 0, Math.PI * 2)
				ctx.fill()
			}
			// milky way
			const len = Math.hypot(w, h), band = Math.min(w, h) * 0.09
			ctx.save()
			ctx.translate(w * 0.45, h * 0.22) // band crosses the title bar
			ctx.rotate(-Math.atan2(h, w) * 0.8)
			const haze = ctx.createLinearGradient(0, -band * 2, 0, band * 2)
			haze.addColorStop(0, 'rgba(160, 215, 185, 0)')
			haze.addColorStop(0.5, 'rgba(160, 215, 185, 0.045)')
			haze.addColorStop(1, 'rgba(160, 215, 185, 0)')
			ctx.globalAlpha = 1
			ctx.fillStyle = haze
			ctx.fillRect(-len / 2, -band * 2, len, band * 4)
			ctx.fillStyle = '#e4ebf0'
			for (let i = 0; i < len * 1.6; i++) {
				ctx.globalAlpha = 0.1 + rand() * 0.35
				ctx.fillRect((rand() - 0.5) * len, gauss(rand) * band * 0.6, 0.7, 0.7)
			}
			ctx.restore()
		}
		draw()
		addEventListener('resize', draw)
		api.onCleanup(() => (removeEventListener('resize', draw), sky.remove()))

		// clock
		const clock = document.createElement('div')
		clock.id = 'gr-clock'
		const tick = () => {
			clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
			const bar = document.querySelector('.app-title-bar > section')
			if (bar && clock.parentElement !== bar) bar.prepend(clock)
		}
		tick()
		const timer = setInterval(tick, 5000)
		api.onCleanup(() => (clearInterval(timer), clock.remove()))

		// fade on page change
		const off = api.router.afterEach(() => {
			const view = document.querySelector('.app-viewport')
			if (!view) return
			view.classList.remove('gr-enter')
			void view.offsetWidth
			view.classList.add('gr-enter')
		})
		api.onCleanup(() => (off(), document.querySelector('.app-viewport')?.classList.remove('gr-enter')))
	},
}

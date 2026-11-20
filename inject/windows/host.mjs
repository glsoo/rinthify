// windows: waits for the modrinth app and injects rinthify through the debug port
// the port comes from a webview2 policy that `rinthify inject` sets
// node host.mjs <port> <rinthify.js> <user dir> [update command...]
import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

const [port, scriptFile, dir, ...updateCmd] = process.argv.slice(2)
const PIPE = '\\\\.\\pipe\\rinthify'
const log = (msg) => console.error(`[rinthify] ${msg}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// only one watcher, a new one kills the old one
async function lock() {
	for (let i = 0; i < 20; i++) {
		const ok = await new Promise((res) => {
			const s = net.createServer((c) => (c.end(), process.exit(0)))
			s.once('error', () => res(false))
			s.listen(PIPE, () => res(true))
		})
		if (ok) return
		net.connect(PIPE).on('error', () => {})
		await sleep(250)
	}
	process.exit(1)
}

// relative path to full path, null if unsafe
function resolve(rel) {
	if (!rel || !dir || /[\\:]/.test(rel)) return null
	const parts = rel.split('/')
	return parts.some((p) => !p || p === '.' || p === '..') ? null : path.join(dir, ...parts)
}

function list(full, rel, out) {
	let names
	try {
		names = fs.readdirSync(full)
	} catch {
		return out
	}
	for (const name of names) {
		const f = path.join(full, name)
		const r = rel ? `${rel}/${name}` : name
		const st = fs.statSync(f, { throwIfNoEntry: false })
		if (st?.isDirectory()) list(f, r, out)
		else if (st?.isFile()) out.push(`${Math.floor(st.mtimeMs)}\t${r}`)
	}
	return out
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }

// same ops as inject/linux/rinthify.c
async function handle(send, msg, contextId) {
	const { op, path: rel, data, method, headers, body } = msg
	const full = resolve(rel)
	if (op === 'log') return log(data ?? ''), null
	if (op === 'eval') {
		const r = await send('Runtime.evaluate', { expression: `${data}\n//# sourceURL=${rel ?? 'rinthify'}`, contextId })
		if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
		return null
	}
	if (op === 'fetch') {
		if (!data?.startsWith('https://')) throw new Error('bad url')
		if (rel && !full) throw new Error(`bad path: ${rel}`)
		const res = await fetch(data, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'user-agent': 'Rinthify', ...(body && { 'content-type': 'application/json' }), ...headers }, body, signal: AbortSignal.timeout(30_000) })
		if (res.status >= 300) throw new Error(`HTTP ${res.status}`)
		if (!full) return await res.text()
		fs.mkdirSync(path.dirname(full), { recursive: true })
		fs.writeFileSync(full, Buffer.from(await res.arrayBuffer()))
		return null
	}
	if (op === 'run') {
		// update, inject (repair) or uninject. uninject kills this process so it never replies
		if (!updateCmd.length || !['update', 'inject', 'uninject'].includes(data)) throw new Error('bad command')
		const [node, cli, , ...rest] = updateCmd
		return new Promise((res, rej) =>
			execFile(node, [cli, data, ...rest], { windowsHide: true }, (e, stdout, stderr) => (e ? rej(new Error(stdout + stderr || e.message)) : res(stdout + stderr))),
		)
	}
	if (op === 'list') return list(dir, '', [])
	if (!full) throw new Error(`bad path: ${rel ?? '(none)'}`)
	if (op === 'read') return fs.readFileSync(full, 'utf8')
	if (op === 'image') {
		const mime = MIME[path.extname(full).slice(1).toLowerCase()] ?? 'application/octet-stream'
		return `data:${mime};base64,${fs.readFileSync(full).toString('base64')}`
	}
	if (op === 'write') {
		fs.mkdirSync(path.dirname(full), { recursive: true })
		fs.writeFileSync(full, msg.base64 ? Buffer.from(data ?? '', 'base64') : (data ?? ''))
		return null
	}
	if (op === 'delete') return fs.rmSync(full, { recursive: true, force: true }), null
	throw new Error(`unknown op: ${op}`)
}

// attach to one page until it closes
async function attach(target) {
	const ws = new WebSocket(target.webSocketDebuggerUrl)
	let seq = 0
	const waiting = new Map()
	const send = (method, params = {}) =>
		new Promise((resolve, reject) => {
			const id = ++seq
			waiting.set(id, { resolve, reject })
			ws.send(JSON.stringify({ id, method, params }))
		})
	ws.onmessage = async ({ data }) => {
		const m = JSON.parse(data)
		if (m.id) {
			const w = waiting.get(m.id)
			waiting.delete(m.id)
			return m.error ? w?.reject(new Error(m.error.message)) : w?.resolve(m.result)
		}
		if (process.env.RINTHIFY_DEBUG && m.method === 'Runtime.consoleAPICalled')
			console.log(`console.${m.params.type}:`, ...m.params.args.map((a) => a.value ?? a.description))
		if (m.method !== 'Runtime.bindingCalled' || m.params.name !== '__rinthifyBridge') return
		const contextId = m.params.executionContextId
		const { id, msg } = JSON.parse(m.params.payload)
		let err = null
		let value = null
		try {
			value = await handle(send, msg, contextId)
		} catch (e) {
			err = String(e.message ?? e)
		}
		send('Runtime.evaluate', { expression: `__rinthifyReply(${id}, ${JSON.stringify(err)}, ${JSON.stringify(value)})`, contextId }).catch(() => {})
	}
	const closed = new Promise((r) => (ws.onclose = ws.onerror = r))
	await new Promise((r, j) => ((ws.onopen = r), closed.then(j)))

	// RINTHIFY_SAFE in the watcher's env, or a file named `safe` in the rinthify folder
	const safe = (!!process.env.RINTHIFY_SAFE && process.env.RINTHIFY_SAFE !== '0') || fs.existsSync(path.join(dir, 'safe'))
	// pretend to be webkit so the loader works the same
	const shim = `if (window === window.top) {
window.__RINTHIFY__ = { dir: ${JSON.stringify(dir)}, safeMode: ${safe} };
const calls = new Map(); let n = 0;
window.__rinthifyReply = (id, err, value) => { const c = calls.get(id); calls.delete(id); if (c) err === null ? c.resolve(value) : c.reject(new Error(err)) };
window.webkit = { messageHandlers: { rinthify: { postMessage: (msg) => new Promise((resolve, reject) => { const id = ++n; calls.set(id, { resolve, reject }); __rinthifyBridge(JSON.stringify({ id, msg })) }) } } };
${fs.readFileSync(scriptFile, 'utf8')}
}`
	await send('Runtime.enable')
	await send('Page.enable')
	await send('Runtime.addBinding', { name: '__rinthifyBridge' })
	await send('Page.addScriptToEvaluateOnNewDocument', { source: shim })
	// reload so we run before the app
	await send('Page.reload')
	log('injecting into the web view')
	// update in the background, used next launch
	if (updateCmd.length) spawn(updateCmd[0], updateCmd.slice(1), { detached: true, stdio: 'ignore', windowsHide: true }).unref()
	await closed
}

await lock()
// check every 2s if the app is open
for (;;) {
	const target = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) })
		.then((r) => r.json())
		// the app page, not the ad frame
		.then((l) => l.find((t) => t.type === 'page' && /^https?:\/\/tauri\.localhost/.test(t.url)))
		.catch(() => null)
	if (target) await attach(target).catch((e) => log(`attach failed: ${e.message}`))
	await sleep(2000)
}

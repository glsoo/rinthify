// fluid sim from glso.page, blurred behind the app
const CFG = { SIM_RES: 128, DYE_RES: 256, DENSITY_DISSIPATION: 0.9, VELOCITY_DISSIPATION: 0.18, PRESSURE: 0.8, PRESSURE_ITERATIONS: 22, CURL: 18, SPLAT_RADIUS: 0.22, STIR_FORCE: 1600, JITTER: 28, EXPOSURE: 0.9 }
const PAL = ['#a855f7', '#5d0282']

const VERT = `#version 300 es
precision highp float;
in vec2 aPos; uniform vec2 texelSize;
out vec2 vUv, vL, vR, vT, vB;
void main(){
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`
const H = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB; out vec4 o;
`
const FRAG = {
	splat: H + `uniform sampler2D uTarget; uniform float aspect; uniform vec3 color; uniform vec2 point; uniform float radius;
void main(){ vec2 p = vUv - point; p.x *= aspect; o = vec4(texture(uTarget, vUv).xyz + exp(-dot(p, p) / radius) * color, 1.0); }`,
	advect: H + `uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
void main(){ vec2 c = vUv - dt * texture(uVelocity, vUv).xy * texelSize; o = vec4(texture(uSource, c).rgb / (1.0 + dissipation * dt), 1.0); }`,
	divergence: H + `uniform sampler2D uVelocity;
void main(){
  float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x, T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
	curl: H + `uniform sampler2D uVelocity;
void main(){ o = vec4(0.5 * (texture(uVelocity, vR).y - texture(uVelocity, vL).y - texture(uVelocity, vT).x + texture(uVelocity, vB).x), 0.0, 0.0, 1.0); }`,
	vorticity: H + `uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
void main(){
  float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4; f *= curl * C; f.y *= -1.0;
  o = vec4(clamp(texture(uVelocity, vUv).xy + f * dt, -1000.0, 1000.0), 0.0, 1.0);
}`,
	pressure: H + `uniform sampler2D uPressure, uDivergence;
void main(){ o = vec4((texture(uPressure, vL).x + texture(uPressure, vR).x + texture(uPressure, vB).x + texture(uPressure, vT).x - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0); }`,
	gradient: H + `uniform sampler2D uPressure, uVelocity;
void main(){ o = vec4(texture(uVelocity, vUv).xy - vec2(texture(uPressure, vR).x - texture(uPressure, vL).x, texture(uPressure, vT).x - texture(uPressure, vB).x), 0.0, 1.0); }`,
	scale: H + `uniform sampler2D uTexture; uniform float value;
void main(){ o = value * texture(uTexture, vUv); }`,
	churn: H + `uniform sampler2D uVelocity; uniform float time, jitter;
void main(){
  vec2 n = vec2(sin(vUv.y * 9.0 + time * 0.35) + sin(vUv.x * 5.0 - time * 0.27), cos(vUv.x * 8.0 - time * 0.31) + cos(vUv.y * 6.0 + time * 0.23));
  o = vec4(texture(uVelocity, vUv).xy + n * jitter * 0.9, 0.0, 1.0);
}`,
	display: H + `uniform sampler2D uTexture; uniform float exposure; uniform vec3 ca, cb;
void main(){
  vec3 c = texture(uTexture, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  vec3 t = mix(cb, ca, clamp(l * 2.0, 0.0, 1.0));
  c = t * l / max(t.r, max(t.g, t.b));
  c = vec3(1.0) - exp(-c * vec3(1.35, 1.25, 1.15) * exposure);
  c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, 1.3); // saturate, was a css filter
  o = vec4(pow(c, vec3(0.95)), 1.0);
}`,
}

export default {
	start(api) {
		// dont use a css blur, it lagged a lot. the small canvas is blurry enough
		api.addStyle(`#fl-bg { position: fixed; inset: 0; width: 100%; height: 100%; z-index: -1; image-rendering: auto; pointer-events: none; }`)
		// small blurred copy is what you see
		const bg = document.body.appendChild(document.createElement('canvas'))
		bg.id = 'fl-bg'
		bg.width = 32
		bg.height = 18
		const bgx = bg.getContext('2d')
		api.onCleanup(() => bg.remove())

		const canvas = document.createElement('canvas')
		const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false })
		if (!gl || !gl.getExtension('EXT_color_buffer_float')) return void (bg.style.background = 'radial-gradient(ellipse at center, #000 55%, #22012f 80%, #5d0282 100%)')
		gl.getExtension('OES_texture_float_linear')
		api.onCleanup(() => gl.getExtension('WEBGL_lose_context')?.loseContext())

		const compile = (type, src) => {
			const s = gl.createShader(type)
			gl.shaderSource(s, src)
			gl.compileShader(s)
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
			return s
		}
		const vs = compile(gl.VERTEX_SHADER, VERT)
		const program = (src) => {
			const p = gl.createProgram()
			gl.attachShader(p, vs)
			gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src))
			gl.bindAttribLocation(p, 0, 'aPos')
			gl.linkProgram(p)
			if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
			const u = {}
			for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
				const name = gl.getActiveUniform(p, i).name
				u[name] = gl.getUniformLocation(p, name)
			}
			return { u, use() { gl.useProgram(p); return this } }
		}
		const P = Object.fromEntries(Object.entries(FRAG).map(([k, v]) => [k, program(v)]))

		gl.bindVertexArray(gl.createVertexArray())
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
		gl.enableVertexAttribArray(0)
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

		const blit = (t) => {
			if (t) gl.viewport(0, 0, t.w, t.h), gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
			else gl.viewport(0, 0, canvas.width, canvas.height), gl.bindFramebuffer(gl.FRAMEBUFFER, null)
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
		}
		const fbo = (w, h) => {
			gl.activeTexture(gl.TEXTURE0)
			const tex = gl.createTexture()
			gl.bindTexture(gl.TEXTURE_2D, tex)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
			const f = gl.createFramebuffer()
			gl.bindFramebuffer(gl.FRAMEBUFFER, f)
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
			gl.viewport(0, 0, w, h)
			gl.clearColor(0, 0, 0, 1)
			gl.clear(gl.COLOR_BUFFER_BIT)
			return { fbo: f, w, h, tx: 1 / w, ty: 1 / h, attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id } }
		}
		const dfbo = (w, h) => {
			let a = fbo(w, h), b = fbo(w, h)
			return { tx: 1 / w, ty: 1 / h, get read() { return a }, get write() { return b }, swap() { [a, b] = [b, a] } }
		}
		const aspect = () => innerWidth / innerHeight
		const res = (r) => (aspect() > 1 ? { w: Math.round(r * aspect()), h: r } : { w: r, h: Math.round(r / aspect()) })

		let velocity, dye, divergence, curl, pressure
		const init = () => {
			const s = res(CFG.SIM_RES), d = res(CFG.DYE_RES)
			canvas.width = d.w
			canvas.height = d.h
			velocity = dfbo(s.w, s.h)
			pressure = dfbo(s.w, s.h)
			divergence = fbo(s.w, s.h)
			curl = fbo(s.w, s.h)
			dye = dfbo(d.w, d.h)
		}

		const splat = (x, y, dx, dy, color, r = CFG.SPLAT_RADIUS) => {
			const radius = (r / 100) * Math.max(1, aspect())
			const p = P.splat.use()
			gl.uniform1i(p.u.uTarget, velocity.read.attach(0))
			gl.uniform1f(p.u.aspect, aspect())
			gl.uniform2f(p.u.point, x, y)
			gl.uniform3f(p.u.color, dx, dy, 0)
			gl.uniform1f(p.u.radius, radius)
			blit(velocity.write)
			velocity.swap()
			if (!color) return
			gl.uniform1i(p.u.uTarget, dye.read.attach(0))
			gl.uniform3f(p.u.color, ...color)
			blit(dye.write)
			dye.swap()
		}
		const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
		const [palA, palB] = PAL.map(hex)
		const mixPal = (m, k) => palA.map((v, i) => (v * (1 - m) + palB[i] * m) * k)
		const rnd = (a, b) => a + Math.random() * (b - a)
		const dir = (f) => ((a) => [Math.cos(a) * f, Math.sin(a) * f])(Math.random() * Math.PI * 2)
		const colourSplat = () => splat(Math.random(), Math.random(), ...dir(rnd(40, 140)), mixPal(Math.random(), rnd(0.18, 0.5)), CFG.SPLAT_RADIUS * rnd(1.4, 3.6))
		const ambientSplat = () => splat(Math.random(), Math.random(), ...dir(rnd(50, 160)), null, CFG.SPLAT_RADIUS * rnd(0.8, 2.4))
		const backgroundSplat = () => splat(rnd(0.05, 0.95), rnd(0.1, 0.9), ...dir(rnd(60, 180)), palB.map((v, i) => (v * 0.7 + palA[i] * 0.3 * Math.random()) * rnd(0.4, 0.9)), CFG.SPLAT_RADIUS * rnd(0.6, 1.8))
		const seed = () => {
			for (let i = 0; i < 10; i++) ambientSplat()
			for (let i = 0; i < 6; i++) backgroundSplat()
			for (let i = 0; i < 26; i++) colourSplat()
		}

		let time = 0
		const step = (dt) => {
			const sx = velocity.tx, sy = velocity.ty
			let p = P.curl.use()
			gl.uniform2f(p.u.texelSize, sx, sy)
			gl.uniform1i(p.u.uVelocity, velocity.read.attach(0))
			blit(curl)
			p = P.vorticity.use()
			gl.uniform2f(p.u.texelSize, sx, sy)
			gl.uniform1i(p.u.uVelocity, velocity.read.attach(0))
			gl.uniform1i(p.u.uCurl, curl.attach(1))
			gl.uniform1f(p.u.curl, CFG.CURL)
			gl.uniform1f(p.u.dt, dt)
			blit(velocity.write)
			velocity.swap()
			p = P.churn.use()
			gl.uniform1i(p.u.uVelocity, velocity.read.attach(0))
			gl.uniform1f(p.u.time, time)
			gl.uniform1f(p.u.jitter, CFG.JITTER * dt)
			blit(velocity.write)
			velocity.swap()
			p = P.divergence.use()
			gl.uniform2f(p.u.texelSize, sx, sy)
			gl.uniform1i(p.u.uVelocity, velocity.read.attach(0))
			blit(divergence)
			p = P.scale.use()
			gl.uniform1i(p.u.uTexture, pressure.read.attach(0))
			gl.uniform1f(p.u.value, CFG.PRESSURE)
			blit(pressure.write)
			pressure.swap()
			p = P.pressure.use()
			gl.uniform2f(p.u.texelSize, sx, sy)
			gl.uniform1i(p.u.uDivergence, divergence.attach(0))
			for (let i = 0; i < CFG.PRESSURE_ITERATIONS; i++) {
				gl.uniform1i(p.u.uPressure, pressure.read.attach(1))
				blit(pressure.write)
				pressure.swap()
			}
			p = P.gradient.use()
			gl.uniform2f(p.u.texelSize, sx, sy)
			gl.uniform1i(p.u.uPressure, pressure.read.attach(0))
			gl.uniform1i(p.u.uVelocity, velocity.read.attach(1))
			blit(velocity.write)
			velocity.swap()
			p = P.advect.use()
			gl.uniform2f(p.u.texelSize, sx, sy)
			gl.uniform1f(p.u.dt, dt)
			const v0 = velocity.read.attach(0)
			gl.uniform1i(p.u.uVelocity, v0)
			gl.uniform1i(p.u.uSource, v0)
			gl.uniform1f(p.u.dissipation, CFG.VELOCITY_DISSIPATION)
			blit(velocity.write)
			velocity.swap()
			gl.uniform1i(p.u.uVelocity, velocity.read.attach(0))
			gl.uniform1i(p.u.uSource, dye.read.attach(1))
			gl.uniform1f(p.u.dissipation, CFG.DENSITY_DISSIPATION)
			blit(dye.write)
			dye.swap()
			p = P.display.use()
			gl.uniform1i(p.u.uTexture, dye.read.attach(0))
			gl.uniform1f(p.u.exposure, CFG.EXPOSURE)
			gl.uniform3fv(p.u.ca, palA)
			gl.uniform3fv(p.u.cb, palB)
			blit(null)
			bgx.drawImage(canvas, 0, 0, 32, 18)
		}

		// mouse stirs it
		const ptr = { x: -1, y: -1 }
		const stir = (e) => {
			const x = e.clientX / innerWidth, y = 1 - e.clientY / innerHeight
			if (ptr.x >= 0) {
				let dx = x - ptr.x, dy = y - ptr.y
				if (aspect() < 1) dx *= aspect()
				else dy /= aspect()
				if (dx || dy) splat(x, y, dx * CFG.STIR_FORCE, dy * CFG.STIR_FORCE, null, CFG.SPLAT_RADIUS * 0.8)
			}
			ptr.x = x
			ptr.y = y
		}
		let timer = 0
		const resize = () => (clearTimeout(timer), (timer = setTimeout(() => (init(), seed()), 150)))
		addEventListener('pointermove', stir)
		addEventListener('resize', resize)

		let last = performance.now(), ambientT = 0, bgT = 0, colT = 0, raf = 0
		// 30fps is plenty for a blurred background, and halves the repaints
		const frame = (now) => {
			raf = requestAnimationFrame(frame)
			if (now - last < 1000 / 30 - 2) return
			const dt = Math.min((now - last) / 1000, 1 / 30)
			last = now
			time += dt
			if ((ambientT += dt) > 0.5) (ambientT = 0), ambientSplat()
			if ((bgT += dt) > 0.55) (bgT = 0), backgroundSplat()
			if ((colT += dt) > 0.14) (colT = 0), colourSplat()
			step(dt)
		}
		init()
		seed()
		raf = requestAnimationFrame(frame)
		api.onCleanup(() => (cancelAnimationFrame(raf), clearTimeout(timer), removeEventListener('pointermove', stir), removeEventListener('resize', resize)))
	},
	stop() {},
}

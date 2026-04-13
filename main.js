(() => {
	const canvas = document.getElementById('canvas');
	const gl = canvas.getContext('webgl', { alpha: false, antialias: true });

	if (!gl) {
		throw new Error('WebGL is not supported in this browser.');
	}

	const vertexShaderSource = `
		attribute vec2 a_position;
		attribute float a_size;
		attribute vec4 a_color;

		uniform vec2 u_resolution;

		varying vec4 v_color;

		void main() {
			vec2 zeroToOne = a_position / u_resolution;
			vec2 zeroToTwo = zeroToOne * 2.0;
			vec2 clipSpace = zeroToTwo - 1.0;

			gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
			gl_PointSize = a_size;
			v_color = a_color;
		}
	`;

	const fragmentShaderSource = `
		precision mediump float;

		varying vec4 v_color;

		void main() {
			vec2 p = gl_PointCoord - vec2(0.5);
			float d = length(p) * 2.0;
			float core = smoothstep(0.75, 0.0, d);
			float glow = smoothstep(1.0, 0.2, d) * 0.35;
			float alpha = (core + glow) * v_color.a;
			gl_FragColor = vec4(v_color.rgb, alpha);
		}
	`;

	function createShader(type, source) {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const message = gl.getShaderInfoLog(shader);
			gl.deleteShader(shader);
			throw new Error(`Shader compile error: ${message}`);
		}

		return shader;
	}

	function createProgram(vsSource, fsSource) {
		const vertexShader = createShader(gl.VERTEX_SHADER, vsSource);
		const fragmentShader = createShader(gl.FRAGMENT_SHADER, fsSource);

		const program = gl.createProgram();
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const message = gl.getProgramInfoLog(program);
			gl.deleteProgram(program);
			throw new Error(`Program link error: ${message}`);
		}

		return program;
	}

	function randomRange(min, max) {
		return min + Math.random() * (max - min);
	}

	function lerp(a, b, t) {
		return a + (b - a) * t;
	}

	const particleProgram = createProgram(vertexShaderSource, fragmentShaderSource);

	const loc = {
		position: gl.getAttribLocation(particleProgram, 'a_position'),
		size: gl.getAttribLocation(particleProgram, 'a_size'),
		color: gl.getAttribLocation(particleProgram, 'a_color'),
		resolution: gl.getUniformLocation(particleProgram, 'u_resolution')
	};

	const positionBuffer = gl.createBuffer();
	const sizeBuffer = gl.createBuffer();
	const colorBuffer = gl.createBuffer();

	let width = 1;
	let height = 1;

	function resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const displayWidth = Math.floor(window.innerWidth * dpr);
		const displayHeight = Math.floor(window.innerHeight * dpr);

		if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
			canvas.width = displayWidth;
			canvas.height = displayHeight;
		}

		width = canvas.width;
		height = canvas.height;
		gl.viewport(0, 0, width, height);
	}

	window.addEventListener('resize', resize);
	resize();

	const gravity = 450;
	const particles = [];
	const rockets = [];

	function spawnParticle(p) {
		particles.push({
			x: p.x,
			y: p.y,
			vx: p.vx || 0,
			vy: p.vy || 0,
			ax: p.ax || 0,
			ay: p.ay || 0,
			drag: p.drag == null ? 0 : p.drag,
			life: p.life,
			maxLife: p.life,
			size: p.size,
			sizeEnd: p.sizeEnd == null ? p.size : p.sizeEnd,
			fadeIn: p.fadeIn || 0,
			color: p.color.slice(),
			colorEnd: (p.colorEnd || p.color).slice(),
			alpha: p.alpha == null ? 1 : p.alpha,
			alphaEnd: p.alphaEnd == null ? 0 : p.alphaEnd,
			gravityScale: p.gravityScale == null ? 1 : p.gravityScale,
			kind: p.kind || 'generic'
		});
	}

	function spawnSparkler(dt, t) {
		const count = Math.floor(280 * dt);
		const x = width * 0.16;
		const y = height * 0.86;
		for (let i = 0; i < count; i += 1) {
			const ang = randomRange(-1.8, -1.1) + Math.sin(t * 12.0 + i) * 0.12;
			const speed = randomRange(120, 360);
			spawnParticle({
				x,
				y,
				vx: Math.cos(ang) * speed + randomRange(-20, 20),
				vy: Math.sin(ang) * speed,
				drag: 1.8,
				life: randomRange(0.6, 1.3),
				size: randomRange(2.0, 4.8),
				sizeEnd: 0.8,
				color: [1.0, randomRange(0.75, 0.95), randomRange(0.2, 0.45)],
				colorEnd: [1.0, 0.2, 0.02],
				alpha: 1.0,
				alphaEnd: 0.0,
				gravityScale: 0.7,
				kind: 'sparkler'
			});
		}
	}

	function spawnSmoke(dt) {
		const count = Math.floor(95 * dt);
		const x = width * 0.16;
		const y = height * 0.84;
		for (let i = 0; i < count; i += 1) {
			spawnParticle({
				x: x + randomRange(-10, 10),
				y: y + randomRange(-6, 6),
				vx: randomRange(-20, 20),
				vy: randomRange(-90, -20),
				drag: 0.6,
				life: randomRange(2.2, 4.0),
				size: randomRange(10, 18),
				sizeEnd: randomRange(32, 64),
				color: [0.45, 0.45, 0.45],
				colorEnd: [0.1, 0.1, 0.1],
				alpha: randomRange(0.24, 0.38),
				alphaEnd: 0.0,
				gravityScale: -0.12,
				kind: 'smoke'
			});
		}
	}

	function spawnRain(dt) {
		const count = Math.floor(900 * dt);
		for (let i = 0; i < count; i += 1) {
			spawnParticle({
				x: randomRange(0, width),
				y: randomRange(-40, -5),
				vx: randomRange(-14, 10),
				vy: randomRange(620, 910),
				drag: 0.0,
				life: randomRange(0.8, 1.4),
				size: randomRange(1.2, 2.1),
				sizeEnd: 1.0,
				color: [0.55, 0.72, 1.0],
				colorEnd: [0.45, 0.62, 0.95],
				alpha: randomRange(0.34, 0.58),
				alphaEnd: 0.08,
				gravityScale: 0.0,
				kind: 'rain'
			});
		}
	}

	function spawnSteamJets(dt, t) {
		const baseX = width * 0.78;
		const baseY = height * 0.9;
		const jets = 3;

		for (let j = 0; j < jets; j += 1) {
			const count = Math.floor(42 * dt);
			const offset = (j - 1) * 34;
			for (let i = 0; i < count; i += 1) {
				const wobble = Math.sin(t * 2.0 + j * 1.2) * 8;
				spawnParticle({
					x: baseX + offset + wobble + randomRange(-5, 5),
					y: baseY + randomRange(-3, 3),
					vx: randomRange(-30, 30),
					vy: randomRange(-210, -110),
					drag: 0.8,
					life: randomRange(1.4, 2.4),
					size: randomRange(8, 16),
					sizeEnd: randomRange(38, 58),
					color: [0.8, 0.84, 0.88],
					colorEnd: [0.32, 0.36, 0.42],
					alpha: randomRange(0.18, 0.3),
					alphaEnd: 0.0,
					gravityScale: -0.08,
					kind: 'steam'
				});
			}
		}
	}

	function spawnCloudLayer(dt, t) {
		const count = Math.floor(18 * dt);
		const y = height * 0.18 + Math.sin(t * 0.25) * 18;
		for (let i = 0; i < count; i += 1) {
			spawnParticle({
				x: randomRange(0, width),
				y: y + randomRange(-30, 24),
				vx: randomRange(6, 20),
				vy: randomRange(-4, 4),
				drag: 0.2,
				life: randomRange(6.0, 10.0),
				size: randomRange(40, 76),
				sizeEnd: randomRange(90, 140),
				color: [0.22, 0.24, 0.28],
				colorEnd: [0.15, 0.16, 0.2],
				alpha: randomRange(0.08, 0.14),
				alphaEnd: 0.0,
				gravityScale: 0.0,
				kind: 'cloud'
			});
		}
	}

	function createRocket(t) {
		rockets.push({
			x: randomRange(width * 0.28, width * 0.72),
			y: height + 10,
			vx: randomRange(-25, 25),
			vy: randomRange(-520, -630),
			targetY: randomRange(height * 0.2, height * 0.45),
			color: [randomRange(0.6, 1.0), randomRange(0.35, 1.0), randomRange(0.35, 1.0)],
			bornAt: t,
			type: Math.floor(randomRange(0, 4))
		});
	}

	function explodeFirework(x, y, baseColor, type) {
		const burstCount = [90, 120, 150, 110][type] || 100;

		for (let i = 0; i < burstCount; i += 1) {
			let ang = randomRange(0, Math.PI * 2);
			let speed = randomRange(90, 320);

			if (type === 1) {
				const ringTightness = randomRange(0.94, 1.06);
				speed = randomRange(190, 250) * ringTightness;
			} else if (type === 2) {
				ang = (Math.PI * 2 * i) / burstCount + randomRange(-0.05, 0.05);
				speed = randomRange(130, 280);
			} else if (type === 3) {
				const petals = 6;
				const petalWave = 0.45 + 0.55 * Math.sin(ang * petals);
				speed = randomRange(120, 260) * petalWave;
			}

			const cJitter = 0.18;
			spawnParticle({
				x,
				y,
				vx: Math.cos(ang) * speed,
				vy: Math.sin(ang) * speed,
				drag: 1.2,
				life: randomRange(1.0, 2.2),
				size: randomRange(2.4, 5.4),
				sizeEnd: 0.7,
				color: [
					Math.min(1, baseColor[0] + randomRange(-cJitter, cJitter)),
					Math.min(1, baseColor[1] + randomRange(-cJitter, cJitter)),
					Math.min(1, baseColor[2] + randomRange(-cJitter, cJitter))
				],
				colorEnd: [0.12, 0.05, 0.02],
				alpha: 1.0,
				alphaEnd: 0.0,
				gravityScale: 0.68,
				kind: 'firework'
			});
		}

		for (let i = 0; i < 36; i += 1) {
			const ang = randomRange(0, Math.PI * 2);
			const speed = randomRange(30, 70);
			spawnParticle({
				x,
				y,
				vx: Math.cos(ang) * speed,
				vy: Math.sin(ang) * speed,
				drag: 0.6,
				life: randomRange(1.6, 2.8),
				size: randomRange(12, 20),
				sizeEnd: randomRange(30, 56),
				color: [0.35, 0.35, 0.4],
				colorEnd: [0.05, 0.05, 0.06],
				alpha: randomRange(0.16, 0.22),
				alphaEnd: 0.0,
				gravityScale: -0.06,
				kind: 'fireworkSmoke'
			});
		}
	}

	function spawnFireworks(dt, t, state) {
		state.fireworkTimer -= dt;
		if (state.fireworkTimer <= 0) {
			createRocket(t);
			if (Math.random() > 0.58) {
				createRocket(t + 0.04);
			}
			state.fireworkTimer = randomRange(1.0, 2.0);
		}

		for (let i = rockets.length - 1; i >= 0; i -= 1) {
			const r = rockets[i];

			r.x += r.vx * dt;
			r.y += r.vy * dt;
			r.vy += gravity * 0.35 * dt;

			spawnParticle({
				x: r.x,
				y: r.y,
				vx: randomRange(-12, 12),
				vy: randomRange(40, 90),
				drag: 2.4,
				life: randomRange(0.22, 0.4),
				size: randomRange(2.2, 3.4),
				sizeEnd: 0.8,
				color: [1.0, 0.78, 0.3],
				colorEnd: [1.0, 0.2, 0.05],
				alpha: 0.9,
				alphaEnd: 0.0,
				gravityScale: 0.3,
				kind: 'rocketTrail'
			});

			if (r.vy >= -20 || r.y <= r.targetY) {
				explodeFirework(r.x, r.y, r.color, r.type);
				rockets.splice(i, 1);
			}
		}
	}

	function spawnMagicSpiral(dt, t) {
		const count = Math.floor(180 * dt);
		const cx = width * 0.5;
		const cy = height * 0.72;

		for (let i = 0; i < count; i += 1) {
			const base = t * 2.7 + i * 0.4;
			const radius = randomRange(12, 34);
			const ang = base + Math.sin(base * 0.33) * 0.5;
			const swirl = 95 + 38 * Math.sin(t * 3.0 + i);
			const hue = 0.5 + 0.5 * Math.sin(base);

			spawnParticle({
				x: cx + Math.cos(ang) * radius,
				y: cy + Math.sin(ang) * radius,
				vx: Math.cos(ang + Math.PI * 0.5) * swirl,
				vy: Math.sin(ang + Math.PI * 0.5) * swirl - randomRange(30, 70),
				ax: (cx - (cx + Math.cos(ang) * radius)) * 0.8,
				ay: (cy - (cy + Math.sin(ang) * radius)) * 0.8,
				drag: 1.6,
				life: randomRange(0.8, 1.6),
				size: randomRange(2.0, 4.2),
				sizeEnd: 0.6,
				color: [0.2 + 0.8 * hue, 0.8, 1.0 - 0.4 * hue],
				colorEnd: [0.08, 0.04, 0.12],
				alpha: 0.75,
				alphaEnd: 0.0,
				gravityScale: -0.08,
				kind: 'magic'
			});
		}
	}

	const state = {
		fireworkTimer: 0.9,
		time: 0,
		maxParticles: 16000
	};

	const positions = new Float32Array(state.maxParticles * 2);
	const sizes = new Float32Array(state.maxParticles);
	const colors = new Float32Array(state.maxParticles * 4);

	function updateParticles(dt) {
		for (let i = particles.length - 1; i >= 0; i -= 1) {
			const p = particles[i];
			p.life -= dt;

			if (p.life <= 0) {
				particles.splice(i, 1);
				continue;
			}

			const dragFactor = Math.max(0, 1 - p.drag * dt);
			p.vx *= dragFactor;
			p.vy *= dragFactor;

			p.vx += p.ax * dt;
			p.vy += (p.ay + gravity * p.gravityScale) * dt;

			p.x += p.vx * dt;
			p.y += p.vy * dt;
		}

		if (particles.length > state.maxParticles) {
			particles.splice(0, particles.length - state.maxParticles);
		}
	}

	function fillBuffers() {
		const count = Math.min(particles.length, state.maxParticles);

		for (let i = 0; i < count; i += 1) {
			const p = particles[i];
			const life01 = 1 - p.life / p.maxLife;
			const t = Math.min(1, Math.max(0, life01));

			let alpha = lerp(p.alpha, p.alphaEnd, t);
			if (p.fadeIn > 0 && p.life > p.maxLife - p.fadeIn) {
				alpha *= (p.maxLife - p.life) / p.fadeIn;
			}

			positions[i * 2] = p.x;
			positions[i * 2 + 1] = p.y;
			sizes[i] = lerp(p.size, p.sizeEnd, t);

			colors[i * 4] = lerp(p.color[0], p.colorEnd[0], t);
			colors[i * 4 + 1] = lerp(p.color[1], p.colorEnd[1], t);
			colors[i * 4 + 2] = lerp(p.color[2], p.colorEnd[2], t);
			colors[i * 4 + 3] = alpha;
		}

		return count;
	}

	function draw(count) {
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(particleProgram);
		gl.uniform2f(loc.resolution, width, height);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positions.subarray(0, count * 2), gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(loc.position);
		gl.vertexAttribPointer(loc.position, 2, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, sizes.subarray(0, count), gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(loc.size);
		gl.vertexAttribPointer(loc.size, 1, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, colors.subarray(0, count * 4), gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(loc.color);
		gl.vertexAttribPointer(loc.color, 4, gl.FLOAT, false, 0, 0);

		gl.drawArrays(gl.POINTS, 0, count);
	}

	let lastTime = performance.now();

	function frame(now) {
		resize();

		const dt = Math.min(0.033, (now - lastTime) * 0.001);
		lastTime = now;
		state.time += dt;

		spawnSparkler(dt, state.time);
		spawnSmoke(dt);
		spawnRain(dt);
		spawnSteamJets(dt, state.time);
		spawnCloudLayer(dt, state.time);
		spawnFireworks(dt, state.time, state);
		spawnMagicSpiral(dt, state.time);

		updateParticles(dt);
		const count = fillBuffers();
		draw(count);

		requestAnimationFrame(frame);
	}

	requestAnimationFrame(frame);
})();

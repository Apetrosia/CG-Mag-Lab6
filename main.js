// ============================================
// КОНФИГУРАЦИЯ ПАРАМЕТРОВ ЧАСТИЦ
// ============================================

const EFFECT_CONFIGS = {
    // Эффект 1: Бенгальский огонь (клавиша 1)
    1: {
        particleCount: 200,           // количество частиц (постоянное!)
        particleSize: 24,
        spawnRadius: 1.5,
        fallSpeed: 0.0,
        speedVariation: 0.0,
        horizontalDrift: 0.0,
        driftVariation: 0.0,
        driftFrequency: 0.0,
        useTracks: true,
        trackColorStart: [1.0, 1.0, 1.0],
        trackColorEnd: [1.0, 0.6, 0.2],
        blendMode: 'additive',
        gravity: 0.0,
        lifetime: null,
        movementType: 'radial',
        spawnArea: 'center',
        trailType: 'center',
        texture: 'beng_light.png'
    },
    
    // Эффект 2: Заготовка
    2: {
        particleCount: 100,
        particleSize: 20,
        spawnRadius: 2.0,
        fallSpeed: 0.0,
        speedVariation: 0.0,
        horizontalDrift: 0.0,
        driftVariation: 0.0,
        driftFrequency: 0.0,
        useTracks: false,
        trackColorStart: [1.0, 1.0, 1.0],
        trackColorEnd: [1.0, 1.0, 1.0],
        blendMode: 'additive',
        gravity: 0.0,
        lifetime: null,
        movementType: 'radial',
        spawnArea: 'center',
        trailType: 'none',
        texture: null
    },
    
    // Эффект 3: Дождь (клавиша 3)
    3: {
        particleCount: 300,           // количество частиц (постоянное!)
        particleSize: 18,
        spawnRadius: 8,
        fallSpeed: 0.02,              // ← МЕНЯЙТЕ ЭТО для скорости дождя!
        speedVariation: 0.008,
        horizontalDrift: 0.015,
        driftVariation: 0.005,
        driftFrequency: 0.0,
        useTracks: true,
        trackColorStart: [0.7, 0.8, 1.0],
        trackColorEnd: [0.5, 0.6, 0.95],
        blendMode: 'alpha',
        gravity: 0.0,
        lifetime: null,
        movementType: 'falling',
        spawnArea: 'top',
        trailType: 'moving',
        texture: null
    },
    
    // Эффект 4: Снег (клавиша E)
    4: {
        particleCount: 180,           // количество частиц (постоянное!)
        particleSize: 32,
        spawnRadius: 8,
        fallSpeed: 0.008,
        speedVariation: 0.003,
        horizontalDrift: 0.025,
        driftVariation: 0.01,
        driftFrequency: 1.2,
        useTracks: false,
        trackColorStart: [1.0, 1.0, 1.0],
        trackColorEnd: [1.0, 1.0, 1.0],
        blendMode: 'alpha',
        gravity: 0.0,
        lifetime: null,
        movementType: 'drifting',
        spawnArea: 'top',
        trailType: 'none',
        texture: 'snowflake.png'
    }
};

let currentEffectId = 1;

// ============================================
// УПРАВЛЕНИЕ КЛАВИШАМИ
// ============================================

const KEY_TO_EFFECT = {
    '1': 1,           // Бенгальский огонь
    '2': 2,           // Заготовка
    '3': 3,           // Дождь
    'e': 4, 'E': 4,   // Снег (английская E)
    'у': 4, 'У': 4    // Снег (русская У для удобства)
};

// ============================================
// ШЕЙДЕРЫ
// ============================================

const vertexShaderSpark = `
    attribute vec3 a_position;
    uniform mat4 u_mvMatrix;
    uniform mat4 u_pMatrix;
    uniform float u_pointSize;
    void main() {
        gl_Position = u_pMatrix * u_mvMatrix * vec4(a_position, 1.0);
        gl_PointSize = u_pointSize;
    }
`;

const fragmentShaderSpark = `
    precision mediump float;
    uniform sampler2D u_texture;
    void main() {
        gl_FragColor = texture2D(u_texture, gl_PointCoord);
    }
`;

const vertexShaderTrack = `
    attribute vec3 a_position;
    attribute vec3 a_color;
    varying vec3 v_color;
    uniform mat4 u_mvMatrix;
    uniform mat4 u_pMatrix;
    void main() {
        v_color = a_color;
        gl_Position = u_pMatrix * u_mvMatrix * vec4(a_position, 1.0);
    }
`;

const fragmentShaderTrack = `
    precision mediump float;
    varying vec3 v_color;
    void main() {
        gl_FragColor = vec4(v_color, 1.0);
    }
`;

// ============================================
// КЛАСС ЧАСТИЦЫ
// ============================================

class Spark {
    constructor(config) {
        this.config = config;
        this.active = true;  // флаг активности частицы
        this.init();
    }
    
    init() {
        this.timeFromCreation = performance.now();
        this.active = true;
        const cfg = this.config;
        
        if (cfg.movementType === 'radial') {
            // Бенгальский огонь: от центра
            const angle = Math.random() * 360;
            const angleRad = angle * Math.PI / 180;
            const radius = Math.random() * cfg.spawnRadius;
            
            this.xMax = Math.cos(angleRad) * radius;
            this.yMax = Math.sin(angleRad) * radius;
            this.zMax = (Math.random() - 0.5) * 0.5;
            
            const baseSpeed = cfg.fallSpeed !== 0 ? cfg.fallSpeed : 0.004;
            const variation = (Math.random() - 0.5) * cfg.speedVariation;
            const multiplier = 1 / (baseSpeed + variation + 0.001);
            
            this.dx = this.xMax / multiplier;
            this.dy = this.yMax / multiplier;
            this.dz = this.zMax / multiplier;
            
            const offset = Math.random() * 1000;
            this.x = (this.dx * offset) % this.xMax;
            this.y = (this.dy * offset) % this.yMax;
            this.z = (this.dz * offset) % this.zMax;
            
        } else if (cfg.movementType === 'falling' || cfg.movementType === 'drifting') {
            // Дождь/снег: спавн СВЕРХУ по всей ширине
            this.x = (Math.random() - 0.5) * cfg.spawnRadius * 2;
            this.y = 3 + Math.random() * 2;
            this.z = (Math.random() - 0.5) * 0.2;
            
            const variation = (Math.random() - 0.5) * cfg.speedVariation;
            this.dy = -cfg.fallSpeed - variation;
            
            const driftVar = (Math.random() - 0.5) * cfg.driftVariation;
            this.baseDrift = cfg.horizontalDrift + driftVar;
            
            if (cfg.driftFrequency > 0) {
                this.driftPhase = Math.random() * Math.PI * 2;
                this.driftAmp = cfg.driftFrequency;
            }
            
            this.prevX = this.x;
            this.prevY = this.y;
            this.prevZ = this.z;
        }
        
        if (cfg.lifetime) {
            this.maxLifetime = cfg.lifetime;
            this.currentLifetime = cfg.lifetime;
        } else {
            this.maxLifetime = null;
            this.currentLifetime = null;
        }
    }
    
    move(time) {
        if (!this.active) return;
        
        const timeShift = time - this.timeFromCreation;
        this.timeFromCreation = time;
        const speed = timeShift * 0.05;
        const cfg = this.config;
        
        // Сохраняем предыдущую позицию для следа
        if (cfg.trailType === 'moving') {
            this.prevX = this.x;
            this.prevY = this.y;
            this.prevZ = this.z;
        }
        
        if (cfg.movementType === 'radial') {
            this.x += this.dx * speed;
            this.y += this.dy * speed;
            this.z += this.dz * speed;
            
            if (cfg.gravity !== 0) {
                this.dy += cfg.gravity * speed * 0.01;
                this.yMax += cfg.gravity * speed * 0.01;
            }
            
            if (cfg.lifetime) {
                this.currentLifetime -= timeShift;
                if (this.currentLifetime <= 0) {
                    this.init();  // МГНОВЕННО создаём новую частицу
                    return;
                }
            }
            
            if (Math.abs(this.x) > Math.abs(this.xMax) || 
                Math.abs(this.y) > Math.abs(this.yMax) ||
                Math.abs(this.z) > Math.abs(this.zMax)) {
                this.init();  // МГНОВЕННО создаём новую частицу
            }
            
        } else if (cfg.movementType === 'falling' || cfg.movementType === 'drifting') {
            this.y += this.dy * speed;
            
            if (cfg.gravity !== 0) {
                this.dy -= cfg.gravity * speed;
            }
            
            let drift = this.baseDrift;
            if (cfg.driftFrequency > 0) {
                drift += Math.sin(time * 0.0015 * cfg.driftAmp + this.driftPhase) * cfg.horizontalDrift * 0.3;
            }
            this.x += drift * speed;
            
            if (cfg.lifetime) {
                this.currentLifetime -= timeShift;
                if (this.currentLifetime <= 0) {
                    this.init();  // МГНОВЕННО создаём новую частицу
                    return;
                }
            }
            
            // Респаун если упала НИЖЕ экрана - МГНОВЕННО создаём новую
            if (this.y < -4) {
                this.init();
            }
        }
    }
    
    getPosition() {
        return [this.x, this.y, this.z];
    }
    
    getTrackData() {
        const cfg = this.config;
        
        if (cfg.trailType === 'center') {
            return {
                start: [0, 0, 0],
                end: [this.x, this.y, this.z],
                color: cfg.trackColorEnd
            };
        } else if (cfg.trailType === 'moving') {
            return {
                start: [this.prevX, this.prevY, this.prevZ],
                end: [this.x, this.y, this.z],
                color: cfg.trackColorEnd
            };
        }
        return null;
    }
}

// ============================================
// СИСТЕМА ЧАСТИЦ
// ============================================

class ParticleSystem {
    constructor(gl, effectId) {
        this.gl = gl;
        this.effectId = effectId;
        this.config = this.getConfigForEffect(effectId);
        this.sparks = [];
        this.programs = {};
        this.locations = {};
        this.buffers = {};
        this.texture = null;
        this.textureLoaded = false;
        this.init();
    }
    
    getConfigForEffect(effectId) {
        return EFFECT_CONFIGS[effectId] || EFFECT_CONFIGS[1];
    }
    
    async init() {
        this.programs.spark = this.createProgram(vertexShaderSpark, fragmentShaderSpark);
        this.programs.track = this.createProgram(vertexShaderTrack, fragmentShaderTrack);
        this.getLocations();
        await this.createSparkTexture();
        this.createSparks();
        this.createBuffers();
    }
    
    createProgram(vertexSrc, fragmentSrc) {
        const gl = this.gl;
        const vs = this.createShader(gl.VERTEX_SHADER, vertexSrc);
        const fs = this.createShader(gl.FRAGMENT_SHADER, fragmentSrc);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Ошибка линковки:', gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }
    
    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Ошибка шейдера:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
    
    getLocations() {
        const gl = this.gl;
        gl.useProgram(this.programs.spark);
        this.locations.spark = {
            position: gl.getAttribLocation(this.programs.spark, 'a_position'),
            mvMatrix: gl.getUniformLocation(this.programs.spark, 'u_mvMatrix'),
            pMatrix: gl.getUniformLocation(this.programs.spark, 'u_pMatrix'),
            pointSize: gl.getUniformLocation(this.programs.spark, 'u_pointSize'),
            texture: gl.getUniformLocation(this.programs.spark, 'u_texture')
        };
        gl.useProgram(this.programs.track);
        this.locations.track = {
            position: gl.getAttribLocation(this.programs.track, 'a_position'),
            color: gl.getAttribLocation(this.programs.track, 'a_color'),
            mvMatrix: gl.getUniformLocation(this.programs.track, 'u_mvMatrix'),
            pMatrix: gl.getUniformLocation(this.programs.track, 'u_pMatrix')
        };
    }
    
    async createSparkTexture() {
        const gl = this.gl;
        const cfg = this.config;
        const textureName = cfg.texture;
        
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, 
                     new Uint8Array([255, 255, 255, 255]));
        
        if (!textureName) {
            this.createFallbackTexture(cfg.movementType, cfg.trailType);
            this.textureLoaded = true;
            return;
        }
        
        return new Promise((resolve) => {
            const image = new Image();
            image.src = textureName;
            image.crossOrigin = 'anonymous';
            image.onload = function() {
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                    gl.generateMipmap(gl.TEXTURE_2D);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                }
                gl.bindTexture(gl.TEXTURE_2D, null);
                this.textureLoaded = true;
                resolve();
            }.bind(this);
            image.onerror = function() {
                console.warn(`Не удалось загрузить ${textureName}`);
                this.createFallbackTexture(cfg.movementType, cfg.trailType);
                this.textureLoaded = true;
                resolve();
            }.bind(this);
        });
    }
    
    createFallbackTexture(movementType, trailType) {
        const gl = this.gl;
        const size = 64;
        const data = new Uint8Array(size * size * 4);
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - size/2, dy = y - size/2;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const idx = (y * size + x) * 4;
                
                if (movementType === 'falling' && trailType === 'moving') {
                    const elongatedDist = Math.sqrt(dx*dx + (dy*2.5)*(dy*2.5));
                    if (elongatedDist < size/2) {
                        const alpha = 1 - (elongatedDist / (size/2));
                        data[idx] = 190; data[idx+1] = 210; data[idx+2] = 255;
                        data[idx+3] = alpha * 220;
                    } else {
                        data[idx] = data[idx+1] = data[idx+2] = data[idx+3] = 0;
                    }
                } else {
                    if (dist < size/2) {
                        const alpha = 1 - (dist / (size/2));
                        const intensity = Math.pow(alpha, 0.8);
                        if (movementType === 'drifting') {
                            data[idx] = 255; data[idx+1] = 255; data[idx+2] = 255;
                        } else {
                            data[idx] = 255; data[idx+1] = 220; data[idx+2] = 150;
                        }
                        data[idx+3] = intensity * 255;
                    } else {
                        data[idx] = data[idx+1] = data[idx+2] = data[idx+3] = 0;
                    }
                }
            }
        }
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    
    createSparks() {
        this.sparks = [];
        // Создаём ФИКСИРОВАННОЕ количество частиц
        for (let i = 0; i < this.config.particleCount; i++) {
            this.sparks.push(new Spark(this.config));
        }
    }
    
    createBuffers() {
        const gl = this.gl;
        this.buffers.sparkPosition = gl.createBuffer();
        this.buffers.trackPosition = gl.createBuffer();
        this.buffers.trackColor = gl.createBuffer();
    }
    
    update(time) {
        // Обновляем ВСЕ частицы - количество всегда постоянное
        for (let i = 0; i < this.sparks.length; i++) {
            this.sparks[i].move(time);
        }
    }
    
    render(time, matrices) {
        const gl = this.gl;
        
        if (this.config.blendMode === 'additive') {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        } else {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
        
        if (this.config.useTracks && this.config.trailType !== 'none') {
            this.drawTracks(matrices);
        }
        this.drawSparks(matrices);
        
        gl.disable(gl.BLEND);
    }
    
    drawTracks(matrices) {
        const gl = this.gl;
        gl.useProgram(this.programs.track);
        
        const positions = [], colors = [];
        for (let spark of this.sparks) {
            const track = spark.getTrackData();
            if (!track) continue;
            positions.push(...track.start, ...track.end);
            colors.push(...this.config.trackColorStart, ...track.color);
        }
        if (positions.length === 0) return;
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.trackPosition);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.track.position);
        gl.vertexAttribPointer(this.locations.track.position, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.trackColor);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.track.color);
        gl.vertexAttribPointer(this.locations.track.color, 3, gl.FLOAT, false, 0, 0);
        
        gl.uniformMatrix4fv(this.locations.track.mvMatrix, false, matrices.mv);
        gl.uniformMatrix4fv(this.locations.track.pMatrix, false, matrices.p);
        gl.drawArrays(gl.LINES, 0, positions.length / 3);
    }
    
    drawSparks(matrices) {
        const gl = this.gl;
        gl.useProgram(this.programs.spark);
        
        const positions = [];
        for (let spark of this.sparks) {
            positions.push(...spark.getPosition());
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.sparkPosition);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.spark.position);
        gl.vertexAttribPointer(this.locations.spark.position, 3, gl.FLOAT, false, 0, 0);
        
        gl.uniformMatrix4fv(this.locations.spark.mvMatrix, false, matrices.mv);
        gl.uniformMatrix4fv(this.locations.spark.pMatrix, false, matrices.p);
        gl.uniform1f(this.locations.spark.pointSize, this.config.particleSize);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this.locations.spark.texture, 0);
        
        gl.drawArrays(gl.POINTS, 0, positions.length / 3);
    }
    
    reset() { 
        this.createSparks(); 
    }
    
    getParticleCount() {
        return this.sparks.length;  // Всегда возвращает фиксированное количество
    }
}

// ============================================
// ОСНОВНОЕ ПРИЛОЖЕНИЕ
// ============================================

class App {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.gl = this.canvas.getContext('webgl');
        if (!this.gl) { alert('WebGL не поддерживается!'); return; }
        this.particleSystem = null;
        this.init();
        this.setupEventListeners();
        this.render(0);
    }
    
    init() {
        this.resize();
        this.particleSystem = new ParticleSystem(this.gl, currentEffectId);
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    
    getMatrices() {
        const aspect = this.canvas.width / this.canvas.height;
        const pMatrix = this.perspectiveMatrix(45, aspect, 0.1, 100);
        const mvMatrix = this.translationMatrix(0, 0, -5);
        return { p: pMatrix, mv: mvMatrix };
    }
    
    perspectiveMatrix(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov * Math.PI / 360);
        const nf = 1 / (near - far);
        return new Float32Array([
            f/aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far+near)*nf, -1, 0, 0, (2*far*near)*nf, 0
        ]);
    }
    
    translationMatrix(x, y, z) {
        return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('keydown', (e) => {
            if (KEY_TO_EFFECT.hasOwnProperty(e.key)) {
                e.preventDefault();
                this.switchEffect(KEY_TO_EFFECT[e.key]);
            }
            if (e.key.toLowerCase() === 'r' && this.particleSystem) {
                this.particleSystem.reset();
            }
        });
    }
    
    switchEffect(effectId) {
        if (effectId === currentEffectId) return;
        currentEffectId = effectId;
        this.particleSystem = new ParticleSystem(this.gl, effectId);
    }
    
    render(time) {
        const gl = this.gl;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        if (this.particleSystem) {
            this.particleSystem.update(time);
            const matrices = this.getMatrices();
            this.particleSystem.render(time, matrices);
        }
        requestAnimationFrame((t) => this.render(t));
    }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function isPowerOf2(value) {
    return (value & (value - 1)) === 0 && value !== 0;
}

// ============================================
// ЗАПУСК
// ============================================

window.addEventListener('load', () => { new App(); });
const EFFECT_CONFIGS = {
    // Эффект 1: Бенгальский огонь (Основной)
    1: {
        particleCount: 80,            // Количество частиц (меньше = реже спавн)
        particleSize: 24,             // Размер искры в пикселях
        spawnRadius: 1.5,             // Максимальная дальность полета
        speedMultiplier: 250,         // Множитель скорости (больше = медленнее)
        speedVariation: 100,          // Разброс скорости
        useTracks: true,              // Рисовать следы (траекторию)
        trackColorStart: [1.0, 1.0, 1.0], // Цвет начала следа (белый)
        trackColorEnd: [1.0, 0.6, 0.2],   // Цвет конца следа (оранжевый)
        blendMode: 'additive',        // Режим смешивания (additive для огня)
        gravity: 0.0,                 // Гравитация
        lifetime: null                // Время жизни (null = бесконечно пока не улетит)
    },
    
    // Эффект 2: Заготовка (Медленные искры)
    2: {
        particleCount: 50,
        particleSize: 30,
        spawnRadius: 2.0,
        speedMultiplier: 400,         // Очень медленно
        speedVariation: 50,
        useTracks: true,
        trackColorStart: [0.0, 1.0, 1.0],
        trackColorEnd: [0.0, 0.5, 1.0],
        blendMode: 'additive',
        gravity: 0.1,                 // Легкая гравитация вниз
        lifetime: null
    },
    
    // Эффект 3: Заготовка (Взрыв)
    3: {
        particleCount: 150,
        particleSize: 20,
        spawnRadius: 3.0,
        speedMultiplier: 150,         // Быстро
        speedVariation: 200,
        useTracks: false,             // Без следов
        trackColorStart: [1.0, 1.0, 1.0],
        trackColorEnd: [1.0, 1.0, 1.0],
        blendMode: 'additive',
        gravity: 0.5,                 // Сильная гравитация
        lifetime: 2000                // Исчезают через 2 секунды
    }
};

// Текущий активный эффект (по умолчанию 1)
let currentEffectId = 1;

// ШЕЙДЕРЫ

// Вершинный шейдер для искр (точки)
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

// Фрагментный шейдер для искр (с текстурой)
const fragmentShaderSpark = `
    precision mediump float;
    uniform sampler2D u_texture;
    
    void main() {
        // Используем координаты точки для текстуры
        gl_FragColor = texture2D(u_texture, gl_PointCoord);
    }
`;

// Вершинный шейдер для следов (линии)
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

// Фрагментный шейдер для следов
const fragmentShaderTrack = `
    precision mediump float;
    varying vec3 v_color;
    
    void main() {
        gl_FragColor = vec4(v_color, 1.0);
    }
`;

// ============================================
// КЛАСС ЧАСТИЦЫ (ИСКРЫ)
// ============================================

class Spark {
    constructor(config) {
        this.config = config;
        this.init();
    }
    
    init() {
        // Время создания искры
        this.timeFromCreation = performance.now();
        
        // Направление полёта (0-360 градусов)
        const angle = Math.random() * 360;
        const angleRad = angle * Math.PI / 180;
        
        // Радиус - расстояние, которое пролетит искра
        const radius = Math.random() * this.config.spawnRadius;
        
        // Максимальные координаты искры (конечная точка)
        this.xMax = Math.cos(angleRad) * radius;
        this.yMax = Math.sin(angleRad) * radius;
        this.zMax = (Math.random() - 0.5) * 0.5; // Небольшое отклонение по Z для объема
        
        // Скорость (dx, dy, dz)
        // Чем больше multiplier, тем медленнее движется частица
        const multiplier = this.config.speedMultiplier + 
                          Math.random() * this.config.speedVariation;
        this.dx = this.xMax / multiplier;
        this.dy = this.yMax / multiplier;
        this.dz = this.zMax / multiplier;
        
        // Начальная позиция
        // Делаем отступ, чтобы они не все начинали строго из (0,0,0) визуально
        // Но линия следа все равно будет идти от центра (как в лекции)
        const offset = Math.random() * 1000;
        this.x = (this.dx * offset) % this.xMax;
        this.y = (this.dy * offset) % this.yMax;
        this.z = (this.dz * offset) % this.zMax;
        
        // Время жизни
        if (this.config.lifetime) {
            this.maxLifetime = this.config.lifetime;
            this.currentLifetime = this.maxLifetime;
        } else {
            this.maxLifetime = null;
            this.currentLifetime = null;
        }
    }
    
    move(time) {
        // Разница времени между кадрами (delta time)
        const timeShift = time - this.timeFromCreation;
        this.timeFromCreation = time;
        
        // Приращение зависит от времени между отрисовками
        // Коэффициент 0.05 подобран для нормализации скорости
        const speed = timeShift * 0.05; 
        
        this.x += this.dx * speed;
        this.y += this.dy * speed;
        this.z += this.dz * speed;
        
        // Применяем гравитацию если есть
        if (this.config.gravity !== 0) {
            this.dy += this.config.gravity * speed * 0.01;
            // Обновляем yMax чтобы частица не телепортировалась при ресете
            this.yMax += this.config.gravity * speed * 0.01; 
        }
        
        // Проверка времени жизни
        if (this.config.lifetime) {
            this.currentLifetime -= timeShift;
            if (this.currentLifetime <= 0) {
                this.init();
                return;
            }
        }
        
        // Если искра достигла конечной точки, перезапускаем
        // Это создает эффект постоянного спавна из центра
        if (Math.abs(this.x) > Math.abs(this.xMax) || 
            Math.abs(this.y) > Math.abs(this.yMax) ||
            Math.abs(this.z) > Math.abs(this.zMax)) {
            this.init();
        }
    }
    
    getPosition() {
        return [this.x, this.y, this.z];
    }
    
    getTrackData() {
        // Возвращает данные для следа: 
        // Начало (0,0,0) - эмиттер
        // Конец - текущая позиция
        // Это реализует траекторию от центра, как в лекции
        return {
            start: [0, 0, 0],
            end: [this.x, this.y, this.z],
            color: this.config.trackColorEnd
        };
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
        
        this.init();
    }
    
    getConfigForEffect(effectId) {
        // Возвращаем конфиг или дефолтный если нет
        return EFFECT_CONFIGS[effectId] || EFFECT_CONFIGS[1];
    }
    
    async init() {
        // Создаём шейдерные программы
        this.programs.spark = this.createProgram(
            vertexShaderSpark, 
            fragmentShaderSpark
        );
        this.programs.track = this.createProgram(
            vertexShaderTrack, 
            fragmentShaderTrack
        );
        
        // Получаем локации атрибутов и униформ
        this.getLocations();
        
        // Создаём/загружаем текстуру для искр
        await this.createSparkTexture();
        
        // Создаём частицы
        this.createSparks();
        
        // Настраиваем буферы
        this.createBuffers();
    }
    
    createProgram(vertexSrc, fragmentSrc) {
        const gl = this.gl;
        
        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSrc);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSrc);
        
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Ошибка линковки программы:', gl.getProgramInfoLog(program));
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
            console.error('Ошибка компиляции шейдера:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    getLocations() {
        const gl = this.gl;
        
        // Для искр
        gl.useProgram(this.programs.spark);
        this.locations.spark = {
            position: gl.getAttribLocation(this.programs.spark, 'a_position'),
            mvMatrix: gl.getUniformLocation(this.programs.spark, 'u_mvMatrix'),
            pMatrix: gl.getUniformLocation(this.programs.spark, 'u_pMatrix'),
            pointSize: gl.getUniformLocation(this.programs.spark, 'u_pointSize'),
            texture: gl.getUniformLocation(this.programs.spark, 'u_texture')
        };
        
        // Для следов
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
        
        // Создаём объект текстуры
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        
        // Заполняем временным пикселем, пока изображение не загрузится
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, 
                     gl.RGBA, gl.UNSIGNED_BYTE, 
                     new Uint8Array([255, 200, 100, 255]));
        
        // Загружаем внешнее изображение
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.src = 'beng_light.png';
            image.crossOrigin = 'anonymous'; // Для CORS, если нужно
            
            image.onload = function() {
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, 
                             gl.UNSIGNED_BYTE, image);
                
                // Настройка фильтров текстуры
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                
                // Генерируем мипмапы если размер текстуры — степень двойки
                if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                    gl.generateMipmap(gl.TEXTURE_2D);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                }
                
                gl.bindTexture(gl.TEXTURE_2D, null);
                resolve();
            }.bind(this);
            
            image.onerror = function() {
                console.warn('Не удалось загрузить beng_light.png, используем процедурную текстуру');
                // Создаём запасную процедурную текстуру если файл не загрузился
                this.createFallbackTexture();
                resolve();
            }.bind(this);
        });
    }
    
    createFallbackTexture() {
        // Запасная процедурная текстура на случай ошибки загрузки
        const gl = this.gl;
        const size = 64;
        const data = new Uint8Array(size * size * 4);
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - size / 2;
                const dy = y - size / 2;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const maxDist = size / 2;
                const idx = (y * size + x) * 4;
                
                if (dist < maxDist) {
                    const alpha = 1 - (dist / maxDist);
                    const intensity = Math.pow(alpha, 0.8);
                    data[idx] = 255;
                    data[idx + 1] = 220;
                    data[idx + 2] = 150;
                    data[idx + 3] = intensity * 255;
                } else {
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    data[idx + 3] = 0;
                }
            }
        }
        
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, 
                     gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    
    createSparks() {
        this.sparks = [];
        for (let i = 0; i < this.config.particleCount; i++) {
            this.sparks.push(new Spark(this.config));
        }
    }
    
    createBuffers() {
        const gl = this.gl;
        
        // Буфер для позиций искр
        this.buffers.sparkPosition = gl.createBuffer();
        
        // Буфер для позиций следов
        this.buffers.trackPosition = gl.createBuffer();
        
        // Буфер для цветов следов
        this.buffers.trackColor = gl.createBuffer();
    }
    
    update(time) {
        // Обновляем все частицы
        for (let i = 0; i < this.sparks.length; i++) {
            this.sparks[i].move(time);
        }
    }
    
    render(time, matrices) {
        const gl = this.gl;
        
        // Настраиваем смешивание цветов
        if (this.config.blendMode === 'additive') {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        } else {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
        
        // Рисуем следы (если включено)
        if (this.config.useTracks) {
            this.drawTracks(matrices);
        }
        
        // Рисуем искры
        this.drawSparks(matrices);
        
        // Отключаем смешивание
        gl.disable(gl.BLEND);
    }
    
    drawTracks(matrices) {
        const gl = this.gl;
        gl.useProgram(this.programs.track);
        
        // Собираем данные для всех следов
        const positions = [];
        const colors = [];
        
        for (let spark of this.sparks) {
            const track = spark.getTrackData();
            
            // Начало следа (эмиттер)
            positions.push(...track.start);
            colors.push(...this.config.trackColorStart);
            
            // Конец следа (частица)
            positions.push(...track.end);
            colors.push(...track.color);
        }
        
        // Буфер позиций
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.trackPosition);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.track.position);
        gl.vertexAttribPointer(this.locations.track.position, 3, gl.FLOAT, false, 0, 0);
        
        // Буфер цветов
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.trackColor);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.track.color);
        gl.vertexAttribPointer(this.locations.track.color, 3, gl.FLOAT, false, 0, 0);
        
        // Униформы
        gl.uniformMatrix4fv(this.locations.track.mvMatrix, false, matrices.mv);
        gl.uniformMatrix4fv(this.locations.track.pMatrix, false, matrices.p);
        
        // Рисуем линии
        gl.drawArrays(gl.LINES, 0, positions.length / 3);
    }
    
    drawSparks(matrices) {
        const gl = this.gl;
        gl.useProgram(this.programs.spark);
        
        // Собираем позиции всех искр
        const positions = [];
        for (let spark of this.sparks) {
            positions.push(...spark.getPosition());
        }
        
        // Буфер позиций
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.sparkPosition);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locations.spark.position);
        gl.vertexAttribPointer(this.locations.spark.position, 3, gl.FLOAT, false, 0, 0);
        
        // Униформы
        gl.uniformMatrix4fv(this.locations.spark.mvMatrix, false, matrices.mv);
        gl.uniformMatrix4fv(this.locations.spark.pMatrix, false, matrices.p);
        gl.uniform1f(this.locations.spark.pointSize, this.config.particleSize);
        
        // Текстура
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this.locations.spark.texture, 0);
        
        // Рисуем точки
        gl.drawArrays(gl.POINTS, 0, positions.length / 3);
    }
    
    reset() {
        this.createSparks();
    }
}

// ============================================
// ОСНОВНОЕ ПРИЛОЖЕНИЕ
// ============================================

class App {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.gl = this.canvas.getContext('webgl');
        
        if (!this.gl) {
            alert('WebGL не поддерживается вашим браузером!');
            return;
        }
        
        this.particleSystem = null;
        this.lastTime = 0;
        
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
        
        // Матрица проекции
        const pMatrix = this.perspectiveMatrix(45, aspect, 0.1, 100);
        
        // Матрица вида (модель-вид)
        const mvMatrix = this.translationMatrix(0, 0, -5);
        
        return { p: pMatrix, mv: mvMatrix };
    }
    
    perspectiveMatrix(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov * Math.PI / 360);
        const nf = 1 / (near - far);
        
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, (2 * far * near) * nf, 0
        ]);
    }
    
    translationMatrix(x, y, z) {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, z, 1
        ]);
    }
    
    setupEventListeners() {
        // Изменение размера окна
        window.addEventListener('resize', () => this.resize());
        
        // Клавиши 1-9 для переключения эффектов
        document.addEventListener('keydown', (e) => {
            // Проверяем цифровые клавиши (как обычные цифры, так и Numpad)
            const key = e.key;
            if (key >= '1' && key <= '9') {
                this.switchEffect(parseInt(key));
            }
            // Клавиша R для сброса
            if (key.toLowerCase() === 'r') {
                if (this.particleSystem) {
                    this.particleSystem.reset();
                }
            }
        });
    }
    
    switchEffect(effectId) {
        if (effectId === currentEffectId) return;
        
        currentEffectId = effectId;
        
        // Пересоздаём систему частиц с новым конфигом
        // Конфиг берется из EFFECT_CONFIGS внутри класса
        this.particleSystem = new ParticleSystem(this.gl, effectId);
    }
    
    render(time) {
        const gl = this.gl;
        
        // Очистка экрана (черный фон)
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Включаем глубину для корректного рендеринга
        gl.enable(gl.DEPTH_TEST);
        
        // Обновляем частицы
        if (this.particleSystem) {
            this.particleSystem.update(time);
            
            // Получаем матрицы
            const matrices = this.getMatrices();
            
            // Рендерим
            this.particleSystem.render(time, matrices);
        }
        
        // Следующий кадр
        requestAnimationFrame((t) => this.render(t));
    }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

// Проверка: является ли число степенью двойки (для мипмапов)
function isPowerOf2(value) {
    return (value & (value - 1)) === 0 && value !== 0;
}

// ============================================
// ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================

window.addEventListener('load', () => {
    new App();
});
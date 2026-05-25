// ================================================================
// KOCAELI MUHAREBESİ – GAME.JS
// Tüm oyun mantığı burada. index.html'den ayrıştırılmıştır.
// Versiyon: Deployment Ready
// ================================================================

// --- HATA YÖNETİMİ ---
function showError(msg) {
    const el = document.getElementById('error-display');
    if (el) { el.style.display = 'block'; el.innerHTML += `<div>${msg}</div>`; }
    const ls = document.getElementById('loading-screen');
    if (ls) ls.style.display = 'none';
    console.error(msg);
}
window.onerror = (m, s, l) => showError(`Hata: ${m} (Satır: ${l})`);
function log(msg) { console.log(msg); const el = document.getElementById('debug-log'); if (el) el.innerText = msg; }

// --- OYUN AYARLARI ---
const CONFIG = {
    WORLD_WIDTH: 2500, WORLD_HEIGHT: 2500,
    PLAYER_SPEED_BASE: 450, PLAYER_CAPACITY_BASE: 1,
    DOG_SPAWN_INTERVAL: 2000, MAX_DOGS: 30,
    ACTIVIST_COUNT: 5, ACTIVIST_SPEED: 100, ACTIVIST_STUN_DURATION: 2000,
    STACK_HEIGHT_OFFSET: 15, DEPOSIT_RATE: 100,
    UPGRADE_COST_SPEED: 50, UPGRADE_COST_CAPACITY: 100,
    UPGRADE_COST_CLEANER: 500, UPGRADE_COST_HELPER: 600, UPGRADE_COST_POLICE: 600,
    SAFE_ZONE_RADIUS: 400, BUILDING_BOUNDS: { x: 0, y: 0, w: 600, h: 600 },
    FOOD_EAT_TIME: 6000, CIVILIAN_EAT_TIME: 5000, HELPER_CAPACITY: 2,
    BOSS_DROPS_BASE: 30, BOSS_WAVE_DELAY: 120,
    CLEANER_SPEED_NORMAL: 80, CLEANER_SPEED_FAST: 400,
    TIMINGS: {
        MUSIC_START_TIME: 0,
        INTRUDER_1_TIME: 300, MUSIC_INTRUDER_1_TIME: 290,
        INTRUDER_2_TIME: 600, MUSIC_INTRUDER_2_TIME: 590,
        BOSS_1_WARN_TIME: 830, BOSS_1_SPAWN_TIME: 840, MUSIC_BOSS_1_TIME: 830, BOSS_1_PANDEMIC_DURATION: 60,
        BOSS_2_WARN_TIME: 1010, BOSS_2_SPAWN_TIME: 1020, MUSIC_BOSS_2_TIME: 1015, BOSS_2_PANDEMIC_DURATION: 45,
        BOSS_3_WARN_TIME: 1300, BOSS_3_SPAWN_TIME: 1310, MUSIC_BOSS_3_TIME: 1305, BOSS_3_PANDEMIC_DURATION: 30,
        VALI_WARN_DELAY: 15, VALI_SPAWN_DELAY: 20
    }
};

// --- SES YÖNETİCİSİ ---
class SoundManager {
    constructor() {
        this.bgm = null; this.cur = null; this.snd = {};
        this.mv = parseFloat(localStorage.getItem('mV')) || 0.5;
        this.sv = parseFloat(localStorage.getItem('sV')) || 0.5;
    }
    loadSounds() {
        const files = {
            'Mainmenu': 'Mainmenu.mp3', 'gamestart1': 'gamestart1.mp3', 'gamestart2': 'gamestart2.mp3',
            'intruder_vehiclewave1_1': 'intruder_vehiclewave1_1.mp3', 'intruder_vehiclewave1_2': 'intruder_vehiclewave1_2.mp3',
            'intruder_vehiclewave2_1': 'intruder_vehiclewave2_1.mp3', 'intruder_vehiclewave2_2': 'intruder_vehiclewave2_2.mp3',
            'bosswave1_1': 'bosswave1_1.mp3', 'bosswave1_2': 'bosswave1_2.mp3',
            'bosswave2_1': 'bosswave2_1.mp3', 'bosswave2_2': 'bosswave2_2.mp3',
            'bosswave3_1': 'bosswave3_1.mp3', 'vali': 'vali.mp3', 'gameover': 'gameover.mp3',
            'click': 'click.wav', 'horn': 'horn.wav', 'cash': 'cashregister.wav',
            'error': 'error.wav', 'pickup': 'item-pickup.mp3', 'money': 'Para_Kazanma.wav',
            'argue': 'Cartoon_Argue.wav',
            // FIX: Boşluklu dosya adı URL encode ile güvenli hale getirildi
            'whistle': 'police_whistle.wav'
        };
        for (const [k, p] of Object.entries(files)) {
            try { const a = new Audio(p); a.preload = 'auto'; this.snd[k] = a; } catch (e) {}
        }
    }
    setMusicVolume(v) { this.mv = v; localStorage.setItem('mV', v); if (this.bgm) this.bgm.volume = v; }
    setSfxVolume(v) { this.sv = v; localStorage.setItem('sV', v); }
    playSFX(n) {
        if (this.sv > 0.01 && this.snd[n]) {
            const c = this.snd[n].cloneNode(); c.volume = this.sv; c.play().catch(() => {});
        }
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
            const Haptics = window.Capacitor.Plugins.Haptics;
            if (n === 'click') Haptics.impact({ style: 'LIGHT' });
            else if (n === 'cash' || n === 'money' || n === 'pickup') Haptics.notification({ type: 'SUCCESS' });
            else if (n === 'error') Haptics.notification({ type: 'ERROR' });
            else if (n === 'hurt' || n === 'stun' || n === 'bark' || n === 'horn') Haptics.impact({ style: 'HEAVY' });
        }
    }
    playMusicSequence(introName, loopName) {
        if (this.mv <= 0.01) { this.cur = loopName; return; }
        if (this.cur === introName) return;
        this.stop(); this.cur = introName;
        const intro = this.snd[introName]; const loop = this.snd[loopName];
        if (!intro) return;
        intro.currentTime = 0; intro.volume = this.mv; intro.loop = false;
        if (introName === 'gamestart1' && loopName === 'gamestart1') {
            intro.loop = true; intro.play().catch(() => {}); this.bgm = intro; return;
        }
        intro.play().catch(() => {}); this.bgm = intro;
        if (loop) {
            intro.onended = () => {
                if (this.mv <= 0.01) return;
                loop.currentTime = 0; loop.volume = this.mv; loop.loop = true;
                loop.play().catch(() => {}); this.bgm = loop; this.cur = loopName;
            };
        }
    }
    playLoop(n) {
        if (this.mv <= 0.01) { this.cur = n; return; }
        if (this.cur === n && this.bgm && !this.bgm.paused) return;
        this.stop(); this.cur = n;
        const s = this.snd[n]; if (!s) return;
        s.currentTime = 0; s.loop = true; s.volume = this.mv;
        s.play().catch(() => {}); this.bgm = s;
    }
    stop() {
        if (this.bgm) { this.bgm.pause(); this.bgm.currentTime = 0; this.bgm.onended = null; this.bgm = null; }
        this.cur = null;
    }
}

// --- ASSET YÖNETİCİSİ ---
class AssetManager {
    constructor() {
        this.assets = {};
        this.toLoad = [
            { name: 'background',    src: 'background1.jpg' },
            { name: 'player',        src: 'player.webp' },
            { name: 'player1',       src: 'player1.webp' },
            { name: 'playerhappy1',  src: 'playerhappy1.webp' },
            { name: 'playerhappy2',  src: 'playerhappy2.webp' },
            { name: 'vehicle',       src: 'vehicle.webp' },
            { name: 'activist',      src: 'activist.webp' },
            { name: 'activist2',     src: 'activist2.webp' },
            { name: 'activist3',     src: 'activist3.webp' },
            { name: 'dog1',          src: 'dog1.webp' },
            { name: 'dog2',          src: 'dog2.webp' },
            { name: 'dog3',          src: 'dog3.webp' },
            { name: 'patient1',      src: 'patient1.webp' },
            { name: 'Pation1happy1', src: 'Pation1happy1.webp' },
            { name: 'Pation1happy2', src: 'Pation1happy2.webp' },
            { name: 'patient2',      src: 'patient2.webp' },
            { name: 'Pation2happy1', src: 'Pation2happy1.webp' },
            { name: 'Pation2happy2', src: 'Pation2happy2.webp' },
            { name: 'patient3',      src: 'patient3.webp' },
            { name: 'Pation3happy1', src: 'Pation3happy1.webp' },
            { name: 'Pation3happy2', src: 'Pation3happy2.webp' },
            { name: 'boot',          src: 'boot.webp' },
            { name: 'cage',          src: 'cage.webp' },
            { name: 'dogfood',       src: 'dogfood.webp' },
            { name: 'cleaner',       src: 'cleaner.webp' },
            { name: 'cleanerhappy',  src: 'cleanerhappy.webp' },
            { name: 'helper',        src: 'helper.webp' },
            { name: 'helperhappy1',  src: 'helperhappy1.webp' },
            { name: 'helperhappy2',  src: 'helperhappy2.webp' },
            { name: 'police',        src: 'police.webp' },
            { name: 'policehappy',   src: 'policehappy.webp' },
            { name: 'boss1',         src: 'boss1.webp' },
            { name: 'boss2',         src: 'boss2.webp' },
            { name: 'intruder_move', src: 'intruder_vehicle.webp' },
            { name: 'intruder_stop', src: 'intruder_vehicle1.webp' },
            { name: 'vali',          src: 'vali.webp' },
            { name: 'vali1',         src: 'vali1.webp' },
            { name: 'valihappy',     src: 'valihappy.webp' }
        ];

        this.lc = 0; this.complete = false;
    }
    loadAll(cb) {
        if (this.toLoad.length === 0) { cb(); return; }
        this.toLoad.forEach(item => {
            const img = new Image(); img.src = item.src;
            img.onload = () => { this.assets[item.name] = img; this._check(cb); };
            img.onerror = () => { log(`Yüklenemedi: ${item.src}`); this.assets[item.name] = null; this._check(cb); };
        });
    }
    _check(cb) {
        if (this.complete) return;
        this.lc++;
        const fill = document.getElementById('loading-fill');
        if (fill) fill.style.width = `${(this.lc / this.toLoad.length) * 100}%`;
        if (this.lc === this.toLoad.length) {
            this.complete = true;
            setTimeout(() => { const ls = document.getElementById('loading-screen'); if (ls) ls.style.display = 'none'; cb(); }, 200);
        }
    }
    get(n) { return this.assets[n]; }
    // FIX: src string döndüren yardımcı (ikon elementlerine atama için)
    getSrc(n) { const img = this.assets[n]; return img ? img.src : ''; }
}

// --- GİRİŞ YÖNETİCİSİ (MOBİL JOYSTICK DESTEKLİ) ---
class InputHandler {
    constructor(canvas, cam, game) {
        this.c = canvas; this.cam = cam; this.game = game || null;
        this.active = false; this.target = { x: 0, y: 0 };

        // Sanal joystick durumu
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.joystick = {
            active: false,
            originX: 0, originY: 0,   // parmağın ilk temas noktası (ekran px)
            currentX: 0, currentY: 0, // parmağın güncel konumu (ekran px)
            radius: 70,               // dış halka yarıçapı (px)
            deadzone: 12,             // ölü bölge (px)
            touchId: null
        };
        this.inputVec = { x: 0, y: 0 };

        // Fare olayları (PC)
        window.addEventListener('mousedown', ev => {
            if (ev.target !== this.c) return;
            this.active = true; this._updTarget(ev.clientX, ev.clientY);
            document.body.classList.add('clicking');
        });
        window.addEventListener('mousemove', ev => { if (this.active) this._updTarget(ev.clientX, ev.clientY); });
        window.addEventListener('mouseup',   () => { this.active = false; document.body.classList.remove('clicking'); });

        // Dokunma olayları (Mobil) – Sadece Joystick
        canvas.addEventListener('touchstart', ev => {
            ev.preventDefault();
            for (const t of ev.changedTouches) {
                // İlk parmak her yere basabilir, joystick'i başlatır
                if (this.isMobile && this.joystick.touchId === null) {
                    this.joystick.active = true;
                    this.joystick.touchId = t.identifier;
                    this.joystick.originX  = t.clientX;
                    this.joystick.originY  = t.clientY;
                    this.joystick.currentX = t.clientX;
                    this.joystick.currentY = t.clientY;
                    this.active = true;
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', ev => {
            ev.preventDefault();
            for (const t of ev.changedTouches) {
                if (t.identifier === this.joystick.touchId) {
                    this.joystick.currentX = t.clientX;
                    this.joystick.currentY = t.clientY;
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchend', ev => {
            for (const t of ev.changedTouches) {
                if (t.identifier === this.joystick.touchId) {
                    this.joystick.active = false;
                    this.joystick.touchId = null;
                    this.inputVec = { x: 0, y: 0 };
                    this.active = false;
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchcancel', () => {
            this.joystick.active = false; this.joystick.touchId = null;
            this.active = false; this.inputVec = { x: 0, y: 0 };
        });
    }

    _updTarget(x, y) {
        // Zoom varsa ekran koordinatını dünya koordinatına dönüştürürken ölçek uygula
        const z = (this.game && this.game.zoomScale) ? this.game.zoomScale : 1.0;
        this.target.x = (x / z) + this.cam.x;
        this.target.y = (y / z) + this.cam.y;
    }

    getInputVector(px, py) {
        // Mobilde sadece joystick kullanılır
        if (this.joystick.active) {
            const dx = this.joystick.currentX - this.joystick.originX;
            const dy = this.joystick.currentY - this.joystick.originY;
            const d  = Math.sqrt(dx * dx + dy * dy);
            if (d < this.joystick.deadzone) { this.inputVec = { x: 0, y: 0 }; }
            else {
                const norm = Math.min(d, this.joystick.radius);
                this.inputVec = { x: (dx / d) * (norm / this.joystick.radius), y: (dy / d) * (norm / this.joystick.radius) };
            }
            return this.inputVec;
        }
        // PC: tıkla-git (sadece masaüstünde)
        if (!this.isMobile) {
            if (!this.active) return { x: 0, y: 0 };
            const dx = this.target.x - px, dy = this.target.y - py;
            const d  = Math.sqrt(dx * dx + dy * dy);
            if (d < 10) return { x: 0, y: 0 };
            return { x: dx / d, y: dy / d };
        }
        return { x: 0, y: 0 };
    }

    // Canvas üzerine joystick çiz (loop'tan çağrılır)
    drawJoystick(ctx) {
        if (!this.joystick.active) return;
        const { originX: ox, originY: oy, currentX: cx, currentY: cy, radius: r } = this.joystick;
        const dx = cx - ox, dy = cy - oy, d = Math.sqrt(dx * dx + dy * dy);
        // Thumb topu maksimum r ile sınırla
        const clampedD = Math.min(d, r);
        const thumbX = ox + (d > 0 ? (dx / d) * clampedD : 0);
        const thumbY = oy + (d > 0 ? (dy / d) * clampedD : 0);

        ctx.save();
        // Dış halka
        ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
        ctx.fill(); ctx.stroke();
        // İç top (thumb)
        ctx.beginPath(); ctx.arc(thumbX, thumbY, r * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }
}

// --- KAMERA ---
class Camera {
    constructor(w, h) { this.x = 0; this.y = 0; this.w = w; this.h = h; }
    follow(t, ww, wh) {
        let tx = t.x - this.w / 2, ty = t.y - this.h / 2;
        tx = Math.max(0, Math.min(tx, ww - this.w));
        ty = Math.max(0, Math.min(ty, wh - this.h));
        this.x += (tx - this.x) * 0.1; this.y += (ty - this.y) * 0.1;
    }
}

// --- PARTİKÜL EFEKTİ ---
class Particle {
    constructor(x, y, t = 'dust') {
        this.x = x; this.y = y; this.type = t; this.life = 1.0;
        if (t === 'dust') {
            this.x += (Math.random() - 0.5) * 20; this.y += (Math.random() - 0.5) * 10;
            this.vx = (Math.random() - 0.5) * 30; this.vy = (Math.random() - 1) * 30;
            this.size = Math.random() * 6 + 4;
        } else {
            this.vx = (Math.random() - 0.5) * 300; this.vy = (Math.random() - 0.5) * 300;
            this.size = Math.random() * 8 + 4;
            this.color = ['#FFD700', '#FF4444', '#44FF44', '#4444FF', '#FF00FF'][Math.floor(Math.random() * 5)];
            this.life = 2.0;
        }
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt * 1.5;
        if (this.type === 'dust') this.size *= 0.95; else this.vy += 200 * dt;
    }
    draw(ctx, cam) {
        ctx.fillStyle = this.type === 'dust' ? `rgba(200,190,170,${this.life * 0.6})` : this.color;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.beginPath(); ctx.arc(this.x - cam.x, this.y - cam.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// --- TEMEL VARLIK (ENTITY) ---
class Entity {
    constructor(x, y, w, h, a) {
        this.x = x; this.y = y; this.width = w; this.height = h; this.assetName = a;
        this.markedForDeletion = false; this.z = 0; this.facingLeft = false;
        this.speechBubble = null; this.speechTimer = 0;
        this.lastX = x; this.lastY = y; this.dustTimer = 0;
        this.celebrationTarget = null; this.willTalk = false;
    }
    trackDust(particles, dt) {
        const d = Math.sqrt((this.x - this.lastX) ** 2 + (this.y - this.lastY) ** 2);
        if (d > 1) { this.dustTimer -= dt; if (this.dustTimer <= 0) { particles.push(new Particle(this.x, this.y + this.height / 4, 'dust')); this.dustTimer = 0.1 + Math.random() * 0.1; } }
        this.lastX = this.x; this.lastY = this.y;
    }
    draw(ctx, assets, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y - this.z;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath();
        if (this.assetName.includes('vehicle') || this.assetName.includes('intruder'))
            ctx.ellipse(sx, sy + 10 + this.z, this.width / 2, this.height / 6, 0, 0, Math.PI * 2);
        else ctx.ellipse(sx, sy + this.z, this.width / 2, this.height / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save(); ctx.translate(sx, sy);
        if (this.facingLeft && !this.assetName.startsWith('boss')) ctx.scale(-1, 1);
        const img = assets.get(this.assetName);
        if (img && img.width > 0) {
            if (this.isBossDog) ctx.filter = 'sepia(1) saturate(4) hue-rotate(-50deg)';
            ctx.drawImage(img, -this.width / 2, -this.height, this.width, this.height);
            ctx.filter = 'none';
        } else {
            ctx.fillStyle = this.assetName.includes('player') ? 'blue' : 'green';
            ctx.fillRect(-this.width / 2, -this.height, this.width, this.height);
        }
        ctx.restore();
        if (this.speechBubble) this._drawBubble(ctx, sx, sy);
    }
    _drawBubble(ctx, x, y) {
        const by = y - this.height - 20;
        ctx.save(); ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const pX = 20, pY = 10, tw = ctx.measureText(this.speechBubble).width;
        const bw = tw + pX * 2, bh = 30 + pY * 2, lx = x - bw / 2, ly = by - bh, r = 20;
        ctx.beginPath(); ctx.moveTo(lx + r, ly); ctx.arcTo(lx + bw, ly, lx + bw, ly + bh, r);
        ctx.arcTo(lx + bw, ly + bh, lx, ly + bh, r);
        ctx.lineTo(x + 10, ly + bh); ctx.lineTo(x, by + 10); ctx.lineTo(x - 10, ly + bh);
        ctx.arcTo(lx, ly + bh, lx, ly, r); ctx.arcTo(lx, ly, lx + bw, ly, r); ctx.closePath();
        ctx.fillStyle = '#FFF'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke();
        ctx.fillStyle = '#000'; ctx.fillText(this.speechBubble, x, ly + bh / 2); ctx.restore();
    }
    distanceTo(o) { return Math.sqrt((this.x - o.x) ** 2 + (this.y - o.y) ** 2); }
    showSpeechBubble(t, d = 2) { this.speechBubble = t; this.speechTimer = d; }
    updateSpeech(dt) { if (this.speechBubble) { this.speechTimer -= dt; if (this.speechTimer <= 0) this.speechBubble = null; } }
    moveToTarget(dt, s = 100) {
        if (!this.celebrationTarget) return false;
        const dx = this.celebrationTarget.x - this.x, dy = this.celebrationTarget.y - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 5) { this.x += (dx / d) * s * dt; this.y += (dy / d) * s * dt; this.facingLeft = dx < 0; this.z = Math.abs(Math.sin(Date.now() / 150)) * 3; return false; }
        this.x = this.celebrationTarget.x; this.y = this.celebrationTarget.y; this.z = 0; return true;
    }
}

// --- VARLIKLAR ---
class Vali extends Entity {
    constructor() { super(CONFIG.WORLD_WIDTH / 2, CONFIG.WORLD_HEIGHT + 100, 80, 145, 'vali'); this.state = 'enter'; this.speed = 120; this.target = null; }
    update(dt, acts, ww, wh) {
        this.updateSpeech(dt);
        if (this.state === 'enter') {
            const dx = ww / 2 - this.x, dy = wh / 2 - this.y, d = Math.sqrt(dx * dx + dy * dy);
            if (d > 10) { this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt; } else this.state = 'hunt';
        } else if (this.state === 'hunt') {
            if (!this.target || this.target.markedForDeletion) {
                let m = 9999; this.target = null;
                acts.forEach(a => { if (!a.markedForDeletion) { const d = this.distanceTo(a); if (d < m) { m = d; this.target = a; } } });
            }
            if (this.target) {
                const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.sqrt(dx * dx + dy * dy);
                this.facingLeft = dx < 0;
                if (d > 10) { this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt; this.assetName = 'vali1'; }
                else { this.target.markedForDeletion = true; if (this.target.type === 1) this.showSpeechBubble(Math.random() > 0.5 ? "Evinde besle" : "Barınaktan sahiplen", 2); else this.showSpeechBubble(["Kontrolsüz beslemek yasak", "Ekolojik dengeyi bozma"][Math.floor(Math.random() * 2)], 2); this.target = null; }
            } else this.assetName = 'vali';
        }
        if (this.state !== 'celebrate') this.z = this.assetName === 'vali1' ? Math.abs(Math.sin(Date.now() / 150)) * 3 : 0;
    }
}

class IntruderVehicle extends Entity {
    constructor() { super(CONFIG.WORLD_WIDTH - 200, CONFIG.WORLD_HEIGHT, 360, 240, 'intruder_move'); this.state = 'enter'; this.targetX = CONFIG.WORLD_WIDTH - 350; this.targetY = CONFIG.WORLD_HEIGHT - 600; this.exitX = CONFIG.WORLD_WIDTH - 350; this.exitY = 1; this.timer = 60.0; this.dropTimer = 0; this.speed = 150; this.facingLeft = true; }
    update(dt) {
        if (this.state === 'enter') {
            this.assetName = 'intruder_move';
            const dx = this.targetX - this.x, dy = this.targetY - this.y, d = Math.sqrt(dx * dx + dy * dy);
            this.facingLeft = dx < 0;
            if (d > 10) { this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt; } else this.state = 'dump';
        } else if (this.state === 'dump') {
            this.assetName = 'intruder_stop'; this.timer -= dt; this.dropTimer -= dt;
            if (this.dropTimer <= 0) { this.dropTimer = 1.0; return 'spawn_dog'; }
            if (this.timer <= 0) this.state = 'leave';
        } else if (this.state === 'leave') {
            this.assetName = 'intruder_move';
            const dx = this.exitX - this.x, dy = this.exitY - this.y, d = Math.sqrt(dx * dx + dy * dy);
            this.facingLeft = dx < 0; this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt;
            if (d < 20) this.markedForDeletion = true;
        }
        this.z = Math.abs(Math.sin(Date.now() / 200)) * 2;
    }
}

class Dog extends Entity {
    constructor(x, y) {
        super(x, y, 65, 65, ['dog1', 'dog2', 'dog3'][Math.floor(Math.random() * 3)]);
        this.isCollected = false; this.spawnPos = { x, y }; this.wanderTarget = { x, y };
        this.wanderTimer = 0; this.state = 'wander'; this.speed = 50; this.perceptionRadius = 300;
    }
    update(dt, foods, civs) {
        if (this.isCollected) return;
        if (this.state === 'wander') {
            let cl = null, dst = this.perceptionRadius;
            foods.forEach(f => { const d = this.distanceTo(f); if (d < dst) { dst = d; cl = f; } });
            if (cl) { this.state = 'eat'; this.targetEntity = cl; }
            else {
                const vc = civs.filter(c => this.distanceTo(c) < this.perceptionRadius);
                if (vc.length > 0) { this.state = 'chase'; this.targetEntity = vc[Math.floor(Math.random() * vc.length)]; }
                else this._wander(dt);
            }
        } else if (this.state === 'eat' || this.state === 'chase') {
            if (!this.targetEntity || this.targetEntity.markedForDeletion) { this.state = 'wander'; return; }
            const d = this.distanceTo(this.targetEntity), range = this.state === 'eat' ? 10 : 20;
            if (d > range) this._moveTo(this.targetEntity.x, this.targetEntity.y, dt);
            else if (this.state === 'eat') {
                this.eatTimer = (this.eatTimer || 0) + dt * 1000;
                if (this.eatTimer > CONFIG.FOOD_EAT_TIME) { this.eatTimer = 0; this.targetEntity.markedForDeletion = true; this.state = 'wander'; return 'multiply'; }
            }
        }
        // Bina sınır kontrolü
        if (this.x < CONFIG.BUILDING_BOUNDS.w && this.y < CONFIG.BUILDING_BOUNDS.h) {
            this.x = CONFIG.BUILDING_BOUNDS.w + 10; this.y = CONFIG.BUILDING_BOUNDS.h + 10;
        }
    }
    _wander(dt) {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            const a = Math.random() * Math.PI * 2, d = Math.random() * 100;
            this.wanderTarget = { x: this.spawnPos.x + Math.cos(a) * d, y: this.spawnPos.y + Math.sin(a) * d };
            this.wanderTimer = 2 + Math.random() * 3;
        }
        this._moveTo(this.wanderTarget.x, this.wanderTarget.y, dt);
    }
    _moveTo(tx, ty, dt) {
        const dx = tx - this.x, dy = ty - this.y, d = Math.sqrt(dx * dx + dy * dy);
        this.facingLeft = dx < 0;
        if (d > 5) { this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt; this.z = Math.abs(Math.sin(Date.now() / 200)) * 5; }
        else this.z = 0;
    }
}

class BossDog extends Dog {
    constructor(x, y) { super(x, y); this.width = 120; this.height = 120; this.speed = 225; this.isBossDog = true; this.perceptionRadius = 1500; }
    _moveTo(tx, ty, dt) {
        const s = this.state === 'chase' ? 300 : this.speed;
        const dx = tx - this.x, dy = ty - this.y, d = Math.sqrt(dx * dx + dy * dy);
        this.facingLeft = dx < 0;
        if (d > 5) { this.x += (dx / d) * s * dt; this.y += (dy / d) * s * dt; this.z = Math.abs(Math.sin(Date.now() / 200)) * 5; }
        else this.z = 0;
    }
}

class Boss extends Entity {
    constructor(x, y, dc) {
        super(x, y, 155, 204, 'boss1'); this.speed = 225; this.dropCount = 0; this.maxDrops = dc || CONFIG.BOSS_DROPS_BASE;
        this.state = 'drop'; this.vx = 0; this.vy = 0; this.changeDirTimer = 0; this.dropTimer = 0; this.speechCooldown = 1.5;
    }
    update(dt, ww, wh) {
        this.updateSpeech(dt); this.speechCooldown -= dt;
        if (this.speechCooldown <= 0) { this.showSpeechBubble("Yiğin kuzucuklarım🤑"); this.speechCooldown = 2.0; }
        if (this.state === 'leave') {
            const tx = ww + 200, dx = tx - this.x, dy = wh / 2 - this.y, d = Math.sqrt(dx * dx + dy * dy);
            this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt;
            this.assetName = dx > 0 ? 'boss1' : 'boss2'; if (d < 20) this.markedForDeletion = true; return;
        }
        this.changeDirTimer -= dt;
        if (this.changeDirTimer <= 0) { const a = Math.random() * Math.PI * 2; this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed; this.changeDirTimer = 2 + Math.random() * 2; }
        let nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        if (nx < CONFIG.BUILDING_BOUNDS.w && ny < CONFIG.BUILDING_BOUNDS.h) { this.vx *= -1; this.vy *= -1; nx = this.x; ny = this.y; }
        this.x = nx; this.y = ny;
        if (this.x < 0 || this.x > ww) this.vx *= -1;
        if (this.y < 0 || this.y > wh) this.vy *= -1;
        this.assetName = this.vx > 0 ? 'boss1' : 'boss2';
        this.z = Math.abs(Math.sin(Date.now() / 150)) * 5;
        this.dropTimer += dt;
        if (this.dropTimer > 1.0) { this.dropTimer = 0; this.dropCount++; if (this.dropCount >= this.maxDrops) this.state = 'leave'; return 'drop_boss_food'; }
    }
}

class BossFood extends Entity {
    constructor(x, y) { super(x, y, 48, 48, 'dogfood'); this.timer = 2.0; }
    update(dt) { if (this.markedForDeletion) return; this.timer -= dt; if (this.timer <= 0) { this.markedForDeletion = true; return 'spawn_boss_dog'; } }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 150, 130, 'player1'); this.speed = CONFIG.PLAYER_SPEED_BASE;
        this.maxCapacity = CONFIG.PLAYER_CAPACITY_BASE; this.stack = []; this.money = 0;
        this.isStunned = false; this.stunTimer = 0; this.animTimer = 0;
    }
    update(dt, vec, ww, wh) {
        this.updateSpeech(dt);
        if (this.isStunned) { this.stunTimer -= dt; if (this.stunTimer <= 0) this.isStunned = false; return; }
        if (vec.x !== 0 || vec.y !== 0) {
            this.assetName = 'player';
            let nx = this.x + vec.x * this.speed * dt, ny = this.y + vec.y * this.speed * dt;
            if (vec.x < 0) this.facingLeft = true; if (vec.x > 0) this.facingLeft = false;
            if (nx < CONFIG.BUILDING_BOUNDS.w && ny < CONFIG.BUILDING_BOUNDS.h) { if (this.x >= CONFIG.BUILDING_BOUNDS.w) nx = this.x; if (this.y >= CONFIG.BUILDING_BOUNDS.h) ny = this.y; }
            this.x = nx; this.y = ny; this.animTimer += dt * 10; this.z = Math.abs(Math.sin(this.animTimer)) * 5;
        } else { this.assetName = 'player1'; this.z = 0; this.animTimer = 0; }
        this.x = Math.max(32, Math.min(this.x, ww - 32)); this.y = Math.max(32, Math.min(this.y, wh - 32));
        this.stack.forEach((d, i) => { const tz = (i + 1) * CONFIG.STACK_HEIGHT_OFFSET + this.z; d.x += (this.x - d.x) * 0.2; d.y += (this.y - d.y) * 0.2; d.z += (tz - d.z) * 0.2; d.facingLeft = this.facingLeft; });
    }
    addToStack(d, sm) {
        if (d.isBossDog && this.stack.length > 0) return false;
        if (this.stack.some(x => x.isBossDog)) return false;
        if (this.stack.length < this.maxCapacity) { this.stack.push(d); d.isCollected = true; if (sm) sm.playSFX('pickup'); return true; }
        return false;
    }
    removeFromStack() { return this.stack.pop(); }
    stun() {
        if (!this.isStunned) {
            this.isStunned = true; this.stunTimer = CONFIG.ACTIVIST_STUN_DURATION / 1000;
            if (this.stack.length > 0) { const d = this.stack.pop(); d.isCollected = false; return d; }
        }
        return null;
    }
    draw(ctx, a, c) { super.draw(ctx, a, c); this.stack.forEach(d => d.draw(ctx, a, c)); }
}

class DogFood extends Entity { constructor(x, y) { super(x, y, 32, 32, 'dogfood'); } }

class Activist extends Entity {
    constructor(x, y, t) {
        let w = 125, h = 136; if (t === 2) { w = 100; }
        super(x, y, w, h, t === 2 ? 'activist2' : 'activist');
        this.type = t; this.vx = 0; this.vy = 0; this.changeDirTimer = 0; this.dropTimer = 0;
    }
    update(dt, ww, wh) {
        this.updateSpeech(dt); this.changeDirTimer -= dt;
        if (this.changeDirTimer <= 0) { const a = Math.random() * Math.PI * 2; this.vx = Math.cos(a) * CONFIG.ACTIVIST_SPEED; this.vy = Math.sin(a) * CONFIG.ACTIVIST_SPEED; this.changeDirTimer = 2 + Math.random() * 2; }
        let nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        this.facingLeft = this.vx < 0;
        if (nx < CONFIG.BUILDING_BOUNDS.w && ny < CONFIG.BUILDING_BOUNDS.h) { this.vx *= -1; this.vy *= -1; nx = this.x; ny = this.y; }
        this.x = nx; this.y = ny;
        if (this.x < 0 || this.x > ww) { this.vx *= -1; this.x = Math.max(0, Math.min(this.x, ww)); }
        if (this.y < 0 || this.y > wh) { this.vy *= -1; this.y = Math.max(0, Math.min(this.y, wh)); }
        this.z = Math.abs(Math.sin(Date.now() / 150)) * 3;
        if (this.type === 2) { this.dropTimer += dt; if (this.dropTimer > 5) { this.dropTimer = 0; return 'drop_food'; } }
    }
    triggerSpeech() { this.showSpeechBubble("Sizi şikayet edicem !!!"); }
}

class Activist3 extends Entity {
    constructor(x, y, v) { super(x, y, 95, 136, 'activist3'); this.van = v; this.state = 'sneak'; this.releaseTimer = 0; this.speed = 80; this.policeEscort = null; }
    update(dt, ww, wh) {
        this.updateSpeech(dt);
        if (this.state === 'arrested') { this.z = Math.abs(Math.sin(Date.now() / 150)) * 2; if (this.policeEscort) this.facingLeft = this.policeEscort.x < this.x; return; }
        if (this.state === 'sneak') {
            const dx = this.van.x - this.x, dy = this.van.y - this.y, d = Math.sqrt(dx * dx + dy * dy);
            this.facingLeft = dx < 0;
            if (d > 50) { this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt; this.z = Math.abs(Math.sin(Date.now() / 200)) * 2; }
            else { this.state = 'release'; this.releaseTimer = 0; }
        } else if (this.state === 'release') { this.releaseTimer += dt; if (this.releaseTimer > 1) { this.releaseTimer = 0; return 'release_dog'; } }
        else if (this.state === 'flee') {
            const dx = this.x - this.van.x, dy = this.y - this.van.y, d = Math.sqrt(dx * dx + dy * dy);
            this.facingLeft = dx < 0;
            if (d < 1000) { this.x += (dx / d) * 160 * dt; this.y += (dy / d) * 160 * dt; this.z = Math.abs(Math.sin(Date.now() / 100)) * 5; }
            else this.markedForDeletion = true;
        }
        this.x = Math.max(0, Math.min(this.x, ww)); this.y = Math.max(0, Math.min(this.y, wh));
    }
}

class Civilian extends Entity {
    constructor(x, y) {
        const v = ['patient1', 'patient2', 'patient3'][Math.floor(Math.random() * 3)];
        let w = 95, h = 136; if (v === 'patient2') { w = 70; h = 100; } else if (v === 'patient3') { w = 115; }
        super(x, y, w, h, v); this.vx = (Math.random() - 0.5) * 50; this.vy = (Math.random() - 0.5) * 50; this.cd = 0; this.eatT = 0; this.beingEaten = false;
    }
    update(dt, ww, wh, dogs) {
        let n = 999;
        dogs.forEach(d => { if (!d.isCollected) { const dist = this.distanceTo(d); if (dist < n) n = dist; } });
        if (n < 30) { this.beingEaten = true; this.eatT += dt * 1000; this.vx = (Math.random() - 0.5) * 150; this.vy = (Math.random() - 0.5) * 150; if (this.eatT > CONFIG.CIVILIAN_EAT_TIME) { this.markedForDeletion = true; return 'died'; } }
        else { this.beingEaten = false; this.eatT = 0; this.cd -= dt; if (this.cd <= 0) { const a = Math.random() * Math.PI * 2; this.vx = Math.cos(a) * 50; this.vy = Math.sin(a) * 50; this.cd = 3 + Math.random() * 3; } }
        let nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        this.facingLeft = this.vx < 0;
        if (nx < CONFIG.BUILDING_BOUNDS.w && ny < CONFIG.BUILDING_BOUNDS.h) { this.vx *= -1; this.vy *= -1; nx = this.x; ny = this.y; }
        this.x = Math.max(0, Math.min(nx, ww)); this.y = Math.max(0, Math.min(ny, wh));
        this.z = Math.abs(Math.sin(Date.now() / 200)) * 2;
    }
}

class Cleaner extends Entity {
    constructor(x, y) { super(x, y, 100, 136, 'cleaner'); this.target = null; this.speed = CONFIG.CLEANER_SPEED_NORMAL; this.busyTimer = 0; }
    update(dt, foods, bf) {
        if (this.busyTimer > 0) { this.busyTimer -= dt; this.z = 0; return; }
        if (this.target && this.target.markedForDeletion) this.target = null;
        if (!this.target) {
            let d = 9999;
            bf.forEach(f => { if (!f.markedForDeletion) { const dist = this.distanceTo(f); if (dist < d) { d = dist; this.target = f; } } });
            if (!this.target) foods.forEach(f => { if (!f.markedForDeletion) { const dist = this.distanceTo(f); if (dist < d) { d = dist; this.target = f; } } });
        }
        if (this.target) {
            this.speed = this.target instanceof BossFood ? CONFIG.CLEANER_SPEED_FAST : CONFIG.CLEANER_SPEED_NORMAL;
            const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.sqrt(dx * dx + dy * dy);
            this.facingLeft = dx < 0;
            if (d > 10) { this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt; this.z = Math.abs(Math.sin(Date.now() / 150)) * 3; }
            else { const isBF = this.target instanceof BossFood; this.target.markedForDeletion = true; this.target = null; if (isBF) this.busyTimer = 4.0; }
        } else this.z = 0;
    }
}

class Helper extends Entity {
    constructor(x, y) { super(x, y, 120, 120, 'helper'); this.speed = 250; this.stack = []; this.max = CONFIG.HELPER_CAPACITY; this.state = 'find'; this.target = null; this.van = null; }
    update(dt, dogs, v) {
        this.van = v;
        if (this.target && this.target instanceof Dog && this.target.isCollected) this.target = null;
        const full = this.stack.length >= this.max || this.stack.some(d => d.isBossDog);
        if (this.state === 'find') {
            if (full) { this.state = 'return'; this.target = this.van; }
            else if (!this.target) {
                let m = 9999;
                dogs.forEach(d => { if (!d.isCollected && (!d.isBossDog || this.stack.length === 0)) { const dist = this.distanceTo(d); if (dist < m) { m = dist; this.target = d; } } });
                if (!this.target) { this.state = 'return'; this.target = this.van; }
            }
        } else if (this.state === 'return') { if (this.stack.length === 0) { this.state = 'find'; this.target = null; } else this.target = this.van; }
        if (this.target) {
            const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.sqrt(dx * dx + dy * dy);
            this.facingLeft = dx < 0;
            if (d > 10) { this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt; this.z = Math.abs(Math.sin(Date.now() / 150)) * 5; }
            else {
                if (this.state === 'find' && this.target instanceof Dog && !this.target.isCollected) { this.stack.push(this.target); this.target.isCollected = true; this.target = null; if (this.stack.some(x => x.isBossDog)) { this.state = 'return'; this.target = this.van; } }
                else if (this.state === 'return' && this.target === this.van && this.stack.length > 0) { this.stack.pop(); return 'deposit'; }
            }
        }
        this.stack.forEach((d, i) => { const tz = (i + 1) * CONFIG.STACK_HEIGHT_OFFSET + this.z; d.x += (this.x - d.x) * 0.2; d.y += (this.y - d.y) * 0.2; d.z += (tz - d.z) * 0.2; d.facingLeft = this.facingLeft; });
    }
    draw(ctx, a, cam) { super.draw(ctx, a, cam); this.stack.forEach(d => d.draw(ctx, a, cam)); }
}

class Police extends Entity {
    constructor(x, y) { super(x, y, 90, 136, 'police'); this.speed = 170; this.state = 'patrol'; this.target = null; this.ep = { x: 0, y: 0 }; this.cd = 0; this.home = { x, y }; }
    update(dt, al, ww, wh, sm) {
        this.updateSpeech(dt);
        if (this.state === 'cooldown') { this.cd -= dt; if (this.cd <= 0) this.state = 'return'; return; }
        if (this.state === 'escort') {
            if (this.target) {
                const dx = this.ep.x - this.x, dy = this.ep.y - this.y, d = Math.sqrt(dx * dx + dy * dy);
                this.facingLeft = dx < 0; this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt;
                this.z = Math.abs(Math.sin(Date.now() / 150)) * 5;
                this.target.x = this.x + (this.facingLeft ? 40 : -40); this.target.y = this.y; this.target.z = this.z;
                if (d < 20) { this.target.markedForDeletion = true; this.target = null; this.state = 'cooldown'; this.cd = 10 + Math.random() * 5; }
            } else this.state = 'return'; return;
        }
        if (this.state === 'return') {
            const dx = this.home.x - this.x, dy = this.home.y - this.y, d = Math.sqrt(dx * dx + dy * dy);
            this.facingLeft = dx < 0;
            if (d > 10) { this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt; this.z = Math.abs(Math.sin(Date.now() / 150)) * 5; }
            else this.state = 'patrol'; return;
        }
        let m = 9999, pot = null;
        al.forEach(a => { if (!a.markedForDeletion && a.state !== 'flee' && a.state !== 'arrested') { const d = this.distanceTo(a); if (d < m) { m = d; pot = a; } } });
        this.target = pot;
        if (this.target) {
            this.state = 'chase';
            const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.sqrt(dx * dx + dy * dy);
            this.facingLeft = dx < 0;
            if (d > 30) { this.x += (dx / d) * this.speed * dt; this.y += (dy / d) * this.speed * dt; this.z = Math.abs(Math.sin(Date.now() / 150)) * 5; }
            else {
                this.state = 'escort'; this.target.state = 'arrested'; this.target.policeEscort = this;
                this.target.showSpeechBubble("Bu yasal diilll !!!", 3); if (sm) sm.playSFX('whistle');
                const dl = this.x, dr = ww - this.x, dt_ = this.y, db = wh - this.y, mm = Math.min(dl, dr, dt_, db);
                if (mm === dl) this.ep = { x: -100, y: this.y }; else if (mm === dr) this.ep = { x: ww + 100, y: this.y };
                else if (mm === dt_) this.ep = { x: this.x, y: -100 }; else this.ep = { x: this.x, y: wh + 100 };
            }
        } else { this.state = 'patrol'; this.z = 0; }
    }
}

// ================================================================
// ANA OYUN SINIFI
// ================================================================
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.assets = new AssetManager();
        this.cam = new Camera(this.canvas.width, this.canvas.height);

        // Mobil tespiti ve zoom – tek yerden yapılır
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.zoomScale = this.isMobile ? 0.65 : 1.0;

        this.input = new InputHandler(this.canvas, this.cam, this);
        this.player = new Player(CONFIG.WORLD_WIDTH / 2, CONFIG.WORLD_HEIGHT / 2);
        this.van = new Entity(CONFIG.WORLD_WIDTH / 2 - 100, CONFIG.WORLD_HEIGHT / 2 + 100, 360, 240, 'vehicle');

        this.dogs = []; this.activists = []; this.a3List = []; this.food = [];
        this.civs = []; this.cleaners = []; this.helpers = []; this.police = [];
        this.bossList = []; this.bossFood = []; this.intruderList = []; this.valiList = [];
        this.particles = [];

        this.lastTime = 0; this.spawnT = 0; this.depT = 0;
        this.capUp = 0; this.spdUp = 0; this.hlpUp = 0; this.clnUp = 0; this.a3T = 0;
        this.totalTime = 0; this.bossWave = 0; this.intruderWave = 0; this.intruderMusicWave = 0;
        this.bossActive = false; this.civsSpawnedForWave = false;
        this.bossWarned = [false, false, false]; this.bossMusicPlayed = [false, false, false];
        this.pandemicActive = false; this.pandemicTimer = 0;
        this.wave3Cleared = false; this.valiTimer = 0; this.valiAlertShown = false;
        this.valiActive = false; this.gameOver = false;
        this.celebrationActive = false; this.celebrationTimer = 25;
        this.score = 0; this.paused = false; this.playerName = "Kahraman";

        this.sm = new SoundManager();
        this.sm.loadSounds();
        this.setupCapacitor();

        this.autoSaveTimer = 0; // Otomatik kayıt sayacı (saniye)

        this.uiMoney = document.getElementById('money-val');
        this.uiScore = document.getElementById('score-val');
        this.uiCap = document.getElementById('capacity-val');

        // Restart butonu
        const rb = document.getElementById('restart-btn');
        if (rb) rb.onclick = () => location.reload();

        // Giriş & Menü DOM
        const login = document.getElementById('login-screen');
        const lBtn = document.getElementById('login-btn');
        const nameIn = document.getElementById('player-name-input');
        const switchBtn = document.getElementById('switch-user-btn');
        const welcomeMsg = document.getElementById('welcome-msg');
        const menu = document.getElementById('main-menu');
        const loading = document.getElementById('loading-screen');

        // Nasıl oynanır – slider
        const chars = [
            { images: ['background.jpg'], title: "Genel Kurallar", desc: `🐕 Topla ve Getir: Sokaktaki başıboş köpeklerin yanına giderek onları yakala ve ortadaki Minibüse götür.\n\n💰 Para Kazan: Barınağa teslim ettiğin her köpek için bütçe kazanırsın.\n\n🚑 Vatandaşı Koru: Hastalar ve yaşlılar risk altında! Saldırı olursa paran azalır.\n\n🍖 Çoğalmayı Önle: Köpeklerin çoğalmaması için kontrolsüz beslenmeyi engelle.\n\n⚠️ Tehlikeler: Aktivistler, Komşu İlçe Aracı ve Patron Köpekler.\n\n🛠️ Güçlen: Market'ten Hız, Kapasite ve Ekip Arkadaşı al.\n\n⏳ Zamana Karşı: Süre bitmeden Patron köpekleri temizlemezsen kaybedersin!\n\n🏆 Hedef: 'The Vali' şehre gelene kadar düzeni sağla!` },
            { images: ['playerhappy2.webp'], title: "Umuttepe Gladyatörü (Siz)", desc: "Elinde file, kalbinde hizmet aşkı. Tek derdi köpekleri güvenli yere götürmek ama herkes ona 'kötü adam' muamelesi yapıyor." },
            { images: ['dog1.webp', 'dog2.webp', 'dog3.webp'], title: "Kampüs Sakini", desc: "Derslerden kalan, vizelerden bunalan öğrenci dostu. Sevimlidir ama acıkınca gözü döner, 'Köfte nerede?' diye seni kovalayabilir." },
            { images: ['dog1.webp', 'dog2.webp', 'dog3.webp'], customClass: 'boss-dog-style', title: "Arnold 'Hav'zenegger", desc: "Bu köpek mama değil, protein tozuyla beslenmiş. Isırmaz, direkt kafa atar. Kaçsan iyi edersin." },
            { images: ['activist.webp'], title: "Telefonlu Teyze", desc: "Süper gücü: 7/24 canlı yayın açıp seni şikayet etmek. Yanına yaklaşırsan kulakların çınlar, seni dondurur." },
            { images: ['activist2.webp'], title: "Mama Saçan", desc: "Yere dökülen her mamanın arkasındaki isim. Doğayı sevdiğini sanır ama aslında fareleri ve haşereleri besliyordur." },
            { images: ['activist3.webp'], title: "Anarşist Karen", desc: "Minibüsüyle gizlice yanaşır, binbir emekle topladığın köpekleri geri salar. Tam bir baş belası." },
            { images: ['boss1.webp'], title: "Rant Baronu", desc: "Kaosun mimarı. Köpekler çoğaldıkça onun cebi doluyor. Uzaktan pis pis sırıtır ve sürekli mama paketleri fırlatarak ortalığı karıştırır." },
            { images: ['intruder_vehicle.webp'], title: "Beleşçi Nakliyat", desc: "'Bizim ilçede yer kalmadı, biraz da siz bakın' diyip köpekleri sizin bölgeye yıkan o hain kamyonet." },
            { images: ['patient1.webp', 'patient2.webp', 'patient3.webp'], title: "Umuttepe Yolcusu", desc: "Soğuk, yokuş ve rüzgar yetmezmiş gibi bir de köpeklerle uğraşan garibanlar. Onları koru, ısırılırlarsa tazminatı cebinden ödersin!" },
            { images: ['cleanerhappy.webp'], title: "Süpürge Reis", desc: "Gizli Kahraman. Yerdeki mamaları ışık hızıyla temizler. O olmasa ortalık mama dağından geçilmezdi." },
            { images: ['helperhappy2.webp'], title: "Kankalar", desc: "Sen yorulunca devreye giren, 'Biz hallederiz abi' diyen o güvenilir ekip. Arkanda onlar varken sırtın yere gelmez." },
            { images: ['policehappy.webp'], title: "Adalet Yumruğu", desc: "Anarşist Karen'ların korkulu rüyası. Kelepçeyi taktığı gibi paketler, geldiği yere gönderir. Huzurun teminatı." },
            { images: ['valihappy.webp'], title: "The Vali (Big Boss)", desc: "O geldiğinde akan sular durur. Köpekler hizaya girer, aktivistler buharlaşır. Oyunun nihai kurtarıcısı." }
        ];
        let curSlide = 0;
        const slideImg = document.getElementById('slide-img-container');
        const slideTit = document.getElementById('slide-title');
        const slideDesc = document.getElementById('slide-desc');
        const howTo = document.getElementById('how-to-play');

        const updSlide = (i) => {
            if (i < 0) curSlide = chars.length - 1; else if (i >= chars.length) curSlide = 0; else curSlide = i;
            const c = chars[curSlide]; slideImg.innerHTML = '';
            if (curSlide === 0) { howTo.style.backgroundImage = `url('${c.images[0]}')`; howTo.style.backgroundSize = 'cover'; howTo.style.backgroundBlendMode = 'multiply'; howTo.style.backgroundColor = 'rgba(0,0,0,0.8)'; }
            else {
                howTo.style.background = 'rgba(0,0,0,0.95)'; howTo.style.backgroundImage = 'none';
                if (c.images) c.images.forEach(src => { const img = document.createElement('img'); img.src = src; img.className = 'slide-img-item'; if (c.customClass) img.classList.add(c.customClass); slideImg.appendChild(img); });
            }
            slideTit.innerText = c.title; slideDesc.innerText = c.desc;
        };

        document.getElementById('play-btn').onclick = () => { this.sm.playSFX('click'); menu.style.display = 'none'; document.getElementById('ui-layer').style.display = 'block'; this.sm.playMusicSequence('gamestart1', 'gamestart2'); this.lastTime = performance.now(); requestAnimationFrame(t => this.loop(t)); };
        document.getElementById('load-btn').onclick = () => {
            this.sm.playSFX('click');
            this.loadGame();
            menu.style.display = 'none';
            document.getElementById('ui-layer').style.display = 'block';
            this.lastTime = performance.now();
            // Müzik: önce tamamen durdur, sonra totalTime'a göre doğru parçayı çal
            this.sm.stop();
            const T  = this.totalTime;
            const TM = CONFIG.TIMINGS;
            if      (T >= TM.MUSIC_BOSS_3_TIME)     this.sm.playLoop('vali');
            else if (T >= TM.MUSIC_BOSS_2_TIME)     this.sm.playMusicSequence('bosswave2_1',           'bosswave2_2');
            else if (T >= TM.MUSIC_BOSS_1_TIME)     this.sm.playMusicSequence('bosswave1_1',           'bosswave1_2');
            else if (T >= TM.MUSIC_INTRUDER_2_TIME) this.sm.playMusicSequence('intruder_vehiclewave2_1','intruder_vehiclewave2_2');
            else if (T >= TM.MUSIC_INTRUDER_1_TIME) this.sm.playMusicSequence('intruder_vehiclewave1_1','intruder_vehiclewave1_2');
            else                                     this.sm.playMusicSequence('gamestart1',            'gamestart2');
            requestAnimationFrame(t => this.loop(t));
        };
        document.getElementById('info-btn').onclick = () => { this.sm.playSFX('click'); howTo.style.display = 'flex'; updSlide(0); };
        document.getElementById('htp-close').onclick = () => { this.sm.playSFX('click'); howTo.style.display = 'none'; };
        document.getElementById('prev-slide').onclick = () => { this.sm.playSFX('click'); updSlide(curSlide - 1); };
        document.getElementById('next-slide').onclick = () => { this.sm.playSFX('click'); updSlide(curSlide + 1); };

        // Ayarlar
        const setModal = document.getElementById('settings-modal');
        document.getElementById('settings-menu-btn').onclick = () => { this.sm.playSFX('click'); this.openSettings(false); };
        document.getElementById('game-settings-btn').onclick = () => { this.sm.playSFX('click'); this.openSettings(true); };
        document.getElementById('settings-close').onclick = () => { this.sm.playSFX('click'); setModal.style.display = 'none'; this.paused = false; };
        document.getElementById('volume-music').oninput = e => this.sm.setMusicVolume(parseFloat(e.target.value));
        document.getElementById('volume-sfx').oninput = e => this.sm.setSfxVolume(parseFloat(e.target.value));
        const sNameIn = document.getElementById('setting-name-input');
        document.getElementById('setting-name-save').onclick = () => { const n = sNameIn.value.trim(); if (n) { this.playerName = n; localStorage.setItem('kocaeli_player_name', n); } };
        document.getElementById('ingame-save').onclick = () => { this.sm.playSFX('click'); this.saveGame(); };
        document.getElementById('ingame-restart').onclick = () => location.reload();
        document.getElementById('ingame-exit').onclick = () => location.reload();

        // Skor Tablosu
        const scoreModal = document.getElementById('scoreboard-modal');
        document.getElementById('scores-btn').onclick = () => { this.sm.playSFX('click'); this.showScores(); scoreModal.style.display = 'flex'; };
        document.getElementById('scoreboard-close').onclick = () => { this.sm.playSFX('click'); scoreModal.style.display = 'none'; };

        // Market
        const mModal = document.getElementById('market-modal');
        document.getElementById('market-btn').onclick = () => { this.sm.playSFX('click'); mModal.style.display = 'flex'; this.updUI(); };
        document.querySelector('#market-modal .modal-close').onclick = () => { this.sm.playSFX('click'); mModal.style.display = 'none'; };

        // Tam ekran
        const tFS = () => { this.sm.playSFX('click'); if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else if (document.exitFullscreen) document.exitFullscreen(); };
        document.getElementById('mm-fullscreen-btn').onclick = tFS;
        document.getElementById('ingame-fullscreen').onclick = tFS;

        // Backdrop kapat
        window.onclick = e => {
            if (e.target === mModal) mModal.style.display = 'none';
            if (e.target === setModal) { setModal.style.display = 'none'; this.paused = false; }
            if (e.target === scoreModal) scoreModal.style.display = 'none';
            if (e.target === howTo) howTo.style.display = 'none';
        };

        this.setupUI();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.assets.loadAll(() => {
            // FIX: AssetManager img elementinden src al
            document.getElementById('icon-speed').src    = this.assets.getSrc('boot');
            document.getElementById('icon-capacity').src = this.assets.getSrc('cage');
            document.getElementById('icon-cleaner').src  = this.assets.getSrc('cleaner');
            document.getElementById('icon-helper').src   = this.assets.getSrc('helper');
            document.getElementById('icon-police').src   = this.assets.getSrc('police');
            document.getElementById('hud-capacity-icon').src = this.assets.getSrc('cage');

            this.initWorld();
            loading.style.display = 'none';

            // Kayıtlı oyuncu kontrolü
            const savedName = localStorage.getItem('kocaeli_player_name');
            if (savedName) {
                nameIn.style.display = 'none';
                welcomeMsg.innerText = `Hoşgeldin, ${savedName}!`; welcomeMsg.style.display = 'block';
                lBtn.innerText = "DEVAM ET"; switchBtn.style.display = 'block';
                this.playerName = savedName;
            } else {
                nameIn.style.display = 'block'; welcomeMsg.style.display = 'none';
                lBtn.innerText = "GİRİŞ"; switchBtn.style.display = 'none';
            }
            login.style.display = 'flex';

            switchBtn.onclick = () => { localStorage.removeItem('kocaeli_player_name'); nameIn.value = ''; nameIn.style.display = 'block'; welcomeMsg.style.display = 'none'; lBtn.innerText = "GİRİŞ"; switchBtn.style.display = 'none'; };
            lBtn.onclick = () => {
                if (nameIn.style.display !== 'none') { const n = nameIn.value.trim(); this.playerName = n || "Kahraman"; localStorage.setItem('kocaeli_player_name', this.playerName); }
                sNameIn.value = this.playerName;
                this.sm.playLoop('Mainmenu');
                login.style.display = 'none'; menu.style.display = 'flex';
            };
        });
    }

    async setupCapacitor() {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ScreenOrientation) {
            try { await window.Capacitor.Plugins.ScreenOrientation.lock({ orientation: 'landscape' }); } catch(e) {}
        }
    }

    showScores() {
        const sc = JSON.parse(localStorage.getItem('kocaeli_scores')) || [];
        const tb = document.getElementById('score-table-body');
        tb.innerHTML = '<tr><th>Sıra</th><th>İsim</th><th>Skor</th><th>Tarih</th></tr>';
        if (sc.length === 0) { tb.innerHTML += '<tr><td colspan="4">Henüz kayıt yok...</td></tr>'; return; }
        sc.sort((a, b) => b.score - a.score).slice(0, 10).forEach((s, i) => {
            tb.innerHTML += `<tr><td>${i + 1}</td><td>${s.name || '?'}</td><td>${s.score}</td><td>${s.date}</td></tr>`;
        });
    }

    openSettings(ingame) {
        const m = document.getElementById('settings-modal');
        const c = document.getElementById('ingame-settings-controls');
        document.getElementById('setting-name-input').value = this.playerName;
        m.style.display = 'flex';
        if (ingame) { this.paused = true; c.style.display = 'flex'; } else c.style.display = 'none';
    }

    setupUI() {
        const buy = (cost, action) => {
            if (this.player.money >= cost) { this.player.money -= cost; action(); this.sm.playSFX('cash'); this.saveGame(); this.updUI(); return true; }
            this.sm.playSFX('error'); return false;
        };
        document.getElementById('btn-speed').onclick    = () => buy(CONFIG.UPGRADE_COST_SPEED,    () => { this.player.speed++;          CONFIG.UPGRADE_COST_SPEED    = Math.floor(CONFIG.UPGRADE_COST_SPEED    * 1.5); this.spdUp++; this.player.speed += 49; });
        document.getElementById('btn-capacity').onclick = () => buy(CONFIG.UPGRADE_COST_CAPACITY, () => { this.player.maxCapacity++;    CONFIG.UPGRADE_COST_CAPACITY = Math.floor(CONFIG.UPGRADE_COST_CAPACITY * 1.5); this.capUp++; });
        document.getElementById('btn-cleaner').onclick  = () => buy(CONFIG.UPGRADE_COST_CLEANER,  () => { this.cleaners.push(new Cleaner(CONFIG.WORLD_WIDTH/2, CONFIG.WORLD_HEIGHT/2)); CONFIG.UPGRADE_COST_CLEANER  = Math.floor(CONFIG.UPGRADE_COST_CLEANER  * 1.5); this.clnUp++; });
        document.getElementById('btn-helper').onclick   = () => buy(CONFIG.UPGRADE_COST_HELPER,   () => { this.helpers.push(new Helper(CONFIG.WORLD_WIDTH/2, CONFIG.WORLD_HEIGHT/2));   CONFIG.UPGRADE_COST_HELPER   = Math.floor(CONFIG.UPGRADE_COST_HELPER   * 1.5); this.hlpUp++; CONFIG.DOG_SPAWN_INTERVAL *= 0.8; });
        document.getElementById('btn-police').onclick   = () => buy(CONFIG.UPGRADE_COST_POLICE,   () => { this.police.push(new Police(CONFIG.WORLD_WIDTH/2, CONFIG.WORLD_HEIGHT/2));   CONFIG.UPGRADE_COST_POLICE   = Math.floor(CONFIG.UPGRADE_COST_POLICE   * 1.5); });
    }

    updUI() {
        ['speed', 'capacity', 'cleaner', 'helper', 'police'].forEach(k => {
            const key = `UPGRADE_COST_${k.toUpperCase()}`;
            document.getElementById(`price-${k}`).innerText = `₺${CONFIG[key]}`;
            const btn = document.getElementById(`btn-${k}`);
            if (this.player.money < CONFIG[key]) btn.classList.add('disabled'); else btn.classList.remove('disabled');
        });
        if (this.uiMoney) this.uiMoney.innerText = this.player.money;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.cam) { this.cam.w = this.canvas.width; this.cam.h = this.canvas.height; }
        // Mobil zoom güncelle: canvas boyutu değişince efektif kamera alanını güncelle
        if (this.isMobile) {
            this.cam.w = this.canvas.width / this.zoomScale;
            this.cam.h = this.canvas.height / this.zoomScale;
        }
    }

    initWorld() {
        for (let i = 0; i < CONFIG.ACTIVIST_COUNT; i++) this.spawnActivist(i % 2 === 0 ? 1 : 2);
        for (let i = 0; i < 10; i++) this.spawnDog();
        for (let i = 0; i < 5; i++) this.spawnCiv();
    }

    saveGame() {
        const d = {
            money: this.player.money, score: this.score,
            spdUp: this.spdUp, capUp: this.capUp, clnUp: this.clnUp, hlpUp: this.hlpUp, polUp: this.police.length,
            playerState: { x: this.player.x, y: this.player.y, stack: this.player.stack.map(s => ({ isBossDog: s.isBossDog })) },
            totalTime: this.totalTime,
            bossWave: this.bossWave, intruderWave: this.intruderWave, intruderMusicWave: this.intruderMusicWave,
            bossWarned: this.bossWarned, bossMusicPlayed: this.bossMusicPlayed,
            bossActive: this.bossActive, civsSpawnedForWave: this.civsSpawnedForWave,
            pandemicActive: this.pandemicActive, pandemicTimer: this.pandemicTimer,
            wave3Cleared: this.wave3Cleared, valiTimer: this.valiTimer, valiAlertShown: this.valiAlertShown, valiActive: this.valiActive,
            dogs: this.dogs.filter(x => !x.isCollected).map(x => ({ x: x.x, y: x.y, isBossDog: x.isBossDog })),
            activists: this.activists.map(x => ({ x: x.x, y: x.y, type: x.type })),
            a3List: this.a3List.map(x => ({ x: x.x, y: x.y, state: x.state })),
            food: this.food.map(x => ({ x: x.x, y: x.y })),
            civs: this.civs.map(x => ({ x: x.x, y: x.y, assetName: x.assetName })),
            bossList: this.bossList.map(x => ({ x: x.x, y: x.y, maxDrops: x.maxDrops, dropCount: x.dropCount, state: x.state })),
            bossFood: this.bossFood.map(x => ({ x: x.x, y: x.y, timer: x.timer })),
            intruderList: this.intruderList.map(x => ({ x: x.x, y: x.y, state: x.state, timer: x.timer, dropTimer: x.dropTimer })),
            valiList: this.valiList.map(x => ({ x: x.x, y: x.y, state: x.state }))
        };
        localStorage.setItem('kocaeli_save', JSON.stringify(d));
    }

    loadGame() {
        const s = localStorage.getItem('kocaeli_save'); if (!s) return;
        const d = JSON.parse(s);
        
        this.player.money = d.money || 0; this.score = d.score || 0;
        this.spdUp = d.spdUp || 0; this.capUp = d.capUp || 0; this.clnUp = d.clnUp || 0; this.hlpUp = d.hlpUp || 0;
        const pc = d.polUp || 0;
        
        for (let i = 0; i < this.spdUp; i++) { this.player.speed += 50; CONFIG.UPGRADE_COST_SPEED = Math.floor(CONFIG.UPGRADE_COST_SPEED * 1.5); }
        for (let i = 0; i < this.capUp; i++) { this.player.maxCapacity++; CONFIG.UPGRADE_COST_CAPACITY = Math.floor(CONFIG.UPGRADE_COST_CAPACITY * 1.5); }
        for (let i = 0; i < this.clnUp; i++) { this.cleaners.push(new Cleaner(CONFIG.WORLD_WIDTH / 2, CONFIG.WORLD_HEIGHT / 2)); CONFIG.UPGRADE_COST_CLEANER = Math.floor(CONFIG.UPGRADE_COST_CLEANER * 1.5); }
        for (let i = 0; i < this.hlpUp; i++) { this.helpers.push(new Helper(CONFIG.WORLD_WIDTH / 2, CONFIG.WORLD_HEIGHT / 2)); CONFIG.UPGRADE_COST_HELPER = Math.floor(CONFIG.UPGRADE_COST_HELPER * 1.5); CONFIG.DOG_SPAWN_INTERVAL *= 0.8; }
        for (let i = 0; i < pc; i++) { this.police.push(new Police(CONFIG.WORLD_WIDTH / 2, CONFIG.WORLD_HEIGHT / 2)); CONFIG.UPGRADE_COST_POLICE = Math.floor(CONFIG.UPGRADE_COST_POLICE * 1.5); }
        this.updUI();

        if (d.totalTime !== undefined) {
            this.totalTime = d.totalTime;
            this.bossWave = d.bossWave || 0; this.intruderWave = d.intruderWave || 0; this.intruderMusicWave = d.intruderMusicWave || 0;
            this.bossWarned = d.bossWarned || [false,false,false]; this.bossMusicPlayed = d.bossMusicPlayed || [false,false,false];
            this.bossActive = d.bossActive || false; this.civsSpawnedForWave = d.civsSpawnedForWave || false;
            this.pandemicActive = d.pandemicActive || false; this.pandemicTimer = d.pandemicTimer || 0;
            this.wave3Cleared = d.wave3Cleared || false; this.valiTimer = d.valiTimer || 0; this.valiAlertShown = d.valiAlertShown || false; this.valiActive = d.valiActive || false;
            
            if (d.playerState) {
                this.player.x = d.playerState.x; this.player.y = d.playerState.y;
                this.player.stack = [];
                d.playerState.stack.forEach(st => {
                    const nd = st.isBossDog ? new BossDog(this.player.x, this.player.y) : new Dog(this.player.x, this.player.y);
                    nd.isCollected = true; this.player.stack.push(nd);
                });
            }
            
            this.dogs = []; this.activists = []; this.a3List = []; this.food = [];
            this.civs = []; this.bossList = []; this.bossFood = []; this.intruderList = []; this.valiList = [];
            
            if (d.dogs) d.dogs.forEach(x => { const nd = x.isBossDog ? new BossDog(x.x, x.y) : new Dog(x.x, x.y); this.dogs.push(nd); });
            if (d.activists) d.activists.forEach(x => this.activists.push(new Activist(x.x, x.y, x.type)));
            if (d.a3List) d.a3List.forEach(x => { const na = new Activist3(x.x, x.y, this.van); na.state = x.state; this.a3List.push(na); });
            if (d.food) d.food.forEach(x => this.food.push(new DogFood(x.x, x.y)));
            if (d.civs) d.civs.forEach(x => { const nc = new Civilian(x.x, x.y); nc.assetName = x.assetName; this.civs.push(nc); });
            if (d.bossList) d.bossList.forEach(x => { const nb = new Boss(x.x, x.y, x.maxDrops); nb.dropCount = x.dropCount; nb.state = x.state; this.bossList.push(nb); });
            if (d.bossFood) d.bossFood.forEach(x => { const nf = new BossFood(x.x, x.y); nf.timer = x.timer; this.bossFood.push(nf); });
            if (d.intruderList) d.intruderList.forEach(x => { const ni = new IntruderVehicle(); ni.x = x.x; ni.y = x.y; ni.state = x.state; ni.timer = x.timer; ni.dropTimer = x.dropTimer; this.intruderList.push(ni); });
            if (d.valiList) d.valiList.forEach(x => { const nv = new Vali(); nv.x = x.x; nv.y = x.y; nv.state = x.state; this.valiList.push(nv); });
            
            const h = document.getElementById('pandemic-hud');
            if (this.pandemicActive && h) h.style.display = 'block';
        }
    }

    saveHighScore() {
        let s = JSON.parse(localStorage.getItem('kocaeli_scores')) || [];
        s.push({ name: this.playerName, date: new Date().toLocaleDateString('tr-TR'), score: this.score });
        s.sort((a, b) => b.score - a.score);
        localStorage.setItem('kocaeli_scores', JSON.stringify(s.slice(0, 10)));
    }

    spawnActivist(t) {
        let x, y, d;
        do { x = Math.random() * CONFIG.WORLD_WIDTH; y = Math.random() * CONFIG.WORLD_HEIGHT; const dx = x - CONFIG.WORLD_WIDTH / 2, dy = y - CONFIG.WORLD_HEIGHT / 2; d = Math.sqrt(dx * dx + dy * dy); }
        while (d < CONFIG.SAFE_ZONE_RADIUS || (x < CONFIG.BUILDING_BOUNDS.w && y < CONFIG.BUILDING_BOUNDS.h));
        this.activists.push(new Activist(x, y, t));
    }

    spawnA3() { const a = Math.random() * Math.PI * 2; this.a3List.push(new Activist3(CONFIG.WORLD_WIDTH / 2 + Math.cos(a) * 800, CONFIG.WORLD_HEIGHT / 2 + Math.sin(a) * 800, this.van)); }

    spawnBoss(dc) {
        const a = Math.random() * Math.PI * 2;
        this.bossList.push(new Boss(CONFIG.WORLD_WIDTH / 2 + Math.cos(a) * 800, CONFIG.WORLD_HEIGHT / 2 + Math.sin(a) * 800, dc));
        const ab = document.getElementById('boss-alert');
        if (ab) { ab.innerText = `Patron Geliyor !!! ${this.bossWave}. Dalga`; ab.style.display = 'block'; setTimeout(() => ab.style.display = 'none', 4000); }
    }

    spawnIntruder() {
        this.sm.playSFX('horn'); this.intruderList.push(new IntruderVehicle());
        const ab = document.getElementById('boss-alert');
        if (ab) { ab.innerText = "Komşu İlçe Aracı Geldi!"; ab.style.display = 'block'; setTimeout(() => ab.style.display = 'none', 4000); }
    }

    spawnVali() { this.valiList.push(new Vali()); this.valiActive = true; }

    // FIX: x=null bug → validPos flag
    spawnDog(x, y) {
        if (this.valiActive && this.activists.filter(a => a.type === 2).length === 0) return;
        if (this.dogs.length >= CONFIG.MAX_DOGS) return;
        if (x === undefined) {
            let validPos = false, attempts = 0;
            while (!validPos && attempts < 100) {
                x = Math.random() * CONFIG.WORLD_WIDTH; y = Math.random() * CONFIG.WORLD_HEIGHT;
                const dx = x - CONFIG.WORLD_WIDTH / 2, dy = y - CONFIG.WORLD_HEIGHT / 2;
                if (Math.sqrt(dx * dx + dy * dy) >= CONFIG.SAFE_ZONE_RADIUS && !(x < CONFIG.BUILDING_BOUNDS.w && y < CONFIG.BUILDING_BOUNDS.h)) validPos = true;
                attempts++;
            }
            if (!validPos) return;
        }
        this.dogs.push(new Dog(x, y));
    }

    spawnCiv() {
        let x, y;
        do { x = Math.random() * CONFIG.WORLD_WIDTH; y = Math.random() * CONFIG.WORLD_HEIGHT; }
        while (x < CONFIG.BUILDING_BOUNDS.w && y < CONFIG.BUILDING_BOUNDS.h);
        this.civs.push(new Civilian(x, y));
    }

    triggerGameOver() {
        this.gameOver = true; this.saveHighScore(); this.sm.playLoop('gameover');
        const el = document.getElementById('game-screen-overlay');
        if (el) { el.style.display = 'flex'; el.style.background = 'rgba(180,0,0,0.8)'; document.getElementById('overlay-title').innerHTML = `Kuduz Salgını Başladı<br>Oyunu Kaybettiniz!<br><small>Skor: ${this.score}</small>`; }
    }

    triggerWin() {
        this.gameOver = true; this.saveHighScore();
        const el = document.getElementById('game-screen-overlay');
        if (el) { el.style.display = 'flex'; el.style.background = 'rgba(0,180,0,0.8)'; document.getElementById('overlay-title').innerHTML = `Tebrikler!<br>Kocaeli Halkını Kurtardınız!!!<br><small>Skor: ${this.score}</small>`; }
    }

    startPandemic() {
        this.pandemicActive = true;
        if (this.bossWave === 1) this.pandemicTimer = CONFIG.TIMINGS.BOSS_1_PANDEMIC_DURATION; 
        else if (this.bossWave === 2) this.pandemicTimer = CONFIG.TIMINGS.BOSS_2_PANDEMIC_DURATION; 
        else this.pandemicTimer = CONFIG.TIMINGS.BOSS_3_PANDEMIC_DURATION;
        const h = document.getElementById('pandemic-hud'); if (h) h.style.display = 'block';
    }

    startCelebration() {
        this.celebrationActive = true; this.dogs = []; this.activists = []; this.food = [];
        // Celebration'da market butonunu gizle
        const mb = document.getElementById('market-btn'); if (mb) mb.style.display = 'none';
        const cx = CONFIG.WORLD_WIDTH / 2, cy = CONFIG.WORLD_HEIGHT / 2, vanY = this.van.y, civY = vanY + 150;
        this.civs.forEach((c, i) => {
            c.celebrationTarget = { x: cx + (i - this.civs.length / 2) * 80, y: civY };
            if (c.assetName.includes('patient1')) c.happyAsset = 'Pation1happy1'; else if (c.assetName.includes('patient2')) c.happyAsset = 'Pation2happy1'; else c.happyAsset = 'Pation3happy1';
            c.idleAsset = c.happyAsset.replace('1', '2'); c.willTalk = Math.random() < 0.5;
        });
        const staffY = civY + 120;
        [...this.police, ...this.cleaners, ...this.helpers].forEach((s, i) => {
            s.celebrationTarget = { x: cx + (i - (this.police.length + this.cleaners.length + this.helpers.length) / 2) * 90, y: staffY };
            if (s instanceof Police) { s.happyAsset = 'policehappy'; s.idleAsset = 'policehappy'; }
            else if (s instanceof Cleaner) { s.happyAsset = 'cleanerhappy'; s.idleAsset = 'cleanerhappy'; }
            else if (s instanceof Helper) { s.happyAsset = 'helperhappy1'; s.idleAsset = 'helperhappy2'; }
            s.willTalk = Math.random() < 0.5;
        });
        const heroY = staffY + 120;
        if (this.valiList.length > 0) { this.valiList[0].celebrationTarget = { x: cx - 60, y: heroY }; this.valiList[0].happyAsset = 'vali1'; this.valiList[0].idleAsset = 'valihappy'; }
        this.player.celebrationTarget = { x: cx + 60, y: heroY }; this.player.happyAsset = 'playerhappy1'; this.player.idleAsset = 'playerhappy2';
    }

    loop(t) {
        try {
            if (this.gameOver) return;
            // FIX: Paused desteği (ayarlar açıkken oyun durur)
            if (this.paused) { this.lastTime = t; requestAnimationFrame(t => this.loop(t)); return; }
            // FIX: Delta time sınırı 0.033 (sekme arka planda sıçrama engeli)
            const dt = Math.min((t - this.lastTime) / 1000, 0.033);
            this.lastTime = t;

            if (this.celebrationActive) {
                this.cam.follow({ x: CONFIG.WORLD_WIDTH / 2, y: CONFIG.WORLD_HEIGHT / 2 }, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
                [...this.civs, ...this.police, ...this.cleaners, ...this.helpers, ...this.valiList, this.player].forEach(e => {
                    e.updateSpeech(dt);
                    if (e.celebrationTarget) {
                        if (e.moveToTarget(dt)) { e.assetName = e.idleAsset || e.happyAsset; if (!e.speechBubble) { if (e instanceof Vali) e.showSpeechBubble("🏅", 5); else if (e instanceof Player) e.showSpeechBubble("Çalışınca oluyor", 5); else if (e.willTalk) e.showSpeechBubble("😊", 2); } }
                        else e.assetName = e.happyAsset;
                    }
                });
                if (Math.random() < 0.3) this.particles.push(new Particle(CONFIG.WORLD_WIDTH / 2 + (Math.random() - 0.5) * 800, CONFIG.WORLD_HEIGHT / 2 + (Math.random() - 0.5) * 600, 'spark'));
                this.celebrationTimer -= dt; if (this.celebrationTimer <= 0) this.triggerWin();
            } else {
                // Köpek spawn
                this.spawnT += dt * 1000; if (this.spawnT > CONFIG.DOG_SPAWN_INTERVAL) { this.spawnDog(); this.spawnT = 0; }
                // Activist3 spawn
                if (this.capUp >= 2) { this.a3T -= dt; if (this.a3T <= 0 && !this.valiActive) { this.spawnA3(); this.a3T = 10 + Math.random() * 10; } }

                this.totalTime += dt;

                // Otomatik kayıt (her 30 saniyede bir)
                this.autoSaveTimer += dt;
                if (this.autoSaveTimer >= 30) { this.saveGame(); this.autoSaveTimer = 0; }

                // İstilacı araç
                if (this.totalTime >= CONFIG.TIMINGS.MUSIC_INTRUDER_1_TIME && this.intruderMusicWave < 1) { this.sm.playMusicSequence('intruder_vehiclewave1_1', 'intruder_vehiclewave1_2'); this.intruderMusicWave = 1; }
                if (this.totalTime >= CONFIG.TIMINGS.INTRUDER_1_TIME && this.intruderWave < 1) { this.spawnIntruder(); this.intruderWave = 1; }
                if (this.totalTime >= CONFIG.TIMINGS.MUSIC_INTRUDER_2_TIME && this.intruderMusicWave < 2) { this.sm.playMusicSequence('intruder_vehiclewave2_1', 'intruder_vehiclewave2_2'); this.intruderMusicWave = 2; }
                if (this.totalTime >= CONFIG.TIMINGS.INTRUDER_2_TIME && this.intruderWave < 2) { this.spawnIntruder(); this.intruderWave = 2; }

                // Boss dalgaları
                if (this.bossWave < 1) {
                    if (this.totalTime >= CONFIG.TIMINGS.BOSS_1_WARN_TIME && !this.bossWarned[0]) { for (let i = 0; i < 10; i++) this.spawnCiv(); document.getElementById('boss-alert').style.display = 'block'; setTimeout(() => document.getElementById('boss-alert').style.display = 'none', 3000); this.bossWarned[0] = true; }
                    if (this.totalTime >= CONFIG.TIMINGS.MUSIC_BOSS_1_TIME && !this.bossMusicPlayed[0]) { this.sm.playMusicSequence('bosswave1_1', 'bosswave1_2'); this.bossMusicPlayed[0] = true; }
                    if (this.totalTime >= CONFIG.TIMINGS.BOSS_1_SPAWN_TIME) { this.bossWave = 1; this.spawnBoss(CONFIG.BOSS_DROPS_BASE); this.bossActive = true; }
                } else if (this.bossWave < 2) {
                    if (this.totalTime >= CONFIG.TIMINGS.BOSS_2_WARN_TIME && !this.bossWarned[1]) { for (let i = 0; i < 10; i++) this.spawnCiv(); document.getElementById('boss-alert').style.display = 'block'; setTimeout(() => document.getElementById('boss-alert').style.display = 'none', 3000); this.bossWarned[1] = true; }
                    if (this.totalTime >= CONFIG.TIMINGS.MUSIC_BOSS_2_TIME && !this.bossMusicPlayed[1]) { this.sm.playMusicSequence('bosswave2_1', 'bosswave2_2'); this.bossMusicPlayed[1] = true; }
                    if (this.totalTime >= CONFIG.TIMINGS.BOSS_2_SPAWN_TIME) { this.bossWave = 2; this.spawnBoss(Math.floor(CONFIG.BOSS_DROPS_BASE * 1.5)); this.bossActive = true; }
                } else if (this.bossWave < 3) {
                    if (this.totalTime >= CONFIG.TIMINGS.BOSS_3_WARN_TIME && !this.bossWarned[2]) { for (let i = 0; i < 10; i++) this.spawnCiv(); document.getElementById('boss-alert').style.display = 'block'; setTimeout(() => document.getElementById('boss-alert').style.display = 'none', 3000); this.bossWarned[2] = true; }
                    if (this.totalTime >= CONFIG.TIMINGS.MUSIC_BOSS_3_TIME && !this.bossMusicPlayed[2]) { this.sm.playMusicSequence('bosswave3_1', 'vali'); this.bossMusicPlayed[2] = true; }
                    if (this.totalTime >= CONFIG.TIMINGS.BOSS_3_SPAWN_TIME) { this.bossWave = 3; this.spawnBoss(Math.floor(CONFIG.BOSS_DROPS_BASE * 2.25)); this.bossActive = true; }
                }

                if (this.bossActive && this.bossList.length === 0) { this.bossActive = false; this.score += this.civs.length * 20; this.startPandemic(); }

                // Salgın
                if (this.pandemicActive) {
                    this.pandemicTimer -= dt;
                    const bdc = this.dogs.filter(d => d.isBossDog && !d.isCollected).length + this.bossFood.length;
                    const h = document.getElementById('pandemic-hud');
                    if (h && h.style.display !== 'none') h.innerHTML = `SALGIN TEHLİKESİ<br>Süre: ${Math.ceil(this.pandemicTimer)}s | Patron Köpek: ${bdc}`;
                    if (this.pandemicTimer <= 0) { this.triggerGameOver(); return; }
                    if (bdc === 0) { this.pandemicActive = false; if (h) h.style.display = 'none'; if (this.bossWave === 3) { this.wave3Cleared = true; this.valiTimer = 0; } }
                }

                // Vali
                if (this.wave3Cleared && !this.valiActive) {
                    this.valiTimer += dt;
                    if (this.valiTimer > CONFIG.TIMINGS.VALI_WARN_DELAY && !this.valiAlertShown) { document.getElementById('boss-alert').innerText = "The Vali Geliyor"; document.getElementById('boss-alert').style.display = 'block'; setTimeout(() => document.getElementById('boss-alert').style.display = 'none', 3000); this.valiAlertShown = true; }
                    if (this.valiTimer > CONFIG.TIMINGS.VALI_SPAWN_DELAY) this.spawnVali();
                }
                if (this.valiActive && this.activists.filter(a => a.type === 2).length === 0 && !this.celebrationActive) this.startCelebration();

                // Güncelle
                const v = this.input.getInputVector(this.player.x, this.player.y);
                this.player.update(dt, v, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
                this.cam.follow(this.player, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
                this.activists.forEach(a => { if (a.update(dt, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT) === 'drop_food') this.food.push(new DogFood(a.x, a.y)); });
                for (let i = this.a3List.length - 1; i >= 0; i--) { const a = this.a3List[i]; if (a.update(dt, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT) === 'release_dog') { this.spawnDog(this.van.x, this.van.y); this.player.money = Math.max(0, this.player.money - 10); } if (a.markedForDeletion) this.a3List.splice(i, 1); }
                this.bossList.forEach(b => { if (b.update(dt, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT) === 'drop_boss_food') this.bossFood.push(new BossFood(b.x + (Math.random() - 0.5) * 200, b.y + (Math.random() - 0.5) * 200)); }); this.bossList = this.bossList.filter(b => !b.markedForDeletion);
                this.bossFood.forEach(f => { if (f.update(dt) === 'spawn_boss_dog') this.dogs.push(new BossDog(f.x, f.y)); }); this.bossFood = this.bossFood.filter(f => !f.markedForDeletion);
                for (let i = this.intruderList.length - 1; i >= 0; i--) { const t = this.intruderList[i]; if (t.update(dt) === 'spawn_dog') this.dogs.push(new Dog(t.x, t.y)); if (t.markedForDeletion) this.intruderList.splice(i, 1); }
                this.valiList.forEach(vl => vl.update(dt, this.activists, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT));
                this.activists = this.activists.filter(a => !a.markedForDeletion);
                this.dogs.forEach(d => { if (d.update(dt, this.food, this.civs) === 'multiply') this.spawnDog(d.x + 10, d.y + 10); });
                this.civs.forEach(c => { if (c.update(dt, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT, this.dogs) === 'died') { this.player.money = Math.max(0, this.player.money - 10); this.score -= 8; setTimeout(() => this.spawnCiv(), 5000); } }); this.civs = this.civs.filter(c => !c.markedForDeletion);
                this.cleaners.forEach(c => c.update(dt, this.food, this.bossFood));
                this.helpers.forEach(h => { if (h.update(dt, this.dogs, this.van) === 'deposit') { this.player.money += 10; this.score += 10; this.sm.playSFX('money'); this.saveGame(); } });
                this.police.forEach(p => p.update(dt, this.a3List, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT, this.sm));
                this.food.forEach(f => { if (this.player.distanceTo(f) < 50) { f.markedForDeletion = true; this.score += 5; } }); this.food = this.food.filter(f => !f.markedForDeletion);
                this.dogs.forEach(d => { if (!d.isCollected && this.player.distanceTo(d) < 60) this.player.addToStack(d, this.sm); }); this.dogs = this.dogs.filter(d => !d.isCollected);
                if (!this.player.isStunned) this.activists.forEach(a => { if (a.type === 1 && this.player.distanceTo(a) < 50) { const d = this.player.stun(); a.triggerSpeech(); this.sm.playSFX('argue'); if (d) this.dogs.push(d); } });
                this.a3List.forEach(a => { if (this.player.distanceTo(a) < 60 && a.state !== 'flee' && a.state !== 'arrested') { a.state = 'flee'; this.player.showSpeechBubble("Abla bi git ya!"); } });

                let cd = this.player.stack.length; if (this.player.stack.some(d => d.isBossDog)) cd = this.player.maxCapacity;
                if (this.uiCap) this.uiCap.innerText = `${cd}/${this.player.maxCapacity}`;
                const dv = Math.sqrt((this.player.x - this.van.x) ** 2 + (this.player.y - (this.van.y - 120)) ** 2);
                if (dv < 150 && this.player.stack.length > 0) { this.depT += dt * 1000; if (this.depT > CONFIG.DEPOSIT_RATE) { if (this.player.removeFromStack()) { this.player.money += 10; this.score += 10; this.sm.playSFX('money'); this.saveGame(); } this.depT = 0; } }
                if (this.uiMoney) this.uiMoney.innerText = this.player.money;
                if (this.uiScore) this.uiScore.innerText = this.score;
            }

            // Çizim – mobilde zoom-out uygulanır (ctx scale)
            this.ctx.fillStyle = '#333'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            const bg = this.assets.get('background');
            this.ctx.save();
            if (this.isMobile && this.zoomScale !== 1.0) {
                // Ekranı küçült → daha fazla alan görünsün
                this.ctx.scale(this.zoomScale, this.zoomScale);
            }
            this.ctx.translate(-this.cam.x, -this.cam.y);
            if (bg) this.ctx.drawImage(bg, 0, 0, CONFIG.WORLD_WIDTH, CONFIG.WORLD_HEIGHT);
            this.ctx.restore();
            // Güvenli bölge çemberi – zoom ile hizalı
            this.ctx.save();
            if (this.isMobile && this.zoomScale !== 1.0) this.ctx.scale(this.zoomScale, this.zoomScale);
            this.ctx.translate(CONFIG.WORLD_WIDTH / 2 - this.cam.x, CONFIG.WORLD_HEIGHT / 2 - this.cam.y);
            this.ctx.fillStyle = 'rgba(100,200,100,0.3)'; this.ctx.beginPath(); this.ctx.arc(0, 0, CONFIG.SAFE_ZONE_RADIUS, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.restore();

            const all = [this.player, this.van, ...this.dogs, ...this.activists, ...this.a3List, ...this.food, ...this.civs, ...this.cleaners, ...this.helpers, ...this.police, ...this.bossList, ...this.bossFood, ...this.intruderList, ...this.valiList];
            all.sort((a, b) => a.y - b.y);
            // Tüm entity çizimleri de zoom ile birlikte çizilmeli
            this.ctx.save();
            if (this.isMobile && this.zoomScale !== 1.0) this.ctx.scale(this.zoomScale, this.zoomScale);
            this.particles.forEach(p => { p.update(dt); p.draw(this.ctx, this.cam); });
            for (let i = this.particles.length - 1; i >= 0; i--) { if (this.particles[i].life <= 0) this.particles.splice(i, 1); }
            all.forEach(e => { if (e instanceof Dog) e.trackDust(this.particles, dt); e.draw(this.ctx, this.assets, this.cam); });
            this.ctx.restore();

            // Hedef çizgisi (sadece PC modunda ve joystick aktif değilken)
            if (this.input.active && !this.celebrationActive && !this.input.joystick.active) {
                // PC hedef çizgisi – zoom'dan bağımsız, ham canvas koordinatlarında
                const px = (this.player.x - this.cam.x) * (this.isMobile ? this.zoomScale : 1);
                const py = (this.player.y - this.cam.y) * (this.isMobile ? this.zoomScale : 1);
                const tx = (this.input.target.x - this.cam.x) * (this.isMobile ? this.zoomScale : 1);
                const ty = (this.input.target.y - this.cam.y) * (this.isMobile ? this.zoomScale : 1);
                this.ctx.strokeStyle = 'rgba(255,255,255,0.5)'; this.ctx.lineWidth = 2;
                this.ctx.beginPath(); this.ctx.moveTo(px, py); this.ctx.lineTo(tx, ty); this.ctx.stroke();
                this.ctx.fillStyle = 'rgba(255,255,255,0.5)'; this.ctx.beginPath(); this.ctx.arc(tx, ty, 10, 0, Math.PI * 2); this.ctx.fill();
            }

            // Sanal joystick çiz (mobil – ekran koordinatlarında, zoom'dan etkilenmez)
            this.input.drawJoystick(this.ctx);

            requestAnimationFrame(t => this.loop(t));
        } catch (e) { console.error(e); showError(e.message); requestAnimationFrame(t => this.loop(t)); }
    }
}

// Başlat
try { window.onload = () => new Game(); } catch (e) { showError(e.message); }
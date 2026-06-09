const config = window.RADIO_CONFIG;

const titleEl = document.getElementById("radio-title");
const taglineEl = document.getElementById("radio-tagline");
const descriptionEl = document.getElementById("radio-description");
const scheduleEl = document.getElementById("radio-schedule");
const logoEl = document.getElementById("radio-logo");
const playButton = document.getElementById("play-button");
const syncButton = document.getElementById("sync-button");
const playLabel = document.getElementById("play-label");
const playIcon = document.getElementById("play-icon");
const playerStatus = document.getElementById("player-status");
const audio = document.getElementById("radio-player");

const AUTO_SYNC_INTERVAL_MS = 60 * 1000;
const MAX_DELAY_SECONDS = 60;
let isSyncingToLive = false;

function isMixedContentBlocked(streamUrl) {
    if (!streamUrl) {
        return false;
    }

    const pageIsSecure = window.location.protocol === "https:";
    const streamIsInsecure = /^http:\/\//i.test(streamUrl);

    return pageIsSecure && streamIsInsecure;
}

function applyConfig() {
    document.title = config.name;
    titleEl.textContent = config.name;
    taglineEl.textContent = config.tagline;
    descriptionEl.textContent = config.description;
    scheduleEl.textContent = config.schedule;

    logoEl.src = normalizeAssetPath(config.logo);
    logoEl.alt = `Logo de ${config.name}`;

    audio.src = config.streamUrl;

    if (isMixedContentBlocked(config.streamUrl)) {
        playButton.disabled = true;
        syncButton.disabled = true;
        playerStatus.textContent = "La senal usa HTTP y el navegador la bloquea en este sitio HTTPS. Usa un stream HTTPS o un proxy HTTPS.";
    }

    const root = document.documentElement;
    root.style.setProperty("--color-bg", config.colors.bg);
    root.style.setProperty("--color-surface", config.colors.surface);
    root.style.setProperty("--color-primary", config.colors.primary);
    root.style.setProperty("--color-text", config.colors.text);
}

function normalizeAssetPath(path) {
    if (!path) {
        return "";
    }

    const isRemotePath = /^https?:\/\//i.test(path);
    const isFilePath = /^file:\/\//i.test(path);

    if (isRemotePath || isFilePath) {
        return path;
    }

    if (window.location.protocol === "file:" && path.startsWith("/")) {
        return `.${path}`;
    }

    return path;
}

function setPlayerState(isPlaying, message) {
    playButton.classList.toggle("is-playing", isPlaying);
    playButton.setAttribute("aria-pressed", String(isPlaying));
    playLabel.textContent = isPlaying ? "Pausar radio" : "Escuchar ahora";
    playIcon.textContent = isPlaying ? "⏸" : "▶";
    playerStatus.textContent = message;
}

function getLiveDelaySeconds() {
    if (!audio.seekable || audio.seekable.length === 0) {
        return 0;
    }

    const liveEdge = audio.seekable.end(audio.seekable.length - 1);
    const delay = liveEdge - audio.currentTime;

    return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

function restartStream() {
    const streamUrl = audio.currentSrc || config.streamUrl;

    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audio.src = streamUrl;
    audio.load();
}

async function syncToLive(reason) {
    if (isSyncingToLive) {
        return;
    }

    if (isMixedContentBlocked(config.streamUrl)) {
        setPlayerState(false, "La transmision no puede abrirse desde este sitio mientras el audio siga en HTTP.");
        return;
    }

    isSyncingToLive = true;
    restartStream();

    try {
        await audio.play();

        if (reason === "auto") {
            setPlayerState(true, "El reproductor se sincronizo automaticamente con la transmision en vivo.");
            return;
        }

        setPlayerState(true, "La radio volvio al punto en vivo.");
    } catch (error) {
        setPlayerState(false, "No se pudo sincronizar el audio en vivo. Intenta nuevamente.");
    } finally {
        isSyncingToLive = false;
    }
}

function startAutoSync() {
    window.setInterval(() => {
        const liveDelaySeconds = getLiveDelaySeconds();

        if (liveDelaySeconds > MAX_DELAY_SECONDS) {
            void syncToLive("auto");
        }
    }, AUTO_SYNC_INTERVAL_MS);
}

playButton.addEventListener("click", async () => {
    if (isMixedContentBlocked(config.streamUrl)) {
        setPlayerState(false, "La transmision no puede abrirse desde GitHub Pages mientras el audio siga en HTTP.");
        return;
    }

    if (audio.paused) {
        try {
            await audio.play();
            setPlayerState(true, "La radio se esta reproduciendo.");
        } catch (error) {
            setPlayerState(false, "No se pudo iniciar el audio. Intenta nuevamente.");
        }
        return;
    }

    audio.pause();
    setPlayerState(false, "La radio esta en pausa.");
});

syncButton.addEventListener("click", () => {
    void syncToLive("manual");
});

audio.addEventListener("ended", () => {
    setPlayerState(false, "La transmision termino.");
});

audio.addEventListener("error", () => {
    setPlayerState(false, "Hubo un problema con la senal de audio.");
});

applyConfig();
startAutoSync();


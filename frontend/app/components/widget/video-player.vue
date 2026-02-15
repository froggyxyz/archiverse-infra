<template>
    <div ref="containerRef" class="av-video-player" @mouseenter="toggleIsShowOverlay" @mouseleave="toggleIsShowOverlay">
        <Transition name="v">
            <div v-show="isLoading" class="av-video-player__preloader">
                <Icon name="svg-spinners:3-dots-bounce" class="av-video-player__preloader-icon" />
            </div>
        </Transition>
        <Transition name="v">
            <div
                v-show="isShowOverlay"
                class="av-video-player__overlay"
                @mousedown.stop
                @touchstart.stop
                @touchmove.stop
                @touchend.stop
            >
                <div class="av-video-player__header">{{ name }}</div>
                <div class="av-video-player__controls">
                    <div class="av-video-player__controls-row">
                        <div class="av-video-player__progress-wrap">
                            <div class="av-video-player__track" />
                            <div
                                class="av-video-player__buffered"
                                :style="{ width: bufferedPercent + '%' }"
                            />
                            <div
                                class="av-video-player__played"
                                :style="{ width: playedPercent + '%' }"
                            />
                            <input
                                v-model.number="seekValue"
                                type="range"
                                class="av-video-player__progress"
                                min="0"
                                :max="duration"
                                step="0.1"
                                @input="onSeekInput"
                            />
                        </div>
                    </div>
                    <div class="av-video-player__controls-row av-video-player__controls-row--main">
                        <div>
                            <button type="button" class="av-video-player__control-button" @click="toggleVideo" :aria-label="isPlaying ? 'Pause' : 'Play'">
                                <Icon :name="isPlaying ? 'mdi:pause' : 'mdi:play'" class="av-video-player__control-button-icon" />
                            </button>
                            <span class="av-video-player__time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
                        </div>
                        <div>
                            <div ref="qualityWrapRef" v-if="hlsLevels.length > 1" class="av-video-player__quality-wrap">
                                <button
                                    type="button"
                                    class="av-video-player__control-button"
                                    :class="{ 'av-video-player__control-button--active': isQualityMenuOpen }"
                                    aria-label="Качество"
                                    aria-haspopup="listbox"
                                    :aria-expanded="isQualityMenuOpen"
                                    @click="isQualityMenuOpen = !isQualityMenuOpen"
                                >
                                    <Icon name="mdi:cog" class="av-video-player__control-button-icon" />
                                </button>
                                <Transition name="v">
                                    <ul
                                        v-show="isQualityMenuOpen"
                                        class="av-video-player__quality-menu"
                                        role="listbox"
                                        aria-label="Выбор качества"
                                    >
                                        <li
                                            role="option"
                                            :aria-selected="currentLevelIndex === -1"
                                            class="av-video-player__quality-option"
                                            :class="{ 'av-video-player__quality-option--active': currentLevelIndex === -1 }"
                                            @click="setQuality(-1); isQualityMenuOpen = false"
                                        >
                                            Авто
                                        </li>
                                        <li
                                            v-for="(level, i) in hlsLevels"
                                            :key="i"
                                            role="option"
                                            :aria-selected="currentLevelIndex === i"
                                            class="av-video-player__quality-option"
                                            :class="{ 'av-video-player__quality-option--active': currentLevelIndex === i }"
                                            @click="setQuality(i); isQualityMenuOpen = false"
                                        >
                                            {{ formatLevelLabel(level) }}
                                        </li>
                                    </ul>
                                </Transition>
                            </div>
                            <button type="button" class="av-video-player__control-button" @click="toggleMuteVideo" :aria-label="isMuted ? 'Unmute' : 'Mute'">
                                <Icon :name="isMuted ? 'mdi:volume-mute' : volume > 0.5 ? 'mdi:volume-high' : 'mdi:volume-low'" class="av-video-player__control-button-icon" />
                            </button>
                            <button type="button" class="av-video-player__control-button" @click="toggleFullScreenVideo" :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'">
                                <Icon :name="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" class="av-video-player__control-button-icon" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
        <video
            ref="videoRef"
            class="av-video-player__video"
            :src="isHls ? undefined : video"
            :controls="false"
            playsinline
            preload="auto"
            @timeupdate="onTimeUpdate"
            @progress="updateBuffered"
            @loadedmetadata="onLoadedMetadata"
            @waiting="isLoading = true"
            @canplay="isLoading = false"
            @play="isPlaying = true"
            @pause="isPlaying = false"
            @volumechange="onVolumeChange"
        >
            <track kind="captions" src="captions.vtt" srclang="en" label="English" />
        </video>
    </div>
</template>

<script setup lang="ts">
interface Props {
    video: string;
    name: string;
}

const props = withDefaults(defineProps<Props>(), { name: 'empty' });
const videoRef = ref<HTMLVideoElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const isHls = computed(() => props.video.includes('.m3u8'));
let hlsInstance: InstanceType<typeof import('hls.js').default> | null = null;
const isShowOverlay = ref<boolean>(false);
const isLoading = ref<boolean>(true);
const isPlaying = ref<boolean>(false);
const currentTime = ref<number>(0);
const duration = ref<number>(0);
const volume = ref<number>(1);
const isMuted = ref<boolean>(false);
const isFullscreen = ref<boolean>(false);
const seekValue = ref<number>(0);
const bufferedEnd = ref<number>(0);
const hlsLevels = ref<Array<{ height?: number; width?: number; bitrate?: number }>>([]);
const currentLevelIndex = ref<number>(-1);
const isQualityMenuOpen = ref<boolean>(false);

const bufferedPercent = computed(() => {
    if (duration.value <= 0 || !Number.isFinite(bufferedEnd.value)) return 0;
    return Math.min(100, (bufferedEnd.value / duration.value) * 100);
});

const playedPercent = computed(() => {
    if (duration.value <= 0 || !Number.isFinite(seekValue.value)) return 0;
    return Math.min(100, (seekValue.value / duration.value) * 100);
});

const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatLevelLabel = (level: { height?: number; width?: number; bitrate?: number }): string => {
    if (level.height) return `${level.height}p`;
    if (level.bitrate) return `${Math.round(level.bitrate / 1_000_000)} Mbps`;
    return '—';
};

const setQuality = (index: number): void => {
    if (!hlsInstance) return;
    hlsInstance.currentLevel = index;
    currentLevelIndex.value = index;
};

const toggleIsShowOverlay = () => {
    isShowOverlay.value = !isShowOverlay.value;
};

const playVideo = (): void => {
    videoRef.value?.play();
};

const pauseVideo = (): void => {
    videoRef.value?.pause();
};

const toggleVideo = (): void => {
    if (videoRef.value) {
        videoRef.value.paused ? playVideo() : pauseVideo();
    }
};

const onSeekInput = (): void => {
    if (videoRef.value) {
        videoRef.value.currentTime = seekValue.value;
    }
};

const onTimeUpdate = (): void => {
    if (videoRef.value) {
        currentTime.value = videoRef.value.currentTime;
        seekValue.value = videoRef.value.currentTime;
    }
};

const onLoadedMetadata = (): void => {
    if (videoRef.value) {
        duration.value = videoRef.value.duration;
        if (videoRef.value.readyState >= 2) isLoading.value = false;
    }
};

const updateBuffered = (): void => {
    const el = videoRef.value;
    if (!el || !el.buffered.length) {
        bufferedEnd.value = 0;
        return;
    }
    bufferedEnd.value = el.buffered.end(el.buffered.length - 1);
};

const onVolumeChange = (): void => {
    if (videoRef.value) {
        volume.value = videoRef.value.volume;
        isMuted.value = videoRef.value.muted;
    }
};

const toggleMuteVideo = (): void => {
    if (videoRef.value) {
        videoRef.value.muted = !videoRef.value.muted;
    }
};

const requestFullScreenVideo = (): void => {
    containerRef.value?.requestFullscreen();
};

const exitFullScreenVideo = (): void => {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
};

const toggleFullScreenVideo = (): void => {
    document.fullscreenElement ? exitFullScreenVideo() : requestFullScreenVideo();
};

const handleFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement;
};

const initHls = async () => {
    if (!props.video || !videoRef.value || !isHls.value) return;
    const Hls = (await import('hls.js')).default;
    if (Hls.isSupported()) {
        hlsInstance = new Hls({ autoStartLoad: true });
        hlsInstance.loadSource(props.video);
        hlsInstance.attachMedia(videoRef.value);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
            hlsLevels.value = data.levels.map((l) => ({ height: l.height, width: l.width, bitrate: l.bitrate }));
        });
        hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
            currentLevelIndex.value = data.level;
        });
    } else if (videoRef.value.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.value.src = props.video;
        videoRef.value.preload = 'auto';
    }
};

watch(() => props.video, () => {
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    hlsLevels.value = [];
    currentLevelIndex.value = -1;
    isQualityMenuOpen.value = false;
    if (isHls.value && videoRef.value) initHls();
}, { immediate: false });

const qualityWrapRef = ref<HTMLElement | null>(null);

const onClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;
    if (qualityWrapRef.value && !qualityWrapRef.value.contains(target)) {
        isQualityMenuOpen.value = false;
    }
};

watch(isQualityMenuOpen, (open) => {
    if (open) {
        nextTick(() => document.addEventListener('click', onClickOutside));
    } else {
        document.removeEventListener('click', onClickOutside);
    }
});

onMounted(async () => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    if (isHls.value && props.video) {
        await nextTick();
        initHls();
    }
});

onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
});
</script>

<style scoped>
.av-video-player {
    width: 100%;
    height: 100%;
    position: relative;
    background: #0a0a0a;
}

.av-video-player__preloader {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0a;
    pointer-events: none;
}

.av-video-player__preloader-icon {
    font-size: 48px;
    color: rgba(255, 255, 255, 0.9);
}

.av-video-player__overlay {
    position: absolute;
    height: 100%;
    width: 100%;
    inset: 0;
    z-index: 2;

    padding: 12px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;

    background: linear-gradient(#080808a0 0%, transparent 20%, transparent 80%, #080808a0 100%);
}

.av-video-player__controls {
    width: 100%;
}

.av-video-player__controls-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.av-video-player__controls-row--main {
    justify-content: space-between;
}

.av-video-player__controls-row--main > div {
    display: flex;
    align-items: center;
    gap: 8px;
}

.av-video-player__progress-wrap {
    flex: 1;
    min-width: 80px;
    position: relative;
    display: flex;
    align-items: center;
    height: 20px;
}

.av-video-player__track {
    position: absolute;
    left: 0;
    right: 0;
    height: 6px;
    top: 50%;
    margin-top: -3px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    pointer-events: none;
    z-index: 0;
}

.av-video-player__buffered {
    position: absolute;
    left: 0;
    height: 6px;
    top: 50%;
    margin-top: -3px;
    min-width: 0;
    background: rgba(255, 255, 255, 0.4);
    border-radius: 3px;
    pointer-events: none;
    z-index: 0;
}

.av-video-player__played {
    position: absolute;
    left: 0;
    height: 6px;
    top: 50%;
    margin-top: -3px;
    min-width: 0;
    background: var(--text-color, #fff);
    border-radius: 3px;
    pointer-events: none;
    z-index: 0;
}

.av-video-player__progress {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 20px;
    margin: 0;
    padding: 0;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
}

.av-video-player__progress::-webkit-slider-runnable-track {
    height: 6px;
    background: transparent;
    border-radius: 3px;
}

.av-video-player__progress::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--text-color, #fff);
    cursor: pointer;
    margin-top: -3px;
}

.av-video-player__progress::-moz-range-track {
    height: 6px;
    background: transparent;
    border-radius: 3px;
}

.av-video-player__progress::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: none;
    background: var(--text-color, #fff);
    cursor: pointer;
}

.av-video-player__time {
    font-size: 12px;
    color: var(--text-color);
    white-space: nowrap;
}

.av-video-player__buffered-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.75);
    white-space: nowrap;
}

.av-video-player__control-button {
    cursor: pointer;
    width: 36px;
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    padding: 0;
}

.av-video-player__control-button-icon {
    color: var(--text-color);
    font-size: 24px;
}

.av-video-player__control-button--active {
    opacity: 0.9;
}

.av-video-player__quality-wrap {
    position: relative;
}

.av-video-player__quality-menu {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 4px;
    padding: 4px 0;
    min-width: 100px;
    list-style: none;
    background: rgba(0, 0, 0, 0.85);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 10;
}

.av-video-player__quality-option {
    padding: 6px 12px;
    font-size: 13px;
    color: var(--text-color);
    cursor: pointer;
    white-space: nowrap;
}

.av-video-player__quality-option:hover {
    background: rgba(255, 255, 255, 0.1);
}

.av-video-player__quality-option--active {
    background: rgba(255, 255, 255, 0.15);
}

.av-video-player__video {
    width: 100%;
    height: 100%;
    display: block;
    background: #0a0a0a;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.3s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
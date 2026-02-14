<template>
    <div ref="containerRef" class="av-video-player" @mouseenter="toggleIsShowOverlay" @mouseleave="toggleIsShowOverlay">
        <Transition name="v">
            <div v-show="isShowOverlay" class="av-video-player__overlay">
                <div class="av-video-player__header">{{ name }}</div>
                <div class="av-video-player__controls">
                    <div class="av-video-player__controls-row">
                        <div class="av-video-player__progress-wrap">
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
            :src="video"
            :controls="false"
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
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

withDefaults(defineProps<Props>(), {
    name: 'empty'
});

const videoRef = ref<HTMLVideoElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const isShowOverlay = ref<boolean>(false);
const isPlaying = ref<boolean>(false);
const currentTime = ref<number>(0);
const duration = ref<number>(0);
const volume = ref<number>(1);
const isMuted = ref<boolean>(false);
const isFullscreen = ref<boolean>(false);
const seekValue = ref<number>(0);

const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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
    }
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

onMounted(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
});
</script>

<style scoped>
.av-video-player {
    width: 100%;
    height: 100%;
    position: relative;
}

.av-video-player__overlay {
    position: absolute;
    height: 100%;
    width: 100%;
    inset: 0;
    z-index: 1;

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
}

.av-video-player__progress {
    width: 100%;
    height: 6px;
    cursor: pointer;
    accent-color: var(--text-color, #fff);
}

.av-video-player__time {
    font-size: 12px;
    color: var(--text-color);
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

.av-video-player__video {
    width: 100%;
    height: 100%;
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
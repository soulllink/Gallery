// src/lib/Canvas/MediaManager.ts
import { getFileUrl } from '../fileSystem';
import type { FileItem } from '../../stores';

interface MediaState {
    image: HTMLImageElement | null;
    video: HTMLVideoElement | null;
    currentUrl: string | null;
    videoFrame: number | null;
    isGif: boolean;
}

export class MediaManager {
    private previousFileItem: FileItem | null = null;
    private audioContext: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private sourceNode: MediaElementAudioSourceNode | null = null;

    constructor(
        private onRedraw: () => void,
        private onVideoFrame: (frameId: number) => void
    ) { }

    async loadFile(
        item: FileItem,
        currentVideo: HTMLVideoElement | null,
        settings: any
    ): Promise<MediaState> {
        let newState: MediaState = {
            image: null,
            video: null,
            currentUrl: null,
            videoFrame: null,
            isGif: false
        };

        if (currentVideo) {
            currentVideo.pause();
            currentVideo.src = '';
        }

        if (this.previousFileItem && this.previousFileItem.url) {
            const oldUrl = this.previousFileItem.url;
            this.previousFileItem.url = undefined;
            if (oldUrl.startsWith("blob:")) {
                setTimeout(() => URL.revokeObjectURL(oldUrl), 1000);
            }
        }

        // Cleanup previous audio context if exists
        this.cleanupAudio();

        try {
            const url = await getFileUrl(item);
            newState.currentUrl = url;
            this.previousFileItem = item;

            if (item.type === 'image') {
                newState.image = new Image();
                newState.image.onload = () => this.onRedraw();
                newState.image.onerror = () => console.error('Failed to load image:', item.name);
                newState.image.src = url;
                // Simple GIF detection by extension for now
                if (item.name.toLowerCase().endsWith('.gif')) {
                    newState.isGif = true;
                }
            } else if (item.type === 'video') {
                newState.video = document.createElement('video');
                newState.video.src = url;
                newState.video.loop = true;
                newState.video.muted = false;
                // We handle volume via AudioContext, so set element volume to 1 (or controlled via gain if we simply hook it up)
                // But initially, let's just use the gain node for the heavy lifting.
                // However, browser policy often requires user interaction for AudioContext.
                // We will attempt to init it on first play.
                newState.video.volume = 1.0;

                newState.video.onloadeddata = () => {
                    this.onRedraw();
                    if (newState.video) {
                        this.setupAudio(newState.video, settings.volume);
                        this.startVideoLoop(newState.video);
                    }
                };
                newState.video.onerror = (e) => console.error('Failed to load video:', item.name, e);

                try {
                    await newState.video.play();
                } catch (e) {
                    console.error("Auto-play failed", e);
                }
            }
        } catch (e) {
            console.error("Failed to get file URL", e);
        }

        return newState;
    }

    private startVideoLoop(video: HTMLVideoElement) {
        const loop = () => {
            this.onRedraw();

            if (!video.paused && !video.ended) {
                const progress = (video.currentTime / video.duration) * 100;
                window.dispatchEvent(new CustomEvent('videoUpdate', {
                    detail: {
                        progress: progress,
                        duration: video.duration,
                        currentTime: video.currentTime
                    }
                }));
            }

            const frameId = requestAnimationFrame(loop);
            this.onVideoFrame(frameId);
        };
        loop();
    }

    private setupAudio(video: HTMLVideoElement, volumePercent: number) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            this.sourceNode = this.audioContext.createMediaElementSource(video);
            this.gainNode = this.audioContext.createGain();

            // Map 100% -> 1.0, 600% -> 6.0
            this.gainNode.gain.value = volumePercent / 100;

            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

        } catch (e) {
            console.error("Audio Context Setup Failed (likely CORS or Interaction policy):", e);
            // Fallback: just set video volume if below 100%
            video.volume = Math.min(volumePercent / 100, 1);
        }
    }

    public updateVolume(volumePercent: number) {
        if (this.gainNode) {
            this.gainNode.gain.value = volumePercent / 100;
        }
    }

    public cleanupAudio() {
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
    }
}
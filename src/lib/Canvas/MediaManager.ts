// src/lib/Canvas/MediaManager.ts
import { getFileUrl } from '../fileSystem'; // Fixed path
import type { FileItem } from '../../stores'; // Fixed path (assuming stores.ts is in src/)

interface MediaState {
    image: HTMLImageElement | null;
    video: HTMLVideoElement | null;
    currentUrl: string | null;
    videoFrame: number | null;
}

export class MediaManager {
    private previousFileItem: FileItem | null = null;

    constructor(
        private onRedraw: () => void,
        private onVideoFrame: (frameId: number) => void
    ) {}

    async loadFile(
        item: FileItem,
        currentVideo: HTMLVideoElement | null,
        settings: any
    ): Promise<MediaState> {
        let newState: MediaState = {
            image: null,
            video: null,
            currentUrl: null,
            videoFrame: null
        };

        if (currentVideo) {
            currentVideo.pause();
            currentVideo.src = '';
        }

        if (this.previousFileItem && this.previousFileItem.url) {
            const oldUrl = this.previousFileItem.url;
            this.previousFileItem.url = undefined;
            setTimeout(() => URL.revokeObjectURL(oldUrl), 1000);
        }

        try {
            const url = await getFileUrl(item);
            newState.currentUrl = url;
            this.previousFileItem = item;

            if (item.type === 'image') {
                newState.image = new Image();
                newState.image.onload = () => this.onRedraw();
                newState.image.onerror = () => console.error('Failed to load image:', item.name);
                newState.image.src = url;
            } else if (item.type === 'video') {
                newState.video = document.createElement('video');
                newState.video.src = url;
                newState.video.loop = true;
                newState.video.muted = false;
                newState.video.volume = Math.min(settings.volume / 100, 6);

                newState.video.onloadeddata = () => {
                    this.onRedraw();
                    this.startVideoLoop(newState.video!);
                };
                newState.video.onerror = (e) => console.error('Failed to load video:', item.name, e);
                newState.video.play().catch(e => console.error("Auto-play failed", e));
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
}
## Video Progress Bar Fix

The video progress bar needs two modifications to `CanvasView.svelte`:

### 1. Update `startVideoLoop()` function (around line 110)

Replace:
```javascript
function startVideoLoop() {
    if (!video) return;
    function loop() {
        canvasRenderer?.draw();
        videoFrame = requestAnimationFrame(loop);
    }
    loop();
}
```

With:
```javascript
function startVideoLoop() {
    if (!video) return;
    function loop() {
        if (video && !isNaN(video.duration) && video.duration > 0) {
            // Dispatch video progress update
            window.dispatchEvent(new CustomEvent('videoUpdate', {
                detail: {
                    progress: (video.currentTime / video.duration) * 100,
                    duration: video.duration
                }
            }));
        }
        canvasRenderer?.draw();
        videoFrame = requestAnimationFrame(loop);
    }
    loop();
}
```

###  2. Add seek event listener in `onMount()` (around line 730)

Add this inside the `onMount` function, after the existing event listeners:
```javascript
window.addEventListener('seekVideo', ((e: CustomEvent) => {
    if (video && e.detail?.percentage !== undefined) {
        video.currentTime = e.detail.percentage * video.duration;
    }
}) as EventListener);
```

And in `onDestroy()` (around line 738), add:
```javascript
window.removeEventListener('seekVideo', ...);  // Match the handler above
```

## Why This Fixes It

- The video element is created with `document.createElement('video')` which doesn't add it to the DOM
- `document.querySelector('video')` can't find it  
- So we use custom events to communicate between components instead

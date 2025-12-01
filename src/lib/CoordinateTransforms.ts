import type { ViewSettings } from '../stores';

export interface TransformParams {
    canvas: HTMLCanvasElement;
    mediaW: number;
    mediaH: number;
    settings: ViewSettings;
    panX: number;
    panY: number;
    scrollOffset: number;
}

/**
 * Transform screen coordinates to image pixel coordinates
 */
export function screenToImageCoords(
    screenX: number,
    screenY: number,
    params: TransformParams
): { x: number; y: number } {
    const { canvas, mediaW, mediaH, settings, panX, panY, scrollOffset, windowWidth, windowHeight } = params;

    if (!mediaW || !mediaH) return { x: 0, y: 0 };

    const width = windowWidth;
    const height = windowHeight;
    const isRotated90 = settings.rotation % 180 !== 0;
    const effectiveW = isRotated90 ? mediaH : mediaW;
    const effectiveH = isRotated90 ? mediaW : mediaH;

    let drawW = mediaW;
    let drawH = mediaH;
    let offsetX = panX;
    let offsetY = panY;

    // Calculate scale based on view mode (same logic as draw())
    if (settings.viewMode === 'fit-h') {
        const scale = width / effectiveW;
        drawW = mediaW * scale;
        drawH = mediaH * scale;
        const finalH = isRotated90 ? drawW : drawH;
        offsetY = panY + (height - finalH) / 2;
        if (isRotated90) offsetX = panX + (width - drawH) / 2;
    } else if (settings.viewMode === 'fit-v') {
        const scale = height / effectiveH;
        drawW = mediaW * scale;
        drawH = mediaH * scale;
        const finalW = isRotated90 ? drawH : drawW;
        offsetX = panX + (width - finalW) / 2;
        if (isRotated90) offsetY = panY + (height - drawW) / 2;
    } else if (settings.viewMode === 'original') {
        const finalW = isRotated90 ? mediaH : mediaW;
        const finalH = isRotated90 ? mediaW : mediaH;
        offsetX = panX + (width - finalW) / 2;
        offsetY = panY + (height - finalH) / 2;
    } else if (settings.viewMode === 'reader') {
        const scale = width / effectiveW;
        drawW = mediaW * scale;
        drawH = mediaH * scale;
        const finalH = isRotated90 ? drawW : drawH;
        offsetY = -scrollOffset + panY;
        if (isRotated90) offsetX = panX + (width - drawH) / 2;
    } else if (settings.viewMode === 'landscape') {
        const scale = height / effectiveH;
        drawW = mediaW * scale;
        drawH = mediaH * scale;
        offsetX = -scrollOffset + panX;
        if (isRotated90) offsetY = panY + (height - drawW) / 2;
    }

    // Apply zoom
    drawW *= settings.zoom;
    drawH *= settings.zoom;

    if (settings.zoom !== 1) {
        const centerX = width / 2;
        const centerY = height / 2;
        offsetX = centerX - (centerX - offsetX) * settings.zoom;
        offsetY = centerY - (centerY - offsetY) * settings.zoom;
    }

    // Calculate center of drawn image
    const cx = offsetX + (isRotated90 ? drawH : drawW) / 2;
    const cy = offsetY + (isRotated90 ? drawW : drawH) / 2;

    // Translate screen coords relative to image center
    let relX = screenX - cx;
    let relY = screenY - cy;

    // Reverse rotation
    const rotationRad = (settings.rotation * Math.PI) / 180;
    const cosA = Math.cos(-rotationRad);
    const sinA = Math.sin(-rotationRad);
    const rotatedX = relX * cosA - relY * sinA;
    const rotatedY = relX * sinA + relY * cosA;

    // Scale back to original image coords
    // The previous logic was slightly off.
    // rotatedX corresponds to the X axis of the DRAWN image (which might be rotated)
    // If rotated 90deg, the drawn width is actually the image height.
    // But we are rotating back, so rotatedX should align with the original image's X axis (if 0 rotation)
    // or Y axis (if 90 rotation).
    // Wait, we rotated the point back by -rotation. So now rotatedX/Y are aligned with the unrotated image axes.

    // The drawn image (unrotated) has dimensions drawW x drawH.
    // Its center is at (0,0) in this relative space.
    // So we just map from [-drawW/2, drawW/2] to [0, mediaW]

    const imgX = (rotatedX / drawW) * mediaW + mediaW / 2;
    const imgY = (rotatedY / drawH) * mediaH + mediaH / 2;

    return { x: Math.round(imgX), y: Math.round(imgY) };
}

/**
 * Transform image coordinates to screen coordinates
 */
export function imageToScreenCoords(
    imgX: number,
    imgY: number,
    imgW: number,
    imgH: number,
    params: TransformParams
): { x: number; y: number; w: number; h: number } {
    const { canvas, mediaW, mediaH, settings, panX, panY, scrollOffset, windowWidth, windowHeight } = params;

    if (!mediaW || !mediaH) return { x: 0, y: 0, w: 0, h: 0 };

    const width = windowWidth;
    const height = windowHeight;
    const isRotated90 = settings.rotation % 180 !== 0;
    const effectiveW = isRotated90 ? mediaH : mediaW;
    const effectiveH = isRotated90 ? mediaW : mediaH;

    let drawW = mediaW;
    let drawH = mediaH;
    let offsetX = panX;
    let offsetY = panY;

    // Same view mode calculations as draw()
    if (settings.viewMode === 'fit-h') {
        const scale = width / effectiveW;
        drawW = mediaW * scale;
        drawH = mediaH * scale;
        const finalH = isRotated90 ? drawW : drawH;
        offsetY = panY + (height - finalH) / 2;
        if (isRotated90) offsetX = panX + (width - drawH) / 2;
    } else if (settings.viewMode === 'fit-v') {
        const scale = height / effectiveH;
        drawW = mediaW * scale;
        drawH = mediaH * scale;
        const finalW = isRotated90 ? drawH : drawW;
        offsetX = panX + (width - finalW) / 2;
        if (isRotated90) offsetY = panY + (height - drawW) / 2;
    } else if (settings.viewMode === 'original') {
        const finalW = isRotated90 ? mediaH : mediaW;
        const finalH = isRotated90 ? mediaW : mediaH;
        offsetX = panX + (width - finalW) / 2;
        offsetY = panY + (height - finalH) / 2;
    } else if (settings.viewMode === 'reader') {
        const scale = width / effectiveW;
        drawW = mediaW * scale;
        drawH = mediaH * scale;
        const finalH = isRotated90 ? drawW : drawH;
        offsetY = -scrollOffset + panY;
        if (isRotated90) offsetX = panX + (width - drawH) / 2;
    } else if (settings.viewMode === 'landscape') {
        const scale = height / effectiveH;
        drawW = mediaW * scale;
        drawH = mediaH * scale;
        offsetX = -scrollOffset + panX;
        if (isRotated90) offsetY = panY + (height - drawW) / 2;
    }

    // Apply zoom
    drawW *= settings.zoom;
    drawH *= settings.zoom;

    if (settings.zoom !== 1) {
        const centerX = width / 2;
        const centerY = height / 2;
        offsetX = centerX - (centerX - offsetX) * settings.zoom;
        offsetY = centerY - (centerY - offsetY) * settings.zoom;
    }

    // Convert image coords to relative coords
    const relX = (imgX - mediaW / 2) / mediaW * drawW;
    const relY = (imgY - mediaH / 2) / mediaH * drawH;
    const relW = imgW / mediaW * drawW;
    const relH = imgH / mediaH * drawH;

    // Apply rotation
    const rotationRad = (settings.rotation * Math.PI) / 180;
    const cosA = Math.cos(rotationRad);
    const sinA = Math.sin(rotationRad);
    const rotatedX = relX * cosA - relY * sinA;
    const rotatedY = relX * sinA + relY * cosA;

    // Calculate center of drawn image
    const cx = offsetX + (isRotated90 ? drawH : drawW) / 2;
    const cy = offsetY + (isRotated90 ? drawW : drawH) / 2;

    // Convert back to screen coords
    const screenX = rotatedX + cx;
    const screenY = rotatedY + cy;

    return { x: Math.round(screenX), y: Math.round(screenY), w: Math.round(relW), h: Math.round(relH) };
}

/**
 * Get edge position for jumping to edges
 */
export function getEdgePosition(
    edge: 'top' | 'bottom' | 'left' | 'right',
    params: Omit<TransformParams, 'canvas'> & { windowWidth: number; windowHeight: number }
): number {
    const { mediaW, mediaH, settings, windowWidth, windowHeight } = params;

    if (!mediaW || !mediaH) return 0;

    const isRotated90 = settings.rotation % 180 !== 0;
    const effectiveW = isRotated90 ? mediaH : mediaW;
    const effectiveH = isRotated90 ? mediaW : mediaH;

    let drawW = mediaW;
    let drawH = mediaH;

    // Calculate dimensions based on view mode
    if (settings.viewMode === 'fit-h' || settings.viewMode === 'reader') {
        const scale = windowWidth / effectiveW;
        drawW *= scale;
        drawH *= scale;
    } else if (settings.viewMode === 'fit-v' || settings.viewMode === 'landscape') {
        const scale = windowHeight / effectiveH;
        drawW *= scale;
        drawH *= scale;
    }

    const finalW = isRotated90 ? drawH : drawW;
    const finalH = isRotated90 ? drawW : drawH;

    // Calculate edge positions
    switch (edge) {
        case 'top':
            // Show top of image
            return finalH > windowHeight ? (finalH - windowHeight) / 2 : 0;
        case 'bottom':
            // Show bottom of image
            return finalH > windowHeight ? -(finalH - windowHeight) / 2 : 0;
        case 'left':
            // Show left of image
            return finalW > windowWidth ? (finalW - windowWidth) / 2 : 0;
        case 'right':
            // Show right of image  
            return finalW > windowWidth ? -(finalW - windowWidth) / 2 : 0;
        default:
            return 0;
    }
}

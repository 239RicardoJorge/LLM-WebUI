/**
 * Thumbnail Generation Utilities
 * 
 * Generates thumbnails for images and videos, validates file sizes,
 * and extracts file metadata for display in chat history.
 */

// Size limits in bytes
export const FILE_SIZE_LIMITS = {
    MAX_FILE_SIZE: 20 * 1024 * 1024,      // 20MB - hard limit for API
    WARNING_FILE_SIZE: 5 * 1024 * 1024,   // 5MB - warning threshold
    THUMBNAIL_MAX_SIZE: 300,               // Max dimension for thumbnails
    THUMBNAIL_QUALITY: 0.8,                // JPEG quality (0-1)
    VIDEO_FRAME_POSITION: 0.25,            // 25% into the video
};

export interface AttachmentMeta {
    name: string;
    type: string;
    size: number;
    thumbnail?: string;      // Base64 data URL
    duration?: number;       // Seconds (for video/audio)
    dimensions?: {           // For images/video
        width: number;
        height: number;
    };
}

export interface FileValidationResult {
    valid: boolean;
    warning?: string;
    error?: string;
}

/**
 * Validate file size before processing
 */
export const validateFileSize = (file: File): FileValidationResult => {
    if (file.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File too large (${formatFileSize(file.size)}). Maximum size is 20MB.`
        };
    }

    if (file.size > FILE_SIZE_LIMITS.WARNING_FILE_SIZE) {
        return {
            valid: true,
            warning: `Large file (${formatFileSize(file.size)}). Upload may take a moment...`
        };
    }

    return { valid: true };
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Generate thumbnail for an image file
 */
export const generateImageThumbnail = (file: File, maxSize: number = FILE_SIZE_LIMITS.THUMBNAIL_MAX_SIZE): Promise<AttachmentMeta> => {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            try {
                // Calculate thumbnail dimensions maintaining aspect ratio
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                }

                // Create canvas and draw scaled image
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to create canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG with 70% quality for smaller size
                const thumbnail = canvas.toDataURL('image/jpeg', FILE_SIZE_LIMITS.THUMBNAIL_QUALITY);

                URL.revokeObjectURL(img.src);

                resolve({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    thumbnail,
                    dimensions: { width: img.width, height: img.height }
                });
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error('Failed to load image'));
        };

        img.src = URL.createObjectURL(file);
    });
};

/**
 * Generate thumbnail from video file (captures frame at 25% position)
 */
export const generateVideoThumbnail = (
    file: File,
    maxSize: number = FILE_SIZE_LIMITS.THUMBNAIL_MAX_SIZE
): Promise<AttachmentMeta> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        let resolved = false;

        const cleanup = () => {
            URL.revokeObjectURL(video.src);
        };

        video.onloadedmetadata = () => {
            // Seek to 25% of the video (or 1 second for very short videos)
            video.currentTime = Math.max(1, video.duration * FILE_SIZE_LIMITS.VIDEO_FRAME_POSITION);
        };

        video.onseeked = () => {
            if (resolved) return;
            resolved = true;

            try {
                // Calculate thumbnail dimensions
                let width = video.videoWidth;
                let height = video.videoHeight;

                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                }

                // Create canvas and capture frame
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    cleanup();
                    reject(new Error('Failed to create canvas context'));
                    return;
                }

                ctx.drawImage(video, 0, 0, width, height);

                const thumbnail = canvas.toDataURL('image/jpeg', FILE_SIZE_LIMITS.THUMBNAIL_QUALITY);

                cleanup();

                resolve({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    thumbnail,
                    duration: video.duration,
                    dimensions: { width: video.videoWidth, height: video.videoHeight }
                });
            } catch (error) {
                cleanup();
                reject(error);
            }
        };

        video.onerror = () => {
            cleanup();
            reject(new Error('Failed to load video'));
        };

        // Timeout for videos that fail to seek
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                cleanup();
                // Return metadata without thumbnail if frame capture fails
                resolve({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    duration: video.duration || undefined
                });
            }
        }, 5000);

        video.src = URL.createObjectURL(file);
    });
};

/**
 * Get audio duration
 */
export const getAudioMeta = (file: File): Promise<AttachmentMeta> => {
    return new Promise((resolve) => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';

        audio.onloadedmetadata = () => {
            URL.revokeObjectURL(audio.src);
            resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                duration: audio.duration
            });
        };

        audio.onerror = () => {
            URL.revokeObjectURL(audio.src);
            resolve({
                name: file.name,
                type: file.type,
                size: file.size
            });
        };

        audio.src = URL.createObjectURL(file);
    });
};

/**
 * Get generic file metadata (for documents, etc.)
 */
export const getFileMeta = (file: File): AttachmentMeta => {
    return {
        name: file.name,
        type: file.type,
        size: file.size
    };
};

/**
 * Process file and generate appropriate metadata/thumbnail
 */
export const processAttachment = async (file: File): Promise<AttachmentMeta> => {
    const type = file.type.toLowerCase();

    if (type.startsWith('image/')) {
        return generateImageThumbnail(file);
    }

    if (type.startsWith('video/')) {
        return generateVideoThumbnail(file);
    }

    if (type.startsWith('audio/')) {
        return getAudioMeta(file);
    }

    // Default: just return basic metadata (PDFs, documents, etc.)
    return getFileMeta(file);
};

/**
 * Format duration in seconds to readable string
 */
export const formatDuration = (seconds: number): string => {
    if (!seconds || !isFinite(seconds)) return '';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    if (mins > 0) {
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `0:${secs.toString().padStart(2, '0')}`;
};

/**
 * Get file type icon
 */
export const getFileTypeIcon = (mimeType: string): string => {
    const type = mimeType.toLowerCase();

    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.includes('presentation') || type.includes('powerpoint')) return '📽️';
    if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return '🗜️';
    if (type.includes('text')) return '📃';

    return '📎';
};

import axios from 'axios';
import config from '../config';

export interface DownloadResult {
  buffer: Buffer;
  ext: string;
  contentType: string;
}

export async function downloadImage(url: string): Promise<DownloadResult> {
  try {
    const response = await axios.get(url, {
      timeout: config.imageTimeout,
      responseType: 'arraybuffer',
      validateStatus: (s: number) => s === 200,
      headers: {
        'User-Agent': config.userAgent,
      },
    });

    const contentType = response.headers['content-type'] || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Not an image: ${contentType}`);
    }

    const buffer = Buffer.from(response.data);
    const ext = getExtension(url, contentType);

    return {
      buffer,
      ext,
      contentType,
    };
  } catch (error) {
    throw new Error(`Download failed: ${(error as Error).message}`);
  }
}

function getExtension(url: string, contentType: string): string {
  const urlPath = url.split('?')[0];
  const urlExt = urlPath.split('.').pop()?.toLowerCase() || '';
  if (['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'ico'].includes(urlExt)) {
    return urlExt;
  }

  const mimeMap: Record<string, string> = {
    'image/svg+xml': 'svg',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
  };

  return mimeMap[contentType] || 'png';
}

import sharp from 'sharp';
import config from '../config';

export interface CropResult {
  buffer: Buffer;
  width: number | null;
  height: number | null;
}

export async function cropImage(buffer: Buffer, ext: string): Promise<CropResult> {
  if (ext === 'svg') {
    return { buffer, width: null, height: null };
  }

  try {
    const trimmed = await sharp(buffer).trim().toBuffer({ resolveWithObject: true });
    
    let croppedBuffer = trimmed.data;
    let info = trimmed.info;

    if (info.width > config.targetWidth) {
      const resized = await sharp(croppedBuffer)
        .resize({ width: config.targetWidth, withoutEnlargement: true })
        .toBuffer({ resolveWithObject: true });
      
      croppedBuffer = resized.data;
      info = resized.info;
    }

    return {
      buffer: croppedBuffer,
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    return {
      buffer,
      width: null,
      height: null,
    };
  }
}

export async function getImageDimensions(buffer: Buffer, ext: string): Promise<{ width: number | null; height: number | null }> {
  if (ext === 'svg') {
    return { width: null, height: null };
  }

  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || null,
      height: metadata.height || null,
    };
  } catch (e) {
    return { width: null, height: null };
  }
}

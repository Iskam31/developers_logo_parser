import sharp from 'sharp';
import { optimize as svgoOptimize } from 'svgo';

export async function optimize(buffer: Buffer, ext: string): Promise<Buffer> {
  if (ext === 'svg') {
    try {
      const svgString = buffer.toString('utf-8');
      const result = svgoOptimize(svgString, {
        multipass: true,
        plugins: [
          'preset-default',
          'removeDimensions',
          'removeXMLNS',
        ],
      });
      return Buffer.from(result.data, 'utf-8');
    } catch (e) {
      return buffer;
    }
  }

  if (ext === 'png') {
    try {
      return await sharp(buffer)
        .png({ compressionLevel: 9 })
        .toBuffer();
    } catch (e) {
      return buffer;
    }
  }

  if (ext === 'jpg' || ext === 'jpeg') {
    try {
      return await sharp(buffer)
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch (e) {
      return buffer;
    }
  }

  if (ext === 'webp') {
    try {
      return await sharp(buffer)
        .webp({ quality: 90 })
        .toBuffer();
    } catch (e) {
      return buffer;
    }
  }

  return buffer;
}

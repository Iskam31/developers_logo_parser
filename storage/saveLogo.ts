import * as fs from 'fs/promises';
import * as path from 'path';

export interface SaveResult {
  path: string;
  url: string;
}

export async function saveLogo(buffer: Buffer, domain: string, ext: string): Promise<SaveResult> {
  const logosDir = path.join(process.cwd(), 'logos');
  
  await fs.mkdir(logosDir, { recursive: true });
  
  const filename = `${domain}.${ext}`;
  const filepath = path.join(logosDir, filename);
  
  await fs.writeFile(filepath, buffer);
  
  return {
    path: filepath,
    url: `/logos/${filename}`,
  };
}

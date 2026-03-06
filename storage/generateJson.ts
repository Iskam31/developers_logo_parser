import * as fs from 'fs/promises';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'logos.json');

export interface LogoEntry {
  domain: string;
  logoUrl: string;
  originalUrl: string;
  format: string;
  width: number | null;
  height: number | null;
  scoring: number;
  downloadedAt: string;
}

async function loadJsonDb(): Promise<LogoEntry[]> {
  try {
    const content = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

async function saveJsonDb(data: LogoEntry[]): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

export async function updateLogoEntry(entry: LogoEntry): Promise<LogoEntry[]> {
  const db = await loadJsonDb();
  
  const filtered = db.filter(item => item.domain !== entry.domain);
  
  filtered.push(entry);
  
  await saveJsonDb(filtered);
  
  return filtered;
}

export async function getLogoEntry(domain: string): Promise<LogoEntry | undefined> {
  const db = await loadJsonDb();
  return db.find(item => item.domain === domain);
}

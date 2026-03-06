import axios from 'axios';

export async function getRobotsTxt(baseUrl: string): Promise<string> {
  try {
    const url = new URL('/robots.txt', baseUrl);
    const response = await axios.get(url.href, {
      timeout: 5000,
      validateStatus: () => true,
    });
    return response.status === 200 ? response.data : '';
  } catch (e) {
    return '';
  }
}

export interface RobotRules {
  allow: string[];
  disallow: string[];
}

export function parseRobotsTxt(robotsTxt: string): RobotRules {
  const rules: RobotRules = { allow: [], disallow: [] };
  const lines = robotsTxt.split('\n');
  let currentUserAgent = '*';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const lower = trimmed.toLowerCase();
    
    if (lower.startsWith('user-agent:')) {
      currentUserAgent = trimmed.split(':')[1].trim();
    } else if (currentUserAgent === '*') {
      if (lower.startsWith('allow:')) {
        rules.allow.push(trimmed.split(':')[1].trim());
      } else if (lower.startsWith('disallow:')) {
        rules.disallow.push(trimmed.split(':')[1].trim());
      }
    }
  }
  
  return rules;
}

export function isAllowed(url: string, robotsTxt: string): boolean {
  if (!robotsTxt) return true;
  
  const rules = parseRobotsTxt(robotsTxt);
  const pathname = new URL(url).pathname;
  
  for (const disallow of rules.disallow) {
    if (disallow && pathname.startsWith(disallow)) {
      for (const allow of rules.allow) {
        if (allow && pathname.startsWith(allow)) {
          return true;
        }
      }
      return false;
    }
  }
  
  return true;
}

export async function checkRobotsTxt(url: string): Promise<boolean> {
  const baseUrl = new URL(url).origin;
  const robotsTxt = await getRobotsTxt(baseUrl);
  return isAllowed(url, robotsTxt);
}

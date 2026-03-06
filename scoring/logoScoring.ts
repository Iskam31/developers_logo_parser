import config from '../config';
import { Candidate } from '../extractors/htmlExtractor';

export interface ScoredCandidate extends Candidate {
  score: number;
  reasons: string[];
  isSquare?: boolean;
}

function isSquare(width: number | undefined, height: number | undefined): boolean {
  if (!width || !height) return false;
  const ratio = width / height;
  return ratio >= config.minSquareRatio && ratio <= 1 / config.minSquareRatio;
}

function scoreCandidate(candidate: Candidate): { score: number; reasons: string[]; isSquare: boolean } {
  let score = 0;
  const reasons: string[] = [];

  const url = candidate.url || '';
  const urlLower = url.toLowerCase();
  const path = urlLower.split('?')[0];

  if (/logo/i.test(path) && !/ologo|xlogo|blogolog|flogo/i.test(path)) {
    score += config.scoring.filenameContainsLogo;
    reasons.push('filename contains "logo"');
  }

  const parentInfo = (candidate.className || '').toLowerCase();
  
  if (/header|nav|footer|navbar|top-bar|site-header/i.test(parentInfo)) {
    score += config.scoring.inHeaderNavFooter;
    reasons.push('in header/nav/footer');
  }

  if (path.endsWith('.svg')) {
    score += config.scoring.svgFormat;
    reasons.push('SVG format');
  }

  let square = false;
  if (candidate.width && candidate.height) {
    const w = parseInt(candidate.width, 10);
    const h = parseInt(candidate.height, 10);
    if (w > h) {
      score += config.scoring.widthGreaterThanHeight;
      reasons.push('width > height');
    }
    // Check if square
    if (isSquare(w, h)) {
      square = true;
      score += 15;
      reasons.push('square format (good for circular)');
    }
  }

  if (/favicon|apple-touch|icon\b/i.test(path)) {
    score += config.scoring.pathContainsFavicon;
    reasons.push('path contains favicon');
  }

  if (candidate.source === 'meta' || candidate.source === 'schema') {
    score += 15;
    reasons.push('from meta/schema');
  } else if (candidate.source === 'css') {
    score += 5;
    reasons.push('from CSS');
  } else if (candidate.source === 'dom') {
    score += 10;
    reasons.push('from DOM');
  }

  return { score, reasons, isSquare: square };
}

export function selectBestCandidate(candidates: Candidate[]): ScoredCandidate | null {
  if (!candidates || candidates.length === 0) return null;

  const scored: ScoredCandidate[] = candidates.map(c => ({
    ...c,
    ...scoreCandidate(c),
  }));

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  
  if (best.score < config.minScore) {
    return null;
  }

  return best;
}

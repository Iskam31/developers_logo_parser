export interface Config {
  targetWidth: number;
  minSize: number;
  maxSize: number;
  minSquareRatio: number;
  scoring: {
    filenameContainsLogo: number;
    inHeaderNavFooter: number;
    svgFormat: number;
    widthGreaterThanHeight: number;
    tooSmallOrLarge: number;
    pathContainsFavicon: number;
    squareFormat: number;
  };
  minScore: number;
  concurrency: number;
  timeout: number;
  imageTimeout: number;
  waitAfterLoad: number;
  debug: boolean;
  logosBaseUrl: string;
  userAgent: string;
}

const config: Config = {
  targetWidth: 256,
  minSize: 64,
  maxSize: 1000,
  minSquareRatio: 0.8,
  scoring: {
    filenameContainsLogo: 40,
    inHeaderNavFooter: 25,
    svgFormat: 20,
    widthGreaterThanHeight: 10,
    tooSmallOrLarge: -20,
    pathContainsFavicon: -10,
    squareFormat: 15,
  },
  minScore: 30,
  concurrency: 3,
  timeout: 60000,
  imageTimeout: 15000,
  waitAfterLoad: 3000,
  debug: process.env.DEBUG === 'true',
  logosBaseUrl: process.env.LOGOS_BASE_URL || '/logos',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

export default config;

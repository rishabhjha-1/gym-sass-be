declare module 'image-diff' {
  interface ImageDiffOptions {
    actualImage: string;
    expectedImage: string;
    diffImage: string;
    shadow?: boolean;
  }

  interface ImageDiffResult {
    total: number;
  }

  function getFullResult(
    options: ImageDiffOptions,
    callback: (err: Error | null, result: ImageDiffResult) => void
  ): void;

  const imageDiff: {
    getFullResult: typeof getFullResult;
  };

  export default imageDiff;
} 
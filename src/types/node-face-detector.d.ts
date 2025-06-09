declare module 'node-face-detector' {
  interface FaceDetection {
    confidence: number;
    box: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }

  interface FaceDetector {
    detect(imageBuffer: Buffer): Promise<FaceDetection[]>;
  }

  const detector: FaceDetector;
  export default detector;
} 
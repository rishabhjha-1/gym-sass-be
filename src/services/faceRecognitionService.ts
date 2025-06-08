import * as faceapi from 'face-api.js';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || ''
  }
});

export class FaceRecognitionService {
  private static readonly FACE_DESCRIPTOR_THRESHOLD = 0.6;
  private static readonly FACE_DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 224 });
  private static readonly FACE_MATCH_OPTIONS = { distanceThreshold: this.FACE_DESCRIPTOR_THRESHOLD };
  private static readonly FACE_DESCRIPTOR_NET = new faceapi.FaceRecognitionNet();
  private static readonly FACE_LANDMARK_NET = new faceapi.FaceLandmark68Net();
  private static readonly FACE_EXPRESSION_NET = new faceapi.FaceExpressionNet();
  private static readonly BUCKET_NAME = process.env.CLOUDFLARE_BUCKET_NAME || '';

  private static faceDescriptors: Map<string, Float32Array> = new Map();
  private static isInitialized = false;

  static async initialize() {
    if (this.isInitialized) return;

    // Load face-api models
    await faceapi.nets.tinyFaceDetector.loadFromDisk('models');
    await faceapi.nets.faceLandmark68Net.loadFromDisk('models');
    await faceapi.nets.faceRecognitionNet.loadFromDisk('models');
    await faceapi.nets.faceExpressionNet.loadFromDisk('models');

    this.isInitialized = true;
  }

  static async uploadFaceImage(imageBuffer: Buffer, memberId: string): Promise<string> {
    // Optimize image before uploading
    const optimizedImage = await sharp(imageBuffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const key = `faces/${memberId}/${uuidv4()}.jpg`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: this.BUCKET_NAME,
      Key: key,
      Body: optimizedImage,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000' // Cache for 1 year
    }));

    return `https://${this.BUCKET_NAME}.r2.dev/${key}`;
  }

  static async verifyFace(imageBuffer: Buffer, memberId: string): Promise<boolean> {
    try {
      await this.initialize();

      // Load the stored face descriptor
      const storedDescriptor = this.faceDescriptors.get(memberId);
      if (!storedDescriptor) {
        throw new Error('No face registered for this member');
      }

      // Process image for face detection
      const processedImage = await sharp(imageBuffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();
      // Create HTML canvas element
      const blob = new Blob([processedImage], { type: 'image/jpeg' });
      const img = await faceapi.bufferToImage(blob);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      const detections = await faceapi
        .detectAllFaces(canvas, this.FACE_DETECTION_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        return false;
      }

      // Compare the detected face with the stored face
      const matcher = new faceapi.FaceMatcher([new faceapi.LabeledFaceDescriptors(memberId, [storedDescriptor])]);
      const bestMatch = matcher.findBestMatch(detections[0].descriptor);

      return bestMatch.label === memberId && bestMatch.distance < this.FACE_DESCRIPTOR_THRESHOLD;
    } catch (error) {
      console.error('Face verification error:', error);
      throw new Error('Failed to verify face');
    }
  }

  static async indexFace(imageBuffer: Buffer, memberId: string): Promise<void> {
    try {
      await this.initialize();

      // Process image for face detection
      const processedImage = await sharp(imageBuffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();
      // Create HTML canvas element
      const blob = new Blob([processedImage], { type: 'image/jpeg' });
      const img = await faceapi.bufferToImage(blob);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      // Detect face and get descriptor
      const detections = await faceapi
        .detectAllFaces(canvas, this.FACE_DETECTION_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        throw new Error('No face detected in the image');
      }

      if (detections.length > 1) {
        throw new Error('Multiple faces detected. Please provide an image with only one face');
      }

      // Store the face descriptor
      this.faceDescriptors.set(memberId, detections[0].descriptor);
    } catch (error) {
      console.error('Face indexing error:', error);
      throw new Error('Failed to index face');
    }
  }
} 
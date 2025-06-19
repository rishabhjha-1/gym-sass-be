import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import cloudinary from 'cloudinary';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import * as faceapi from 'face-api.js';
import { Canvas, Image, ImageData } from 'canvas';
import { FaceDetection } from 'face-api.js';
import * as tf from '@tensorflow/tfjs-node';
import PythonFaceRecognitionService from './pythonFaceRecognitionService';

// Configure Cloudinary
(cloudinary.v2 as any).config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

const prisma = new PrismaClient();

// Configure face-api.js
const canvas = new Canvas(1, 1);
const image = new Image();
const imageData = new ImageData(1, 1);

// Initialize face-api.js environment
faceapi.env.monkeyPatch({
  Canvas: canvas.constructor as any,
  Image: image.constructor as any,
  ImageData: imageData.constructor as any,
  createCanvasElement: () => new Canvas(1, 1) as any,
  createImageElement: () => new Image() as any
});

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
}

interface CloudinaryError {
  message?: string;
  http_code?: number;
}

interface CloudinaryResult {
  secure_url: string;
  public_id: string;
}

interface CloudinaryUploader {
  upload_stream: (options: any, callback: (error: CloudinaryError | null, result: CloudinaryResult | undefined) => void) => {
    end: (buffer: Buffer) => void;
  };
}

// Cache for face descriptors to avoid recomputation
interface FaceDescriptorCache {
  descriptor: Float32Array;
  timestamp: number;
}

class FaceRecognitionService {
  private static instance: FaceRecognitionService;
  private isInitialized: boolean = false;
  private static faceImages: Map<string, Buffer> = new Map();
  private static faceDescriptorCache: Map<string, FaceDescriptorCache> = new Map();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private pythonService: PythonFaceRecognitionService;
  
  // Optimized detection options for speed
  private static readonly FACE_DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({ 
    inputSize: 320, // Optimal size for speed/accuracy balance
    scoreThreshold: 0.8 // Stricter threshold for better quality faces
  });
  private static readonly MAX_IMAGE_SIZE = 320; // Optimal size for processing
  private static readonly MIN_FACE_SIZE = 80; // Minimum face size in pixels

  private constructor() {
    this.pythonService = PythonFaceRecognitionService.getInstance();
  }

  public static getInstance(): FaceRecognitionService {
    if (!FaceRecognitionService.instance) {
      FaceRecognitionService.instance = new FaceRecognitionService();
    }
    return FaceRecognitionService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Face recognition service already initialized');
      return;
    }

    try {
      console.log('Initializing face recognition service...');
      
      // Check if Python service is available
      const isHealthy = await this.pythonService.healthCheck();
      if (!isHealthy) {
        console.warn('Python face recognition service is not available, falling back to Node.js service');
        // Load face-api.js models as fallback
        const modelsPath = path.join(__dirname, '../../models');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
          faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
          faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath)
        ]);
      } else {
        console.log('Python face recognition service is available and healthy');
      }

      this.isInitialized = true;
      console.log('Face recognition service initialized successfully');
    } catch (error) {
      console.error('Error initializing face recognition service:', error);
      throw error;
    }
  }

  // Optimized image processing - resize before detection
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    return sharp(imageBuffer)
      .resize(FaceRecognitionService.MAX_IMAGE_SIZE, FaceRecognitionService.MAX_IMAGE_SIZE, { 
        fit: 'inside', 
        withoutEnlargement: true,
        fastShrinkOnLoad: true,
        kernel: 'nearest' // Fastest resize kernel
      })
      .jpeg({ 
        quality: 50, // Further reduced quality for speed
        chromaSubsampling: '4:2:0',
        optimizeScans: true,
        optimizeCoding: true,
        progressive: false // Disable progressive for faster processing
      })
      .toBuffer();
  }

  // Direct buffer to image conversion without file I/O
  private async bufferToImageDirect(buffer: Buffer): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => resolve(img as any);
        img.onerror = reject;
        
        // Use data URL instead of file system
        const base64 = buffer.toString('base64');
        const mimeType = this.getMimeType(buffer);
        img.src = `data:${mimeType};base64,${base64}`;
      } catch (error) {
        reject(error);
      }
    });
  }

  // Detect MIME type from buffer
  private getMimeType(buffer: Buffer): string {
    const header = buffer.toString('hex', 0, 4);
    if (header.startsWith('ffd8')) return 'image/jpeg';
    if (header.startsWith('8950')) return 'image/png';
    if (header.startsWith('4749')) return 'image/gif';
    if (header.startsWith('5249')) return 'image/webp';
    return 'image/jpeg'; // default
  }

  // Check if face is properly aligned and centered
  private checkFaceAlignment(detection: any): boolean {
    try {
      const box = detection.box;
      const imageWidth = 320; // Based on MAX_IMAGE_SIZE
      const imageHeight = 320;
      
      // Check if face is reasonably centered
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const imageCenterX = imageWidth / 2;
      const imageCenterY = imageHeight / 2;
      
      const centerOffsetX = Math.abs(faceCenterX - imageCenterX) / imageWidth;
      const centerOffsetY = Math.abs(faceCenterY - imageCenterY) / imageHeight;
      
      // Face should be within 30% of center
      if (centerOffsetX > 0.3 || centerOffsetY > 0.3) {
        console.log(`Face not centered - X offset: ${centerOffsetX}, Y offset: ${centerOffsetY}`);
        return false;
      }
      
      // Check face aspect ratio (should be roughly square-ish)
      const aspectRatio = box.width / box.height;
      if (aspectRatio < 0.7 || aspectRatio > 1.4) {
        console.log(`Face aspect ratio too extreme: ${aspectRatio}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking face alignment:', error);
      return false;
    }
  }

  // Optimized face detection with preprocessing
  private async detectFace(imageBuffer: Buffer): Promise<boolean> {
    try {
      console.log('Processing image for face detection...');
      
      const processedBuffer = await this.preprocessImage(imageBuffer);
      const img = await this.bufferToImageDirect(processedBuffer);
      
      const detections = await faceapi.detectAllFaces(
        img as any, 
        FaceRecognitionService.FACE_DETECTION_OPTIONS
      );

      // Check if exactly one face is detected
      if (detections.length !== 1) {
        console.log(`Invalid number of faces detected: ${detections.length}`);
        return false;
      }

      // Check face size
      const detection = detections[0];
      const faceSize = Math.max(detection.box.width, detection.box.height);
      if (faceSize < FaceRecognitionService.MIN_FACE_SIZE) {
        console.log(`Face too small: ${faceSize}px`);
        return false;
      }

      // Check face alignment
      if (!this.checkFaceAlignment(detection)) {
        console.log('Face not properly aligned');
        return false;
      }

      console.log(`Face detection result: true (size: ${faceSize}px)`);
      return true;
    } catch (error) {
      console.error('Error detecting face:', error);
      throw error;
    }
  }

  // Validate face descriptor quality
  private validateFaceDescriptor(descriptor: Float32Array): boolean {
    try {
      if (!descriptor || descriptor.length === 0) {
        return false;
      }

      // Check for reasonable descriptor values
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      
      for (let i = 0; i < descriptor.length; i++) {
        const val = descriptor[i];
        sum += val;
        min = Math.min(min, val);
        max = Math.max(max, val);
      }

      const mean = sum / descriptor.length;
      const range = max - min;

      // Descriptor should have reasonable statistics
      if (Math.abs(mean) > 1.0 || range < 0.1 || range > 10.0) {
        console.log(`Invalid descriptor stats - mean: ${mean}, range: ${range}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating face descriptor:', error);
      return false;
    }
  }

  // Get face descriptor with caching and optimization
  private async getFaceDescriptor(imageBuffer: Buffer, cacheKey?: string): Promise<Float32Array | null> {
    try {
      if (cacheKey) {
        const cached = FaceRecognitionService.faceDescriptorCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < FaceRecognitionService.CACHE_TTL) {
          return cached.descriptor;
        }
      }

      const processedBuffer = await this.preprocessImage(imageBuffer);
      const img = await this.bufferToImageDirect(processedBuffer);
      
      // Get face detection with landmarks and descriptor
      const detection = await faceapi.detectSingleFace(
        img as any, 
        FaceRecognitionService.FACE_DETECTION_OPTIONS
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

      if (!detection) {
        return null;
      }

      // Validate landmarks
      const landmarks = detection.landmarks;
      if (!landmarks || !this.validateLandmarks(landmarks)) {
        console.log('Invalid face landmarks detected');
        return null;
      }

      // Validate descriptor quality
      if (!this.validateFaceDescriptor(detection.descriptor)) {
        console.log('Invalid face descriptor quality');
        return null;
      }

      if (cacheKey) {
        FaceRecognitionService.faceDescriptorCache.set(cacheKey, {
          descriptor: detection.descriptor,
          timestamp: Date.now()
        });
      }

      return detection.descriptor;
    } catch (error) {
      console.error('Error getting face descriptor:', error);
      return null;
    }
  }

  // Validate face landmarks
  private validateLandmarks(landmarks: any): boolean {
    try {
      // Check if all required landmarks are present
      if (!landmarks.positions || landmarks.positions.length < 68) {
        return false;
      }

      // Check for symmetry in facial features
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const nose = landmarks.getNose();
      const mouth = landmarks.getMouth();

      if (!leftEye || !rightEye || !nose || !mouth) {
        return false;
      }

      // Check if eyes are roughly at the same height
      const eyeHeightDiff = Math.abs(leftEye[0].y - rightEye[0].y);
      if (eyeHeightDiff > 10) {
        return false;
      }

      // Check if nose is roughly centered
      const faceWidth = Math.abs(rightEye[rightEye.length - 1].x - leftEye[0].x);
      const noseCenter = nose[0].x;
      const faceCenter = leftEye[0].x + faceWidth / 2;
      if (Math.abs(noseCenter - faceCenter) > faceWidth * 0.2) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating landmarks:', error);
      return false;
    }
  }

  private async uploadFaceImage(imageBuffer: Buffer): Promise<CloudinaryUploadResponse> {
    try {
      console.log('Optimizing image for upload...');
      const optimizedImage = await sharp(imageBuffer)
        .resize(800, 800, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();

      console.log('Uploading to Cloudinary...');
      return new Promise((resolve, reject) => {
        const uploader = cloudinary.v2.uploader as unknown as CloudinaryUploader;
        const uploadStream = uploader.upload_stream(
          {
            folder: 'face-images',
            public_id: `face-${uuidv4()}`,
            resource_type: 'image'
          },
          (error: CloudinaryError | null, result: CloudinaryResult | undefined) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              reject(error);
            } else if (!result || !result.secure_url || !result.public_id) {
              reject(new Error('Invalid response from Cloudinary'));
            } else {
              console.log('Upload successful:', result);
              resolve({
                secure_url: result.secure_url,
                public_id: result.public_id
              });
            }
          }
        );
        uploadStream.end(optimizedImage);
      });
    } catch (error) {
      console.error('Error uploading face image:', error);
      throw error;
    }
  }

  // Ultra-optimized face comparison using descriptors with early exit
  private compareFaceDescriptors(descriptor1: Float32Array, descriptor2: Float32Array): boolean {
    try {
      if (!descriptor1 || !descriptor2 || descriptor1.length !== descriptor2.length) {
        return false;
      }

      // Use cosine similarity for better performance and accuracy
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;
      
      // Use full descriptor length for better accuracy
      const len = descriptor1.length;
      
      for (let i = 0; i < len; i++) {
        const val1 = descriptor1[i];
        const val2 = descriptor2[i];
        
        dotProduct += val1 * val2;
        norm1 += val1 * val1;
        norm2 += val2 * val2;
      }

      // Early exit if norms are too different (indicates very different faces)
      const normDiff = Math.abs(Math.sqrt(norm1) - Math.sqrt(norm2));
      if (normDiff > 2.0) {
        console.log(`Face similarity score: 0.0 (norm difference too high: ${normDiff})`);
        return false;
      }

      const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
      
      // Log similarity score for debugging
      console.log(`Face similarity score: ${similarity}`);
      
      // Much stricter threshold - require 85% similarity
      return similarity > 0.85;
    } catch (error) {
      console.error('Error comparing face descriptors:', error);
      return false;
    }
  }

  // Main verification method - uses Python service for speed
  public async verifyFace(imageBuffer: Buffer, memberId: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('Starting face verification with Python service...');
      const startTime = Date.now();

      // Try Python service first
      try {
        const isMatch = await this.pythonService.verifyFace(imageBuffer, memberId);
        const endTime = Date.now();
        console.log(`Python face verification completed in ${endTime - startTime}ms, result: ${isMatch}`);
        return isMatch;
      } catch (pythonError) {
        console.warn('Python service failed, falling back to Node.js service:', pythonError);
        
        // Fallback to Node.js service
        return await this.verifyFaceNodeJS(imageBuffer, memberId);
      }
    } catch (error) {
      console.error('Error verifying face:', error);
      throw error;
    }
  }

  // Node.js fallback verification method
  private async verifyFaceNodeJS(imageBuffer: Buffer, memberId: string): Promise<boolean> {
    try {
      console.log('Using Node.js face verification fallback...');
      const startTime = Date.now();

      // Get member's photo URL and cached descriptor in parallel
      const [member, verificationDescriptor] = await Promise.all([
        prisma.member.findUnique({
          where: { memberId: memberId },
          select: { photoUrl: true }
        }),
        this.getFaceDescriptor(imageBuffer)
      ]);

      if (!member?.photoUrl || !verificationDescriptor) {
        return false;
      }

      // Get stored face descriptor (with caching)
      let storedDescriptor = FaceRecognitionService.faceDescriptorCache.get(`stored_${memberId}`)?.descriptor;
      
      if (!storedDescriptor) {
        const response = await fetch(member.photoUrl);
        if (!response.ok) {
          return false;
        }

        const storedFaceBuffer = Buffer.from(await response.arrayBuffer());
        storedDescriptor = await this.getFaceDescriptor(storedFaceBuffer, `stored_${memberId}`) || undefined;
        
        if (!storedDescriptor) {
          return false;
        }
      }

      const isMatch = this.compareFaceDescriptors(storedDescriptor, verificationDescriptor);
      const endTime = Date.now();
      console.log(`Node.js face verification completed in ${endTime - startTime}ms, result: ${isMatch}`);
      return isMatch;
    } catch (error) {
      console.error('Error in Node.js face verification:', error);
      throw error;
    }
  }

  public async indexFace(imageBuffer: Buffer, memberId: string): Promise<string> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('Processing face for indexing...');
      
      // Try Python service first
      try {
        const photoUrl = await this.pythonService.indexFace(imageBuffer, memberId);
        console.log('Face indexed successfully with Python service');
        return photoUrl;
      } catch (pythonError) {
        console.warn('Python service failed, falling back to Node.js service:', pythonError);
        
        // Fallback to Node.js service
        return await this.indexFaceNodeJS(imageBuffer, memberId);
      }
    } catch (error) {
      console.error('Error indexing face:', error);
      throw error;
    }
  }

  // Node.js fallback indexing method
  private async indexFaceNodeJS(imageBuffer: Buffer, memberId: string): Promise<string> {
    try {
      console.log('Using Node.js face indexing fallback...');
      
      // Detect face and get descriptor
      const faceDescriptor = await this.getFaceDescriptor(imageBuffer);
      if (!faceDescriptor) {
        throw new Error('No face detected in the image');
      }

      // Store face image
      FaceRecognitionService.faceImages.set(memberId, imageBuffer);

      // Cache the descriptor for future verifications
      FaceRecognitionService.faceDescriptorCache.set(`stored_${memberId}`, {
        descriptor: faceDescriptor,
        timestamp: Date.now()
      });

      console.log('Uploading face image...');
      const uploadResult = await this.uploadFaceImage(imageBuffer);

      return uploadResult.secure_url;
    } catch (error) {
      console.error('Error in Node.js face indexing:', error);
      throw error;
    }
  }

  // Utility method to clear cache
  public clearCache(): void {
    FaceRecognitionService.faceDescriptorCache.clear();
    this.pythonService.clearCache();
    console.log('Face descriptor cache cleared');
  }

  // Utility method to warm up cache
  public async warmUpCache(memberIds: string[]): Promise<void> {
    console.log('Warming up cache for members:', memberIds);
    
    const members = await prisma.member.findMany({
      where: { memberId: { in: memberIds } },
      select: { memberId: true, photoUrl: true }
    });

    const promises = members.map(async (member) => {
      if (member.photoUrl) {
        try {
          const response = await fetch(member.photoUrl);
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            await this.getFaceDescriptor(buffer, `stored_${member.memberId}`);
          }
        } catch (error) {
          console.error(`Failed to warm up cache for member ${member.memberId}:`, error);
        }
      }
    });

    await Promise.all(promises);
    console.log('Cache warm-up completed');
  }
}

export default FaceRecognitionService;
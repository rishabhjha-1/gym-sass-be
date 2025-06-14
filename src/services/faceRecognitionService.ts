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
  
  // Optimized detection options for speed
  private static readonly FACE_DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({ 
    inputSize: 160, // Further reduced for faster processing
    scoreThreshold: 0.3 // More aggressive threshold
  });
  private static readonly FACE_MATCH_THRESHOLD = 0.55; // Slightly adjusted for speed
  private static readonly MAX_IMAGE_SIZE = 300; // Further reduced maximum dimension
  private static readonly DESCRIPTOR_COMPARE_LENGTH = 64; // Reduced comparison length
  private static readonly EARLY_EXIT_THRESHOLD = 0.3; // Early exit threshold for comparison

  private constructor() {}

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
      
      // Load face-api.js models
      const modelsPath = path.join(__dirname, '../../models');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
        faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
        faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath)
        // Removed faceExpressionNet as it's not needed for recognition
      ]);

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
        quality: 60, // Further reduced quality
        chromaSubsampling: '4:2:0',
        optimizeScans: true,
        optimizeCoding: true
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

  // Optimized face detection with preprocessing
  private async detectFace(imageBuffer: Buffer): Promise<boolean> {
    try {
      console.log('Processing image for face detection...');
      
      // Preprocess image for faster detection
      const processedBuffer = await this.preprocessImage(imageBuffer);
      const img = await this.bufferToImageDirect(processedBuffer);
      
      // Detect faces with optimized options
      const detections = await faceapi.detectAllFaces(
        img as any, 
        FaceRecognitionService.FACE_DETECTION_OPTIONS
      );

      const hasFace = detections.length > 0;
      console.log(`Face detection result: ${hasFace}`);
      return hasFace;
    } catch (error) {
      console.error('Error detecting face:', error);
      throw error;
    }
  }

  // Get face descriptor with caching and optimization
  private async getFaceDescriptor(imageBuffer: Buffer, cacheKey?: string): Promise<Float32Array | null> {
    try {
      // Check cache first
      if (cacheKey) {
        const cached = FaceRecognitionService.faceDescriptorCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < FaceRecognitionService.CACHE_TTL) {
          return cached.descriptor;
        }
      }

      // Preprocess image with reduced quality
      const processedBuffer = await this.preprocessImage(imageBuffer);
      const img = await this.bufferToImageDirect(processedBuffer);
      
      // Get face descriptor with optimized options
      const detection = await faceapi.detectSingleFace(
        img as any, 
        FaceRecognitionService.FACE_DETECTION_OPTIONS
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

      if (!detection) {
        return null;
      }

      // Cache the descriptor
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
      // Early exit if descriptors are empty
      if (!descriptor1 || !descriptor2 || descriptor1.length !== descriptor2.length) {
        return false;
      }

      // Use a more efficient distance calculation with early exit
      let sum = 0;
      const len = Math.min(descriptor1.length, FaceRecognitionService.DESCRIPTOR_COMPARE_LENGTH);
      
      for (let i = 0; i < len; i++) {
        const diff = descriptor1[i] - descriptor2[i];
        sum += diff * diff;
        
        // Early exit if distance is already too large
        if (sum > FaceRecognitionService.EARLY_EXIT_THRESHOLD) {
          return false;
        }
      }

      const distance = Math.sqrt(sum);
      const similarity = 1 - (distance / 2);
      return similarity > FaceRecognitionService.FACE_MATCH_THRESHOLD;
    } catch (error) {
      console.error('Error comparing face descriptors:', error);
      return false;
    }
  }

  // Main verification method - ultra optimized
  public async verifyFace(imageBuffer: Buffer, memberId: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

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

      return this.compareFaceDescriptors(storedDescriptor, verificationDescriptor);
    } catch (error) {
      console.error('Error verifying face:', error);
      throw error;
    }
  }

  public async indexFace(imageBuffer: Buffer, memberId: string): Promise<string> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('Processing face for indexing...');
      
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
      console.error('Error indexing face:', error);
      throw error;
    }
  }

  // Utility method to clear cache
  public clearCache(): void {
    FaceRecognitionService.faceDescriptorCache.clear();
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
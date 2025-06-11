import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import cloudinary from 'cloudinary';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import * as faceapi from 'face-api.js';
import { Canvas, Image, ImageData } from 'canvas';
import { FaceDetection } from 'face-api.js';

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

class FaceRecognitionService {
  private static instance: FaceRecognitionService;
  private isInitialized: boolean = false;
  private static faceImages: Map<string, Buffer> = new Map();
  private static readonly FACE_DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({ 
    inputSize: 416,
    scoreThreshold: 0.5 
  });
  private static readonly FACE_MATCH_THRESHOLD = 0.6;

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
        faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath),
        faceapi.nets.faceExpressionNet.loadFromDisk(modelsPath)
      ]);

      this.isInitialized = true;
      console.log('Face recognition service initialized successfully');
    } catch (error) {
      console.error('Error initializing face recognition service:', error);
      throw error;
    }
  }

  private async detectFace(imageBuffer: Buffer): Promise<boolean> {
    try {
      console.log('Processing image for face detection...');
      
      // Convert buffer to HTMLImageElement
      const img = await this.bufferToImage(imageBuffer);
      
      // Detect faces
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

  private async bufferToImage(buffer: Buffer): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      try {
        // Create a temporary file to store the image
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, `temp-${uuidv4()}.jpg`);
        
        // Write buffer to temporary file
        fs.writeFileSync(tempFilePath, buffer);
        
        const img = new Image();
        img.onload = () => {
          // Clean up the temporary file
          fs.unlinkSync(tempFilePath);
          resolve(img as any);
        };
        img.onerror = (err) => {
          // Clean up the temporary file
          fs.unlinkSync(tempFilePath);
          reject(err);
        };
        
        img.src = tempFilePath;
      } catch (error) {
        reject(error);
      }
    });
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

  private async compareFaces(face1: Buffer, face2: Buffer): Promise<boolean> {
    try {
      // Convert buffers to images
      const [img1, img2] = await Promise.all([
        this.bufferToImage(face1),
        this.bufferToImage(face2)
      ]);

      // Detect faces and compute descriptors
      const [detections1, detections2] = await Promise.all([
        faceapi.detectAllFaces(img1 as any, FaceRecognitionService.FACE_DETECTION_OPTIONS)
          .withFaceLandmarks()
          .withFaceDescriptors(),
        faceapi.detectAllFaces(img2 as any, FaceRecognitionService.FACE_DETECTION_OPTIONS)
          .withFaceLandmarks()
          .withFaceDescriptors()
      ]);

      if (detections1.length === 0 || detections2.length === 0) {
        console.log('No faces detected in one or both images');
        return false;
      }

      // Compare face descriptors
      const distance = faceapi.euclideanDistance(
        detections1[0].descriptor,
        detections2[0].descriptor
      );

      // Convert distance to similarity score (0-1)
      const similarity = 1 - (distance / 2);
      const isMatch = similarity > FaceRecognitionService.FACE_MATCH_THRESHOLD;

      console.log('Face comparison details:', {
        distance,
        similarity,
        isMatch,
        threshold: FaceRecognitionService.FACE_MATCH_THRESHOLD
      });

      return isMatch;
    } catch (error) {
      console.error('Error comparing faces:', error);
      throw error;
    }
  }

  public async verifyFace(imageBuffer: Buffer, memberId: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('Detecting face in verification image...');
      const hasFace = await this.detectFace(imageBuffer);

      if (!hasFace) {
        console.log('No face detected in verification image');
        return false;
      }

      // Get member's photo URL from database
      const member = await prisma.member.findUnique({
        where: { memberId: memberId },
        select: { photoUrl: true }
      });

      if (!member || !member.photoUrl) {
        console.log('No face registered for this member');
        return false;
      }

      // Download the stored face image from Cloudinary
      const response = await fetch(member.photoUrl);
      if (!response.ok) {
        console.log('Failed to fetch stored face image');
        return false;
      }

      const storedFaceBuffer = Buffer.from(await response.arrayBuffer());
      
      // Compare faces
      const isMatch = await this.compareFaces(storedFaceBuffer, imageBuffer);
      console.log('Face match result:', isMatch);
      
      return isMatch;
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

      console.log('Detecting face in index image...');
      const hasFace = await this.detectFace(imageBuffer);

      if (!hasFace) {
        throw new Error('No face detected in the image');
      }

      // Store face image
      FaceRecognitionService.faceImages.set(memberId, imageBuffer);

      console.log('Uploading face image...');
      const uploadResult = await this.uploadFaceImage(imageBuffer);

      return uploadResult.secure_url;
    } catch (error) {
      console.error('Error indexing face:', error);
      throw error;
    }
  }
}

export default FaceRecognitionService;
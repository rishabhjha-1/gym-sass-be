import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import cloudinary from 'cloudinary';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

// Configure Cloudinary
(cloudinary.v2 as any).config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

const prisma = new PrismaClient();

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
      
      // Convert image to grayscale and resize
      const processedImage = await sharp(imageBuffer)
        .grayscale()
        .resize(100, 100)
        .toBuffer();

      // Calculate image statistics
      const stats = await sharp(processedImage).stats();
      const mean = stats.channels[0].mean;
      const stdev = stats.channels[0].stdev;

      // Simple face detection based on image statistics
      // Faces typically have higher contrast and specific brightness patterns
      const hasFace = mean > 50 && mean < 200 && stdev > 30;
      
      console.log(`Face detection result: ${hasFace}`);
      return hasFace;
    } catch (error) {
      console.error('Error detecting face:', error);
      throw error;
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

  private async compareFaces(face1: Buffer, face2: Buffer): Promise<boolean> {
    try {
      // Enhanced preprocessing
      const [processed1, processed2] = await Promise.all([
        sharp(face1)
          .grayscale()
          .normalize() // Normalize brightness
          .sharpen() // Enhance edges
          .resize(200, 200, { fit: 'fill' }) // Increased resolution
          .toBuffer(),
        sharp(face2)
          .grayscale()
          .normalize()
          .sharpen()
          .resize(200, 200, { fit: 'fill' })
          .toBuffer()
      ]);

      // Get image data
      const [data1, data2] = await Promise.all([
        sharp(processed1).raw().toBuffer(),
        sharp(processed2).raw().toBuffer()
      ]);

      // Calculate multiple comparison metrics
      let totalDiff = 0;
      let structuralDiff = 0;
      const histogram1 = new Array(256).fill(0);
      const histogram2 = new Array(256).fill(0);
      const blockSize = 20; // Size of blocks for structural comparison

      // Calculate MSE and build histograms
      for (let i = 0; i < data1.length; i++) {
        const diff = Math.abs(data1[i] - data2[i]);
        totalDiff += diff * diff;
        
        histogram1[data1[i]]++;
        histogram2[data2[i]]++;
      }

      // Calculate structural similarity (SSIM-like metric)
      for (let y = 0; y < 200; y += blockSize) {
        for (let x = 0; x < 200; x += blockSize) {
          let block1Sum = 0, block2Sum = 0;
          let block1SqSum = 0, block2SqSum = 0;
          let blockCrossSum = 0;
          
          for (let by = 0; by < blockSize; by++) {
            for (let bx = 0; bx < blockSize; bx++) {
              const idx = (y + by) * 200 + (x + bx);
              const val1 = data1[idx];
              const val2 = data2[idx];
              
              block1Sum += val1;
              block2Sum += val2;
              block1SqSum += val1 * val1;
              block2SqSum += val2 * val2;
              blockCrossSum += val1 * val2;
            }
          }
          
          const blockSizeSq = blockSize * blockSize;
          const block1Mean = block1Sum / blockSizeSq;
          const block2Mean = block2Sum / blockSizeSq;
          
          const block1Var = (block1SqSum / blockSizeSq) - (block1Mean * block1Mean);
          const block2Var = (block2SqSum / blockSizeSq) - (block2Mean * block2Mean);
          const blockCov = (blockCrossSum / blockSizeSq) - (block1Mean * block2Mean);
          
          const blockSimilarity = (2 * blockCov) / (block1Var + block2Var + 1e-6);
          structuralDiff += (1 - blockSimilarity);
        }
      }

      // Calculate histogram similarity
      let histogramDiff = 0;
      for (let i = 0; i < 256; i++) {
        histogramDiff += Math.abs(histogram1[i] - histogram2[i]);
      }
      const histogramSimilarity = 1 - (histogramDiff / (2 * data1.length));

      // Calculate MSE
      const mse = totalDiff / data1.length;
      
      // Calculate structural similarity
      const structuralSimilarity = 1 - (structuralDiff / ((200/blockSize) * (200/blockSize)));

      // Calculate final similarity score with adjusted weights
      const similarity = (
        (1 - (mse / (255 * 255))) * 0.4 + // MSE weight reduced
        histogramSimilarity * 0.2 + // Histogram weight reduced
        structuralSimilarity * 0.4 // Added structural similarity
      );

      // Dynamic threshold based on image quality
      const threshold = 0.82; // Slightly lowered threshold
      const isMatch = similarity > threshold;
      
      console.log('Enhanced face comparison details:', {
        mse,
        histogramSimilarity,
        structuralSimilarity,
        finalSimilarity: similarity,
        isMatch,
        threshold
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
      console.log('member.photoUrl', member.photoUrl);
      const storedFaceBuffer = Buffer.from(await response.arrayBuffer());
      console.log('storedFaceBuffer', storedFaceBuffer);  
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
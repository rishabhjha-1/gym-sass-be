import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import cloudinary from 'cloudinary';
import path from 'path';
import fs from 'fs';
// @ts-ignore
import imageDiff from 'image-diff';

// Configure Cloudinary
(cloudinary.v2 as any).config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
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
      // Process both images to same size and format
      const [processed1, processed2] = await Promise.all([
        sharp(face1).grayscale().resize(100, 100).toBuffer(),
        sharp(face2).grayscale().resize(100, 100).toBuffer()
      ]);

      // Save temporary files for image-diff
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }

      const temp1 = path.join(tempDir, 'face1.jpg');
      const temp2 = path.join(tempDir, 'face2.jpg');
      const diffOutput = path.join(tempDir, 'diff.png');

      await Promise.all([
        fs.promises.writeFile(temp1, processed1),
        fs.promises.writeFile(temp2, processed2)
      ]);

      // Compare images
      return new Promise((resolve, reject) => {
        imageDiff.getFullResult({
          actualImage: temp1,
          expectedImage: temp2,
          diffImage: diffOutput,
          shadow: true
        }, (err: Error | null, result: { total: number }) => {
          // Clean up temp files
          Promise.all([
            fs.promises.unlink(temp1),
            fs.promises.unlink(temp2),
            fs.promises.unlink(diffOutput)
          ]).catch(console.error);

          if (err) {
            reject(err);
            return;
          }

          // Calculate similarity (lower total means more similar)
          const similarity = 1 - (result.total / (100 * 100 * 255));
          const isMatch = similarity > 0.8; // 80% similarity threshold
          
          console.log('Face comparison result:', { similarity, isMatch });
          resolve(isMatch);
        });
      });
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

      // Get stored face image
      const storedFace = FaceRecognitionService.faceImages.get(memberId);
      if (!storedFace) {
        console.log('No face registered for this member');
        return false;
      }

      // Compare faces
      const isMatch = await this.compareFaces(storedFace, imageBuffer);
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
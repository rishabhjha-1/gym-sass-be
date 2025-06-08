import * as faceapi from 'face-api.js';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import cloudinary from 'cloudinary';
import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
}

// Define model paths
const MODEL_PATH = path.join(__dirname, '../../models');
const FACE_DETECTION_MODEL = path.join(MODEL_PATH, 'tiny_face_detector_model-weights_manifest.json');
const FACE_LANDMARK_MODEL = path.join(MODEL_PATH, 'face_landmark_68_model-weights_manifest.json');
const FACE_RECOGNITION_MODEL = path.join(MODEL_PATH, 'face_recognition_model-weights_manifest.json');

class FaceRecognitionService {
  private static instance: FaceRecognitionService;
  private isInitialized: boolean = false;

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
      console.log('Model paths:', {
        FACE_DETECTION_MODEL,
        FACE_LANDMARK_MODEL,
        FACE_RECOGNITION_MODEL
      });

      // Validate model files exist
      [FACE_DETECTION_MODEL, FACE_LANDMARK_MODEL, FACE_RECOGNITION_MODEL].forEach(modelPath => {
        if (!fs.existsSync(modelPath)) {
          throw new Error(`Model file not found: ${modelPath}`);
        }
      });

      // Load models
      console.log('Loading face detection model...');
      await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH);
      console.log('Loading face landmark model...');
      await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
      console.log('Loading face recognition model...');
      await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);

      this.isInitialized = true;
      console.log('Face recognition service initialized successfully');
    } catch (error) {
      console.error('Error initializing face recognition service:', error);
      throw error;
    }
  }

  private async detectFace(imageBuffer: Buffer): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>>[]> {
    try {
      console.log('Processing image for face detection...');
      const image = await loadImage(imageBuffer);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);

      console.log('Detecting faces...');
      // Convert canvas to HTMLCanvasElement
      const htmlCanvas = canvas as unknown as HTMLCanvasElement;
      // Add required properties to match HTMLCanvasElement interface
      Object.defineProperties(htmlCanvas, {
        width: { value: canvas.width },
        height: { value: canvas.height },
        getContext: { value: () => ctx }
      });

      const detections = await faceapi
        .detectAllFaces(htmlCanvas, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      console.log(`Found ${detections.length} faces`);
      return detections;
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
        cloudinary.v2.uploader.upload_stream(
          {
            folder: 'face-images',
            public_id: `face-${uuidv4()}`,
            resource_type: 'image'
          },
          (error, result) => {
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
        ).end(optimizedImage);
      });
    } catch (error) {
      console.error('Error uploading face image:', error);
      throw error;
    }
  }

  private static faceDescriptors: Map<string, Float32Array> = new Map();

  public async verifyFace(imageBuffer: Buffer, memberId: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('Detecting face in verification image...');
      const detections = await this.detectFace(imageBuffer);
      
      if (detections.length === 0) {
        console.log('No face detected in verification image');
        return false;
      }

      if (detections.length > 1) {
        console.log('Multiple faces detected in verification image');
        return false;
      }

      // Get stored face descriptor
      const storedDescriptor = FaceRecognitionService.faceDescriptors.get(memberId);
      if (!storedDescriptor) {
        console.log('No face registered for this member');
        return false;
      }

      // Compare faces
      const matcher = new faceapi.FaceMatcher([new faceapi.LabeledFaceDescriptors(memberId, [storedDescriptor])]);
      const bestMatch = matcher.findBestMatch(detections[0].descriptor);
      
      console.log('Face match result:', bestMatch.toString());
      return bestMatch.label === memberId && bestMatch.distance < 0.6;
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
      const detections = await this.detectFace(imageBuffer);
      
      if (detections.length === 0) {
        throw new Error('No face detected in the image');
      }

      if (detections.length > 1) {
        throw new Error('Multiple faces detected in the image');
      }

      // Store face descriptor
      FaceRecognitionService.faceDescriptors.set(memberId, detections[0].descriptor);

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
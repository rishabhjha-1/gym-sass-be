import { PrismaClient } from '@prisma/client';

interface FaceVerificationRequest {
  image_data: string;
  member_id: string;
  stored_image_url: string;
}

interface FaceVerificationResponse {
  success: boolean;
  is_match: boolean;
  similarity_score: number;
  processing_time: number;
  error_message?: string;
}

interface FaceIndexRequest {
  image_data: string;
  member_id: string;
}

interface FaceIndexResponse {
  success: boolean;
  face_detected: boolean;
  processing_time: number;
  error_message?: string;
}

class PythonFaceRecognitionService {
  private static instance: PythonFaceRecognitionService;
  private baseUrl: string;
  private prisma: PrismaClient;

  private constructor() {
    this.baseUrl = process.env.PYTHON_FACE_SERVICE_URL || 'http://localhost:8000';
    this.prisma = new PrismaClient();
  }

  public static getInstance(): PythonFaceRecognitionService {
    if (!PythonFaceRecognitionService.instance) {
      PythonFaceRecognitionService.instance = new PythonFaceRecognitionService();
    }
    return PythonFaceRecognitionService.instance;
  }

  private async makeRequest<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error making request to ${endpoint}:`, error);
      throw error;
    }
  }

  private bufferToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  public async verifyFace(imageBuffer: Buffer, memberId: string): Promise<boolean> {
    try {
      console.log('Verifying face with Python service...');
      
      // Get member's photo URL
      const member = await this.prisma.member.findUnique({
        where: { memberId: memberId },
        select: { photoUrl: true }
      });

      if (!member?.photoUrl) {
        console.log('Member not found or no photo URL');
        return false;
      }

      const request: FaceVerificationRequest = {
        image_data: this.bufferToBase64(imageBuffer),
        member_id: memberId,
        stored_image_url: member.photoUrl
      };

      const response: FaceVerificationResponse = await this.makeRequest('/verify-face', request);

      if (!response.success) {
        console.error('Face verification failed:', response.error_message);
        return false;
      }

      console.log(`Face verification completed in ${response.processing_time.toFixed(2)}s`);
      console.log(`Similarity score: ${response.similarity_score.toFixed(4)}`);
      console.log(`Match result: ${response.is_match}`);

      return response.is_match;
    } catch (error) {
      console.error('Error in face verification:', error);
      throw error;
    }
  }

  public async indexFace(imageBuffer: Buffer, memberId: string): Promise<string> {
    try {
      console.log('Indexing face with Python service...');
      
      const request: FaceIndexRequest = {
        image_data: this.bufferToBase64(imageBuffer),
        member_id: memberId
      };

      const response: FaceIndexResponse = await this.makeRequest('/index-face', request);

      if (!response.success) {
        throw new Error(response.error_message || 'Face indexing failed');
      }

      if (!response.face_detected) {
        throw new Error('No face detected in the image');
      }

      console.log(`Face indexing completed in ${response.processing_time.toFixed(2)}s`);

      // For now, return a placeholder URL since we're not uploading to Cloudinary
      // You can modify this to still upload to Cloudinary if needed
      return `https://example.com/face-${memberId}.jpg`;
    } catch (error) {
      console.error('Error in face indexing:', error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  public async clearCache(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/clear-cache`, { method: 'POST' });
      console.log('Python service cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

export default PythonFaceRecognitionService; 
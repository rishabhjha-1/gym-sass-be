"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
class PythonFaceRecognitionService {
    constructor() {
        this.baseUrl = process.env.PYTHON_FACE_SERVICE_URL || 'http://localhost:8000';
        this.prisma = new client_1.PrismaClient();
    }
    static getInstance() {
        if (!PythonFaceRecognitionService.instance) {
            PythonFaceRecognitionService.instance = new PythonFaceRecognitionService();
        }
        return PythonFaceRecognitionService.instance;
    }
    async makeRequest(endpoint, data) {
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
        }
        catch (error) {
            console.error(`Error making request to ${endpoint}:`, error);
            throw error;
        }
    }
    bufferToBase64(buffer) {
        return buffer.toString('base64');
    }
    async verifyFace(imageBuffer, memberId) {
        try {
            console.log('Verifying face with Python service...');
            // Get member's photo URL
            const member = await this.prisma.member.findUnique({
                where: { memberId: memberId },
                select: { photoUrl: true }
            });
            if (!(member === null || member === void 0 ? void 0 : member.photoUrl)) {
                console.log('Member not found or no photo URL');
                return false;
            }
            const request = {
                image_data: this.bufferToBase64(imageBuffer),
                member_id: memberId,
                stored_image_url: member.photoUrl
            };
            const response = await this.makeRequest('/verify-face', request);
            if (!response.success) {
                console.error('Face verification failed:', response.error_message);
                return false;
            }
            console.log(`Face verification completed in ${response.processing_time.toFixed(2)}s`);
            console.log(`Similarity score: ${response.similarity_score.toFixed(4)}`);
            console.log(`Match result: ${response.is_match}`);
            return response.is_match;
        }
        catch (error) {
            console.error('Error in face verification:', error);
            throw error;
        }
    }
    async indexFace(imageBuffer, memberId) {
        try {
            console.log('Indexing face with Python service...');
            const request = {
                image_data: this.bufferToBase64(imageBuffer),
                member_id: memberId
            };
            const response = await this.makeRequest('/index-face', request);
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
        }
        catch (error) {
            console.error('Error in face indexing:', error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return response.ok;
        }
        catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }
    async clearCache() {
        try {
            await fetch(`${this.baseUrl}/clear-cache`, { method: 'POST' });
            console.log('Python service cache cleared');
        }
        catch (error) {
            console.error('Error clearing cache:', error);
        }
    }
}
exports.default = PythonFaceRecognitionService;

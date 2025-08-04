"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
            // Upload to Cloudinary using the Node.js service
            const FaceRecognitionService = (await Promise.resolve().then(() => __importStar(require('./faceRecognitionService')))).default;
            const faceService = FaceRecognitionService.getInstance();
            const uploadResult = await faceService.uploadFaceImage(imageBuffer);
            return uploadResult.secure_url;
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

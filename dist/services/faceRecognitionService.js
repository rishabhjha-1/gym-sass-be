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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sharp_1 = __importDefault(require("sharp"));
const uuid_1 = require("uuid");
const cloudinary_1 = __importDefault(require("cloudinary"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const faceapi = __importStar(require("face-api.js"));
const canvas_1 = require("canvas");
const pythonFaceRecognitionService_1 = __importDefault(require("./pythonFaceRecognitionService"));
// Configure Cloudinary
cloudinary_1.default.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || ''
});
const prisma = new client_1.PrismaClient();
// Configure face-api.js
const canvas = new canvas_1.Canvas(1, 1);
const image = new canvas_1.Image();
const imageData = new canvas_1.ImageData(1, 1);
// Initialize face-api.js environment
faceapi.env.monkeyPatch({
    Canvas: canvas.constructor,
    Image: image.constructor,
    ImageData: imageData.constructor,
    createCanvasElement: () => new canvas_1.Canvas(1, 1),
    createImageElement: () => new canvas_1.Image()
});
class FaceRecognitionService {
    constructor() {
        this.isInitialized = false;
        this.pythonService = pythonFaceRecognitionService_1.default.getInstance();
    }
    static getInstance() {
        if (!FaceRecognitionService.instance) {
            FaceRecognitionService.instance = new FaceRecognitionService();
        }
        return FaceRecognitionService.instance;
    }
    async initialize() {
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
                const modelsPath = path_1.default.join(__dirname, '../../models');
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
                    faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
                    faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath)
                ]);
            }
            else {
                console.log('Python face recognition service is available and healthy');
            }
            this.isInitialized = true;
            console.log('Face recognition service initialized successfully');
        }
        catch (error) {
            console.error('Error initializing face recognition service:', error);
            throw error;
        }
    }
    // Optimized image processing - resize before detection
    async preprocessImage(imageBuffer) {
        return (0, sharp_1.default)(imageBuffer)
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
    async bufferToImageDirect(buffer) {
        return new Promise((resolve, reject) => {
            try {
                const img = new canvas_1.Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                // Use data URL instead of file system
                const base64 = buffer.toString('base64');
                const mimeType = this.getMimeType(buffer);
                img.src = `data:${mimeType};base64,${base64}`;
            }
            catch (error) {
                reject(error);
            }
        });
    }
    // Detect MIME type from buffer
    getMimeType(buffer) {
        const header = buffer.toString('hex', 0, 4);
        if (header.startsWith('ffd8'))
            return 'image/jpeg';
        if (header.startsWith('8950'))
            return 'image/png';
        if (header.startsWith('4749'))
            return 'image/gif';
        if (header.startsWith('5249'))
            return 'image/webp';
        return 'image/jpeg'; // default
    }
    // Check if face is properly aligned and centered
    checkFaceAlignment(detection) {
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
        }
        catch (error) {
            console.error('Error checking face alignment:', error);
            return false;
        }
    }
    // Optimized face detection with preprocessing
    async detectFace(imageBuffer) {
        try {
            console.log('Processing image for face detection...');
            const processedBuffer = await this.preprocessImage(imageBuffer);
            const img = await this.bufferToImageDirect(processedBuffer);
            const detections = await faceapi.detectAllFaces(img, FaceRecognitionService.FACE_DETECTION_OPTIONS);
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
        }
        catch (error) {
            console.error('Error detecting face:', error);
            throw error;
        }
    }
    // Validate face descriptor quality
    validateFaceDescriptor(descriptor) {
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
        }
        catch (error) {
            console.error('Error validating face descriptor:', error);
            return false;
        }
    }
    // Get face descriptor with caching and optimization
    async getFaceDescriptor(imageBuffer, cacheKey) {
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
            const detection = await faceapi.detectSingleFace(img, FaceRecognitionService.FACE_DETECTION_OPTIONS)
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
        }
        catch (error) {
            console.error('Error getting face descriptor:', error);
            return null;
        }
    }
    // Validate face landmarks
    validateLandmarks(landmarks) {
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
        }
        catch (error) {
            console.error('Error validating landmarks:', error);
            return false;
        }
    }
    async uploadFaceImage(imageBuffer) {
        try {
            console.log('Optimizing image for upload...');
            const optimizedImage = await (0, sharp_1.default)(imageBuffer)
                .resize(800, 800, { fit: 'inside' })
                .jpeg({ quality: 80 })
                .toBuffer();
            console.log('Uploading to Cloudinary...');
            return new Promise((resolve, reject) => {
                const uploader = cloudinary_1.default.v2.uploader;
                const uploadStream = uploader.upload_stream({
                    folder: 'face-images',
                    public_id: `face-${(0, uuid_1.v4)()}`,
                    resource_type: 'image'
                }, (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    }
                    else if (!result || !result.secure_url || !result.public_id) {
                        reject(new Error('Invalid response from Cloudinary'));
                    }
                    else {
                        console.log('Upload successful:', result);
                        resolve({
                            secure_url: result.secure_url,
                            public_id: result.public_id
                        });
                    }
                });
                uploadStream.end(optimizedImage);
            });
        }
        catch (error) {
            console.error('Error uploading face image:', error);
            throw error;
        }
    }
    // Ultra-optimized face comparison using descriptors with early exit
    compareFaceDescriptors(descriptor1, descriptor2) {
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
        }
        catch (error) {
            console.error('Error comparing face descriptors:', error);
            return false;
        }
    }
    // Main verification method - uses Python service for speed
    async verifyFace(imageBuffer, memberId) {
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
            }
            catch (pythonError) {
                console.warn('Python service failed, falling back to Node.js service:', pythonError);
                // Fallback to Node.js service
                return await this.verifyFaceNodeJS(imageBuffer, memberId);
            }
        }
        catch (error) {
            console.error('Error verifying face:', error);
            throw error;
        }
    }
    // Node.js fallback verification method
    async verifyFaceNodeJS(imageBuffer, memberId) {
        var _a;
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
            if (!(member === null || member === void 0 ? void 0 : member.photoUrl) || !verificationDescriptor) {
                return false;
            }
            // Get stored face descriptor (with caching)
            let storedDescriptor = (_a = FaceRecognitionService.faceDescriptorCache.get(`stored_${memberId}`)) === null || _a === void 0 ? void 0 : _a.descriptor;
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
            // Note: Notifications are handled in the route layer where we have gym context
            return isMatch;
        }
        catch (error) {
            console.error('Error in Node.js face verification:', error);
            throw error;
        }
    }
    async indexFace(imageBuffer, memberId) {
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
            }
            catch (pythonError) {
                console.warn('Python service failed, falling back to Node.js service:', pythonError);
                // Fallback to Node.js service
                return await this.indexFaceNodeJS(imageBuffer, memberId);
            }
        }
        catch (error) {
            console.error('Error indexing face:', error);
            throw error;
        }
    }
    // Node.js fallback indexing method
    async indexFaceNodeJS(imageBuffer, memberId) {
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
        }
        catch (error) {
            console.error('Error in Node.js face indexing:', error);
            throw error;
        }
    }
    // Utility method to clear cache
    clearCache() {
        FaceRecognitionService.faceDescriptorCache.clear();
        this.pythonService.clearCache();
        console.log('Face descriptor cache cleared');
    }
    // Utility method to warm up cache
    async warmUpCache(memberIds) {
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
                }
                catch (error) {
                    console.error(`Failed to warm up cache for member ${member.memberId}:`, error);
                }
            }
        });
        await Promise.all(promises);
        console.log('Cache warm-up completed');
    }
}
FaceRecognitionService.faceImages = new Map();
FaceRecognitionService.faceDescriptorCache = new Map();
FaceRecognitionService.CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
// Optimized detection options for speed
FaceRecognitionService.FACE_DETECTION_OPTIONS = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320, // Optimal size for speed/accuracy balance
    scoreThreshold: 0.8 // Stricter threshold for better quality faces
});
FaceRecognitionService.MAX_IMAGE_SIZE = 320; // Optimal size for processing
FaceRecognitionService.MIN_FACE_SIZE = 80; // Minimum face size in pixels
exports.default = FaceRecognitionService;

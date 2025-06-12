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
            // Load face-api.js models
            const modelsPath = path_1.default.join(__dirname, '../../models');
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
                faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
                faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath)
                // Removed faceExpressionNet as it's not needed for recognition
            ]);
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
            .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
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
    // Optimized face detection with preprocessing
    async detectFace(imageBuffer) {
        try {
            console.log('Processing image for face detection...');
            // Preprocess image for faster detection
            const processedBuffer = await this.preprocessImage(imageBuffer);
            const img = await this.bufferToImageDirect(processedBuffer);
            // Detect faces with optimized options
            const detections = await faceapi.detectAllFaces(img, FaceRecognitionService.FACE_DETECTION_OPTIONS);
            const hasFace = detections.length > 0;
            console.log(`Face detection result: ${hasFace}`);
            return hasFace;
        }
        catch (error) {
            console.error('Error detecting face:', error);
            throw error;
        }
    }
    // Get face descriptor with caching
    async getFaceDescriptor(imageBuffer, cacheKey) {
        try {
            // Check cache first
            if (cacheKey) {
                const cached = FaceRecognitionService.faceDescriptorCache.get(cacheKey);
                if (cached && Date.now() - cached.timestamp < FaceRecognitionService.CACHE_TTL) {
                    console.log('Using cached face descriptor');
                    return cached.descriptor;
                }
            }
            // Preprocess image
            const processedBuffer = await this.preprocessImage(imageBuffer);
            const img = await this.bufferToImageDirect(processedBuffer);
            // Get face descriptor
            const detection = await faceapi.detectSingleFace(img, FaceRecognitionService.FACE_DETECTION_OPTIONS)
                .withFaceLandmarks()
                .withFaceDescriptor();
            if (!detection) {
                console.log('No face detected for descriptor extraction');
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
        }
        catch (error) {
            console.error('Error getting face descriptor:', error);
            return null;
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
    // Optimized face comparison using descriptors
    compareFaceDescriptors(descriptor1, descriptor2) {
        try {
            const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
            const similarity = 1 - (distance / 2);
            const isMatch = similarity > FaceRecognitionService.FACE_MATCH_THRESHOLD;
            console.log('Face comparison details:', {
                distance,
                similarity,
                isMatch,
                threshold: FaceRecognitionService.FACE_MATCH_THRESHOLD
            });
            return isMatch;
        }
        catch (error) {
            console.error('Error comparing face descriptors:', error);
            return false;
        }
    }
    // Main verification method - heavily optimized
    async verifyFace(imageBuffer, memberId) {
        var _a;
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            console.log('Starting face verification...');
            const startTime = Date.now();
            // Get member's photo URL and cached descriptor
            const member = await prisma.member.findUnique({
                where: { memberId: memberId },
                select: { photoUrl: true }
            });
            if (!member || !member.photoUrl) {
                console.log('No face registered for this member');
                return false;
            }
            // Get face descriptor from verification image
            const verificationDescriptor = await this.getFaceDescriptor(imageBuffer);
            if (!verificationDescriptor) {
                console.log('No face detected in verification image');
                return false;
            }
            // Get stored face descriptor (with caching)
            let storedDescriptor = (_a = FaceRecognitionService.faceDescriptorCache.get(`stored_${memberId}`)) === null || _a === void 0 ? void 0 : _a.descriptor;
            if (!storedDescriptor) {
                console.log('Fetching stored face image...');
                const response = await fetch(member.photoUrl);
                if (!response.ok) {
                    console.log('Failed to fetch stored face image');
                    return false;
                }
                const storedFaceBuffer = Buffer.from(await response.arrayBuffer());
                storedDescriptor = await this.getFaceDescriptor(storedFaceBuffer, `stored_${memberId}`) || undefined;
                if (!storedDescriptor) {
                    console.log('No face detected in stored image');
                    return false;
                }
            }
            // Compare descriptors
            const isMatch = this.compareFaceDescriptors(storedDescriptor, verificationDescriptor);
            const endTime = Date.now();
            console.log(`Face verification completed in ${endTime - startTime}ms, result: ${isMatch}`);
            return isMatch;
        }
        catch (error) {
            console.error('Error verifying face:', error);
            throw error;
        }
    }
    async indexFace(imageBuffer, memberId) {
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
        }
        catch (error) {
            console.error('Error indexing face:', error);
            throw error;
        }
    }
    // Utility method to clear cache
    clearCache() {
        FaceRecognitionService.faceDescriptorCache.clear();
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
    inputSize: 320, // Reduced from 416 for faster processing
    scoreThreshold: 0.5
});
FaceRecognitionService.FACE_MATCH_THRESHOLD = 0.6;
exports.default = FaceRecognitionService;

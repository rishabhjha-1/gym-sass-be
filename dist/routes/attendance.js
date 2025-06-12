"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/attendanceRoutes.ts
const express_1 = __importDefault(require("express"));
const attendanceService_1 = require("../services/attendanceService");
const faceRecognitionService_1 = __importDefault(require("../services/faceRecognitionService"));
const zod_1 = require("../zod");
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const client_1 = require("@prisma/client");
const message91Service_1 = require("../services/message91Service");
const router = express_1.default.Router();
const upload = (0, multer_1.default)();
const prisma = new client_1.PrismaClient();
// Protect all routes
router.use(auth_1.authenticateToken);
router.use(auth_1.authorizeGymAccess);
// Record attendance with face recognition
router.post('/face', upload.single('faceImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Face image is required' });
        }
        const { memberId } = req.body;
        console.log('memberId', memberId);
        if (!memberId) {
            return res.status(400).json({ error: 'Member ID is required' });
        }
        // Check for overdue payments
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            include: {
                payments: {
                    where: {
                        status: client_1.PaymentStatus.PENDING,
                        dueDate: {
                            lt: new Date()
                        }
                    }
                }
            }
        });
        if (member && member.payments.length > 0) {
            // Get gym owner's phone number
            const gymOwner = await prisma.user.findFirst({
                where: {
                    gymId: req.user.gymId,
                    role: 'OWNER'
                }
            });
            if (gymOwner && gymOwner.phone) {
                // Send Message91 notification to gym owner
                const message = `⚠️ Overdue Payment Alert\n\nMember ${member.firstName} ${member.lastName} (ID: ${member.memberId}) is trying to mark attendance but has overdue payments:\n\n` +
                    member.payments.map(payment => `• Amount: $${payment.amount}\n` +
                        `• Due Date: ${new Date(payment.dueDate).toLocaleDateString()}\n` +
                        `• Invoice: ${payment.invoiceNumber}\n`).join('\n') +
                    `\nMember's Photo: ${member.photoUrl || 'No photo available'}`;
                await message91Service_1.Message91Service.broadcastMessage(message, req.user.gymId);
            }
        }
        // Verify face
        const faceService = faceRecognitionService_1.default.getInstance();
        const isVerified = await faceService.verifyFace(req.file.buffer, memberId);
        if (!isVerified) {
            return res.status(500).json({ error: 'Face verification failed' });
        }
        // Record attendance
        const attendance = await attendanceService_1.AttendanceService.recordAttendance({
            memberId,
            type: 'CHECK_IN',
            notes: 'Face recognition attendance'
        });
        res.status(201).json(attendance);
    }
    catch (error) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: error.errors });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
});
// Record attendance
router.post('/', async (req, res) => {
    try {
        const validatedData = zod_1.AttendanceSchema.parse(req.body);
        const attendance = await attendanceService_1.AttendanceService.recordAttendance({
            ...validatedData,
            gymId: req.user.gymId
        });
        res.status(201).json(attendance);
    }
    catch (error) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: error.errors });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
});
// Get attendance records with pagination and filters
router.get('/', async (req, res) => {
    try {
        const { page, limit } = zod_1.PaginationSchema.parse(req.query);
        const filter = {
            gymId: req.user.gymId,
            memberId: req.query.memberId,
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
        };
        const attendance = await attendanceService_1.AttendanceService.getAttendance(filter, page, limit);
        res.json(attendance);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get attendance statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await attendanceService_1.AttendanceService.getAttendanceStats(req.user.gymId);
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Register member's face
router.post('/register-face', upload.single('faceImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Face image is required' });
        }
        const { memberId } = req.body;
        if (!memberId) {
            return res.status(400).json({ error: 'Member ID is required' });
        }
        // Upload face image
        const faceService = faceRecognitionService_1.default.getInstance();
        const photoUrl = await faceService.indexFace(req.file.buffer, memberId);
        // Update member's photo URL
        await prisma.member.update({
            where: { id: memberId },
            data: { photoUrl }
        });
        res.status(201).json({ message: 'Face registered successfully', photoUrl });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

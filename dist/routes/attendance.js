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
const notificationService_1 = require("../services/notificationService");
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
            where: { memberId: memberId },
            include: {
                payments: {
                    where: {
                        status: client_1.PaymentStatus.OVERDUE
                    }
                }
            }
        });
        console.log("received member", member === null || member === void 0 ? void 0 : member.status, "member found:", !!member);
        if (member) {
            console.log(`Member ${member.firstName} ${member.lastName} is entering the gym (face recognition)`);
            console.log("Gym ID from request:", req.user.gymId);
            console.log("member payments", member.payments);
            // Check if member has overdue payments
            if (member.payments && member.payments.length > 0) {
                console.log(`Member has ${member.payments.length} overdue payments`);
                // Get gym owner's phone number
                const gymOwner = await prisma.user.findFirst({
                    where: {
                        gymId: req.user.gymId,
                        role: 'OWNER'
                    }
                });
                console.log("Gym owner found:", gymOwner ? { id: gymOwner.id, email: gymOwner.email, role: gymOwner.role } : "Not found");
                if (gymOwner && gymOwner.phone) {
                    // Send WhatsApp notification to gym owner
                    // await WhatsAppService.sendOverduePaymentAlert(gymOwner.phone, member, member.payments);
                }
                // Send email notification to gym owner
                try {
                    console.log("sending email notification to gym owner for overdue member");
                    await notificationService_1.NotificationService.sendMemberEntryNotification(req.user.gymId, member);
                    console.log("Email notification sent successfully");
                }
                catch (emailError) {
                    console.error('Failed to send email notification to gym owner:', emailError);
                    // Don't throw error as WhatsApp notification was already sent
                }
            }
            else {
                console.log("Member has no overdue payments - no notification sent");
            }
        }
        else {
            console.log("Member not found for memberId:", memberId);
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
        // Check for overdue payments before recording attendance
        const member = await prisma.member.findUnique({
            where: { id: validatedData.memberId },
            include: {
                payments: {
                    where: {
                        status: client_1.PaymentStatus.OVERDUE
                    }
                }
            }
        });
        if (member && member.payments && member.payments.length > 0) {
            console.log(`Member ${member.firstName} ${member.lastName} is entering the gym with overdue payments`);
            // Get gym owner's phone number
            const gymOwner = await prisma.user.findFirst({
                where: {
                    gymId: req.user.gymId,
                    role: 'OWNER'
                }
            });
            if (gymOwner && gymOwner.phone) {
                // Send WhatsApp notification to gym owner
                // await WhatsAppService.sendOverduePaymentAlert(gymOwner.phone, member, member.payments);
            }
            // Send email notification to gym owner
            try {
                console.log("sending email notification to gym owner for overdue member");
                await notificationService_1.NotificationService.sendMemberEntryNotification(req.user.gymId, member);
            }
            catch (emailError) {
                console.error('Failed to send email notification to gym owner:', emailError);
                // Don't throw error as WhatsApp notification was already sent
            }
        }
        else if (member) {
            console.log(`Member ${member.firstName} ${member.lastName} is entering the gym - no overdue payments`);
        }
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
// Test endpoint for email functionality
router.post('/test-email', async (req, res) => {
    try {
        console.log('Testing email functionality...');
        // Get gym owner
        const gymOwner = await prisma.user.findFirst({
            where: {
                gymId: req.user.gymId,
                role: 'OWNER'
            }
        });
        if (!gymOwner || !gymOwner.email) {
            return res.status(404).json({ error: 'Gym owner not found or no email available' });
        }
        // Test email
        const testResult = await notificationService_1.NotificationService.emailTransporter.sendMail({
            from: process.env.EMAIL_FROM || 'noreply@yourgym.com',
            to: gymOwner.email,
            subject: 'Test Email - Gym Management System',
            text: 'This is a test email to verify email functionality is working.'
        });
        res.json({
            success: true,
            message: 'Test email sent successfully',
            result: testResult
        });
    }
    catch (error) {
        console.error('Test email failed:', error);
        res.status(500).json({
            error: 'Test email failed',
            details: error.message
        });
    }
});
exports.default = router;

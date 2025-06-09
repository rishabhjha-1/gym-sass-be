// src/routes/attendanceRoutes.ts
import express from 'express';
import { AttendanceService } from '../services/attendanceService';
import FaceRecognitionService from '../services/faceRecognitionService';
import { AttendanceSchema, PaginationSchema } from '../zod';
import { authenticateToken, authorizeGymAccess, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const upload = multer();
const prisma = new PrismaClient();

// Extend AuthRequest to include file property
interface FaceAuthRequest extends AuthRequest {
  file?: Express.Multer.File;
}

// Protect all routes
router.use(authenticateToken);
router.use(authorizeGymAccess);

// Record attendance with face recognition
router.post('/face', upload.single('faceImage'), async (req: FaceAuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Face image is required' });
    }

    const { memberId } = req.body;
    console.log('memberId', memberId);
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    // Verify face
    const faceService = FaceRecognitionService.getInstance();
    const isVerified = await faceService.verifyFace(req.file.buffer, memberId);
    if (!isVerified) {
      return res.status(500).json({ error: 'Face verification failed' });
    }

    // Record attendance
    const attendance = await AttendanceService.recordAttendance({
      memberId,
      type: 'CHECK_IN',
      notes: 'Face recognition attendance'
    });

    res.status(201).json(attendance);
  } catch (error:any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Record attendance
router.post('/', async (req: AuthRequest, res) => {
  try {
    const validatedData = AttendanceSchema.parse(req.body);
    const attendance = await AttendanceService.recordAttendance({
      ...validatedData,
      gymId: req.user!.gymId
    });
    res.status(201).json(attendance);
  } catch (error:any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get attendance records with pagination and filters
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page, limit } = PaginationSchema.parse(req.query);
    
    const filter = {
      gymId: req.user!.gymId,
      memberId: req.query.memberId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    };
    
    const attendance = await AttendanceService.getAttendance(filter, page, limit);
    res.json(attendance);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance statistics
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const stats = await AttendanceService.getAttendanceStats(req.user!.gymId);
    res.json(stats);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Register member's face
router.post('/register-face', upload.single('faceImage'), async (req: FaceAuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Face image is required' });
    }

    const { memberId } = req.body;
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    // Upload face image
    const faceService = FaceRecognitionService.getInstance();
    const photoUrl = await faceService.indexFace(req.file.buffer, memberId);

    // Update member's photo URL
    await prisma.member.update({
      where: { id: memberId },
      data: { photoUrl }
    });

    res.status(201).json({ message: 'Face registered successfully', photoUrl });
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
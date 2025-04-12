// src/routes/attendanceRoutes.ts
import express from 'express';
import { AttendanceService } from '../services/attendanceService';
import { AttendanceSchema, PaginationSchema } from '../zod';
import { authenticateToken, authorizeGymAccess, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Protect all routes
router.use(authenticateToken);
router.use(authorizeGymAccess);

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

export default router;
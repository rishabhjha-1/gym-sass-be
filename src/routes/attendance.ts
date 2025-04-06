// src/routes/attendanceRoutes.ts
import express from 'express';
import { AttendanceService } from '../services/attendanceService';
import { AttendanceSchema, PaginationSchema } from '../zod';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Protect all routes
router.use(authenticateToken);

// Record attendance
router.post('/', async (req, res) => {
  try {
    const validatedData = AttendanceSchema.parse(req.body);
    const attendance = await AttendanceService.recordAttendance(validatedData);
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
router.get('/', async (req, res) => {
  try {
    const { page, limit } = PaginationSchema.parse(req.query);
    
    const filter = {
      memberId: req.query.memberId as string,
    //   startDate: req.query.startDate as string,
    //   endDate: req.query.endDate as string
    };
    
    const attendance = await AttendanceService.getAttendance(filter, page, limit);
    res.json(attendance);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await AttendanceService.getAttendanceStats();
    res.json(stats);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
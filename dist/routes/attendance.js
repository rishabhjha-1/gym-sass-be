"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/attendanceRoutes.ts
const express_1 = __importDefault(require("express"));
const attendanceService_1 = require("../services/attendanceService");
const zod_1 = require("../zod");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Protect all routes
router.use(auth_1.authenticateToken);
router.use(auth_1.authorizeGymAccess);
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
exports.default = router;

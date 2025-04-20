"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/memberRoutes.ts
const express_1 = __importDefault(require("express"));
const memberService_1 = require("../services/memberService");
const zod_1 = require("../zod");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Protect all routes
router.use(auth_1.authenticateToken);
router.use(auth_1.authorizeGymAccess);
// Create a new member
router.post('/', async (req, res) => {
    try {
        const validatedData = zod_1.MemberSchema.parse(req.body);
        const member = await memberService_1.MemberService.createMember({
            ...validatedData,
            gymId: req.user.gymId
        });
        res.status(201).json(member);
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
// Get members with pagination and filters
router.get('/', async (req, res) => {
    try {
        const { page, limit } = zod_1.PaginationSchema.parse(req.query);
        const filter = {
            gymId: req.user.gymId,
            status: req.query.status,
            membershipType: req.query.membershipType,
            searchTerm: req.query.search,
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
        };
        const members = await memberService_1.MemberService.getMembers(filter, page, limit);
        res.json(members);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get member by ID
router.get('/:id', async (req, res) => {
    try {
        const member = await memberService_1.MemberService.getMemberById(req.params.id, req.user.gymId);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json(member);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Update member
router.put('/:id', async (req, res) => {
    try {
        const validatedData = zod_1.MemberSchema.parse(req.body);
        const member = await memberService_1.MemberService.updateMember(req.params.id, {
            ...validatedData,
            gymId: req.user.gymId
        });
        res.json(member);
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
// Delete member
router.delete('/:id', async (req, res) => {
    try {
        await memberService_1.MemberService.deleteMember(req.params.id, req.user.gymId);
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get membership growth statistics
router.get('/stats/growth', async (req, res) => {
    try {
        const stats = await memberService_1.MemberService.getMembershipGrowth();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Make member inactive
router.patch('/:id/inactive', async (req, res) => {
    try {
        const member = await memberService_1.MemberService.updateMember(req.params.id, {
            status: 'INACTIVE',
            gymId: req.user.gymId
        });
        res.json(member);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

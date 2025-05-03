// src/routes/memberRoutes.ts
import express from 'express';
import { MemberService } from '../services/memberService';
import { MemberSchema, PaginationSchema } from '../zod';
import { authenticateToken, authorizeGymAccess, AuthRequest } from '../middleware/auth';
import { MembershipType, MemberStatus } from '../type';

const router = express.Router();

// Protect all routes
router.use(authenticateToken);
router.use(authorizeGymAccess);

// Create a new member
router.post('/', async (req: AuthRequest, res) => {
  try {
    const validatedData = MemberSchema.parse(req.body);
    const member = await MemberService.createMember({
      ...validatedData,
      gymId: req.user!.gymId
    });
    res.status(201).json(member);
  } catch (error:any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get members with pagination and filters
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page, limit } = PaginationSchema.parse(req.query);
    
    const filter = {
      gymId: req.user!.gymId,
      status: req.query.status as MemberStatus,
      membershipType: req.query.membershipType as MembershipType,
      searchTerm: req.query.search as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    };
    
    const members = await MemberService.getMembers(filter, page, limit);
    res.json(members);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Get member by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const member = await MemberService.getMemberById(req.params.id, req.user!.gymId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Update member
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const validatedData = MemberSchema.parse(req.body);
    const member = await MemberService.updateMember(req.params.id, {
      ...validatedData,
      gymId: req.user!.gymId
    });
    res.json(member);
  } catch (error:any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete member
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await MemberService.deleteMember(req.params.id, req.user!.gymId);
    res.status(204).send();
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Get membership growth statistics
router.get('/stats/growth', async (req: AuthRequest, res) => {
  try {
    const stats = await MemberService.getMembershipGrowth();
    res.json(stats);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Make member inactive
router.patch('/:id/inactive', async (req: AuthRequest, res) => {
  try {
    const member = await MemberService.updateMember(req.params.id, {
      status: 'INACTIVE',
      gymId: req.user!.gymId
    });
    res.json(member);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Update member's membership type
router.patch('/:id/membership-type', async (req: AuthRequest, res) => {
  try {
    const { membershipType } = req.body;
    
    if (!membershipType || !Object.values(MembershipType).includes(membershipType)) {
      return res.status(400).json({ error: 'Invalid membership type' });
    }
    
    const member = await MemberService.updateMember(req.params.id, {
      membershipType,
      gymId: req.user!.gymId
    });
    
    res.json(member);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
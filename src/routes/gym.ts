import express from 'express';
import { GymService } from '../services/gymService';
import { GymSchema } from '../zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Create a new gym
router.post('/', async (req: AuthRequest, res) => {
  try {
    const validatedData = GymSchema.parse(req.body);
    const gym = await GymService.createGym(validatedData);
    res.status(201).json(gym);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get all gyms
router.get('/', async (req: AuthRequest, res) => {
  try {
    const gyms = await GymService.getAllGyms();
    res.json(gyms);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get gym by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const gym = await GymService.getGymById(req.params.id);
    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }
    res.json(gym);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update gym
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const validatedData = GymSchema.partial().parse(req.body);
    const gym = await GymService.updateGym(req.params.id, validatedData);
    res.json(gym);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete gym
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await GymService.deleteGym(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 
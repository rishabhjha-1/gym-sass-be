"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const gymService_1 = require("../services/gymService");
const zod_1 = require("../zod");
const router = express_1.default.Router();
// Create a new gym
router.post('/', async (req, res) => {
    try {
        const validatedData = zod_1.GymSchema.parse(req.body);
        const gym = await gymService_1.GymService.createGym(validatedData);
        res.status(201).json(gym);
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
// Get all gyms
router.get('/', async (req, res) => {
    try {
        const gyms = await gymService_1.GymService.getAllGyms();
        res.json(gyms);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get gym by ID
router.get('/:id', async (req, res) => {
    try {
        const gym = await gymService_1.GymService.getGymById(req.params.id);
        if (!gym) {
            return res.status(404).json({ error: 'Gym not found' });
        }
        res.json(gym);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Update gym
router.put('/:id', async (req, res) => {
    try {
        const validatedData = zod_1.GymSchema.partial().parse(req.body);
        const gym = await gymService_1.GymService.updateGym(req.params.id, validatedData);
        res.json(gym);
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
// Delete gym
router.delete('/:id', async (req, res) => {
    try {
        await gymService_1.GymService.deleteGym(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

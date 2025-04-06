// src/routes/authRoutes.ts
import express from 'express';  
import {  AuthService } from '../services/authenticationService';
import { LoginSchema, UserSchema } from '../zod';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const validatedData = UserSchema.parse(req.body);
    const user = await AuthService.registerUser(validatedData);
    res.status(201).json(user);
  } catch (error:any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.post('/login', async (req, res) => {
  try {
    const validatedData = LoginSchema.parse(req.body);
    const { email, password } = validatedData;
    const result = await AuthService.loginUser(email, password);
    res.json(result);
  } catch (error:any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(401).json({ error: error.message });
    }
  }
});

export default router;
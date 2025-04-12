// src/routes/authRoutes.ts
import express from 'express';  
import { AuthService } from '../services/authenticationService';
import { LoginSchema, UserSchema } from '../zod';
import { ZodError } from 'zod';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const validatedData = UserSchema.parse(req.body);
    const user = await AuthService.registerUser(validatedData);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.errors 
      });
    }
    
    if (error instanceof Error) {
      return res.status(500).json({ 
        error: 'Registration failed',
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Registration failed',
      message: 'An unexpected error occurred' 
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const validatedData = LoginSchema.parse(req.body);
    const { email, password } = validatedData;
    const result = await AuthService.loginUser(email, password);
    res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.errors 
      });
    }
    
    if (error instanceof Error) {
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ 
          error: 'Authentication failed',
          message: 'Invalid email or password' 
        });
      }
      
      return res.status(500).json({ 
        error: 'Login failed',
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Login failed',
      message: 'An unexpected error occurred' 
    });
  }
});

export default router;
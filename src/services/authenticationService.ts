// src/services/authService.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  gymId: string;
}

interface UserWithGymId {
  id: string;
  email: string;
  password: string;
  role: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  gymId: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET;
  private static readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

  static async registerUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
    phone?: string;
    gymId: string;
  }) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword
      }
    });

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async loginUser(email: string, password: string) {
    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    const user = await prisma.user.findUnique({ 
      where: { email }
    }) as UserWithGymId | null;
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new Error('Invalid credentials');
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      gymId: user.gymId
    };

    try {
      const token = jwt.sign(
        payload,
        this.JWT_SECRET as jwt.Secret,
        {
          expiresIn: this.JWT_EXPIRES_IN
        } as jwt.SignOptions
      );

      const { password: _, ...userWithoutPassword } = user;
      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      console.error('Error signing JWT:', error);
      throw new Error('Failed to generate authentication token');
    }
  }

  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static verifyToken(token: string): TokenPayload {
    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    try {
      return jwt.verify(token, this.JWT_SECRET) as TokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw new Error('Failed to verify token');
    }
  }
}
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
// src/services/authService.ts
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma = new client_1.PrismaClient();
class AuthService {
    static async registerUser(userData) {
        const hashedPassword = await bcryptjs_1.default.hash(userData.password, 10);
        const user = await prisma.user.create({
            data: {
                ...userData,
                password: hashedPassword
            }
        });
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
    static async loginUser(email, password) {
        if (!this.JWT_SECRET) {
            throw new Error('JWT_SECRET is not configured');
        }
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            throw new Error('Invalid credentials');
        }
        const passwordMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!passwordMatch) {
            throw new Error('Invalid credentials');
        }
        // Update last login time
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            gymId: user.gymId
        };
        try {
            const token = jsonwebtoken_1.default.sign(payload, this.JWT_SECRET, {
                expiresIn: this.JWT_EXPIRES_IN
            });
            const { password: _, ...userWithoutPassword } = user;
            return {
                user: userWithoutPassword,
                gymId: user.gymId,
                token
            };
        }
        catch (error) {
            console.error('Error signing JWT:', error);
            throw new Error('Failed to generate authentication token');
        }
    }
    static async getUserById(userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
    static verifyToken(token) {
        if (!this.JWT_SECRET) {
            throw new Error('JWT_SECRET is not configured');
        }
        try {
            return jsonwebtoken_1.default.verify(token, this.JWT_SECRET);
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new Error('Token has expired');
            }
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new Error('Invalid token');
            }
            throw new Error('Failed to verify token');
        }
    }
}
exports.AuthService = AuthService;
AuthService.JWT_SECRET = process.env.JWT_SECRET;
AuthService.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

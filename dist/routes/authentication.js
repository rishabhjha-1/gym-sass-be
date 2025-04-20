"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/authRoutes.ts
const express_1 = __importDefault(require("express"));
const authenticationService_1 = require("../services/authenticationService");
const zod_1 = require("../zod");
const zod_2 = require("zod");
const router = express_1.default.Router();
router.post('/register', async (req, res) => {
    try {
        const validatedData = zod_1.UserSchema.parse(req.body);
        const user = await authenticationService_1.AuthService.registerUser(validatedData);
        res.status(201).json(user);
    }
    catch (error) {
        if (error instanceof zod_2.ZodError) {
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
        const validatedData = zod_1.LoginSchema.parse(req.body);
        const { email, password } = validatedData;
        const result = await authenticationService_1.AuthService.loginUser(email, password);
        res.json(result);
    }
    catch (error) {
        if (error instanceof zod_2.ZodError) {
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
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const authentication_1 = __importDefault(require("./routes/authentication"));
const member_1 = __importDefault(require("./routes/member"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const payment_1 = __importDefault(require("./routes/payment"));
const gym_1 = __importDefault(require("./routes/gym"));
// Load environment variables
dotenv_1.default.config();
// Initialize express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 100 requests per IP
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);
// Routes
app.use('/api/auth', authentication_1.default);
app.use('/api/members', member_1.default);
app.use('/api/attendance', attendance_1.default);
app.use('/api/payments', payment_1.default);
app.use('/api/gyms', gym_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    // Handle specific error types
    if (err.name === 'ZodError') {
        return res.status(400).json({
            error: 'Validation error',
            details: err.message
        });
    }
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token',
            message: 'Please provide a valid authentication token'
        });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token expired',
            message: 'Your session has expired. Please login again'
        });
    }
    // Default error response
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
});
// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
exports.default = app;

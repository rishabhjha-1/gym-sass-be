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
require("./cron/paymentNotifications");
// Load environment variables
dotenv_1.default.config();
// Initialize express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// CORS Configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            console.log('CORS: Allowing request with no origin');
            return callback(null, true);
        }
        const allowedOrigins = [
            'https://gym.nexgenbattles.com',
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:4173', // Vite preview
            'http://localhost:8080',
            'https://localhost:3000',
            'https://localhost:5173'
        ];
        // Add environment-specific origins
        if (process.env.FRONTEND_URL) {
            allowedOrigins.push(process.env.FRONTEND_URL);
        }
        // Add additional frontend URLs from environment
        if (process.env.ADDITIONAL_FRONTEND_URLS) {
            const additionalUrls = process.env.ADDITIONAL_FRONTEND_URLS.split(',').map(url => url.trim());
            allowedOrigins.push(...additionalUrls);
        }
        // Add Render-specific origins (common patterns)
        if (process.env.NODE_ENV === 'production') {
            allowedOrigins.push('https://*.onrender.com', 'https://*.render.com');
        }
        console.log(`CORS: Checking origin: ${origin}`);
        console.log(`CORS: Allowed origins:`, allowedOrigins);
        // Check if origin is allowed
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (allowedOrigin.includes('*')) {
                // Handle wildcard domains
                const domain = allowedOrigin.replace('*.', '');
                return origin.includes(domain);
            }
            return origin === allowedOrigin;
        });
        if (isAllowed) {
            console.log(`CORS: Allowing origin: ${origin}`);
            callback(null, true);
        }
        else {
            console.log(`CORS: Blocked origin: ${origin}`);
            callback(new Error(`Origin ${origin} not allowed by CORS policy`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
};
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)(corsOptions));
// Handle preflight requests
app.options('*', (0, cors_1.default)(corsOptions));
// CORS error handling middleware
app.use((err, req, res, next) => {
    if (err.message && err.message.includes('CORS')) {
        console.error('CORS Error:', err.message);
        return res.status(403).json({
            error: 'CORS Error',
            message: 'Cross-origin request not allowed',
            origin: req.headers.origin,
            allowedOrigins: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : ['https://gym.nexgenbattles.com']
        });
    }
    next(err);
});
// Increase payload size limit to 50MB
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
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

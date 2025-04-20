"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.authorizeRole = authorizeRole;
exports.authorizeGymAccess = authorizeGymAccess;
const authenticationService_1 = require("../services/authenticationService");
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    try {
        const user = authenticationService_1.AuthService.verifyToken(token);
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}
function authorizeRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}
// Add a new middleware to ensure users can only access their gym's data
function authorizeGymAccess(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    // For routes that have gymId in params or body
    const requestedGymId = req.params.gymId || req.body.gymId;
    if (requestedGymId && requestedGymId !== req.user.gymId) {
        return res.status(403).json({ error: 'Access to this gym is not allowed' });
    }
    next();
}

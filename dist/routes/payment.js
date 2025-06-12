"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/paymentRoutes.ts
const express_1 = __importDefault(require("express"));
const paymentService_1 = require("../services/paymentService");
const notificationService_1 = require("../services/notificationService");
const zod_1 = require("../zod");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Protect all routes
router.use(auth_1.authenticateToken);
router.use(auth_1.authorizeGymAccess);
// Create a new payment
router.post('/', async (req, res) => {
    try {
        const validatedData = zod_1.PaymentSchema.parse(req.body);
        const payment = await paymentService_1.PaymentService.createPayment({
            ...validatedData,
            gymId: req.user.gymId
        });
        res.status(201).json(payment);
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
// Get payments with pagination and filters
router.get('/', async (req, res) => {
    try {
        const { page, limit } = zod_1.PaginationSchema.parse(req.query);
        const filter = {
            gymId: req.user.gymId,
            paymentMethod: req.query.paymentMethod,
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
        };
        const payments = await paymentService_1.PaymentService.getPayments(filter, page, limit);
        res.json(payments);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get pending payments
router.get('/pending', async (req, res) => {
    try {
        const payments = await paymentService_1.PaymentService.getPendingPayments(req.user.gymId);
        res.json(payments);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get paid or upcoming due payments (within 5 days)
router.get('/paid-or-upcoming', async (req, res) => {
    try {
        const payments = await paymentService_1.PaymentService.getPaidOrUpcomingPayments(req.user.gymId);
        res.json(payments);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get revenue statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await paymentService_1.PaymentService.getRevenueStats(req.user.gymId);
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get payment by ID
router.get('/:id', async (req, res) => {
    try {
        const payment = await paymentService_1.PaymentService.getPaymentById(req.params.id, req.user.gymId);
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        res.json(payment);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Update payment status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['PENDING', 'PAID', 'OVERDUE', 'REFUNDED', 'CANCELLED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid payment status' });
        }
        const payment = await paymentService_1.PaymentService.updatePaymentStatus(req.params.id, req.user.gymId, status);
        res.json(payment);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Update payment method
router.patch('/:id/method', async (req, res) => {
    try {
        const { paymentMethod } = req.body;
        if (!paymentMethod) {
            return res.status(400).json({ error: 'Payment method is required' });
        }
        const payment = await paymentService_1.PaymentService.updatePaymentMethod(req.params.id, req.user.gymId, paymentMethod);
        res.json(payment);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Update payment amount
router.patch('/:id/amount', async (req, res) => {
    try {
        const { amount } = req.body;
        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }
        const payment = await paymentService_1.PaymentService.updatePaymentAmount(req.params.id, req.user.gymId, amount);
        res.json(payment);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.patch('/:id/payment-method', async (req, res) => {
    try {
        const { paymentMethod } = req.body;
        if (!paymentMethod) {
            return res.status(400).json({ error: 'Payment method is required' });
        }
        const payment = await paymentService_1.PaymentService.updatePaymentMethod(req.params.id, req.user.gymId, paymentMethod);
        res.json(payment);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Send payment notification
router.post('/:id/notify', async (req, res) => {
    try {
        const payment = await paymentService_1.PaymentService.getPaymentById(req.params.id, req.user.gymId);
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        const result = await notificationService_1.NotificationService.sendPaymentReminder(payment.memberId, payment.id);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Send bulk payment notifications for pending payments
router.post('/notify/pending', async (req, res) => {
    try {
        const payments = await paymentService_1.PaymentService.getPendingPayments(req.user.gymId);
        const notifications = [];
        for (const payment of payments) {
            const result = await notificationService_1.NotificationService.sendPaymentReminder(payment.memberId, payment.id);
            notifications.push({
                paymentId: payment.id,
                success: result.success,
                error: result.error
            });
        }
        res.json({
            totalSent: notifications.length,
            successful: notifications.filter(n => n.success).length,
            failed: notifications.filter(n => !n.success).length,
            details: notifications
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Delete payment
router.delete('/:id', async (req, res) => {
    try {
        await paymentService_1.PaymentService.deletePayment(req.params.id, req.user.gymId);
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

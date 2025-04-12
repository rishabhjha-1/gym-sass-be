// src/routes/paymentRoutes.ts
import express from 'express';
import { PaymentService } from '../services/paymentService';
import { NotificationService } from '../services/notificationService';
import { PaymentSchema, PaginationSchema } from '../zod';
import { authenticateToken, authorizeGymAccess, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Protect all routes
router.use(authenticateToken);
router.use(authorizeGymAccess);

// Create a new payment
router.post('/', async (req: AuthRequest, res) => {
  try {
    const validatedData = PaymentSchema.parse(req.body);
    const payment = await PaymentService.createPayment({
      ...validatedData,
      gymId: req.user!.gymId
    });
    res.status(201).json(payment);
  } catch (error:any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get payments with pagination and filters
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page, limit } = PaginationSchema.parse(req.query);
    
    const filter = {
      gymId: req.user!.gymId,
      paymentMethod: req.query.paymentMethod as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    };
    
    const payments = await PaymentService.getPayments(filter, page, limit);
    res.json(payments);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const payment = await PaymentService.getPaymentById(req.params.id, req.user!.gymId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(payment);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending payments
router.get('/pending', async (req: AuthRequest, res) => {
  try {
    const payments = await PaymentService.getPendingPayments(req.user!.gymId);
    res.json(payments);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Get revenue statistics
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const stats = await PaymentService.getRevenueStats(req.user!.gymId);
    res.json(stats);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Update payment status
router.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    
    if (!['PENDING', 'PAID', 'OVERDUE', 'REFUNDED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }
    
    const payment = await PaymentService.updatePaymentStatus(req.params.id, req.user!.gymId, status);
    res.json(payment);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Send payment notification
router.post('/:id/notify', async (req: AuthRequest, res) => {
  try {
    const payment = await PaymentService.getPaymentById(req.params.id, req.user!.gymId) as any;
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const result = await NotificationService.sendPaymentReminder(
      payment.memberId, 
      payment.id
    );
    
    res.json(result);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Send bulk payment notifications for pending payments
router.post('/notify/pending', async (req: AuthRequest, res) => {
  try {
    const payments = await PaymentService.getPendingPayments(req.user!.gymId) as any;
    const notifications = [];
    
    for (const payment of payments) {
      const result = await NotificationService.sendPaymentReminder(
        payment.memberId,
        payment.id
      );
      
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
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
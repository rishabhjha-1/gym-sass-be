// src/routes/paymentRoutes.ts
import express from 'express';
import { PaymentService } from '../services/paymentService';
import { NotificationService } from '../services/notificationService';
import { PaymentSchema, PaginationSchema } from '../zod';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Protect all routes
router.use(authenticateToken);

// Create a new payment
router.post('/', async (req, res) => {
  try {
    const validatedData = PaymentSchema.parse(req.body);
    const payment = await PaymentService.createPayment(validatedData);
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
router.get('/', async (req, res) => {
  try {
    const { page, limit } = PaginationSchema.parse(req.query);
    
    const filter = {
      paymentMethod: req.query.paymentMethod as string,
    //   startDate: req.query.startDate as string,
    //   endDate: req.query.endDate as string
    };
    
    const payments = await PaymentService.getPayments(filter, page, limit);
    res.json(payments);
  } catch (error:any) {
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
    
    const payment = await PaymentService.updatePaymentStatus(req.params.id, status);
    res.json(payment);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending payments
router.get('/pending', async (req, res) => {
  try {
    const pendingPayments = await PaymentService.getPendingPayment();
    res.json(pendingPayments);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Get revenue statistics
router.get('/revenue/stats', async (req, res) => {
  try {
    const filter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };
    
    const stats = await PaymentService.getRevenueStats();
    res.json(stats);
  } catch (error:any) {
    res.status(500).json({ error: error.message });
  }
});

// Send payment notification
router.post('/:id/notify', async (req, res) => {
  try {
    const payment = await PaymentService.getPaymentById(req.params.id) as any;
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
router.post('/notify/pending', async (req, res) => {
  try {
    const payments = await PaymentService.getPendingPayment() as any;
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
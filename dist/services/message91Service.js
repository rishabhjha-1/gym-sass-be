"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message91Service = void 0;
const axios_1 = __importDefault(require("axios"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Validate required environment variables
const MESSAGE91_AUTH_KEY = "455843ACIz3YcgyL2U6849dee9P1";
const MESSAGE91_SENDER_ID = "msg91";
if (!MESSAGE91_AUTH_KEY) {
    console.warn('⚠️ Message91 integration is not properly configured. Please set MESSAGE91_AUTH_KEY environment variable.');
}
class Message91Service {
    static formatPhoneNumber(phone) {
        // Remove any non-digit characters
        const digits = phone.replace(/\D/g, '');
        // If number starts with 91 (India), remove it
        const number = digits.startsWith('91') ? digits.slice(2) : digits;
        // Ensure number is 10 digits
        if (number.length !== 10) {
            throw new Error(`Invalid phone number length: ${number}`);
        }
        // Add country code for India
        return `91${number}`;
    }
    static async sendSMS(to, message) {
        var _a;
        try {
            const formattedNumber = this.formatPhoneNumber(to);
            if (!MESSAGE91_AUTH_KEY || !MESSAGE91_SENDER_ID) {
                console.warn('Message91 SMS integration not configured');
                return;
            }
            const response = await axios_1.default.post('https://api.msg91.com/api/v2/sendsms', {
                sender: MESSAGE91_SENDER_ID,
                route: "4", // Transactional route
                country: "91",
                sms: [
                    {
                        message: message,
                        to: [formattedNumber]
                    }
                ]
            }, {
                headers: {
                    'authkey': MESSAGE91_AUTH_KEY,
                    'Content-Type': 'application/json'
                }
            });
            console.log('Message91 SMS API Response:', response.data);
            return response.data;
        }
        catch (error) {
            console.error('Failed to send SMS via Message91:', {
                error: error.message,
                response: (_a = error.response) === null || _a === void 0 ? void 0 : _a.data,
                phone: to
            });
            throw new Error(`Failed to send SMS: ${error.message}`);
        }
    }
    static async sendPaymentConfirmation(member, payment) {
        try {
            const message = `Dear ${member.firstName}, your payment of $${payment.amount} has been successfully received. Invoice: ${payment.invoiceNumber}. Payment Method: ${payment.paymentMethod}. Membership Type: ${member.membershipType}. Thank you for your payment!`;
            console.log('sending payment confirmation to', member.phone);
            // Send SMS
            await this.sendSMS(member.phone, message);
            // Log the notification
            await prisma.notification.create({
                data: {
                    memberId: member.id,
                    type: 'PAYMENT_CONFIRMATION',
                    message,
                    status: 'SENT'
                }
            });
        }
        catch (error) {
            console.error('Failed to send payment confirmation:', error);
            throw new Error('Failed to send payment confirmation');
        }
    }
    static async sendPaymentDueNotification(member, payment) {
        try {
            const message = `Dear ${member.firstName}, your payment of $${payment.amount} is due on ${new Date(payment.dueDate).toLocaleDateString()}.`;
            // Send SMS
            await this.sendSMS(member.phone, message);
            // Log the notification
            await prisma.notification.create({
                data: {
                    memberId: member.id,
                    type: 'PAYMENT_DUE',
                    message,
                    status: 'SENT'
                }
            });
        }
        catch (error) {
            console.error('Failed to send payment due notification:', error);
            throw new Error('Failed to send payment due notification');
        }
    }
    static async sendPaymentOverdueNotification(member, payment) {
        try {
            const message = `Dear ${member.firstName}, your payment of $${payment.amount} is overdue. Please make the payment immediately.`;
            // Send SMS
            await this.sendSMS(member.phone, message);
            // Log the notification
            await prisma.notification.create({
                data: {
                    memberId: member.id,
                    type: 'PAYMENT_OVERDUE',
                    message,
                    status: 'SENT'
                }
            });
        }
        catch (error) {
            console.error('Failed to send payment overdue notification:', error);
            throw new Error('Failed to send payment overdue notification');
        }
    }
    static async sendMembershipExpiryNotification(member) {
        try {
            const message = `Dear ${member.firstName}, your ${member.membershipType} membership will expire on ${new Date(member.expiryDate).toLocaleDateString()}.`;
            // Send SMS
            await this.sendSMS(member.phone, message);
            // Log the notification
            await prisma.notification.create({
                data: {
                    memberId: member.id,
                    type: 'MEMBERSHIP_EXPIRY',
                    message,
                    status: 'SENT'
                }
            });
        }
        catch (error) {
            console.error('Failed to send membership expiry notification:', error);
            throw new Error('Failed to send membership expiry notification');
        }
    }
    static async broadcastMessage(message, gymId) {
        try {
            // Get all active members for the gym
            const members = await prisma.member.findMany({
                where: {
                    gymId,
                    status: 'ACTIVE',
                    phone: { not: '' } // Filter out empty phone numbers
                }
            });
            const results = {
                total: members.length,
                successful: 0,
                failed: 0,
                errors: []
            };
            // Send message to each member
            for (const member of members) {
                try {
                    // Send SMS
                    await this.sendSMS(member.phone, message);
                    // Log the notification
                    await prisma.notification.create({
                        data: {
                            memberId: member.id,
                            type: 'BROADCAST',
                            message,
                            status: 'SENT'
                        }
                    });
                    results.successful++;
                }
                catch (error) {
                    results.failed++;
                    results.errors.push(`Failed to send to ${member.firstName} ${member.lastName}: ${error.message}`);
                    // Log the failed notification
                    await prisma.notification.create({
                        data: {
                            memberId: member.id,
                            type: 'BROADCAST',
                            message,
                            status: 'FAILED'
                        }
                    });
                }
            }
            return results;
        }
        catch (error) {
            console.error('Failed to broadcast message:', error);
            throw new Error('Failed to broadcast message');
        }
    }
}
exports.Message91Service = Message91Service;

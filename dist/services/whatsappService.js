"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const prisma = new client_1.PrismaClient();
// Validate required environment variables
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
if (!META_PHONE_NUMBER_ID || !META_ACCESS_TOKEN) {
    console.warn('⚠️ WhatsApp integration is not properly configured. Please set META_PHONE_NUMBER_ID and META_ACCESS_TOKEN environment variables.');
}
const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${META_PHONE_NUMBER_ID}/messages`;
// Message templates for production
const TEMPLATES = {
    PAYMENT_CONFIRMATION: {
        name: 'payment_confirmation',
        language: 'en',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: '{{1}}' }, // Member Name
                    { type: 'text', text: '{{2}}' }, // Invoice Number
                    { type: 'text', text: '{{3}}' }, // Date
                    { type: 'text', text: '{{4}}' }, // Amount
                    { type: 'text', text: '{{5}}' }, // Payment Method
                    { type: 'text', text: '{{6}}' } // Membership Type
                ]
            }
        ]
    },
    PAYMENT_DUE: {
        name: 'payment_due_reminder',
        language: 'en',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: '{{1}}' }, // Member Name
                    { type: 'text', text: '{{2}}' }, // Amount
                    { type: 'text', text: '{{3}}' }, // Due Date
                    { type: 'text', text: '{{4}}' } // Membership Type
                ]
            }
        ]
    }
};
class WhatsAppService {
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
        return `+91${number}`;
    }
    static async sendWhatsAppMessage(to, message, templateName, templateParams) {
        var _a, _b, _c, _d, _e, _f, _g;
        let formattedNumber = to; // Initialize with original number
        try {
            // Format phone number
            formattedNumber = this.formatPhoneNumber(to);
            // Check if WhatsApp integration is configured
            if (!META_PHONE_NUMBER_ID || !META_ACCESS_TOKEN) {
                console.warn('WhatsApp message not sent - integration not configured');
                return;
            }
            console.log('Sending WhatsApp message to:', formattedNumber);
            let requestBody;
            if (IS_PRODUCTION && templateName && templateParams) {
                // Use template message in production
                const template = TEMPLATES[templateName];
                if (!template) {
                    throw new Error(`Template ${templateName} not found`);
                }
                requestBody = {
                    messaging_product: 'whatsapp',
                    to: formattedNumber,
                    type: 'template',
                    template: {
                        name: template.name,
                        language: template.language,
                        components: template.components.map(comp => ({
                            ...comp,
                            parameters: comp.parameters.map((param, index) => ({
                                ...param,
                                text: templateParams[index]
                            }))
                        }))
                    }
                };
            }
            else {
                // Use regular text message in test mode
                requestBody = {
                    messaging_product: 'whatsapp',
                    to: formattedNumber,
                    type: 'text',
                    text: { body: message }
                };
            }
            console.log('Message content:', requestBody);
            const response = await axios_1.default.post(WHATSAPP_API_URL, requestBody, {
                headers: {
                    'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('WhatsApp API Response:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data,
                headers: response.headers
            });
            // Check if the message was actually queued
            if ((_c = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.messages) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.id) {
                console.log('Message ID:', response.data.messages[0].id);
                return response.data;
            }
            else {
                console.warn('Message might not have been queued. Response:', response.data);
                return null;
            }
        }
        catch (error) {
            // Handle specific WhatsApp API errors
            if (((_f = (_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.error) === null || _f === void 0 ? void 0 : _f.code) === 131030) {
                console.warn(`Phone number ${to} is not in the allowed list. Add it to your WhatsApp Business API test numbers.`);
                // Log the notification as failed but don't throw error
                return;
            }
            console.error('Failed to send WhatsApp message:', {
                error: error.message,
                response: (_g = error.response) === null || _g === void 0 ? void 0 : _g.data,
                phone: to,
                requestData: {
                    url: WHATSAPP_API_URL,
                    to: formattedNumber,
                    message: message
                }
            });
            throw new Error(`Failed to send WhatsApp message: ${error.message}`);
        }
    }
    static async sendPaymentConfirmation(member, payment) {
        try {
            const message = `*Payment Confirmation*\n\n` +
                `Dear ${member.firstName},\n\n` +
                `Thank you for your payment. Here are your payment details:\n\n` +
                `*Invoice Number:* ${payment.invoiceNumber}\n` +
                `*Date:* ${new Date(payment.paidDate).toLocaleDateString()}\n` +
                `*Amount Paid:* $${payment.amount}\n` +
                `*Payment Method:* ${payment.paymentMethod}\n` +
                `*Membership Type:* ${member.membershipType}\n\n` +
                `*Payment Status:* ✅ PAID\n\n` +
                `Thank you for your business!\n` +
                `Your Gym Team`;
            // In production, use template message
            if (IS_PRODUCTION) {
                await this.sendWhatsAppMessage(member.phone, message, 'PAYMENT_CONFIRMATION', [
                    member.firstName,
                    payment.invoiceNumber,
                    new Date(payment.paidDate).toLocaleDateString(),
                    `$${payment.amount}`,
                    payment.paymentMethod,
                    member.membershipType
                ]);
            }
            else {
                // In test mode, use regular text message
                await this.sendWhatsAppMessage(member.phone, message);
            }
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
            const message = `Dear ${member.firstName},\n\n` +
                `Your payment of $${payment.amount} for ${member.membershipType} membership is due on ${new Date(payment.dueDate).toLocaleDateString()}.\n\n` +
                `Please make the payment to continue enjoying our services.\n\n` +
                `Thank you,\n` +
                `Your Gym Team`;
            await this.sendWhatsAppMessage(member.phone, message);
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
            console.error('Failed to send WhatsApp notification:', error);
            throw new Error('Failed to send payment due notification');
        }
    }
    static async sendPaymentOverdueNotification(member, payment) {
        try {
            const message = `Dear ${member.firstName},\n\n` +
                `Your payment of $${payment.amount} for ${member.membershipType} membership is overdue.\n\n` +
                `Please make the payment immediately to avoid any service interruptions.\n\n` +
                `Thank you,\n` +
                `Your Gym Team`;
            await this.sendWhatsAppMessage(member.phone, message);
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
            console.error('Failed to send WhatsApp notification:', error);
            throw new Error('Failed to send payment overdue notification');
        }
    }
    static async sendMembershipExpiryNotification(member) {
        try {
            const message = `Dear ${member.firstName},\n\n` +
                `Your ${member.membershipType} membership will expire on ${new Date(member.expiryDate).toLocaleDateString()}.\n\n` +
                `Please renew your membership to continue enjoying our services.\n\n` +
                `Thank you,\n` +
                `Your Gym Team`;
            await this.sendWhatsAppMessage(member.phone, message);
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
            console.error('Failed to send WhatsApp notification:', error);
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
                    await this.sendWhatsAppMessage(member.phone, message);
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
    // Add new public method for overdue payment alerts
    static async sendOverduePaymentAlert(gymOwnerPhone, member, payments) {
        try {
            const message = `⚠️ *Overdue Payment Alert*\n\n` +
                `Member ${member.firstName} ${member.lastName} (ID: ${member.memberId}) is trying to mark attendance but has overdue payments:\n\n` +
                payments.map(payment => `• Amount: $${payment.amount}\n` +
                    `• Due Date: ${new Date(payment.dueDate).toLocaleDateString()}\n` +
                    `• Invoice: ${payment.invoiceNumber}\n`).join('\n') +
                `\nMember's Photo: ${member.photoUrl || 'No photo available'}`;
            await this.sendWhatsAppMessage(gymOwnerPhone, message);
            // Log the notification
            await prisma.notification.create({
                data: {
                    memberId: member.id,
                    type: 'OVERDUE_PAYMENT_ALERT',
                    message,
                    status: 'SENT'
                }
            });
        }
        catch (error) {
            console.error('Failed to send overdue payment alert:', error);
            throw new Error('Failed to send overdue payment alert');
        }
    }
}
exports.WhatsAppService = WhatsAppService;

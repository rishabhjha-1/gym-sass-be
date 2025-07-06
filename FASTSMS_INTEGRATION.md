# Message91 WhatsApp Integration

This document describes the Message91 WhatsApp integration that has been implemented in the gym management system.

## Overview

The system now uses Message91 for sending WhatsApp messages. Since the original FastSMS domains were not reachable, we've integrated with Message91's WhatsApp API using the provided API key. This integration provides a reliable solution for sending WhatsApp notifications to gym members.

## Configuration

### Environment Variables

Add the following environment variable to your `.env` file:

```bash
FASTSMS_API_KEY="DJ4Up5EHRwYWgNermxtAFaOC2Pzid7XhIGuKoM9s8BnQkTj3bfoVDqyfgnBGFlhvEILZKT4S23JRwM8b"
```

### API Key

The Message91 API key has been provided and is already configured in the system:
- **API Key**: `DJ4Up5EHRwYWgNermxtAFaOC2Pzid7XhIGuKoM9s8BnQkTj3bfoVDqyfgnBGFlhvEILZKT4S23JRwM8b`

## Features

### 1. Payment Confirmations
- Automatically sends WhatsApp messages when payments are marked as PAID
- Includes payment details like invoice number, amount, payment method, and membership type

### 2. Payment Due Notifications
- Sends reminders for payments due within 3 days
- Cron job runs daily at 9 AM to check for due payments

### 3. Payment Overdue Alerts
- Sends notifications for overdue payments
- Alerts gym owners when members with overdue payments try to mark attendance

### 4. Membership Expiry Notifications
- Sends reminders for memberships expiring within 7 days
- Helps with membership renewal retention

### 5. Broadcast Messages
- Allows gym owners to send messages to all active members
- Available via API endpoint: `POST /api/members/broadcast`

## API Endpoints

### Broadcast Message
```http
POST /api/members/broadcast
Content-Type: application/json
Authorization: Bearer <token>

{
  "message": "Your broadcast message here"
}
```

Response:
```json
{
  "success": true,
  "message": "Broadcast message sent successfully",
  "result": {
    "total": 50,
    "successful": 48,
    "failed": 2,
    "errors": ["Failed to send to John Doe: Invalid phone number"]
  }
}
```

## Message Templates

### Payment Confirmation
```
*Payment Confirmation*

Dear [Member Name],

Thank you for your payment. Here are your payment details:

*Invoice Number:* [Invoice Number]
*Date:* [Date]
*Amount Paid:* $[Amount]
*Payment Method:* [Payment Method]
*Membership Type:* [Membership Type]

*Payment Status:* ✅ PAID

Thank you for your business!
Your Gym Team
```

### Payment Due Notification
```
Dear [Member Name],

Your payment of $[Amount] for [Membership Type] membership is due on [Due Date].

Please make the payment to continue enjoying our services.

Thank you,
Your Gym Team
```

### Payment Overdue Notification
```
Dear [Member Name],

Your payment of $[Amount] for [Membership Type] membership is overdue.

Please make the payment immediately to avoid any service interruptions.

Thank you,
Your Gym Team
```

### Membership Expiry Notification
```
Dear [Member Name],

Your [Membership Type] membership will expire on [Expiry Date].

Please renew your membership to continue enjoying our services.

Thank you,
Your Gym Team
```

## Error Handling

The system includes comprehensive error handling:

1. **Invalid Phone Numbers**: Logs warnings for invalid phone numbers
2. **API Failures**: Logs detailed error information for debugging
3. **Network Issues**: Handles network timeouts and connection errors
4. **Rate Limiting**: Respects Message91 API rate limits
5. **Fallback to SMS**: If WhatsApp API fails, automatically falls back to SMS

## Logging

All WhatsApp message activities are logged:

- **Success**: Message sent successfully with response details
- **Failure**: Detailed error information including request data
- **Notifications**: All messages are logged in the database for audit purposes

## Phone Number Formatting

The system automatically formats phone numbers:
- Removes non-digit characters
- Handles Indian phone numbers (91 country code)
- Validates 10-digit format
- Adds country code prefix

## Testing

To test the integration:

1. Ensure the `FASTSMS_API_KEY` is set in your environment
2. Create a test payment and mark it as PAID
3. Check the logs for WhatsApp message delivery status
4. Use the broadcast endpoint to send test messages

## Monitoring

Monitor the integration through:

1. **Application Logs**: Check for WhatsApp message delivery status
2. **Database**: Review notification records in the `notifications` table
3. **API Responses**: Monitor broadcast message results
4. **Error Logs**: Check for any integration issues

## Support

For issues with the Message91 integration:

1. Check the application logs for detailed error messages
2. Verify the API key is correctly configured
3. Ensure phone numbers are in the correct format
4. Contact Message91 support for API-related issues

## Technical Details

### API Endpoints Used
- **WhatsApp API**: `https://api.msg91.com/api/v5/whatsapp/send`
- **SMS Fallback**: `https://api.msg91.com/api/v2/sendsms`

### Authentication
- Uses `authkey` header with the provided API key
- Content-Type: `application/json`

### Request Format
```json
{
  "to": "919876543210",
  "message": "Your message here",
  "type": "text"
}
``` 
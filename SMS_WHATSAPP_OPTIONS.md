# SMS & WhatsApp Services - No DLT/GST Required

This document outlines various SMS and WhatsApp services that can be used without DLT approval or company GST registration for your gym management system.

## 🚀 Quick Start Options

### Option 1: TextLocal (Recommended for SMS)
- **No DLT approval required** for promotional SMS
- **Simple setup** and reliable delivery
- **Cost**: ~₹0.12-0.15 per SMS

### Option 2: Twilio (Recommended for WhatsApp)
- **No DLT approval required**
- **International service** with excellent reliability
- **Cost**: $0.005 per WhatsApp message

## 📱 SMS Services (No DLT Required)

### 1. TextLocal
**Best for: Promotional SMS without DLT approval**

- **Setup**: 
  - Sign up at https://www.textlocal.in/
  - Get API key from dashboard
  - Set environment variables:
    ```env
    TEXTLOCAL_API_KEY=your_api_key_here
    TEXTLOCAL_SENDER=TXTLCL
    ```

- **Pros**:
  - No DLT approval needed for promotional SMS
  - Simple API integration
  - Good delivery rates in India
  - Affordable pricing

- **Cons**:
  - DLT approval required for transactional SMS
  - Limited to promotional content

### 2. MSG91 (Current Setup)
**Best for: Existing integration**

- **Setup**:
  ```env
  MESSAGE91_AUTH_KEY=your_auth_key_here
  MESSAGE91_SENDER_ID=GYMGMT
  ```

- **Pros**:
  - Good documentation
  - Reliable delivery
  - Works without DLT for promotional messages

- **Cons**:
  - DLT required for transactional SMS
  - Your current auth key seems invalid (401 error)

### 3. Twilio SMS
**Best for: International reliability**

- **Setup**:
  ```env
  TWILIO_ACCOUNT_SID=your_account_sid
  TWILIO_AUTH_TOKEN=your_auth_token
  TWILIO_PHONE_NUMBER=your_twilio_number
  ```

- **Pros**:
  - No Indian DLT requirements
  - Very reliable delivery
  - Excellent API documentation

- **Cons**:
  - Higher cost for Indian numbers (~$0.0079 per SMS)
  - International service

### 4. Plivo
**Best for: Global SMS service**

- **Setup**:
  ```env
  PLIVO_AUTH_ID=your_auth_id
  PLIVO_AUTH_TOKEN=your_auth_token
  PLIVO_PHONE_NUMBER=your_plivo_number
  ```

- **Pros**:
  - No DLT requirements
  - Good API and documentation
  - Competitive pricing

- **Cons**:
  - International service
  - Higher latency for Indian numbers

## 💬 WhatsApp Services (No DLT Required)

### 1. Twilio WhatsApp
**Best for: Reliable WhatsApp Business API**

- **Setup**:
  ```env
  TWILIO_ACCOUNT_SID=your_account_sid
  TWILIO_AUTH_TOKEN=your_auth_token
  TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
  ```

- **Pros**:
  - No DLT approval required
  - Very reliable delivery
  - Excellent API
  - $0.005 per message

- **Cons**:
  - Requires WhatsApp Business account approval
  - International service

### 2. MessageBird WhatsApp
**Best for: European-based service**

- **Setup**:
  ```env
  MESSAGEBIRD_API_KEY=your_api_key
  MESSAGEBIRD_WHATSAPP_CHANNEL_ID=your_channel_id
  ```

- **Pros**:
  - No DLT requirements
  - Good delivery rates
  - €0.005 per message

- **Cons**:
  - International service
  - Requires WhatsApp Business approval

### 3. 360dialog
**Best for: WhatsApp Business specialist**

- **Setup**:
  ```env
  DIALOG360_API_KEY=your_api_key
  DIALOG360_PHONE_NUMBER_ID=your_phone_number_id
  ```

- **Pros**:
  - Specialized in WhatsApp Business
  - No DLT requirements
  - Good support

- **Cons**:
  - Requires WhatsApp Business approval
  - Pricing varies by volume

## 🔧 Implementation Guide

### Current Setup (Fixed)
Your system now has:
1. **WhatsApp Service** (Meta WhatsApp Business API)
2. **TextLocal SMS** (Fallback when WhatsApp fails)
3. **Message91 SMS** (Currently failing - needs valid auth key)

### Recommended Configuration

```env
# Primary: WhatsApp (Meta)
META_PHONE_NUMBER_ID=your_phone_number_id
META_ACCESS_TOKEN=your_access_token

# Fallback: TextLocal SMS
TEXTLOCAL_API_KEY=your_textlocal_api_key
TEXTLOCAL_SENDER=GYMGMT

# Alternative: Message91 (if you fix the auth key)
MESSAGE91_AUTH_KEY=your_valid_message91_key
MESSAGE91_SENDER_ID=GYMGMT
```

### Service Priority
1. **WhatsApp** (Meta) - Primary
2. **TextLocal SMS** - Fallback
3. **Message91 SMS** - Alternative (if auth key is fixed)

## 💰 Cost Comparison

| Service | Type | Cost per Message | DLT Required | GST Required |
|---------|------|------------------|--------------|--------------|
| TextLocal | SMS | ₹0.12-0.15 | No (Promotional) | No |
| MSG91 | SMS | ₹0.12-0.18 | No (Promotional) | No |
| Twilio SMS | SMS | $0.0079 | No | No |
| Twilio WhatsApp | WhatsApp | $0.005 | No | No |
| MessageBird WhatsApp | WhatsApp | €0.005 | No | No |

## 🚀 Quick Setup Instructions

### For TextLocal (Recommended SMS Fallback):

1. **Sign up**: Go to https://www.textlocal.in/
2. **Get API key**: From your dashboard
3. **Add to .env**:
   ```env
   TEXTLOCAL_API_KEY=your_api_key_here
   TEXTLOCAL_SENDER=GYMGMT
   ```
4. **Test**: The system will automatically use TextLocal when WhatsApp fails

### For Twilio WhatsApp (Recommended WhatsApp):

1. **Sign up**: Go to https://www.twilio.com/
2. **Get credentials**: Account SID and Auth Token
3. **Set up WhatsApp**: Follow Twilio's WhatsApp Business setup
4. **Add to .env**:
   ```env
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
   ```

## 🔍 Troubleshooting

### Current Issue: Message91 401 Error
Your Message91 auth key is invalid. To fix:
1. Log into your Message91 account
2. Generate a new auth key
3. Update your environment variable:
   ```env
   MESSAGE91_AUTH_KEY=your_new_valid_key
   ```

### WhatsApp API Issues
If WhatsApp fails, the system automatically falls back to SMS via TextLocal.

### Testing
Use the test mode in development:
```env
NODE_ENV=development  # Enables test mode for TextLocal
```

## 📞 Support

- **TextLocal**: https://www.textlocal.in/support
- **Twilio**: https://support.twilio.com/
- **MessageBird**: https://support.messagebird.com/
- **360dialog**: https://www.360dialog.com/support

## 🎯 Recommendation

For your gym management system, I recommend:

1. **Primary**: Keep WhatsApp (Meta) as primary
2. **Fallback**: Use TextLocal for SMS when WhatsApp fails
3. **Alternative**: Fix Message91 auth key for additional SMS option

This gives you maximum reliability with no DLT/GST requirements! 
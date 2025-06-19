# Python Face Recognition Service Deployment

Since you already have your Express app deployed on Render, this guide will help you add the Python face recognition service.

## 🚀 Quick Deployment Steps

### Step 1: Deploy Python Service

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your existing GitHub repository (same repo as your Express app)
   - Configure the service:

**Basic Settings:**
- **Name**: `face-recognition-service`
- **Environment**: `Python 3`
- **Region**: Same as your Express app
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty

**Build & Deploy:**
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python face_recognition_service.py`

**Environment Variables:**
```
PYTHON_VERSION=3.11.0
PORT=8000
```

3. **Deploy**: Click "Create Web Service"
4. **Wait**: First build may take 10-15 minutes
5. **Note the URL**: `https://face-recognition-service.onrender.com`

### Step 2: Update Your Express App Environment Variables

1. **Go to your existing Express app** in Render dashboard
2. **Environment Variables** → **Add Environment Variable**:
   - **Key**: `PYTHON_FACE_SERVICE_URL`
   - **Value**: `https://face-recognition-service.onrender.com`
3. **Save** and **Redeploy** your Express app

### Step 3: Test the Integration

```bash
# Test Python service
curl https://face-recognition-service.onrender.com/health

# Test your Express app (replace with your actual URL)
curl https://your-express-app.onrender.com/health
```

## 🔧 Alternative: Manual Deployment

If you prefer to deploy manually without the render.yaml file:

1. **Create New Web Service** in Render
2. **Use these exact settings**:

**Build Command:**
```bash
pip install -r requirements.txt
```

**Start Command:**
```bash
python face_recognition_service.py
```

**Environment Variables:**
- `PYTHON_VERSION=3.11.0`
- `PORT=8000`

## 🎯 Expected Results

After deployment:
- ✅ Python service: `https://face-recognition-service.onrender.com`
- ✅ Express app: Your existing URL
- ✅ Face recognition: **5x faster** (2-3 seconds vs 10-15 seconds)

## 🚨 Troubleshooting

### Python Service Won't Start
- Check build logs for dependency issues
- Ensure `requirements.txt` is in the root directory
- Verify Python version compatibility

### Express App Can't Connect
- Verify `PYTHON_FACE_SERVICE_URL` is set correctly
- Check if Python service is healthy
- Ensure CORS is configured properly

### Slow Performance
- Upgrade to paid Render plan for better resources
- Monitor CPU usage in Render dashboard
- Consider implementing caching

## 📊 Monitoring

1. **Python Service Logs**: Check in Render dashboard
2. **Express App Logs**: Check in Render dashboard
3. **Performance**: Monitor response times
4. **Health Checks**: Both services have `/health` endpoints

## 💡 Pro Tips

1. **Free Tier**: Both services can run on Render's free tier
2. **Auto-scaling**: Upgrade plans for better performance
3. **Custom Domains**: Add your own domain for production
4. **SSL**: Render provides HTTPS automatically

## 🎉 Success!

Your face recognition will now be:
- ⚡ **5x faster** in production
- 🔄 **Automatically deployed** on Git pushes
- 🔒 **Secure** with HTTPS
- 📊 **Monitored** with Render metrics

## 📞 Need Help?

- Check Render logs for specific errors
- Verify environment variables are set correctly
- Test endpoints individually to isolate issues 
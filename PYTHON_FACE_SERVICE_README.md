# Python Face Recognition Service

This is a high-performance Python-based face recognition service that can process face verification in 2-3 seconds. It uses the `face-recognition` library which is built on top of dlib and provides excellent accuracy and speed.

## Features

- ⚡ **Fast Processing**: Face verification in 2-3 seconds
- 🎯 **High Accuracy**: Uses dlib's state-of-the-art face recognition
- 🔄 **Caching**: In-memory caching of face encodings for faster subsequent requests
- 🐳 **Docker Support**: Easy deployment with Docker
- 🔌 **REST API**: FastAPI-based REST endpoints
- 📊 **Detailed Logging**: Processing time and similarity scores

## Performance Comparison

| Service | Processing Time | Accuracy | Memory Usage |
|---------|----------------|----------|--------------|
| Node.js (face-api.js) | 10-15 seconds | Good | High |
| Python (face-recognition) | 2-3 seconds | Excellent | Low |

## Setup Instructions

### Option 1: Local Setup

1. **Install Python 3.11**
   ```bash
   # macOS
   brew install python@3.11
   
   # Ubuntu
   sudo apt-get install python3.11
   ```

2. **Run Setup Script**
   ```bash
   ./setup_python_service.sh
   ```

3. **Start the Service**
   ```bash
   source venv/bin/activate
   python face_recognition_service.py
   ```

### Option 2: Docker Setup

1. **Build and Run**
   ```bash
   docker build -t face-recognition-service .
   docker run -p 8000:8000 face-recognition-service
   ```

2. **Using Docker Compose**
   ```bash
   docker-compose up face-recognition-service
   ```

## API Endpoints

### Verify Face
```http
POST /verify-face
Content-Type: application/json

{
  "image_data": "base64_encoded_image",
  "member_id": "member123",
  "stored_image_url": "https://example.com/photo.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "is_match": true,
  "similarity_score": 0.85,
  "processing_time": 2.1
}
```

### Index Face
```http
POST /index-face
Content-Type: application/json

{
  "image_data": "base64_encoded_image",
  "member_id": "member123"
}
```

**Response:**
```json
{
  "success": true,
  "face_detected": true,
  "processing_time": 1.8
}
```

### Health Check
```http
GET /health
```

### Clear Cache
```http
POST /clear-cache
```

## Integration with Node.js

Replace your existing face recognition service calls with the Python service:

```typescript
// Instead of using FaceRecognitionService
// import FaceRecognitionService from './faceRecognitionService';

// Use the Python service
import PythonFaceRecognitionService from './pythonFaceRecognitionService';

const faceService = PythonFaceRecognitionService.getInstance();

// Verify face
const isMatch = await faceService.verifyFace(imageBuffer, memberId);

// Index face
const photoUrl = await faceService.indexFace(imageBuffer, memberId);
```

## Environment Variables

Add to your `.env` file:
```env
PYTHON_FACE_SERVICE_URL=http://localhost:8000
```

## Configuration

### Similarity Threshold
Adjust the similarity threshold in `face_recognition_service.py`:
```python
self.similarity_threshold = 0.6  # Default: 0.6 (60% similarity)
```

### Face Detection Model
Choose between HOG (faster) and CNN (more accurate):
```python
face_locations = face_recognition.face_locations(rgb_image, model="hog")  # or "cnn"
```

## Performance Optimization

1. **Caching**: Face encodings are cached in memory for faster subsequent verifications
2. **Image Preprocessing**: Images are automatically resized and optimized
3. **Early Exit**: Quick rejection of obviously different faces
4. **Parallel Processing**: Multiple faces can be processed simultaneously

## Troubleshooting

### Common Issues

1. **Service not responding**
   ```bash
   curl http://localhost:8000/health
   ```

2. **Face not detected**
   - Ensure image has a clear, front-facing face
   - Check image quality and lighting
   - Try different face detection model

3. **High processing time**
   - Check system resources
   - Consider using HOG model instead of CNN
   - Optimize image size before sending

### Logs
Check the service logs for detailed information:
```bash
docker logs face-recognition-service
```

## Migration from Node.js Service

1. **Stop the old service**
2. **Start the Python service**
3. **Update your application to use the new TypeScript client**
4. **Test with a few images to ensure accuracy**

## Monitoring

The service provides detailed metrics:
- Processing time per request
- Similarity scores
- Cache hit/miss rates
- Error rates

## Security Considerations

- The service runs on localhost by default
- Add authentication if exposed to the internet
- Consider rate limiting for production use
- Validate input images before processing

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify the service is running: `curl http://localhost:8000/health`
3. Test with a simple image first
4. Check system resources (CPU, memory) 
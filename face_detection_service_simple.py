import cv2
import numpy as np
import base64
import io
from PIL import Image
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import time
import os
from typing import Optional
import logging
import gc

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Simple Face Detection Service", version="1.0.0")

class FaceVerificationRequest(BaseModel):
    image_data: str  # base64 encoded image
    member_id: str
    stored_image_url: Optional[str] = None

class FaceIndexRequest(BaseModel):
    image_data: str  # base64 encoded image
    member_id: str

class FaceVerificationResponse(BaseModel):
    success: bool
    is_match: bool
    similarity_score: float
    processing_time: float
    error_message: Optional[str] = None

class FaceIndexResponse(BaseModel):
    success: bool
    face_detected: bool
    processing_time: float
    error_message: Optional[str] = None

class SimpleFaceDetectionService:
    def __init__(self):
        self.face_cache = {}
        self.similarity_threshold = 0.7
        self.max_cache_size = 10
        
        # Load OpenCV face detection cascade
        try:
            # Try to load from OpenCV data path
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
            if self.face_cascade.empty():
                logger.warning("Could not load face cascade, using basic detection")
                self.face_cascade = None
        except Exception as e:
            logger.warning(f"Could not load face cascade: {e}")
            self.face_cascade = None
        
    def clear_old_cache(self):
        """Clear old cache entries to prevent memory issues"""
        if len(self.face_cache) > self.max_cache_size:
            oldest_keys = sorted(self.face_cache.keys(), key=lambda k: self.face_cache[k].get('timestamp', 0))[:5]
            for key in oldest_keys:
                del self.face_cache[key]
            gc.collect()
        
    def base64_to_image(self, base64_string: str) -> np.ndarray:
        """Convert base64 string to numpy array with memory optimization"""
        try:
            if base64_string.startswith('data:image'):
                base64_string = base64_string.split(',')[1]
            
            image_data = base64.b64decode(base64_string)
            image = Image.open(io.BytesIO(image_data))
            
            # Resize image to reduce memory usage
            max_size = 300
            if max(image.size) > max_size:
                image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            return np.array(image)
        except Exception as e:
            logger.error(f"Error converting base64 to image: {e}")
            raise ValueError("Invalid image data")

    def url_to_image(self, url: str) -> np.ndarray:
        """Download image from URL with memory optimization"""
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            image = Image.open(io.BytesIO(response.content))
            
            # Resize image to reduce memory usage
            max_size = 300
            if max(image.size) > max_size:
                image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            return np.array(image)
        except Exception as e:
            logger.error(f"Error downloading image from URL: {e}")
            raise ValueError(f"Failed to download image from URL: {url}")

    def detect_face_simple(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Simple face detection using OpenCV"""
        try:
            # Convert to grayscale for face detection
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            else:
                gray = image

            # Use OpenCV face detection if available
            if self.face_cascade:
                faces = self.face_cascade.detectMultiScale(
                    gray, 
                    scaleFactor=1.1, 
                    minNeighbors=5, 
                    minSize=(30, 30)
                )
                
                if len(faces) > 0:
                    # Get the largest face
                    largest_face = max(faces, key=lambda x: x[2] * x[3])
                    x, y, w, h = largest_face
                    face_roi = gray[y:y+h, x:x+w]
                    
                    # Resize to standard size for comparison
                    face_roi = cv2.resize(face_roi, (64, 64))
                    return face_roi
            else:
                # Fallback: use the center portion of the image
                h, w = gray.shape
                center_h, center_w = h // 2, w // 2
                size = min(h, w) // 2
                
                face_roi = gray[center_h-size:center_h+size, center_w-size:center_w+size]
                face_roi = cv2.resize(face_roi, (64, 64))
                return face_roi
                
        except Exception as e:
            logger.error(f"Error in face detection: {e}")
            return None

    def compare_faces_simple(self, face1: np.ndarray, face2: np.ndarray) -> tuple[bool, float]:
        """Compare two face images using simple similarity metrics"""
        try:
            # Normalize images
            face1_norm = face1.astype(np.float32) / 255.0
            face2_norm = face2.astype(np.float32) / 255.0
            
            # Calculate structural similarity
            # Simple mean squared error
            mse = np.mean((face1_norm - face2_norm) ** 2)
            similarity_score = 1.0 - mse
            
            # Normalize similarity score
            similarity_score = max(0.0, min(1.0, similarity_score))
            
            is_match = similarity_score >= self.similarity_threshold
            
            logger.info(f"MSE: {mse:.4f}, Similarity: {similarity_score:.4f}, Match: {is_match}")
            
            return is_match, similarity_score
            
        except Exception as e:
            logger.error(f"Error comparing faces: {e}")
            return False, 0.0

    def verify_face(self, image_data: str, member_id: str, stored_image_url: str) -> tuple[bool, float, float]:
        """Verify if uploaded image matches stored image"""
        start_time = time.time()
        
        try:
            self.clear_old_cache()
            
            cache_key = f"stored_{member_id}"
            stored_face = self.face_cache.get(cache_key, {}).get('face')
            
            # Convert uploaded image
            uploaded_image = self.base64_to_image(image_data)
            uploaded_face = self.detect_face_simple(uploaded_image)
            
            if uploaded_face is None:
                return False, 0.0, time.time() - start_time
            
            # Get stored face
            if stored_face is None:
                stored_image = self.url_to_image(stored_image_url)
                stored_face = self.detect_face_simple(stored_image)
                
                if stored_face is None:
                    return False, 0.0, time.time() - start_time
                
                # Cache the stored face
                self.face_cache[cache_key] = {
                    'face': stored_face,
                    'timestamp': time.time()
                }
            
            # Compare faces
            is_match, similarity_score = self.compare_faces_simple(stored_face, uploaded_face)
            processing_time = time.time() - start_time
            
            # Clear memory
            del uploaded_image
            gc.collect()
            
            return is_match, similarity_score, processing_time
            
        except Exception as e:
            logger.error(f"Error in face verification: {e}")
            return False, 0.0, time.time() - start_time

    def index_face(self, image_data: str, member_id: str) -> tuple[bool, float]:
        """Index a new face for future verification"""
        start_time = time.time()
        
        try:
            self.clear_old_cache()
            
            # Convert image
            image = self.base64_to_image(image_data)
            face = self.detect_face_simple(image)
            
            if face is None:
                return False, time.time() - start_time
            
            # Cache the face
            cache_key = f"stored_{member_id}"
            self.face_cache[cache_key] = {
                'face': face,
                'timestamp': time.time()
            }
            
            processing_time = time.time() - start_time
            
            # Clear memory
            del image
            gc.collect()
            
            return True, processing_time
            
        except Exception as e:
            logger.error(f"Error in face indexing: {e}")
            return False, time.time() - start_time

# Initialize service
face_service = SimpleFaceDetectionService()

@app.post("/verify-face", response_model=FaceVerificationResponse)
async def verify_face(request: FaceVerificationRequest):
    """Verify if uploaded face matches stored face"""
    try:
        if not request.stored_image_url:
            raise HTTPException(status_code=400, detail="stored_image_url is required")
        
        is_match, similarity_score, processing_time = face_service.verify_face(
            request.image_data, 
            request.member_id, 
            request.stored_image_url
        )
        
        return FaceVerificationResponse(
            success=True,
            is_match=is_match,
            similarity_score=similarity_score,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Error in verify-face endpoint: {e}")
        return FaceVerificationResponse(
            success=False,
            is_match=False,
            similarity_score=0.0,
            processing_time=0.0,
            error_message=str(e)
        )

@app.post("/index-face", response_model=FaceIndexResponse)
async def index_face(request: FaceIndexRequest):
    """Index a new face for future verification"""
    try:
        face_detected, processing_time = face_service.index_face(
            request.image_data, 
            request.member_id
        )
        
        return FaceIndexResponse(
            success=True,
            face_detected=face_detected,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Error in index-face endpoint: {e}")
        return FaceIndexResponse(
            success=False,
            face_detected=False,
            processing_time=0.0,
            error_message=str(e)
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "simple-face-detection"}

@app.post("/clear-cache")
async def clear_cache():
    """Clear the face cache"""
    face_service.face_cache.clear()
    gc.collect()
    return {"message": "Cache cleared successfully"}

if __name__ == "__main__":
    # Get port from environment variable (for Render)
    port = int(os.environ.get("PORT", 8000))
    
    # Run the service
    uvicorn.run(app, host="0.0.0.0", port=port) 
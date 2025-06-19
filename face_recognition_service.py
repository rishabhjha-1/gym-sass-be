import face_recognition
import numpy as np
import cv2
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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Face Recognition Service", version="1.0.0")

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

class FaceRecognitionService:
    def __init__(self):
        self.face_cache = {}
        self.similarity_threshold = 0.6  # Adjustable threshold
        
    def base64_to_image(self, base64_string: str) -> np.ndarray:
        """Convert base64 string to numpy array"""
        try:
            # Remove data URL prefix if present
            if base64_string.startswith('data:image'):
                base64_string = base64_string.split(',')[1]
            
            image_data = base64.b64decode(base64_string)
            image = Image.open(io.BytesIO(image_data))
            return np.array(image)
        except Exception as e:
            logger.error(f"Error converting base64 to image: {e}")
            raise ValueError("Invalid image data")

    def url_to_image(self, url: str) -> np.ndarray:
        """Download image from URL and convert to numpy array"""
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            image = Image.open(io.BytesIO(response.content))
            return np.array(image)
        except Exception as e:
            logger.error(f"Error downloading image from URL: {e}")
            raise ValueError(f"Failed to download image from URL: {url}")

    def detect_and_encode_face(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Detect face and return encoding"""
        try:
            # Convert BGR to RGB if needed
            if len(image.shape) == 3 and image.shape[2] == 3:
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            else:
                rgb_image = image

            # Detect face locations
            face_locations = face_recognition.face_locations(rgb_image, model="hog")
            
            if not face_locations:
                logger.warning("No face detected in image")
                return None
            
            if len(face_locations) > 1:
                logger.warning(f"Multiple faces detected ({len(face_locations)}), using first one")
            
            # Get face encoding
            face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
            
            if not face_encodings:
                logger.warning("Failed to encode face")
                return None
            
            return face_encodings[0]
            
        except Exception as e:
            logger.error(f"Error in face detection/encoding: {e}")
            return None

    def compare_faces(self, encoding1: np.ndarray, encoding2: np.ndarray) -> tuple[bool, float]:
        """Compare two face encodings and return match status and similarity score"""
        try:
            # Calculate face distance (lower is more similar)
            face_distance = face_recognition.face_distance([encoding1], encoding2)[0]
            
            # Convert distance to similarity score (0-1, higher is more similar)
            similarity_score = 1 - face_distance
            
            # Check if faces match based on threshold
            is_match = similarity_score >= self.similarity_threshold
            
            logger.info(f"Face distance: {face_distance:.4f}, Similarity: {similarity_score:.4f}, Match: {is_match}")
            
            return is_match, similarity_score
            
        except Exception as e:
            logger.error(f"Error comparing faces: {e}")
            return False, 0.0

    def verify_face(self, image_data: str, member_id: str, stored_image_url: str) -> tuple[bool, float, float]:
        """Verify if uploaded image matches stored image"""
        start_time = time.time()
        
        try:
            # Check cache first
            cache_key = f"stored_{member_id}"
            stored_encoding = self.face_cache.get(cache_key)
            
            # Convert uploaded image
            uploaded_image = self.base64_to_image(image_data)
            uploaded_encoding = self.detect_and_encode_face(uploaded_image)
            
            if uploaded_encoding is None:
                return False, 0.0, time.time() - start_time
            
            # Get stored face encoding
            if stored_encoding is None:
                stored_image = self.url_to_image(stored_image_url)
                stored_encoding = self.detect_and_encode_face(stored_image)
                
                if stored_encoding is None:
                    return False, 0.0, time.time() - start_time
                
                # Cache the stored encoding
                self.face_cache[cache_key] = stored_encoding
            
            # Compare faces
            is_match, similarity_score = self.compare_faces(stored_encoding, uploaded_encoding)
            processing_time = time.time() - start_time
            
            return is_match, similarity_score, processing_time
            
        except Exception as e:
            logger.error(f"Error in face verification: {e}")
            return False, 0.0, time.time() - start_time

    def index_face(self, image_data: str, member_id: str) -> tuple[bool, float]:
        """Index a new face for future verification"""
        start_time = time.time()
        
        try:
            # Convert image
            image = self.base64_to_image(image_data)
            face_encoding = self.detect_and_encode_face(image)
            
            if face_encoding is None:
                return False, time.time() - start_time
            
            # Cache the encoding
            cache_key = f"stored_{member_id}"
            self.face_cache[cache_key] = face_encoding
            
            processing_time = time.time() - start_time
            return True, processing_time
            
        except Exception as e:
            logger.error(f"Error in face indexing: {e}")
            return False, time.time() - start_time

# Initialize service
face_service = FaceRecognitionService()

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
    return {"status": "healthy", "service": "face-recognition"}

@app.post("/clear-cache")
async def clear_cache():
    """Clear the face encoding cache"""
    face_service.face_cache.clear()
    return {"message": "Cache cleared successfully"}

if __name__ == "__main__":
    # Get port from environment variable (for Render)
    port = int(os.environ.get("PORT", 8000))
    
    # Run the service
    uvicorn.run(app, host="0.0.0.0", port=port) 
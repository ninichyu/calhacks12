import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import { LettaAI } from "../services/lettaAI";

export default function CardStack({ userID, restaurants }) {
  const [ai] = useState(() => new LettaAI(userID));
  const [currentRestaurant, setCurrentRestaurant] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [validPhotos, setValidPhotos] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [explanation, setExplanation] = useState("");
  const [aiOrderedRestaurants, setAiOrderedRestaurants] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize AI and get first restaurant
  useEffect(() => {
    const initializeAI = async () => {
      if (restaurants.length === 0) return;
      
      const firstRestaurant = await ai.chooseNextRestaurant(restaurants);
      if (firstRestaurant) {
        setCurrentRestaurant(firstRestaurant);
        setExplanation(ai.getRecommendationExplanation(firstRestaurant));
        setAiOrderedRestaurants([firstRestaurant]);
      }
      setIsInitialized(true);
    };

    initializeAI();
  }, [restaurants]);

  // Validate images for current restaurant whenever it changes
  useEffect(() => {
    const validateCurrentRestaurant = async () => {
      if (!currentRestaurant) return;
      
      setIsLoadingPhotos(true);
      setPhotoIndex(0);
      
      if (!currentRestaurant.photo_ids) {
        setValidPhotos([]);
        setIsLoadingPhotos(false);
        return;
      }

      const photoIds = currentRestaurant.photo_ids.split(',');
      const validated = [];

      // Quickly validate each photo
      await Promise.all(
        photoIds.map(async (photoId) => {
          const { data } = supabase.storage
            .from("photos")
            .getPublicUrl(photoId.trim() + '.jpg');

          if (data && data.publicUrl) {
            try {
              await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => reject();
                img.src = data.publicUrl;
                setTimeout(() => reject(), 2000); // 2 sec timeout
              });
              validated.push(data.publicUrl);
            } catch {
              // Silently skip invalid images
            }
          }
        })
      );

      setValidPhotos(validated);
      setIsLoadingPhotos(false);
    };

    validateCurrentRestaurant();
  }, [currentRestaurant]);

  if (!restaurants.length) return <p>Loading...</p>;
  if (!isInitialized || isLoadingPhotos) return <p>Loading...</p>;
  if (!currentRestaurant) return <p>No more restaurants!</p>;

  const currentPhoto = validPhotos[photoIndex];

  console.log('Current restaurant object:', currentRestaurant);
  console.log('Available fields:', Object.keys(currentRestaurant));

  async function saveUserSwipe(userId, restaurant, action) {
    const liked = action === 1;
    console.log('Saving swipe:', { userId, restaurantId: restaurant.business_id, action });
    
    // Record feedback with AI
    ai.recordFeedback(restaurant, liked);

    // Save to Supabase
    supabase
      .from("swipes")
      .upsert(
        [{ user_id: userId, restaurant_id: restaurant.business_id, action: action }],
        { onConflict: ["user_id", "restaurant_id"] }
      )
      .then((result) => {
        const { data, error } = result;
        if (error) console.error("Error saving swipe:", error);
        else console.log("Swipe saved successfully:", data);
      });

    // Get next restaurant from AI
    const nextRestaurant = await ai.chooseNextRestaurant(restaurants);
    
    if (nextRestaurant) {
      setCurrentRestaurant(nextRestaurant);
      setExplanation(ai.getRecommendationExplanation(nextRestaurant));
      setAiOrderedRestaurants(prev => [...prev, nextRestaurant]);
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentRestaurant(null);
    }
  }

  function nextPhoto() {
    setPhotoIndex(prev => (prev + 1) % validPhotos.length);
  }

  function prevPhoto() {
    setPhotoIndex(prev => (prev - 1 + validPhotos.length) % validPhotos.length);
  }

  const categories =
    Array.isArray(currentRestaurant.categories)
      ? currentRestaurant.categories
      : typeof currentRestaurant.categories === "string"
      ? currentRestaurant.categories.replace(/[\[\]"]+/g, "").split(",").map(s => s.trim())
      : [];

  const filteredCategories = categories.filter(
    cat => !["restaurant", "restaurants", "food", "entertainment"].includes(cat.toLowerCase())
  );

  return (
    <div className="card-stack">
      {/* AI Explanation */}
      {explanation && (
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#0c4a6e',
          maxWidth: '350px'
        }}>
          <strong>🤖 AI Pick:</strong> {explanation}
        </div>
      )}

      <div className="card">
        {validPhotos.length > 0 ? (
          <div style={{ position: 'relative' }}>
            <img 
              src={currentPhoto}
              alt={`${currentRestaurant.name} - Photo ${photoIndex + 1}`}
              style={{
                width: "350px", 
                height: "500px",
                objectFit: "cover",
                borderRadius: "8px" 
              }}
            />
            
            {validPhotos.length > 1 && (
              <>
                <button
                  onClick={prevPhoto}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    fontSize: '20px'
                  }}
                >
                  ←
                </button>
                
                <button
                  onClick={nextPhoto}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    fontSize: '20px'
                  }}
                >
                  →
                </button>

                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '5px'
                }}>
                  {validPhotos.map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: idx === photoIndex ? 'white' : 'rgba(255,255,255,0.5)',
                        cursor: 'pointer'
                      }}
                      onClick={() => setPhotoIndex(idx)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{
            width: "350px", 
            height: "500px",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f0f0f0',
            borderRadius: "8px",
            color: '#999'
          }}>
            No photos available
          </div>
        )}

        <h3>{currentRestaurant.name}</h3>
        <p>{currentRestaurant.stars} ⭐ • {filteredCategories.join(", ")}</p>
        <p>{currentRestaurant.city}, {currentRestaurant.state}</p>
        {validPhotos.length > 1 && (
          <p style={{ fontSize: '12px', color: '#666' }}>
            Photo {photoIndex + 1} of {validPhotos.length}
          </p>
        )}
      </div>

      <div className="buttons">
        <button onClick={() => saveUserSwipe(userID, currentRestaurant, 0)}>❌ Nope</button>
        <button onClick={() => saveUserSwipe(userID, currentRestaurant, 1)}>💚 Like</button>
      </div>
    </div>
  );
}
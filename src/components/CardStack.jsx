import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export default function CardStack({ userID, restaurants }) {
  const [index, setIndex] = useState(0);
  const [validPhotos, setValidPhotos] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);

  // Validate images for current restaurant whenever index changes
  useEffect(() => {
    const validateCurrentRestaurant = async () => {
      if (index >= restaurants.length) return;
      
      setIsLoadingPhotos(true);
      setPhotoIndex(0);
      
      const current = restaurants[index];
      
      if (!current.photo_ids) {
        setValidPhotos([]);
        setIsLoadingPhotos(false);
        return;
      }

      const photoIds = current.photo_ids.split(',');
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
  }, [index, restaurants]);

  if (!restaurants.length) return <p>Loading...</p>;
  if (index >= restaurants.length) return <p>No more restaurants!</p>;
  if (isLoadingPhotos) return <p>Loading...</p>;

  const current = restaurants[index];
  const currentPhoto = validPhotos[photoIndex];

  console.log('Current restaurant object:', current);
  console.log('Available fields:', Object.keys(current));

  function saveUserSwipe(userId, restaurantId, action) {
    console.log('Saving swipe:', { userId, restaurantId, action });
    setIndex(prev => prev + 1);

    supabase
      .from("swipes")
      .upsert(
        [{ user_id: userId, restaurant_id: restaurantId, action: action }],
        { onConflict: ["user_id", "restaurant_id"] }
      )
      .then((result) => {
        const { data, error } = result;
        if (error) console.error("Error saving swipe:", error);
        else console.log("Swipe saved successfully:", data);
      });
  }

  function nextPhoto() {
    if (photoIndex < validPhotos.length - 1) {
      setPhotoIndex(prev => prev + 1);
    }
  }

  function prevPhoto() {
    if (photoIndex > 0) {
      setPhotoIndex(prev => prev - 1);
    }
  }

  const categories =
    Array.isArray(current.categories)
      ? current.categories
      : typeof current.categories === "string"
      ? current.categories.replace(/[\[\]"]+/g, "").split(",").map(s => s.trim())
      : [];

  const filteredCategories = categories.filter(
    cat => !["restaurant", "restaurants", "food", "entertainment"].includes(cat.toLowerCase())
  );

  return (
    <div className="card-stack">
      <div className="card">
        {validPhotos.length > 0 ? (
          <div style={{ position: 'relative' }}>
            <img 
              src={currentPhoto}
              alt={`${current.name} - Photo ${photoIndex + 1}`}
              style={{
                width: "350px", 
                height: "500px",
                objectFit: "cover",
                borderRadius: "8px" 
              }}
            />
            
            {validPhotos.length > 1 && (
              <>
                {photoIndex > 0 && (
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
                )}
                
                {photoIndex < validPhotos.length - 1 && (
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
                )}

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

        <h3>{current.name}</h3>
        <p>{current.stars} ⭐ • {filteredCategories.join(", ")}</p>
        <p>{current.city}, {current.state}</p>
        {validPhotos.length > 1 && (
          <p style={{ fontSize: '12px', color: '#666' }}>
            Photo {photoIndex + 1} of {validPhotos.length}
          </p>
        )}
      </div>

      <div className="buttons">
        <button onClick={() => saveUserSwipe(userID, current.business_id, 0)}>❌ Nope</button>
        <button onClick={() => saveUserSwipe(userID, current.business_id, 1)}>💚 Like</button>
      </div>
    </div>
  );
}
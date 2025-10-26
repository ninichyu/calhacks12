import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import { getRankedRestaurants, updateUserPreferences, getUserTasteProfile } from '../services/lettaService';

export default function CardStack({ userID, restaurants }) {
  const [rankedRestaurants, setRankedRestaurants] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [validPhotos, setValidPhotos] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [tasteProfile, setTasteProfile] = useState("");

  // Initialize: Get Letta-ranked restaurants and taste profile
  useEffect(() => {
    const initializeLetta = async () => {
      if (restaurants.length === 0) return;
      
      setIsInitializing(true);
      
      try {
        // Get AI-ranked restaurants based on user's history
        console.log('🤖 Initializing Letta for user:', userID);
        const ranked = await getRankedRestaurants(userID, restaurants);
        setRankedRestaurants(ranked);
        
        // Get user's taste profile for display
        console.log('🤖 Fetching taste profile...');
        const profile = await getUserTasteProfile(userID);
        console.log('🤖 Taste profile received:', profile);
        setTasteProfile(profile);
      } catch (error) {
        console.error('Error initializing Letta:', error);
        // Fallback to original order if Letta fails
        setRankedRestaurants(restaurants);
        setTasteProfile("New user - start swiping to build your profile!");
      } finally {
        setIsInitializing(false);
      }
    };

    initializeLetta();
  }, [userID, restaurants]);

  // Validate photos for current restaurant
  useEffect(() => {
    const validatePhotos = async () => {
      const currentRestaurant = rankedRestaurants[currentIndex];
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
                setTimeout(() => reject(), 2000);
              });
              validated.push(data.publicUrl);
            } catch {
              // Skip invalid images
            }
          }
        })
      );

      setValidPhotos(validated);
      setIsLoadingPhotos(false);
    };

    if (rankedRestaurants.length > 0) {
      validatePhotos();
    }
  }, [currentIndex, rankedRestaurants]);

  // Loading states
  if (!restaurants.length) return <p>Loading restaurants...</p>;
  if (isInitializing) return <p>AI is analyzing your preferences...</p>;
  if (isLoadingPhotos) return <p>Loading photos...</p>;
  if (currentIndex >= rankedRestaurants.length) return <p>No more restaurants! You've seen them all.</p>;

  const currentRestaurant = rankedRestaurants[currentIndex];
  if (!currentRestaurant) return <p>No restaurants available.</p>;

  const currentPhoto = validPhotos[photoIndex];

  async function handleSwipe(action) {
    const liked = action === 1;
    console.log('Swiping:', { userId: userID, restaurantId: currentRestaurant.business_id, action });
    
    try {
      // Save swipe to Supabase (always)
      const { error } = await supabase
        .from("swipes")
        .upsert(
          [{ 
            user_id: userID, 
            restaurant_id: currentRestaurant.business_id, 
            action: action 
          }],
          { onConflict: ["user_id", "restaurant_id"] }
        );

      if (error) {
        console.error("Error saving swipe:", error);
      } else {
        console.log("Swipe saved successfully");
      }

      // Only update Letta and re-rank every 3 swipes
      if ((currentIndex + 1) % 3 === 0) {
        setIsInitializing(true); // Show loading
        
        console.log('🔄 Every 3rd swipe - updating Letta and re-ranking...');
        
        // Update Letta AI's memory with this preference
        await updateUserPreferences(userID, currentRestaurant, liked);
        
        console.log('✅ Letta memory updated (every 3 swipes)');

        // Re-rank remaining restaurants with updated preferences
        if (currentIndex + 1 < rankedRestaurants.length) {
          console.log('🤖 Re-ranking remaining restaurants...');
          const remaining = rankedRestaurants.slice(currentIndex + 1);
          const reranked = await getRankedRestaurants(userID, remaining);
          
          console.log('✅ Re-ranking complete. Next restaurant:', reranked[0]?.name);
          
          setRankedRestaurants([
            ...rankedRestaurants.slice(0, currentIndex + 1),
            ...reranked
          ]);
        }

        // Update taste profile
        console.log('🤖 Refreshing taste profile...');
        const updatedProfile = await getUserTasteProfile(userID);
        console.log('🤖 Updated profile:', updatedProfile);
        setTasteProfile(updatedProfile);
        
        setIsInitializing(false);
      } else {
        console.log(`⏭️  Swipe ${currentIndex + 1} - skipping Letta update (updates on 3, 6, 9, etc.)`);
      }

      // Move to next restaurant
      setCurrentIndex(prev => prev + 1);
      
    } catch (error) {
      console.error('Error handling swipe:', error);
      setIsInitializing(false);
      // Still move to next restaurant even if update fails
      setCurrentIndex(prev => prev + 1);
    }
  }

  function nextPhoto() {
    setPhotoIndex(prev => (prev + 1) % validPhotos.length);
  }

  function prevPhoto() {
    setPhotoIndex(prev => (prev - 1 + validPhotos.length) % validPhotos.length);
  }

  // Parse categories
  const categories = Array.isArray(currentRestaurant.categories)
    ? currentRestaurant.categories
    : typeof currentRestaurant.categories === "string"
    ? currentRestaurant.categories.replace(/[\[\]"]+/g, "").split(",").map(s => s.trim())
    : [];

  const filteredCategories = categories.filter(
    cat => !["restaurant", "restaurants", "food", "entertainment"].includes(cat.toLowerCase())
  );

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative'
    }}>
      {/* AI Taste Profile - Positioned to the side */}
      {tasteProfile && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'white',
          borderRadius: '16px',
          padding: '20px',
          maxWidth: '300px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          zIndex: 10
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '24px' }}>🤖</span>
            <strong style={{ fontSize: '16px', color: '#333' }}>Your Taste Profile</strong>
          </div>
          <p style={{ 
            fontSize: '14px', 
            margin: 0,
            lineHeight: '1.6',
            color: '#555'
          }}>
            {tasteProfile}
          </p>
        </div>
      )}

      {/* Main Card Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        {/* Progress indicator */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '12px',
          padding: '12px 24px',
          fontSize: '14px',
          color: '#666',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          Restaurant {currentIndex + 1} of {rankedRestaurants.length} • AI Ranked
        </div>

        {/* Card with arrows */}
        <div style={{ 
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}>
          {/* Left Arrow - Dislike */}
          <button
            onClick={() => handleSwipe(0)}
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              border: '3px solid #ff4458',
              background: 'white',
              color: '#ff4458',
              fontSize: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(255,68,88,0.3)',
              transition: 'all 0.2s ease',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#ff4458';
              e.target.style.color = 'white';
              e.target.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'white';
              e.target.style.color = '#ff4458';
              e.target.style.transform = 'scale(1)';
            }}
          >
            ✕
          </button>

          {/* Restaurant Card */}
          <div style={{
            background: 'white',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            width: '400px'
          }}>
            {validPhotos.length > 0 ? (
              <div style={{ position: 'relative' }}>
                <img 
                  src={currentPhoto}
                  alt={`${currentRestaurant.name} - Photo ${photoIndex + 1}`}
                  style={{
                    width: "100%", 
                    height: "500px",
                    objectFit: "cover"
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
                        background: 'rgba(255,255,255,0.9)',
                        color: '#333',
                        border: 'none',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'white'}
                      onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.9)'}
                    >
                      ‹
                    </button>
                    
                    <button
                      onClick={nextPhoto}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(255,255,255,0.9)',
                        color: '#333',
                        border: 'none',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'white'}
                      onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.9)'}
                    >
                      ›
                    </button>

                    <div style={{
                      position: 'absolute',
                      bottom: '15px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      gap: '6px'
                    }}>
                      {validPhotos.map((_, idx) => (
                        <div
                          key={idx}
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: idx === photoIndex ? 'white' : 'rgba(255,255,255,0.5)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
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
                width: "100%", 
                height: "500px",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                color: '#999',
                fontSize: '16px'
              }}>
                No photos available
              </div>
            )}

            {/* Restaurant Info */}
            <div style={{ padding: '24px' }}>
              <h2 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '28px',
                color: '#333',
                fontWeight: '700'
              }}>
                {currentRestaurant.name}
              </h2>
              <p style={{ 
                margin: '0 0 8px 0',
                fontSize: '16px',
                color: '#666'
              }}>
                {currentRestaurant.stars} ⭐ • {filteredCategories.join(", ")}
              </p>
              <p style={{ 
                margin: 0,
                fontSize: '15px',
                color: '#888'
              }}>
                📍 {currentRestaurant.city}, {currentRestaurant.state}
              </p>
              {validPhotos.length > 1 && (
                <p style={{ 
                  fontSize: '13px', 
                  color: '#aaa',
                  margin: '12px 0 0 0' 
                }}>
                  Photo {photoIndex + 1} of {validPhotos.length}
                </p>
              )}
            </div>
          </div>

          {/* Right Arrow - Like */}
          <button
            onClick={() => handleSwipe(1)}
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              border: '3px solid #01df8a',
              background: 'white',
              color: '#01df8a',
              fontSize: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(1,223,138,0.3)',
              transition: 'all 0.2s ease',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#01df8a';
              e.target.style.color = 'white';
              e.target.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'white';
              e.target.style.color = '#01df8a';
              e.target.style.transform = 'scale(1)';
            }}
          >
            ♥
          </button>
        </div>
      </div>
    </div>
  );
}
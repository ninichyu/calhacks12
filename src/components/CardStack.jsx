import React, { useState, useEffect, useRef } from "react";
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
  const [swipeAnimation, setSwipeAnimation] = useState({ active: false, direction: null });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const isProcessingSwipe = useRef(false);

  // Initialize: Get Letta-ranked restaurants and taste profile
  useEffect(() => {
    const initializeLetta = async () => {
      if (restaurants.length === 0) return;
      
      setIsInitializing(true);
      
      try {
        console.log('🤖 Initializing Letta for user:', userID);
        const ranked = await getRankedRestaurants(userID, restaurants);
        setRankedRestaurants(ranked);
        
        console.log('🤖 Fetching taste profile...');
        const profile = await getUserTasteProfile(userID);
        console.log('🤖 Taste profile received:', profile);
        setTasteProfile(profile);
      } catch (error) {
        console.error('Error initializing Letta:', error);
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

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (isProcessingSwipe.current || swipeAnimation.active) return;
      
      if (e.key === 'ArrowLeft') {
        triggerSwipe(0); // Dislike
      } else if (e.key === 'ArrowRight') {
        triggerSwipe(1); // Like
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, rankedRestaurants]);

  // Main swipe trigger function
  async function triggerSwipe(action) {
    if (isProcessingSwipe.current || swipeAnimation.active) return;
    
    isProcessingSwipe.current = true;
    const direction = action === 1 ? 'right' : 'left';
    
    // Start animation
    setSwipeAnimation({ active: true, direction });
    
    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Process the swipe (this is the original handleSwipe logic)
    await handleSwipe(action);
    
    // Reset animation state
    setSwipeAnimation({ active: false, direction: null });
    setDragOffset({ x: 0, y: 0 });
    isProcessingSwipe.current = false;
  }

  // Mouse/touch drag handlers
  function handleDragStart(e) {
    if (isProcessingSwipe.current || swipeAnimation.active) return;
    
    setIsDragging(true);
    const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
    const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
    setStartPos({ x: clientX, y: clientY });
  }

  function handleDragMove(e) {
    if (!isDragging || isProcessingSwipe.current) return;
    
    e.preventDefault();
    const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
    const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
    
    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;
    
    setDragOffset({ x: deltaX, y: deltaY });
  }

  function handleDragEnd() {
    if (!isDragging || isProcessingSwipe.current) return;
    setIsDragging(false);
    
    // If dragged more than 100px, trigger swipe
    if (Math.abs(dragOffset.x) > 100) {
      const action = dragOffset.x > 0 ? 1 : 0; // 1 for like, 0 for dislike
      triggerSwipe(action);
    } else {
      // Snap back with animation
      setDragOffset({ x: 0, y: 0 });
    }
  }

  // Original handleSwipe function with all backend logic
  async function handleSwipe(action) {
    const currentRestaurant = rankedRestaurants[currentIndex]; // ✅ add this line
    if (!currentRestaurant) return;
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
        console.log(`⏭️ Swipe ${currentIndex + 1} - skipping Letta update (updates on 3, 6, 9, etc.)`);
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

  function nextPhoto(e) {
    e?.stopPropagation();
    setPhotoIndex(prev => (prev + 1) % validPhotos.length);
  }

  function prevPhoto(e) {
    e?.stopPropagation();
    setPhotoIndex(prev => (prev - 1 + validPhotos.length) % validPhotos.length);
  }

  // Loading states
  if (!restaurants.length) return <p>Loading restaurants...</p>;
  if (isInitializing) return <p>LettaAI is analyzing your preferences...</p>;
  if (isLoadingPhotos) return <p>Loading photos...</p>;
  if (currentIndex >= rankedRestaurants.length) return <p>No more restaurants! You've seen them all.</p>;

  const currentRestaurant = rankedRestaurants[currentIndex];
  if (!currentRestaurant) return <p>No restaurants available.</p>;

  const currentPhoto = validPhotos[photoIndex];

  // Parse categories
  const categories = Array.isArray(currentRestaurant.categories)
    ? currentRestaurant.categories
    : typeof currentRestaurant.categories === "string"
    ? currentRestaurant.categories.replace(/[\[\]"]+/g, "").split(",").map(s => s.trim())
    : [];

  const filteredCategories = categories.filter(
    cat => !["restaurant", "restaurants", "food", "entertainment"].includes(cat.toLowerCase())
  );

  // Calculate card transform
  const getCardTransform = () => {
    if (swipeAnimation.active) {
      const direction = swipeAnimation.direction;
      const translateX = direction === 'right' ? '150%' : '-150%';
      const rotate = direction === 'right' ? '25deg' : '-25deg';
      return `translateX(${translateX}) translateY(-50px) rotate(${rotate})`;
    }
    
    if (isDragging || dragOffset.x !== 0) {
      const rotate = dragOffset.x * 0.1;
      return `translateX(${dragOffset.x}px) translateY(${dragOffset.y * 0.5}px) rotate(${rotate}deg)`;
    }
    
    return 'translate(0, 0) rotate(0deg)';
  };

  const getCardOpacity = () => {
    if (swipeAnimation.active) return 0;
    if (isDragging) {
      return Math.max(0.5, 1 - Math.abs(dragOffset.x) / 300);
    }
    return 1;
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
      padding: '20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative'
    }}>
      {/* AI Taste Profile */}
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
            onClick={() => triggerSwipe(0)}
            disabled={isProcessingSwipe.current || swipeAnimation.active}
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              border: '3px solid #ff4458',
              background: 'white',
              color: '#ff4458',
              fontSize: '32px',
              cursor: (isProcessingSwipe.current || swipeAnimation.active) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(255,68,88,0.3)',
              transition: 'all 0.2s ease',
              fontWeight: 'bold',
              opacity: (isProcessingSwipe.current || swipeAnimation.active) ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isProcessingSwipe.current && !swipeAnimation.active) {
                e.target.style.background = '#ff4458';
                e.target.style.color = 'white';
                e.target.style.transform = 'scale(1.1)';
              }
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
          <div 
            style={{
              background: 'white',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              width: '400px',
              cursor: isDragging ? 'grabbing' : 'grab',
              transform: getCardTransform(),
              transition: swipeAnimation.active ? 'transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.5s ease' :
                         (isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease'),
              opacity: getCardOpacity(),
              userSelect: 'none',
              position: 'relative',
              touchAction: 'none'
            }}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            {/* Swipe indicators during drag */}
            {(dragOffset.x > 50 || (swipeAnimation.active && swipeAnimation.direction === 'right')) && (
              <div style={{
                position: 'absolute',
                top: '50px',
                right: '30px',
                fontSize: '80px',
                fontWeight: 'bold',
                color: '#01df8a',
                transform: 'rotate(20deg)',
                zIndex: 10,
                textShadow: '0 0 20px rgba(1,223,138,0.8)',
                pointerEvents: 'none',
                border: '6px solid #01df8a',
                padding: '10px 30px',
                borderRadius: '12px',
                opacity: swipeAnimation.active ? 1 : Math.min(1, Math.abs(dragOffset.x) / 100)
              }}>
                LIKE
              </div>
            )}
            {(dragOffset.x < -50 || (swipeAnimation.active && swipeAnimation.direction === 'left')) && (
              <div style={{
                position: 'absolute',
                top: '50px',
                left: '30px',
                fontSize: '80px',
                fontWeight: 'bold',
                color: '#ff4458',
                transform: 'rotate(-20deg)',
                zIndex: 10,
                textShadow: '0 0 20px rgba(255,68,88,0.8)',
                pointerEvents: 'none',
                border: '6px solid #ff4458',
                padding: '10px 30px',
                borderRadius: '12px',
                opacity: swipeAnimation.active ? 1 : Math.min(1, Math.abs(dragOffset.x) / 100)
              }}>
                NOPE
              </div>
            )}

            {validPhotos.length > 0 ? (
              <div style={{ position: 'relative' }}>
                <img 
                  src={currentPhoto}
                  alt={`${currentRestaurant.name} - Photo ${photoIndex + 1}`}
                  style={{
                    width: "100%", 
                    height: "500px",
                    objectFit: "cover",
                    pointerEvents: 'none'
                  }}
                  draggable="false"
                />
                
                {validPhotos.length > 1 && (
                  <>
                    <button
                      onClick={prevPhoto}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
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
                        transition: 'all 0.2s',
                        zIndex: 5
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'white'}
                      onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.9)'}
                    >
                      ‹
                    </button>
                    
                    <button
                      onClick={nextPhoto}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
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
                        alignments: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s',
                        zIndex: 5
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
                      gap: '6px',
                      zIndex: 5
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoIndex(idx);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
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
            <div style={{ padding: '24px', pointerEvents: 'none' }}>
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
            onClick={() => triggerSwipe(1)}
            disabled={isProcessingSwipe.current || swipeAnimation.active}
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              border: '3px solid #01df8a',
              background: 'white',
              color: '#01df8a',
              fontSize: '32px',
              cursor: (isProcessingSwipe.current || swipeAnimation.active) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(1,223,138,0.3)',
              transition: 'all 0.2s ease',
              fontWeight: 'bold',
              opacity: (isProcessingSwipe.current || swipeAnimation.active) ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isProcessingSwipe.current && !swipeAnimation.active) {
                e.target.style.background = '#01df8a';
                e.target.style.color = 'white';
                e.target.style.transform = 'scale(1.1)';
              }
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

        {/* Keyboard hint */}
        <div style={{
          background: 'rgba(255,255,255,0.85)',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '12px',
          color: '#666',
          fontWeight: '400'
        }}>
          💡 Swipe, click arrows, or use keyboard: ← Nope • → Yes
        </div>
      </div>
    </div>
  );
}
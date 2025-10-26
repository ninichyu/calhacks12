import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import CardStack from "./components/CardStack";
import LikedRestaurants from "./components/LikedRestaurants";
import RestaurantMapView from "./components/RestaurantMapView";
import { supabase } from "./services/supabase";

function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("swipe"); // "swipe", "liked", or "map"

  useEffect(() => {
    const fetchRestaurants = async () => {
      // Fetch all restaurants with photo_ids
      const { data, error } = await supabase
        .from("restaurant")
        .select("*")
        .not("photo_ids", "is", null)
        .neq("photo_ids", "");

      if (error) {
        console.error("Error fetching restaurants:", error);
        setLoading(false);
        return;
      }

      console.log(`Loaded ${data.length} total restaurants`);

      // Get all restaurants this user has already swiped on (seen)
      const { data: seenSwipes } = await supabase
        .from("swipes")
        .select("restaurant_id")
        .eq("user_id", userId);

      const seenRestaurantIds = new Set(
        seenSwipes ? seenSwipes.map(s => s.restaurant_id) : []
      );

      console.log(`User has already seen ${seenRestaurantIds.size} restaurants`);

      // Filter out restaurants the user has already seen
      const unseenRestaurants = data.filter(
        r => !seenRestaurantIds.has(r.business_id)
      );

      console.log(`Showing ${unseenRestaurants.length} new restaurants`);

      setRestaurants(unseenRestaurants);
      setLoading(false);
    };

    if (userId) {
      fetchRestaurants();
    }
  }, [userId]);

  if (!userId) return <Login onLogin={setUserId} />;
  
  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
      padding: "0",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(90deg, #FF6B6B 0%, #C44569 50%, #8B5CF6 100%)",
        padding: "20px 40px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        position: "sticky",
        top: 0,
        zIndex: 1000
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px"
        }}>
          {/* Logo */}
          <h1 style={{ 
            margin: 0,
            fontSize: "32px",
            fontWeight: "800",
            color: "white",
            textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
            letterSpacing: "1px"
          }}>
            🍴 Munch Match
          </h1>
          
          {/* Navigation */}
          <div style={{ 
            display: "flex", 
            gap: "12px",
            backgroundColor: "rgba(255,255,255,0.15)",
            padding: "6px",
            borderRadius: "50px",
            backdropFilter: "blur(10px)"
          }}>
            <button
              onClick={() => setCurrentPage("swipe")}
              style={{
                padding: "12px 28px",
                backgroundColor: currentPage === "swipe" 
                  ? "rgba(255,255,255,0.95)" 
                  : "transparent",
                color: currentPage === "swipe" ? "#C44569" : "white",
                border: "none",
                borderRadius: "50px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                transition: "all 0.3s ease",
                boxShadow: currentPage === "swipe" 
                  ? "0 4px 15px rgba(0,0,0,0.2)" 
                  : "none"
              }}
            >
              🔥 Swipe
            </button>
            <button
              onClick={() => setCurrentPage("liked")}
              style={{
                padding: "12px 28px",
                backgroundColor: currentPage === "liked" 
                  ? "rgba(255,255,255,0.95)" 
                  : "transparent",
                color: currentPage === "liked" ? "#C44569" : "white",
                border: "none",
                borderRadius: "50px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                transition: "all 0.3s ease",
                boxShadow: currentPage === "liked" 
                  ? "0 4px 15px rgba(0,0,0,0.2)" 
                  : "none"
              }}
            >
              💚 Liked
            </button>
            <button
              onClick={() => setCurrentPage("map")}
              style={{
                padding: "12px 28px",
                backgroundColor: currentPage === "map" 
                  ? "rgba(255,255,255,0.95)" 
                  : "transparent",
                color: currentPage === "map" ? "#C44569" : "white",
                border: "none",
                borderRadius: "50px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                transition: "all 0.3s ease",
                boxShadow: currentPage === "map" 
                  ? "0 4px 15px rgba(0,0,0,0.2)" 
                  : "none"
              }}
            >
              🗺️ Map
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: currentPage === "map" ? "100%" : "1200px",
        margin: "0 auto",
        padding: currentPage === "map" ? "0" : "30px 20px"
      }}>
        {currentPage === "swipe" && (
          <div style={{
            backgroundColor: "rgba(255,255,255,0.95)",
            borderRadius: "20px",
            padding: "40px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            backdropFilter: "blur(10px)"
          }}>
            {loading && (
              <div style={{ textAlign: "center", padding: "60px" }}>
                <div style={{
                  fontSize: "48px",
                  marginBottom: "20px"
                }}>🍽️</div>
                <p style={{ 
                  fontSize: "18px", 
                  color: "#666",
                  fontWeight: "500"
                }}>
                  Loading delicious restaurants...
                </p>
              </div>
            )}
            {!loading && (!restaurants || restaurants.length === 0) && (
              <div style={{ textAlign: "center", padding: "60px" }}>
                <div style={{
                  fontSize: "64px",
                  marginBottom: "20px"
                }}>😋</div>
                <h2 style={{ 
                  color: "#333",
                  marginBottom: "10px",
                  fontSize: "28px"
                }}>
                  All Done!
                </h2>
                <p style={{ color: "#666", fontSize: "16px" }}>
                  You've seen all available restaurants. Check back later for more!
                </p>
              </div>
            )}
            {!loading && restaurants && restaurants.length > 0 && (
              <CardStack userID={userId} restaurants={restaurants} />
            )}
          </div>
        )}
        
        {currentPage === "liked" && (
          <div style={{
            backgroundColor: "rgba(255,255,255,0.95)",
            borderRadius: "20px",
            padding: "40px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            backdropFilter: "blur(10px)"
          }}>
            <LikedRestaurants userID={userId} />
          </div>
        )}
        
        {currentPage === "map" && <RestaurantMapView userID={userId} />}
      </div>

      {/* Decorative Elements */}
      <div style={{
        position: "fixed",
        top: "20%",
        left: "-100px",
        width: "300px",
        height: "300px",
        background: "radial-gradient(circle, rgba(255,107,107,0.3) 0%, transparent 70%)",
        borderRadius: "50%",
        filter: "blur(60px)",
        zIndex: -1,
        pointerEvents: "none"
      }} />
      <div style={{
        position: "fixed",
        bottom: "10%",
        right: "-100px",
        width: "400px",
        height: "400px",
        background: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)",
        borderRadius: "50%",
        filter: "blur(60px)",
        zIndex: -1,
        pointerEvents: "none"
      }} />
    </div>
  );
}

export default App;
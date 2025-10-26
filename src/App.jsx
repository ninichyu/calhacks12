import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import CardStack from "./components/CardStack";
import LikedRestaurants from "./components/LikedRestaurants";
import { supabase } from "./services/supabase";

function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("swipe");

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
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>🍴 Munch Match</h1>
      
      {/* Navigation */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", justifyContent: "center" }}>
        <button
          onClick={() => setCurrentPage("swipe")}
          style={{
            padding: "10px 20px",
            backgroundColor: currentPage === "swipe" ? "#4CAF50" : "#ddd",
            color: currentPage === "swipe" ? "white" : "#333",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px"
          }}
        >
          Swipe
        </button>
        <button
          onClick={() => setCurrentPage("liked")}
          style={{
            padding: "10px 20px",
            backgroundColor: currentPage === "liked" ? "#4CAF50" : "#ddd",
            color: currentPage === "liked" ? "white" : "#333",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px"
          }}
        >
          Liked (💚)
        </button>
      </div>

      {/* Content */}
      {currentPage === "swipe" ? (
        <>
          {loading && <p>Loading restaurants...</p>}
          {!loading && (!restaurants || restaurants.length === 0) && <p>No restaurants found!</p>}
          {!loading && restaurants && restaurants.length > 0 && (
            <CardStack userID={userId} restaurants={restaurants} />
          )}
        </>
      ) : (
        <LikedRestaurants userID={userId} />
      )}
    </div>
  );
}

export default App;
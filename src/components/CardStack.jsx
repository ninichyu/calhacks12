import React, { useState } from "react";
import { supabase } from "../services/supabase";
import SwipeCard from "./SwipeCard"; // optional, or just render a div for demo

export default function CardStack({ userID, restaurants }) {
  const [index, setIndex] = useState(0); // track current card

  if (!restaurants.length) return <p>Loading...</p>;
  if (index >= restaurants.length) return <p>No more restaurants!</p>;

  const current = restaurants[index];

  async function saveUserSwipe(userId, restaurantId, action) {
  const { error } = await supabase
  .from("swipes")
  .upsert(
    [{ user_id: userId, restaurant_id: restaurantId, action: action }],
    { onConflict: ["user_id", "restaurant_id"] }
  );
  if (error) console.error("Error saving swipe:", error);

  setIndex(index + 1);
}

  return (
    <div className="card-stack">
      <div className="card">
        <img src={current.image_url}
            alt={current.name} 
            style={{
                width: "350px", 
                height: "500px",
                objectFit: "cover",
                borderRadius: "8px" 
            }}/>
        <h3>{current.name}</h3>
        <p>{current.rating} ⭐ • {current.categories.join(", ")}</p>
        <p>{current.location}</p>
      </div>

      <div className="buttons">
        <button onClick={() => saveUserSwipe(userID, current.id, 0)}>❌ Nope</button>
        <button onClick={() => saveUserSwipe(userID, current.id, 1)}>💚 Like</button>
      </div>
    </div>
  );
}

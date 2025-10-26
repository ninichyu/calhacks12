import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import SwipeCard from "./SwipeCard"; // optional, or just render a div for demo

export default function CardStack({ userID, restaurants }) {
  const [index, setIndex] = useState(0); // track current card

  if (!restaurants.length) return <p>Loading...</p>;
  if (index >= restaurants.length) return <p>No more restaurants!</p>;

  const current = restaurants[index];
  console.log("userID:", userID, "restaurantID:", current.id);

function saveUserSwipe(userId, restaurantId, action) {
  // Move to next card immediately
  setIndex(prev => prev + 1);

  // Save swipe asynchronously
  supabase
    .from("swipes")
    .upsert(
      [{ user_id: userId, restaurant_id: restaurantId, action }],
      { onConflict: ["user_id", "restaurant_id"] }
    )
    .then((result) => {
      const { data, error } = result;
      if (error) console.error("Error saving swipe:", error);
      else console.log("Swipe saved:", data);
    });
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

const [imageUrls, setImageUrls] = useState({}); 

  useEffect(() => {
    const fetchImages = async () => {
      const urls = {};

      for (const r of restaurants) {
        if (!r.photo_ids) continue; 

        const { data } = supabase.storage
          .from("photos")
          .getPublicUrl(r.photo_ids.split(',')[0]+'.jpg');

        urls[r.business_id] = data.publicUrl;
      }

      setImageUrls(urls);
    };

    if (restaurants.length > 0) {
      fetchImages();
    }
  }, [restaurants]);
  console.log(restaurants[0])

  return (
    <div className="card-stack">
      <div className="card">
        <img src={imageUrls[current.business_id]}
            alt={current.name} 
            style={{
                width: "350px", 
                height: "500px",
                objectFit: "cover",
                borderRadius: "8px" 
            }}/>
        <h3>{current.name}</h3>
        <p>{current.stars} ⭐ • {filteredCategories.join(", ")}</p>
        <p>{current.city}, {current.state}</p>        
      </div>

      <div className="buttons">
        <button onClick={() => saveUserSwipe(userID, current.id, 0)}>❌ Nope</button>
        <button onClick={() => saveUserSwipe(userID, current.id, 1)}>💚 Like</button>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import SwipeCard from "./SwipeCard"; // optional, or just render a div for demo

export default function CardStack({ restaurants }) {
  const [index, setIndex] = useState(0); // track current card

  if (!restaurants.length) return <p>Loading...</p>;
  if (index >= restaurants.length) return <p>No more restaurants!</p>;

  const current = restaurants[index];

  // handle swipe
  const handleSwipe = (action) => {
    console.log(`User swiped ${action} on ${current.name}`);
    setIndex(index + 1); // move to next card
  };

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
        <button onClick={() => handleSwipe("nope")}>❌ Nope</button>
        <button onClick={() => handleSwipe("like")}>💚 Like</button>
      </div>
    </div>
  );
}

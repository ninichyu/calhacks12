import React from "react";
import SwipeCard from "./SwipeCard";

export default function CardStack({ restaurants, onSwipe }) {
  if (!restaurants.length) return <p>Loading...</p>;

  const current = restaurants[0];

  return (
    <div className="card-stack">
      <SwipeCard restaurant={current} />
      <div className="buttons">
        <button onClick={() => onSwipe("nope")}>❌ Nope</button>
        <button onClick={() => onSwipe("like")}>💚 Like</button>
      </div>
    </div>
  );
}

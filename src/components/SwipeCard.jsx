import React from "react";

export default function SwipeCard({ restaurant }) {
  return (
    <div className="swipe-card">
      <img src={restaurant.image_url} alt={restaurant.name} />
      <div className="card-info">
        <h2>{restaurant.name}</h2>
        <p>{restaurant.rating} ⭐ • {restaurant.price || "$$"} • {restaurant.location.city}</p>
      </div>
    </div>
  );
}

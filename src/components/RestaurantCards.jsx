import React from "react";

export default function RestaurantCards({ restaurants }) {
  return (
    <div className="card-container">
      {restaurants.map((r) => (
        <div key={r.id} className="card">
          <img src={r.image_url} alt={r.name} />
          <h3>{r.name}</h3>
          <p>{r.rating} ⭐ • {r.categories.join(", ")}</p>
          <p>{r.location}</p>
        </div>
      ))}
    </div>
  );
}

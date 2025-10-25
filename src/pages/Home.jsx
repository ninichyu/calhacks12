import React, { useEffect, useState } from "react";
import { fetchRestaurants } from "../services/yelpService";
import CardStack from "../components/CardStack";
import MapView from "../components/MapView";

export default function Home() {
  const [restaurants, setRestaurants] = useState([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    fetchRestaurants("San Francisco").then(setRestaurants);
  }, []);

  const currentRestaurant = restaurants[current];

  return (
    <div className="home">
      <h1>🍴 Restaurant Tinder</h1>
      <CardStack restaurants={restaurants} onSwipe={() => setCurrent(i => i + 1)} />
      {currentRestaurant && (
        <MapView
          lat={currentRestaurant.coordinates.latitude}
          lon={currentRestaurant.coordinates.longitude}
        />
      )}
    </div>
  );
}

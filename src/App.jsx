import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import data from "./data/restaurants.json";
import CardStack from "./components/CardStack";

function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    setTimeout(() => setRestaurants(data), 500);
  }, []);

  if (!userId) return <Login onLogin={setUserId} />;




  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>🍴 Munch Match</h1>
      <CardStack userID={userId} restaurants={restaurants} />
    </div>
  );
}

export default App;

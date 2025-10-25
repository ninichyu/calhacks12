import React, { useState, useEffect } from "react";
import Login from "./components/Login";
//import data from "./data/restaurants.json";
import CardStack from "./components/CardStack";
import { supabase } from "./services/supabase";


function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    //setTimeout(() => setRestaurants(data), 500);
    const fetchRestaurants = async () => {
        const { data, error } = await supabase
        .from("restaurant")
        .select("*");

        if (error) {
        console.error("Error fetching restaurants:", error);
      } else {
        setRestaurants(data);
      }
      setLoading(false);
    }

    

    fetchRestaurants()
  }, []);

  if (!userId) return <Login onLogin={setUserId} />;
  if (loading) return <p>Loading restaurants...</p>;




  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>🍴 Munch Match</h1>
      <CardStack userID={userId} restaurants={restaurants} />
    </div>
  );
}

export default App;

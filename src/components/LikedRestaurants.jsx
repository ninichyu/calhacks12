import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

// Category mapping with keyword variations
const CATEGORY_MAPPINGS = {
  bakery: ["bakery", "bakeries", "bakeshop", "patisserie", "pastry", "bread", "boulangerie"],
  cafe: ["cafe", "cafes", "coffee", "coffeehouse", "tea house", "tea room", "espresso"],
  restaurant: ["restaurant", "restaurants", "dining", "eatery", "eateries", "bistro", "brasserie"],
  bar: ["bar", "bars", "pub", "pubs", "tavern", "lounge", "brewery", "brewpub", "wine bar", "cocktail"],
  pizza: ["pizza", "pizzeria", "pizzerias", "pie", "neapolitan"],
  mexican: ["mexican", "tex-mex", "taqueria", "tacos", "burrito", "latin american"],
  italian: ["italian", "trattoria", "osteria", "pasta", "mediterranean"],
  chinese: ["chinese", "dim sum", "cantonese", "szechuan", "sichuan", "mandarin"],
  japanese: ["japanese", "sushi", "ramen", "izakaya", "hibachi", "tempura", "udon"],
  american: ["american", "burgers", "burger", "bbq", "barbecue", "steakhouse", "diner"],
  asian: ["asian", "pan-asian", "asian fusion"],
  indian: ["indian", "curry", "tandoori", "biryani"],
  thai: ["thai", "pad thai"],
  vietnamese: ["vietnamese", "pho", "banh mi"],
  korean: ["korean", "bbq", "kbbq"],
  mediterranean: ["mediterranean", "greek", "middle eastern", "falafel", "kebab"],
  seafood: ["seafood", "fish", "oyster", "sushi"],
  fastfood: ["fast food", "quick serve", "sandwich", "sandwiches", "deli"],
  dessert: ["dessert", "ice cream", "gelato", "frozen yogurt", "sweets", "candy"]
};

// Function to match a restaurant to categories
function getCategoriesForRestaurant(restaurantCategories) {
  const categories = Array.isArray(restaurantCategories)
    ? restaurantCategories
    : typeof restaurantCategories === "string"
    ? restaurantCategories.replace(/[\[\]"]+/g, "").split(",").map(s => s.trim().toLowerCase())
    : [];

  const matched = new Set();

  categories.forEach(cat => {
    Object.entries(CATEGORY_MAPPINGS).forEach(([key, keywords]) => {
      if (keywords.some(keyword => cat.includes(keyword) || keyword.includes(cat))) {
        matched.add(key);
      }
    });
  });

  return Array.from(matched);
}

export default function LikedRestaurants({ userID }) {
  const [likedRestaurants, setLikedRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("recent");
  const [filterCategory, setFilterCategory] = useState("all");
  const [availableCategories, setAvailableCategories] = useState([]);

  useEffect(() => {
    const fetchLikedRestaurants = async () => {
      setLoading(true);

      console.log('Fetching liked restaurants for user:', userID);

      const { data: swipes, error } = await supabase
        .from("swipes")
        .select("restaurant_id")
        .eq("user_id", userID)
        .eq("action", 1);

      console.log('Swipes data:', swipes);

      if (error) {
        console.error("Error fetching liked restaurants:", error);
        setLoading(false);
        return;
      }

      if (!swipes || swipes.length === 0) {
        console.log('No liked restaurants found');
        setLikedRestaurants([]);
        setFilteredRestaurants([]);
        setLoading(false);
        return;
      }

      const restaurantIds = swipes.map(s => s.restaurant_id);
      
      console.log('Fetching details for restaurant IDs:', restaurantIds);

      const { data: restaurants, error: restaurantError } = await supabase
        .from("restaurant")
        .select("*")
        .in("business_id", restaurantIds);

      console.log('Restaurants fetched:', restaurants);

      if (restaurantError) {
        console.error("Error fetching restaurant details:", restaurantError);
        setLoading(false);
        return;
      }

      const restaurantsWithPhotos = await Promise.all(
        restaurants.map(async (restaurant) => {
          let photoUrl = null;
          
          if (restaurant.photo_ids) {
            const photoIds = restaurant.photo_ids.split(',');
            
            for (const photoId of photoIds) {
              const { data } = supabase.storage
                .from("photos")
                .getPublicUrl(photoId.trim() + '.jpg');
              
              if (data && data.publicUrl) {
                try {
                  await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = data.publicUrl;
                    setTimeout(reject, 2000);
                  });
                  
                  photoUrl = data.publicUrl;
                  break;
                } catch {
                  console.log(`Image failed for ${restaurant.name}, trying next...`);
                }
              }
            }
          }

          // Add matched categories
          const matchedCategories = getCategoriesForRestaurant(restaurant.categories);
          return { ...restaurant, photoUrl, matchedCategories };
        })
      );

      // Get unique categories from all restaurants
      const allCategories = new Set();
      restaurantsWithPhotos.forEach(r => {
        r.matchedCategories.forEach(cat => allCategories.add(cat));
      });
      setAvailableCategories(Array.from(allCategories).sort());

      const reversed = [...restaurantsWithPhotos].reverse();
      setLikedRestaurants(reversed);
      setFilteredRestaurants(reversed);
      setLoading(false);
    };

    if (userID) {
      fetchLikedRestaurants();
    }
  }, [userID]);

  useEffect(() => {
    let result = [...likedRestaurants];

    // Filter by category
    if (filterCategory !== "all") {
      result = result.filter(r => r.matchedCategories.includes(filterCategory));
    }

    // Sort
    if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "rating") {
      result.sort((a, b) => b.stars - a.stars);
    }

    setFilteredRestaurants(result);
  }, [sortBy, filterCategory, likedRestaurants]);

  const removeRestaurant = async (businessId) => {
    const { error } = await supabase
      .from("swipes")
      .delete()
      .eq("user_id", userID)
      .eq("restaurant_id", businessId);

    if (error) {
      console.error("Error removing restaurant:", error);
      return;
    }

    setLikedRestaurants(prev => prev.filter(r => r.business_id !== businessId));
  };

  if (loading) return <p>Loading your liked restaurants...</p>;

  if (likedRestaurants.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <h2>No Liked Restaurants Yet</h2>
        <p>Start swiping to build your list!</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h2>💚 Your Liked Restaurants ({filteredRestaurants.length})</h2>
      
      <div style={{ 
        display: "flex", 
        gap: "15px", 
        marginTop: "20px", 
        marginBottom: "20px",
        flexWrap: "wrap"
      }}>
        <div>
          <label style={{ marginRight: "8px", fontWeight: "bold" }}>Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              cursor: "pointer"
            }}
          >
            <option value="recent">Recently Added</option>
            <option value="name">Name (A-Z)</option>
            <option value="rating">Rating (High to Low)</option>
          </select>
        </div>

        <div>
          <label style={{ marginRight: "8px", fontWeight: "bold" }}>Filter:</label>
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              cursor: "pointer"
            }}
          >
            <option value="all">All Categories ({likedRestaurants.length})</option>
            {availableCategories.map(cat => {
              const count = likedRestaurants.filter(r => 
                r.matchedCategories.includes(cat)
              ).length;
              return (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {filteredRestaurants.length === 0 ? (
        <p style={{ textAlign: "center", color: "#666" }}>
          No restaurants match your filter.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {filteredRestaurants.map((restaurant) => {
            const categories = Array.isArray(restaurant.categories)
              ? restaurant.categories
              : typeof restaurant.categories === "string"
              ? restaurant.categories.replace(/[\[\]"]+/g, "").split(",").map(s => s.trim())
              : [];

            const filteredCategories = categories.filter(
              cat => !["restaurant", "restaurants", "food", "entertainment"].includes(cat.toLowerCase())
            );

            return (
              <div
                key={restaurant.business_id}
                style={{
                  display: "flex",
                  gap: "15px",
                  padding: "15px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  backgroundColor: "#fff",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}
              >
                {restaurant.photoUrl ? (
                  <img
                    src={restaurant.photoUrl}
                    alt={restaurant.name}
                    style={{
                      width: "120px",
                      height: "120px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "120px",
                      height: "120px",
                      backgroundColor: "#f0f0f0",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#999",
                      flexShrink: 0
                    }}
                  >
                    No Photo
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 5px 0" }}>{restaurant.name}</h3>
                  <p style={{ margin: "5px 0", color: "#666" }}>
                    {restaurant.stars} ⭐ • {filteredCategories.join(", ")}
                  </p>
                  {restaurant.matchedCategories.length > 0 && (
                    <p style={{ margin: "5px 0", fontSize: "13px", color: "#999" }}>
                      Categories: {restaurant.matchedCategories.map(c => 
                        c.charAt(0).toUpperCase() + c.slice(1)
                      ).join(", ")}
                    </p>
                  )}
                  <p style={{ margin: "5px 0", color: "#666" }}>
                    {restaurant.city}, {restaurant.state}
                  </p>
                  {restaurant.address && (
                    <p style={{ margin: "5px 0", fontSize: "14px", color: "#999" }}>
                      {restaurant.address}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => removeRestaurant(restaurant.business_id)}
                  style={{
                    alignSelf: "flex-start",
                    padding: "8px 12px",
                    backgroundColor: "#ff4444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
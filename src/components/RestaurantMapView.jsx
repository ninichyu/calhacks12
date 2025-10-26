import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../services/supabase";

// Category mapping for filtering
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

export default function RestaurantMapView({ userID }) {
  const [likedRestaurants, setLikedRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    const fetchLikedRestaurants = async () => {
      setLoading(true);

      const { data: swipes, error } = await supabase
        .from("swipes")
        .select("restaurant_id")
        .eq("user_id", userID)
        .eq("action", 1);

      if (error || !swipes || swipes.length === 0) {
        setLoading(false);
        return;
      }

      const restaurantIds = swipes.map(s => s.restaurant_id);

      const { data: restaurants, error: restaurantError } = await supabase
        .from("restaurant")
        .select("*")
        .in("business_id", restaurantIds);

      if (restaurantError || !restaurants) {
        setLoading(false);
        return;
      }

      // Filter restaurants with valid coordinates
      const restaurantsWithData = restaurants
        .filter(r => r.latitude && r.longitude)
        .map(restaurant => {
          const matchedCategories = getCategoriesForRestaurant(restaurant.categories);
          return { ...restaurant, matchedCategories };
        });

      // Get unique categories
      const allCategories = new Set();
      restaurantsWithData.forEach(r => {
        r.matchedCategories.forEach(cat => allCategories.add(cat));
      });
      setAvailableCategories(Array.from(allCategories).sort());

      setLikedRestaurants(restaurantsWithData);
      setFilteredRestaurants(restaurantsWithData);
      setLoading(false);
    };

    if (userID) {
      fetchLikedRestaurants();
    }
  }, [userID]);

  // Filter restaurants by category
  useEffect(() => {
    if (filterCategory === "all") {
      setFilteredRestaurants(likedRestaurants);
    } else {
      setFilteredRestaurants(
        likedRestaurants.filter(r => r.matchedCategories.includes(filterCategory))
      );
    }
  }, [filterCategory, likedRestaurants]);

  // Initialize Google Map
  useEffect(() => {
    if (!loading && filteredRestaurants.length > 0 && !googleMapRef.current) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyCALOLVL1OTliTeE8Ns1Vh3bwtjLguRong`;
      script.async = true;
      script.onload = initializeMap;
      document.head.appendChild(script);
    }
  }, [loading, filteredRestaurants]);

  const initializeMap = () => {
    if (!mapRef.current || filteredRestaurants.length === 0) return;

    // Calculate center point
    const avgLat = filteredRestaurants.reduce((sum, r) => sum + r.latitude, 0) / filteredRestaurants.length;
    const avgLng = filteredRestaurants.reduce((sum, r) => sum + r.longitude, 0) / filteredRestaurants.length;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: avgLat, lng: avgLng },
      zoom: 12,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }]
        }
      ]
    });

    googleMapRef.current = map;
    updateMarkers();
  };

  const updateMarkers = () => {
    if (!googleMapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add markers for filtered restaurants
    filteredRestaurants.forEach(restaurant => {
      const marker = new window.google.maps.Marker({
        position: { lat: restaurant.latitude, lng: restaurant.longitude },
        map: googleMapRef.current,
        title: restaurant.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#FF385C",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2
        }
      });

      marker.addListener('click', () => {
        setSelectedRestaurant(restaurant);
        googleMapRef.current.panTo({ lat: restaurant.latitude, lng: restaurant.longitude });
      });

      markersRef.current.push(marker);
    });

    // Adjust bounds to fit all markers
    if (filteredRestaurants.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      filteredRestaurants.forEach(r => {
        bounds.extend({ lat: r.latitude, lng: r.longitude });
      });
      googleMapRef.current.fitBounds(bounds);
    }
  };

  // Update markers when filtered restaurants change
  useEffect(() => {
    if (googleMapRef.current) {
      updateMarkers();
    }
  }, [filteredRestaurants]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading your liked restaurants...</p>
      </div>
    );
  }

  if (likedRestaurants.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <h2>No Liked Restaurants Yet</h2>
        <p>Start swiping to build your map!</p>
      </div>
    );
  }

  const categories = Array.isArray(selectedRestaurant?.categories)
    ? selectedRestaurant.categories
    : typeof selectedRestaurant?.categories === "string"
    ? selectedRestaurant.categories.replace(/[\[\]"]+/g, "").split(",").map(s => s.trim())
    : [];

  const filteredCategories = categories.filter(
    cat => !["restaurant", "restaurants", "food", "entertainment"].includes(cat.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Header with filter */}
      <div style={{
        padding: "15px 20px",
        backgroundColor: "#fff",
        borderBottom: "1px solid #ddd",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "15px",
        flexWrap: "wrap"
      }}>
        <h2 style={{ margin: 0 }}>🗺️ Your Restaurant Map ({filteredRestaurants.length})</h2>
        
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

      {/* Map and Details Container */}
      <div style={{ height: "calc(100vh - 220px)", display: "flex", position: "relative" }}>
        {/* Map */}
        <div 
          ref={mapRef} 
          style={{ 
            flex: 1,
            minHeight: "400px"
          }}
        />

        {/* Selected Restaurant Details (Overlay) */}
        {selectedRestaurant && (
          <div style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            width: "90%",
            maxWidth: "400px",
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            padding: "20px",
            zIndex: 1000
          }}>
            <button
              onClick={() => setSelectedRestaurant(null)}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "none",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "#666",
                padding: "5px"
              }}
            >
              ×
            </button>

            <h3 style={{ margin: "0 0 10px 0", paddingRight: "30px" }}>
              {selectedRestaurant.name}
            </h3>
            
            <p style={{ margin: "5px 0", color: "#666" }}>
              {selectedRestaurant.stars} ⭐ • {filteredCategories.join(", ")}
            </p>
            
            <p style={{ margin: "5px 0", color: "#666" }}>
              {selectedRestaurant.city}, {selectedRestaurant.state}
            </p>
            
            {selectedRestaurant.address && (
              <p style={{ margin: "10px 0", fontSize: "14px", color: "#999" }}>
                📍 {selectedRestaurant.address}
              </p>
            )}

            <button
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedRestaurant.latitude},${selectedRestaurant.longitude}`;
                window.open(url, '_blank');
              }}
              style={{
                marginTop: "15px",
                padding: "10px 20px",
                backgroundColor: "#FF385C",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
                width: "100%"
              }}
            >
              Get Directions
            </button>
          </div>
        )}
      </div>

      {/* Restaurant List Sidebar */}
      <div style={{
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        right: "20px",
        width: "280px",
        maxHeight: "60vh",
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        overflowY: "auto",
        zIndex: 999
      }}>
        {filteredRestaurants.map((restaurant) => (
          <div
            key={restaurant.business_id}
            onClick={() => {
              setSelectedRestaurant(restaurant);
              googleMapRef.current?.panTo({ 
                lat: restaurant.latitude, 
                lng: restaurant.longitude 
              });
              googleMapRef.current?.setZoom(15);
            }}
            style={{
              padding: "15px",
              borderBottom: "1px solid #eee",
              cursor: "pointer",
              backgroundColor: selectedRestaurant?.business_id === restaurant.business_id 
                ? "#FFF5F5" 
                : "white",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => {
              if (selectedRestaurant?.business_id !== restaurant.business_id) {
                e.currentTarget.style.backgroundColor = "#f9f9f9";
              }
            }}
            onMouseLeave={(e) => {
              if (selectedRestaurant?.business_id !== restaurant.business_id) {
                e.currentTarget.style.backgroundColor = "white";
              }
            }}
          >
            <h4 style={{ margin: "0 0 5px 0", fontSize: "16px" }}>
              {restaurant.name}
            </h4>
            <p style={{ margin: "3px 0", fontSize: "14px", color: "#666" }}>
              {restaurant.stars} ⭐
            </p>
            <p style={{ margin: "3px 0", fontSize: "13px", color: "#999" }}>
              {restaurant.city}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
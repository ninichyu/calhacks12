// [file name]: services/lettaAI.js

import { supabase } from "./supabase";

export class LettaAI {
  constructor(userId) {
    this.userId = userId;
    this.preferenceHistory = [];
    this.learnedPreferences = {
      likedCuisines: new Set(),
      dislikedCuisines: new Set(),
      likedLocations: new Set(),
      dislikedLocations: new Set()
    };
    this.seenRestaurantIds = new Set();
  }

  // Record user feedback and learn from it
  recordFeedback(restaurant, liked) {
    this.seenRestaurantIds.add(restaurant.business_id); 
    console.log(`📝 Recording feedback: ${liked ? 'LIKED' : 'DISLIKED'} - ${restaurant.name}`);
    
    const categories = this.parseCategories(restaurant.categories);
    const location = `${restaurant.city}, ${restaurant.state}`;

    // Add to history
    this.preferenceHistory.push({
      restaurant,
      liked,
      timestamp: new Date()
    });

    // Update learned preferences
    if (liked) {
      categories.forEach(cat => this.learnedPreferences.likedCuisines.add(cat));
      this.learnedPreferences.likedLocations.add(location);
    } else {
      categories.forEach(cat => this.learnedPreferences.dislikedCuisines.add(cat));
      this.learnedPreferences.dislikedLocations.add(location);
    }

    console.log("🎯 Updated preferences:", this.learnedPreferences);
  }

  // Choose the next restaurant based on learned preferences
  async chooseNextRestaurant(allRestaurants, previousRestaurantId = null) {
    console.log("🤖 LettaAI choosing next restaurant...");
    
    // Filter out already shown restaurants if we have a previous one
    const availableRestaurants = allRestaurants.filter(
     r => !this.seenRestaurantIds.has(r.business_id)
  );


    if (availableRestaurants.length === 0) {
      console.log("❌ No more restaurants available");
      return null;
    }

    // Score each available restaurant
    const scoredRestaurants = availableRestaurants.map(restaurant => {
      const score = this.calculateRestaurantScore(restaurant);
      return { ...restaurant, aiScore: score };
    });

    // Sort by score (highest first)
    scoredRestaurants.sort((a, b) => b.aiScore - a.aiScore);

    console.log("🏆 Top 5 recommendations:");
    scoredRestaurants.slice(0, 5).forEach((r, i) => {
      console.log(`${i + 1}. ${r.name} - Score: ${r.aiScore} - ${this.parseCategories(r.categories).join(', ')}`);
    });

    // Return the highest scored restaurant
    const chosenRestaurant = scoredRestaurants[0];
    this.seenRestaurantIds.add(chosenRestaurant.business_id);
    console.log(`🎯 Chosen: ${chosenRestaurant.name} with score ${chosenRestaurant.aiScore}`);
    
    return chosenRestaurant;
  }

  // Calculate score for a restaurant based on learned preferences
  calculateRestaurantScore(restaurant) {
    const categories = this.parseCategories(restaurant.categories);
    const location = `${restaurant.city}, ${restaurant.state}`;
    let score = 0;

    // MAJOR factors based on recent feedback
    if (this.preferenceHistory.length > 0) {
      const lastFeedback = this.preferenceHistory[this.preferenceHistory.length - 1];
      
      if (lastFeedback.liked) {
        // If user just liked something, find SIMILAR restaurants
        const lastCategories = this.parseCategories(lastFeedback.restaurant.categories);
        const lastLocation = `${lastFeedback.restaurant.city}, ${lastFeedback.restaurant.state}`;
        
        // Bonus for matching categories from liked restaurant
        const matchingCategories = categories.filter(cat => lastCategories.includes(cat));
        score += matchingCategories.length * 30;
        
        // Bonus for same location
        if (location === lastLocation) {
          score += 20;
        }
        
        console.log(`✅ Building on like: ${matchingCategories.length} matching categories, same location: ${location === lastLocation}`);
      } else {
        // If user just disliked something, find DIFFERENT restaurants
        const lastCategories = this.parseCategories(lastFeedback.restaurant.categories);
        const lastLocation = `${lastFeedback.restaurant.city}, ${lastFeedback.restaurant.state}`;
        
        // Penalty for matching disliked categories
        const matchingCategories = categories.filter(cat => lastCategories.includes(cat));
        score -= matchingCategories.length * 40;
        
        // Penalty for same location if disliked
        if (location === lastLocation && this.learnedPreferences.dislikedLocations.has(location)) {
          score -= 25;
        }
        
        console.log(`❌ Avoiding dislike: ${matchingCategories.length} matching categories to avoid`);
      }
    }

    // General preference matching
    categories.forEach(cat => {
      if (this.learnedPreferences.likedCuisines.has(cat)) {
        score += 15;
      }
      if (this.learnedPreferences.dislikedCuisines.has(cat)) {
        score -= 25;
      }
    });

    // Location preferences
    if (this.learnedPreferences.likedLocations.has(location)) {
      score += 10;
    }
    if (this.learnedPreferences.dislikedLocations.has(location)) {
      score -= 20;
    }

    // Rating bonus
    if (restaurant.stars >= 4.0) {
      score += 5;
    }

    return score;
  }

  parseCategories(categories) {
    if (Array.isArray(categories)) {
      return categories.filter(cat => cat && cat.trim() !== "");
    }
    if (typeof categories === "string") {
      return categories
        .replace(/[\[\]"]+/g, "")
        .split(",")
        .map(s => s.trim())
        .filter(cat => cat && cat !== "");
    }
    return [];
  }

  // Get explanation for why a restaurant was chosen
  getRecommendationExplanation(restaurant) {
    const categories = this.parseCategories(restaurant.categories);
    const location = `${restaurant.city}, ${restaurant.state}`;
    const reasons = [];

    if (this.preferenceHistory.length > 0) {
      const lastFeedback = this.preferenceHistory[this.preferenceHistory.length - 1];
      
      if (lastFeedback.liked) {
        const lastCategories = this.parseCategories(lastFeedback.restaurant.categories);
        const matchingCategories = categories.filter(cat => lastCategories.includes(cat));
        
        if (matchingCategories.length > 0) {
          reasons.push(`Similar to the ${lastFeedback.restaurant.name} you liked (${matchingCategories.join(', ')})`);
        }
        
        if (`${lastFeedback.restaurant.city}, ${lastFeedback.restaurant.state}` === location) {
          reasons.push(`Same area as your previous like`);
        }
      } else {
        const lastCategories = this.parseCategories(lastFeedback.restaurant.categories);
        const differentCategories = categories.filter(cat => !lastCategories.includes(cat));
        
        if (differentCategories.length > 0) {
          reasons.push(`Different from the ${lastFeedback.restaurant.name} you disliked`);
        }
      }
    }

    // General preferences
    const likedMatches = categories.filter(cat => this.learnedPreferences.likedCuisines.has(cat));
    if (likedMatches.length > 0) {
      reasons.push(`Matches your liked cuisines: ${likedMatches.join(', ')}`);
    }

    if (reasons.length === 0) {
      return "New recommendation based on your overall preferences";
    }

    return reasons.join(' • ');
  }

  // Get learning summary
  getLearningSummary() {
    return {
      totalDecisions: this.preferenceHistory.length,
      likedCuisines: Array.from(this.learnedPreferences.likedCuisines),
      dislikedCuisines: Array.from(this.learnedPreferences.dislikedCuisines),
      likedLocations: Array.from(this.learnedPreferences.likedLocations),
      dislikedLocations: Array.from(this.learnedPreferences.dislikedLocations)
    };
  }
}
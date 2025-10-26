// src/services/lettaService.js
import { LettaClient } from '@letta-ai/letta-client';
import { supabase } from './supabase';

// Access environment variable correctly in React
const LETTA_API_KEY = import.meta.env.VITE_LETTA_API_KEY || process.env.REACT_APP_LETTA_API_KEY;

const client = new LettaClient({ 
  token: LETTA_API_KEY
});

// Store agent IDs per user in memory (or use Supabase)
const userAgents = new Map();

/**
 * Get or create a Letta agent for a specific user
 */
export async function getUserAgent(userId) {
  // Check if agent already exists for this user
  if (userAgents.has(userId)) {
    return userAgents.get(userId);
  }

  // Fetch user's preference history from Supabase
  const { data: likedRestaurants } = await supabase
    .from('swipes')
    .select(`
      restaurant_id,
      restaurant:restaurant_id (
        name,
        categories,
        stars,
        city,
        state
      )
    `)
    .eq('user_id', userId)
    .eq('action', 1)
    .limit(20);

  const { data: dislikedRestaurants } = await supabase
    .from('swipes')
    .select(`
      restaurant_id,
      restaurant:restaurant_id (
        name,
        categories,
        stars
      )
    `)
    .eq('user_id', userId)
    .eq('action', 0)
    .limit(10);

  // Build user preference profile
  const likedCategories = likedRestaurants
    ?.map(r => r.restaurant?.categories)
    .filter(Boolean)
    .flat()
    .join(', ') || 'no preferences yet';

  const likedNames = likedRestaurants
    ?.map(r => r.restaurant?.name)
    .filter(Boolean)
    .slice(0, 5)
    .join(', ') || 'none';

  const dislikedNames = dislikedRestaurants
    ?.map(r => r.restaurant?.name)
    .filter(Boolean)
    .slice(0, 5)
    .join(', ') || 'none';

  console.log('Creating Letta agent with profile:', {
    userId,
    likedCount: likedRestaurants?.length || 0,
    dislikedCount: dislikedRestaurants?.length || 0
  });

  // Create Letta agent with user's food preferences
  const agentState = await client.agents.create({
    model: "openai/gpt-4o-mini",
    embedding: "openai/text-embedding-3-small",
    memoryBlocks: [
      {
        label: "human",
        value: `User ID: ${userId}
Liked restaurants: ${likedNames}
Disliked restaurants: ${dislikedNames}
Preferred categories: ${likedCategories}
Number of likes: ${likedRestaurants?.length || 0}
Number of dislikes: ${dislikedRestaurants?.length || 0}`
      },
      {
        label: "persona",
        value: `I am a food recommendation AI for Munch Match. My job is to understand user preferences and rank restaurants based on their taste profile. I analyze:
- Restaurant categories and cuisine types
- Star ratings and quality
- User's past likes/dislikes
- Geographic preferences
I provide personalized scores (0-100) for how well each restaurant matches the user's taste.`
      }
    ],
    tools: []
  });

  console.log('✅ Created Letta agent:', agentState.id);
  userAgents.set(userId, agentState.id);
  return agentState.id;
}

/**
 * Get personalized restaurant recommendations using Letta
 */
export async function getRankedRestaurants(userId, restaurants) {
  try {
    const agentId = await getUserAgent(userId);

    // Prepare restaurant data for ranking
    const restaurantSummaries = restaurants.slice(0, 20).map(r => ({
      id: r.business_id,
      name: r.name,
      categories: Array.isArray(r.categories) 
        ? r.categories.join(', ')
        : r.categories?.replace(/[\[\]"]+/g, ''),
      stars: r.stars,
      city: r.city,
      state: r.state
    }));

    // Ask Letta to rank these restaurants
    const prompt = `Based on the user's preferences, rank these ${restaurantSummaries.length} restaurants from most to least recommended. Return ONLY a JSON array of restaurant IDs in order of preference.

Restaurants:
${JSON.stringify(restaurantSummaries, null, 2)}

Return format: ["restaurant_id_1", "restaurant_id_2", ...]`;

    console.log('🤖 Sending ranking request to Letta...');
    const response = await client.agents.messages.create(agentId, {
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    console.log('🤖 Letta ranking response:', response);
    console.log('🤖 Full response structure:', JSON.stringify(response, null, 2));

    // Parse Letta's response - extract from messages array
    let messageContent = '';
    if (response.messages && response.messages.length > 0) {
      console.log('📬 All messages:', response.messages);
      
      // Try to find assistant message in different formats
      for (const msg of response.messages) {
        console.log('📨 Message:', msg);
        
        // Check various possible fields where content might be
        if (msg.text) {
          messageContent += msg.text + '\n';
        } else if (msg.content) {
          messageContent += msg.content + '\n';
        } else if (msg.message) {
          messageContent += msg.message + '\n';
        } else if (msg.internal_monologue) {
          // Sometimes Letta puts content here
          messageContent += msg.internal_monologue + '\n';
        }
      }
    }

    console.log('📝 Extracted message content:', messageContent);

    let rankedIds;
    
    try {
      // Extract JSON from response and clean it
      const jsonMatch = messageContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        // Clean up the JSON: remove markdown code blocks and fix newlines in strings
        let cleanJson = jsonMatch[0]
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .replace(/"\s*\n\s*/g, '"') // Remove newlines inside strings
          .replace(/,\s*\n\s*/g, ', '); // Normalize commas
        
        rankedIds = JSON.parse(cleanJson);
        console.log('✅ Parsed ranked IDs:', rankedIds);
      } else {
        rankedIds = [];
      }
    } catch (e) {
      console.error('Failed to parse Letta response:', e);
      console.error('Raw content:', messageContent);
      rankedIds = [];
    }

    // Reorder restaurants based on Letta's ranking
    if (rankedIds.length > 0) {
      const rankedRestaurants = [];
      const idMap = new Map(restaurants.map(r => [r.business_id, r]));
      
      rankedIds.forEach(id => {
        if (idMap.has(id)) {
          rankedRestaurants.push(idMap.get(id));
          idMap.delete(id);
        }
      });
      
      // Add any remaining restaurants that weren't ranked
      rankedRestaurants.push(...Array.from(idMap.values()));
      
      return rankedRestaurants;
    }

    // Fallback: return original order if ranking fails
    return restaurants;

  } catch (error) {
    console.error('Letta ranking error:', error);
    console.error('Error details:', error.message);
    // Fallback: return original order
    return restaurants;
  }
}

/**
 * Update user agent's memory when they swipe
 */
export async function updateUserPreferences(userId, restaurant, liked) {
  try {
    console.log('💾 Updating preferences for user:', userId);
    const agentId = await getUserAgent(userId);
    console.log('💾 Agent ID:', agentId);
    
    const action = liked ? 'liked' : 'disliked';
    const categories = Array.isArray(restaurant.categories)
      ? restaurant.categories.join(', ')
      : restaurant.categories?.replace(/[\[\]"]+/g, '');

    const message = `User ${action} ${restaurant.name} (${categories}, ${restaurant.stars} stars, ${restaurant.city}, ${restaurant.state}). Update preferences accordingly.`;
    console.log('💾 Sending message to Letta:', message);

    const response = await client.agents.messages.create(agentId, {
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    });

    console.log('💾 Letta update response:', response);
    console.log(`✅ Updated Letta agent with ${action} preference`);
  } catch (error) {
    console.error('❌ Error updating Letta preferences:', error);
    console.error('❌ Error details:', error.message);
  }
}

/**
 * Get personalized insights about user's taste
 */
export async function getUserTasteProfile(userId) {
  try {
    console.log('📊 Getting taste profile for user:', userId);
    const agentId = await getUserAgent(userId);
    console.log('📊 Agent ID:', agentId);

    const response = await client.agents.messages.create(agentId, {
      messages: [
        {
          role: 'user',
          content: "Based on the user's swipe history, summarize their food preferences in 2-3 sentences. What cuisines do they like? What patterns do you see? If they have no history yet, say 'New user - let's discover your tastes!'"
        }
      ]
    });

    console.log('📊 Full Letta response:', response);
    console.log('📊 Full response structure:', JSON.stringify(response, null, 2));
    
    // Parse response - extract from messages array
    let content = "New user - start swiping to build your taste profile!";
    if (response.messages && response.messages.length > 0) {
      console.log('📬 All messages:', response.messages);
      
      // Try to find content in different message fields
      let extractedText = '';
      for (const msg of response.messages) {
        console.log('📨 Message:', msg);
        
        if (msg.text) {
          extractedText += msg.text + '\n';
        } else if (msg.content) {
          extractedText += msg.content + '\n';
        } else if (msg.message) {
          extractedText += msg.message + '\n';
        } else if (msg.internal_monologue) {
          extractedText += msg.internal_monologue + '\n';
        }
      }
      
      if (extractedText.trim()) {
        content = extractedText.trim();
      }
    }
    
    console.log('📊 Extracted content:', content);
    return content;
  } catch (error) {
    console.error('❌ Error getting taste profile:', error);
    console.error('❌ Error details:', error.message);
    return "New user - start swiping to build your taste profile!";
  }
}
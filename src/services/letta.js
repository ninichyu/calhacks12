import { supabase } from './supabase';

// OpenAI API configuration (simpler than Letta for now)
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export async function getUserSwipeHistory(userId) {
  const { data: swipes, error } = await supabase
    .from('swipes')
    .select(`
      action,
      restaurant:restaurant_id (
        name,
        categories,
        stars,
        city,
        state
      )
    `)
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching swipes:', error);
    return { likes: [], dislikes: [] };
  }

  const likes = swipes
    .filter(s => s.action === 1)
    .map(s => s.restaurant);
  
  const dislikes = swipes
    .filter(s => s.action === 0)
    .map(s => s.restaurant);

  return { likes, dislikes };
}

export async function rankRestaurantsWithLetta(userId, restaurants) {
  try {
    const { likes, dislikes } = await getUserSwipeHistory(userId);

    if (likes.length === 0 && dislikes.length === 0) {
      console.log('No swipe history yet, showing random order');
      return restaurants;
    }

    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not set, skipping AI ranking');
      return restaurants;
    }

    console.log(`Analyzing ${likes.length} likes and ${dislikes.length} dislikes...`);

    // Build prompt for OpenAI
    const prompt = buildPrompt(likes, dislikes, restaurants);

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a restaurant recommendation expert. Analyze user preferences and return ONLY a comma-separated list of restaurant IDs ranked from most to least likely to be liked.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);

    // Parse ranked IDs from response
    const rankedIds = parseRankingResponse(aiResponse);

    const rankedRestaurants = rankedIds
      .map(id => restaurants.find(r => r.id === id))
      .filter(r => r !== undefined);

    const unrankedRestaurants = restaurants.filter(
      r => !rankedIds.includes(r.id)
    );

    console.log(`✨ AI ranked ${rankedRestaurants.length} restaurants based on your preferences`);
    return [...rankedRestaurants, ...unrankedRestaurants];
  } catch (error) {
    console.error('Error ranking with AI:', error);
    return restaurants;
  }
}

function buildPrompt(likes, dislikes, restaurants) {
  const likesText = likes.length > 0
    ? `LIKED RESTAURANTS:\n${likes.map(r => 
        `- ${r.name} (${r.stars}⭐, ${Array.isArray(r.categories) ? r.categories.join(', ') : r.categories})`
      ).join('\n')}`
    : 'No liked restaurants yet.';

  const dislikesText = dislikes.length > 0
    ? `\nDISLIKED RESTAURANTS:\n${dislikes.map(r => 
        `- ${r.name} (${r.stars}⭐, ${Array.isArray(r.categories) ? r.categories.join(', ') : r.categories})`
      ).join('\n')}`
    : '';

  const restaurantsText = `\n\nRANK THESE RESTAURANTS (return ONLY comma-separated IDs):\n${restaurants.map(r => 
    `ID: ${r.id} | ${r.name} (${r.stars}⭐, ${Array.isArray(r.categories) ? r.categories.join(', ') : r.categories})`
  ).join('\n')}`;

  return `${likesText}${dislikesText}${restaurantsText}\n\nBased on the user's preferences, rank these restaurant IDs from most to least likely to be liked. Return ONLY the comma-separated IDs, nothing else.`;
}

function parseRankingResponse(content) {
  // Extract comma-separated IDs
  const match = content.match(/\d+(?:,\s*\d+)*/);
  if (match) {
    return match[0].split(',').map(id => parseInt(id.trim()));
  }
  return [];
}
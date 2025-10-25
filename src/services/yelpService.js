export async function fetchRestaurants() {
  // mock for testing
  return [
    {
      id: "1",
      name: "Taco Heaven",
      image_url: "https://picsum.photos/400?1",
      rating: 4.5,
      price: "$$",
      location: { city: "San Francisco" },
      coordinates: { latitude: 37.77, longitude: -122.42 },ow 
    },
    {
      id: "2",
      name: "Pasta Palace",
      image_url: "https://picsum.photos/400?2",
      rating: 4.2,
      price: "$$",
      location: { city: "San Francisco" },
      coordinates: { latitude: 37.76, longitude: -122.43 },
    },
  ];
}

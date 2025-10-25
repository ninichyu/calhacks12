import React from "react";


export default function RestaurantCards({ restaurants }) {
  const [imageUrls, setImageUrls] = useState({}); 

  useEffect(() => {
    const fetchImages = async () => {
      const urls = {};

      for (const r of restaurants) {
        if (!r.photo_ids) continue; 

        const { data } = supabase.storage
          .from("photos")
          .getPublicUrl(r.photo_ids);

        urls[r.id] = data.publicUrl;
      }

      setImageUrls(urls);
    };

    if (restaurants.length > 0) {
      fetchImages();
    }
  }, [restaurants]);

  return (
    <div className="card-container">
      {restaurants.map((r) => (
        <div key={r.id} className="card">
          <img src={imageUrls[r.id]} alt={r.name} />
          <h3>{r.name}</h3>
          <p>{r.stars} ⭐ • {r.categories.join(", ")}</p>
          <p>{r.city}, {r.state}</p>
        </div>
      ))}
    </div>
  );
}

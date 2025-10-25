export default function MapView({ lat, lon }) {
  const mapUrl = `https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`;

  return (
    <div className="map-view">
      <iframe
        src={mapUrl}
        width="100%"
        height="300"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
      ></iframe>
    </div>
  );
}

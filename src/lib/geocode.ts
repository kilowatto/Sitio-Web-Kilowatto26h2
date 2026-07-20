export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
      { headers: { "User-Agent": "kilowatto-photo-pipeline/1.0 (esteban.rey@desici.com)" } }
    );
    const data: any = await res.json();
    const a = data?.address ?? {};
    return a.city ?? a.town ?? a.village ?? a.state ?? a.country ?? null;
  } catch {
    return null;
  }
}

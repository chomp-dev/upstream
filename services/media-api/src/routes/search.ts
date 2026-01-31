import { Router } from 'express';

export const searchRouter = Router();

searchRouter.post('/', async (req, res) => {
    try {
        const { query, lat, lng, radius } = req.body;

        if (!query || typeof query !== 'string' || query.length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 characters' });
        }

        const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.error('Missing GOOGLE_PLACES_API_KEY');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Google Places Text Search
        let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;

        // Default radius 5km if location provided
        if (lat && lng) {
            url += `&location=${lat},${lng}&radius=${radius || 5000}`;
        }

        const googleRes = await fetch(url);
        const data = await googleRes.json() as any;

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            console.error('Google Places Error:', data);
            // Don't expose internal error details to client unless safe
            throw new Error(data.error_message || 'Google Places API Error');
        }

        const restaurants = (data.results || []).map((place: any) => ({
            id: place.place_id,
            google_place_id: place.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            price_level: place.price_level,
            types: place.types,
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
            photos: place.photos, // Pass photos to client if they handle them
        }));

        res.json({ restaurants });

    } catch (error: any) {
        console.error('Search API Error:', error);
        res.status(500).json({ error: 'Failed to perform search' });
    }
});

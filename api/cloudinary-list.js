// api/cloudinary-list.js - Vercel Serverless Function
// Proxies Cloudinary Admin API to keep API_SECRET server-side

export default async function handler(req, res) {
  // Enable CORS for your Vercel domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { folder = 'personal', max = '20' } = req.query;
    const maxResults = Math.min(parseInt(max, 10), 100); // Cap at 100

    // Get secrets from Vercel Environment Variables
    const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
    const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      console.error('Missing Cloudinary environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Build Cloudinary Admin API request params
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      type: 'upload',
      prefix: folder + '/',
      max_results: maxResults,
      direction: 'desc', // newest first
      resource_type: 'image',
      timestamp: timestamp.toString(),
      api_key: CLOUDINARY_API_KEY,
    };

    // Generate signature (SHA-1 of sorted params + secret)
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    const stringToSign = `${sortedParams}${CLOUDINARY_API_SECRET}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(stringToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Call Cloudinary Admin API
    const queryString = new URLSearchParams({
      ...params,
      signature,
    }).toString();

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image?${queryString}`;
    console.log('Cloudinary request URL:', url.replace(CLOUDINARY_API_SECRET, '***'));
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Cloudinary API error:', response.status, errText);
      // Return actual Cloudinary error for debugging
      return res.status(response.status).json({ error: 'Cloudinary API error', details: errText });
    }

    const data2 = await response.json();

    // Transform to minimal format for frontend
    const images = data2.resources.map((r) => ({
      caption: r.public_id.replace(`${folder}/`, ''),
      imageUrl: r.secure_url,
      publicId: r.public_id,
      width: r.width,
      height: r.height,
      format: r.format,
      createdAt: r.created_at,
    }));

    res.json(images);
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
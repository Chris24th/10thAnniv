export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { folder = "personal", max = "20" } = req.query;
    const maxResults = Math.min(parseInt(max, 10), 100);

    const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
    const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      console.error("Missing Cloudinary environment variables");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Admin API uses HTTP Basic Auth, not a signed query string
    const authHeader = "Basic " + Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");

    const queryString = new URLSearchParams({
      type: "upload",
      prefix: folder + "/",
      max_results: maxResults.toString(),
      direction: "desc",
    }).toString();

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image?${queryString}`;

    const response = await fetch(url, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Cloudinary API error:", response.status, errText);
      return res.status(response.status).json({ error: "Cloudinary API error", details: errText });
    }

    const data2 = await response.json();
    const images = data2.resources.map((r) => ({
      caption: r.public_id.replace(`${folder}/`, ""),
      imageUrl: r.secure_url,
      publicId: r.public_id,
      width: r.width,
      height: r.height,
      format: r.format,
      createdAt: r.created_at,
    }));

    res.json(images);
  } catch (error) {
    console.error("Function error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
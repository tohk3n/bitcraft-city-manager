// Proxy to bitjita.com API - whitelisted endpoints only
const ALLOWED_PATHS = [
  /^\/claims\/\d+$/,
/^\/claims\/\d+\/citizens$/,
/^\/claims\/\d+\/inventories$/,
/^\/players\/\d+\/equipment$/,
/^\/players\/\d+\/inventories$/,
/^\/players\/\d+\/vault$/,
/^\/crafts$/,
/^\/items$/,
/^\/items\/\d+$/,
/^\/buildings$/,
/^\/buildings\/\d+$/,
];

export default async function handler(req, res) {
  const { path } = req.query;

  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  // Validate against whitelist
  const isAllowed = ALLOWED_PATHS.some(pattern => pattern.test(path));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  const url = `https://bitjita.com/api${path}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    // Cache for 1 minute to be nice to bitjita
    res.setHeader('Cache-Control', 's-maxage=60');
    res.status(response.status).json(data);
  } catch (error) {
    res.status(502).json({ error: 'Upstream request failed' });
  }
}

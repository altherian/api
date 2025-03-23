const fetch = require('node-fetch');

// Data URLs
const playerDataURL = "http://159.69.165.169:8000/maps/world/live/players.json?857372";
const mapDataURL = "http://159.69.165.169:8000/maps/world/markers.json?";

exports.handler = async function (event, context) {
  const path = event.path;
  
  // Handle /map/:id route
  if (path.startsWith('/map/')) {
    const id = event.pathParameters?.id || '1';
    return await handleMapRoute(id);
  }
  
  // Handle /player/:id route
  if (path.startsWith('/player/')) {
    const id = event.pathParameters?.id || '1';
    return await handlePlayerRoute(id);
  }
  
  // Handle /data route
  if (path === '/data') {
    return await handleCombinedDataRoute();
  }
  
  return {
    statusCode: 404,
    body: JSON.stringify({ message: 'Route not found' })
  };
};

// Handle /map/:id endpoint
async function handleMapRoute(id) {
  try {
    const url = `${mapDataURL}${id}`;
    const data = await fetchData(url);
    const cleanedData = cleanMapData(data);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // CORS header
      },
      body: JSON.stringify(cleanedData, null, 2) // Pretty print with 2-space indentation
    };
  } catch (err) {
    console.error("Map error:", err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: `Error fetching map data: ${err.message}` }, null, 2)
    };
  }
}

// Handle /player/:id endpoint
async function handlePlayerRoute(id) {
  try {
    const url = `${playerDataURL}${id}`;
    const data = await fetchData(url);
    
    // Make sure we're returning data in the expected format
    const formattedData = {
      players: data.players || []
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(formattedData, null, 2) // Pretty print
    };
  } catch (err) {
    console.error("Player error:", err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: `Error fetching player data: ${err.message}` }, null, 2)
    };
  }
}

// Handle /data endpoint (combined map and player data)
async function handleCombinedDataRoute() {
  try {
    const playerData = await fetchData(playerDataURL);
    const mapData = await fetchData(mapDataURL);
    const cleanedMapData = cleanMapData(mapData);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        players: playerData.players || [],
        map: cleanedMapData
      }, null, 2) // Pretty print
    };
  } catch (err) {
    console.error("Combined data error:", err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: `Error fetching combined data: ${err.message}` }, null, 2)
    };
  }
}

// Fetch data from an external URL
async function fetchData(url) {
  try {
    const headers = {
      'User-Agent': 'Netlify-Serverless-Function',
    };
    
    console.log(`Fetching from: ${url}`);
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Status ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Data received from ${url}:`, JSON.stringify(data).substring(0, 100) + '...');
    return data;
  } catch (err) {
    console.error(`Fetch error for ${url}:`, err);
    throw new Error(`Error fetching data: ${err.message}`);
  }
}

function cleanMapData(data) {
  const cleanedMarkers = {};
  const markers = data["me.angeschossen.lands"].markers;

  for (const key in markers) {
    if (markers[key].detail && markers[key].position) {
      const marker = markers[key];
      cleanedMarkers[key] = {
        detail: marker.detail.replace(/<[^>]+>/g, "").trim(),
        positions: Array.isArray(marker.position) ? marker.position : [marker.position],
      };
    }
  }
  return { markers: cleanedMarkers };
}

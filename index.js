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
  try {
    if (!data || !data["me.angeschossen.lands"] || !data["me.angeschossen.lands"].markers) {
      console.error("Invalid map data structure:", JSON.stringify(data).substring(0, 200));
      return { markers: {} };
    }
    
    const cleanedMarkers = {};
    const markers = data["me.angeschossen.lands"].markers;
    
    for (const key in markers) {
      if (markers[key] && markers[key].detail) {
        const marker = markers[key];
        
        let positions = [];

        // Handle different position formats
        if (marker.position) {
          if (Array.isArray(marker.position)) {
            // It's already an array, use it as-is
            positions = marker.position;
          } else if (typeof marker.position === "object") {
            // If it's a single object, wrap it in an array
            positions = [marker.position];
          }
        }

        // Check if there is an extra 'positions' field that contains more coordinates
        if (marker.positions) {
          if (Array.isArray(marker.positions)) {
            // Append the extra positions
            positions = positions.concat(marker.positions);
          } else if (typeof marker.positions === "object") {
            positions.push(marker.positions);
          }
        }

        // Remove duplicates, in case the same coordinates are stored in different fields
        positions = positions.filter(
          (pos, index, self) =>
            index === self.findIndex(p => p.x === pos.x && p.y === pos.y && p.z === pos.z)
        );

        if (positions.length > 0) {
          cleanedMarkers[key] = {
            detail: typeof marker.detail === 'string' ? 
              marker.detail.replace(/<[^>]+>/g, "").trim() : 
              String(marker.detail),
            positions: positions // Always contains all available coordinates
          };
        }
      }
    }
    
    return { markers: cleanedMarkers };
  } catch (err) {
    console.error("Error cleaning map data:", err);
    return { markers: {}, error: err.message };
  }
}

    
    return { markers: cleanedMarkers };
  } catch (err) {
    console.error("Error cleaning map data:", err);
    return { markers: {}, error: err.message };
  }
}

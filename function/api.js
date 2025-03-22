const playerDataURL = "http://159.69.165.169:8000/maps/world/live/players.json?857372";
const mapDataURL = "http://159.69.165.169:8000/maps/world/markers.json?";

exports.handler = async function (event, context) {
  const path = event.path;
  
  // Handle /map/:id route
  if (path.startsWith('/map/')) {
    const id = event.pathParameters.id;
    return await handleMapRoute(id);
  }
  
  // Handle /player/:id route
  if (path.startsWith('/player/')) {
    const id = event.pathParameters.id;
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
    return {
      statusCode: 200,
      body: JSON.stringify(cleanMapData(data)),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Error fetching map data: ${err.message}` }),
    };
  }
}

// Handle /player/:id endpoint
async function handlePlayerRoute(id) {
  try {
    const url = `${playerDataURL}${id}`;
    const data = await fetchData(url);
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Error fetching player data: ${err.message}` }),
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
      body: JSON.stringify({
        players: playerData,
        map: cleanedMapData,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Error fetching combined data: ${err.message}` }),
    };
  }
}

// Fetch data from an external URL
async function fetchData(url) {
  try {
    const headers = {
      'User-Agent': 'Netlify-Serverless-Function',
    };

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Status ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    throw new Error(`Error fetching data: ${err.message}`);
  }
}

// Clean up map data before returning it
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

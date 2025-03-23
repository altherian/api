const http = require('http');
const https = require('https');
const { Buffer } = require('buffer');

const playerDataURL = "http://159.69.165.169:8000/maps/world/live/players.json?857372";
const mapDataURL = "http://159.69.165.169:8000/maps/world/live/markers.json?835023";

// Netlify function handlers
exports.handler = async (event, context) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  try {
    // Netlify passes the path after the function name in the path parameter
    // Extract the path, removing the function name if present
    let path = event.path || '/';
    
    // If the path includes the function name (/api), remove it
    // This handles both /api and /.netlify/functions/api formats
    const apiPathMatch = path.match(/\/(?:\.netlify\/functions\/)?api(\/.*)?$/);
    if (apiPathMatch) {
      path = apiPathMatch[1] || '/';
    }
    
    console.log('Processed path:', path);
    
    const method = event.httpMethod || 'GET';
    
    // Create a pseudo-request object
    const req = {
      method: method,
      url: path,
      headers: event.headers || {},
    };
    
    // Create a response object to collect the response data
    const res = {
      statusCode: 200,
      headers: {},
      body: '',
      
      writeHead: function(statusCode, headers) {
        this.statusCode = statusCode;
        this.headers = { ...this.headers, ...headers };
      },
      
      end: function(body) {
        this.body = body;
      }
    };
    
    // Handle the request
    await handleAPIRequest(req, res, path);
    
    // Return the response in the format expected by Netlify Functions
    return {
      statusCode: res.statusCode,
      headers: res.headers,
      body: res.body
    };
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      },
      body: `Error: ${error.message}`
    };
  }
};

async function handleAPIRequest(req, res, path) {
  console.log('Handling API request for path:', path);
  
  // For debugging purposes, return path info if requested
  if (path === '/debug') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'Debug info', 
      path: path,
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers
      }
    }));
    return;
  }
  
  const mapRegex = /^\/map\/(\d+)$/;
  const playerRegex = /^\/player\/(\d+)$/;
  const combinedDataRegex = /^\/data$/;  

  const mapMatch = path.match(mapRegex);
  if (mapMatch) {
    console.log('Map data requested');
    await fetchAndForward(req, res, mapDataURL, "map");
    return;
  }

  const playerMatch = path.match(playerRegex);
  if (playerMatch) {
    console.log('Player data requested');
    await fetchAndForward(req, res, playerDataURL, "player");
    return;
  }

  const combinedMatch = path.match(combinedDataRegex);
  if (combinedMatch) {
    console.log('Combined data requested');
    await fetchCombinedData(req, res);
    return;
  }

  // Handle preflight OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    sendCorsResponse(res);
    return;
  }

  // Check if this is the root path, if so return basic info
  if (path === '/' || path === '') {
    console.log('Root path requested, sending API info');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'API is running',
      endpoints: ['/map/:id', '/player/:id', '/data', '/debug']
    }));
    return;
  }

  console.log('No matching route found for:', path);
  res.writeHead(404, { 
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(`Not Found: ${path}`);
}

async function fetchAndForward(req, res, targetURL, type) {
  try {
    const options = {
      headers: {
        'User-Agent': 'Netlify-Function',
      },
      timeout: 5000
    };
    
    // Use custom fetch implementation
    const response = await nodeFetch(targetURL, options);
    
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Status ${response.statusCode}: ${response.statusMessage}`);
    }

    const data = JSON.parse(response.body);
    const responseData = type === "map" ? (data) : data;
    
    sendJsonResponse(res, responseData);
  } catch (err) {
    console.error('Error in fetchAndForward:', err);
    res.writeHead(500, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(`Error fetching data: ${err.message}`);
  }
}

async function fetchCombinedData(req, res) {
  try {
    const options = {
      headers: {
        'User-Agent': 'Netlify-Function',
      },
      timeout: 5000
    };
    
    // Fetch player data
    console.log('Fetching player data from:', playerDataURL);
    const playerResponse = await nodeFetch(playerDataURL, options);
    if (playerResponse.statusCode < 200 || playerResponse.statusCode >= 300) {
      throw new Error(`Player data error ${playerResponse.statusCode}: ${playerResponse.statusMessage}`);
    }
    const playerData = JSON.parse(playerResponse.body);
    
    // Fetch map data
    console.log('Fetching map data from:', mapDataURL);
    const mapResponse = await nodeFetch(mapDataURL, options);
    if (mapResponse.statusCode < 200 || mapResponse.statusCode >= 300) {
      throw new Error(`Map data error ${mapResponse.statusCode}: ${mapResponse.statusMessage}`);
    }
    const mapData = JSON.parse(mapResponse.body);
    const cleanedMapData = (mapData);

    const combinedData = {
      players: playerData,
      map: cleanedMapData
    };

    sendJsonResponse(res, combinedData);
  } catch (err) {
    console.error('Error in fetchCombinedData:', err);
    res.writeHead(500, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(`Error fetching combined data: ${err.message}`);
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
    // If the marker has a "shape", then we want to include all of its coordinates (multiple points)
    else if (markers[key].shape) {
      const shapeCoordinates = markers[key].shape.map(point => ({
        x: point.x,
        y: markers[key].shapeY, // assuming shapeY is the height (Y coordinate)
        z: point.z
      }));
      
      cleanedMarkers[key] = {
        detail: markers[key].detail.replace(/<[^>]+>/g, "").trim(),
        positions: shapeCoordinates, // This will include all the points of the shape
      };
    }
  }
  return { markers: cleanedMarkers };
}

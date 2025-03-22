const http = require('http');
const https = require('https');
const url = require('url');
const { Buffer } = require('buffer');

const playerDataURL = "http://159.69.165.169:8000/maps/world/live/players.json?857372";
const mapDataURL = "http://159.69.165.169:8000/maps/world/markers.json?";

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  try {
    await handleAPIRequest(req, res, path);
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(`Error: ${error.message}`);
  }
});

// Port configuration - you can change this or use environment variables
const PORT = process.env.PORT || 3000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function handleAPIRequest(req, res, path) {
  const mapRegex = /^\/map\/(\d+)$/;
  const playerRegex = /^\/player\/(\d+)$/;
  const combinedDataRegex = /^\/data$/;  

  const mapMatch = path.match(mapRegex);
  if (mapMatch) {
    await fetchAndForward(req, res, mapDataURL, "map");
    return;
  }

  const playerMatch = path.match(playerRegex);
  if (playerMatch) {
    await fetchAndForward(req, res, playerDataURL, "player");
    return;
  }

  const combinedMatch = path.match(combinedDataRegex);
  if (combinedMatch) {
    await fetchCombinedData(req, res);
    return;
  }

  // Handle preflight OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    sendCorsResponse(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

async function fetchAndForward(req, res, targetURL, type) {
  try {
    const options = {
      headers: {
        'User-Agent': 'Node-Server',
      },
      timeout: 5000
    };
    
    // Use custom fetch implementation
    const response = await nodeFetch(targetURL, options);
    
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Status ${response.statusCode}: ${response.statusMessage}`);
    }

    const data = JSON.parse(response.body);
    const responseData = type === "map" ? cleanMapData(data) : data;
    
    sendJsonResponse(res, responseData);
  } catch (err) {
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
        'User-Agent': 'Node-Server',
      },
      timeout: 5000
    };
    
    // Fetch player data
    const playerResponse = await nodeFetch(playerDataURL, options);
    if (playerResponse.statusCode < 200 || playerResponse.statusCode >= 300) {
      throw new Error(`Player data error ${playerResponse.statusCode}: ${playerResponse.statusMessage}`);
    }
    const playerData = JSON.parse(playerResponse.body);
    
    // Fetch map data
    const mapResponse = await nodeFetch(mapDataURL, options);
    if (mapResponse.statusCode < 200 || mapResponse.statusCode >= 300) {
      throw new Error(`Map data error ${mapResponse.statusCode}: ${mapResponse.statusMessage}`);
    }
    const mapData = JSON.parse(mapResponse.body);
    const cleanedMapData = cleanMapData(mapData);

    const combinedData = {
      players: playerData,
      map: cleanedMapData
    };

    sendJsonResponse(res, combinedData);
  } catch (err) {
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
  }
  return { markers: cleanedMarkers };
}

function sendJsonResponse(res, data) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify(data));
}

function sendCorsResponse(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  });
  res.end();
}

// Custom fetch implementation for Node.js using http/https modules
function nodeFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 30000
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = [];
      
      res.on('data', (chunk) => {
        data.push(chunk);
      });
      
      res.on('end', () => {
        const body = Buffer.concat(data).toString();
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: body
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

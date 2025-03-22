const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

const playerDataURL = "http://159.69.165.169:8000/maps/world/live/players.json?857372";
const mapDataURL = "http://159.69.165.169:8000/maps/world/markers.json?";

// Map endpoint
app.get('/map/:id', async (req, res) => {
  try {
    await fetchAndForward(req, res, mapDataURL, "map");
  } catch (err) {
    res.status(500).send(`Error fetching data: ${err.message}`);
  }
});

// Player endpoint
app.get('/player/:id', async (req, res) => {
  try {
    await fetchAndForward(req, res, playerDataURL, "player");
  } catch (err) {
    res.status(500).send(`Error fetching data: ${err.message}`);
  }
});

// Combined data endpoint
app.get('/data', async (req, res) => {
  try {
    await fetchCombinedData(req, res);
  } catch (err) {
    res.status(500).send(`Error fetching combined data: ${err.message}`);
  }
});

async function fetchAndForward(req, res, targetURL, type) {
  try {
    const headers = {
      'User-Agent': 'Node-Express-Server'
    };
    
    const fetchOptions = {
      method: 'GET',
      headers: headers,
      redirect: 'follow'
    };
    
    const response = await fetch(targetURL, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (type === "map") {
      res.json(cleanMapData(data));
    } else {
      res.json(data);
    }
  } catch (err) {
    res.status(500).send(`Error fetching data: ${err.message}`);
  }
}

async function fetchCombinedData(req, res) {
  try {
    const headers = {
      'User-Agent': 'Node-Express-Server'
    };
    
    const fetchOptions = {
      method: 'GET',
      headers: headers,
      redirect: 'follow'
    };
    
    const playerResponse = await fetch(playerDataURL, fetchOptions);
    if (!playerResponse.ok) {
      const errorText = await playerResponse.text();
      throw new Error(`Player data error ${playerResponse.status}: ${errorText}`);
    }
    const playerData = await playerResponse.json();
    
    const mapResponse = await fetch(mapDataURL, fetchOptions);
    if (!mapResponse.ok) {
      const errorText = await mapResponse.text();
      throw new Error(`Map data error ${mapResponse.status}: ${errorText}`);
    }
    const mapData = await mapResponse.json();
    const cleanedMapData = cleanMapData(mapData);

    const combinedData = {
      players: playerData,
      map: cleanedMapData
    };

    res.json(combinedData);
  } catch (err) {
    res.status(500).send(`Error fetching combined data: ${err.message}`);
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

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

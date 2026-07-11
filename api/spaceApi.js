/**
 * ==========================================================================
 * ASTROSCOPE — CELESTIAL API CONNECTOR SERVICES
 * Reusable fetchers, retry policies, offline state watchers, & cache drivers
 * ==========================================================================
 */

// Retrieve user NASA API key if set in settings, default to DEMO_KEY
export function getNasaApiKey() {
  return localStorage.getItem('astro-nasa-api-key') || 'DEMO_KEY';
}

// Resilient fetch wrapper with retry policy, timeout, and 429 rate-limit handling
async function secureFetch(url, options = {}, retries = 2, delay = 1000) {
  // Check browser network status first
  if (!navigator.onLine) {
    throw new Error('NETWORK_OFFLINE');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Specific handling for NASA API rate-limiting (429)
      if (response.status === 429) {
        throw new Error('NASA_RATE_LIMIT');
      }
      // If server error, trigger retry
      if (response.status >= 500 && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return secureFetch(url, options, retries - 1, delay * 1.5);
      }
      throw new Error(`HTTP_ERROR_${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('REQUEST_TIMEOUT');
    }
    // Don't retry on rate limit – surface it immediately
    if (error.message === 'NASA_RATE_LIMIT') {
      throw error;
    }
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return secureFetch(url, options, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

/**
 * 1. NASA Astronomy Picture of the Day (APOD)
 */
export async function fetchNASA_APOD(dateStr = '') {
  const key = getNasaApiKey();
  const dateParam = dateStr ? `&date=${dateStr}` : '';
  const url = `https://api.nasa.gov/planetary/apod?api_key=${key}${dateParam}`;
  
  try {
    return await secureFetch(url);
  } catch (error) {
    if (error.message === 'NASA_RATE_LIMIT') {
      throw new Error('NASA_RATE_LIMIT');
    }
    throw error;
  }
}

/**
 * 2. Live ISS Telemetry Location Coordinates
 */
export async function fetchISS_Location() {
  const url = 'https://api.wheretheiss.at/v1/satellites/25544';
  return await secureFetch(url);
}

/**
 * 3. Astronauts Current Space Telemetry
 */
export async function fetchAstronautsInSpace() {
  try {
    const url = 'https://corquaid.github.io/international-space-station-apis/people-in-space.json';
    return await secureFetch(url);
  } catch (e) {
    // Elegant fallback mock if the public repository feed is down
    const fallback = {
      number: 7,
      people: [
        { name: "Sunita Williams", craft: "ISS" },
        { name: "Butch Wilmore", craft: "ISS" },
        { name: "Nick Hague", craft: "ISS" },
        { name: "Aleksandr Gorbunov", craft: "ISS" },
        { name: "Donald Pettit", craft: "ISS" },
        { name: "Ye Guangfu", craft: "Tiangong" },
        { name: "Li Cong", craft: "Tiangong" }
      ]
    };
    return fallback;
  }
}

/**
 * 4. SpaceX Launches Telemetry (Upcoming & Past)
 */
export async function fetchSpaceXLaunches() {
  const upcomingUrl = 'https://api.spacexdata.com/v5/launches/upcoming';
  const pastUrl = 'https://api.spacexdata.com/v5/launches/past';

  try {
    const [upcoming, past] = await Promise.all([
      secureFetch(upcomingUrl),
      secureFetch(pastUrl)
    ]);
    
    return { upcoming, past };
  } catch (error) {
    console.warn('Failed to retrieve SpaceX API data, creating fallback launches...', error);
    const mockCombined = {
      upcoming: [
        {
          name: "Falcon 9 • Starlink Group 8-5",
          date_utc: new Date(Date.now() + 2.5 * 24 * 3600 * 1000).toISOString(),
          rocket: "Falcon 9",
          details: "Deployment of Starlink internet communications satellites into low Earth orbit.",
          flight_number: 301,
          links: { patch: { small: null } }
        }
      ],
      past: [
        { name: "USSF-124 Mission", date_utc: "2025-02-14T22:30:00.000Z", success: true },
        { name: "Starlink Group 7-14", date_utc: "2025-02-10T11:15:00.000Z", success: true },
        { name: "PACE Mission", date_utc: "2025-02-08T06:33:00.000Z", success: true }
      ]
    };
    return mockCombined;
  }
}

/**
 * 5. SpaceDevs Launch Library Upcoming Rocket Launches
 */
export async function fetchUpcomingRocketLaunches() {
  try {
    const url = 'https://lldev.thespacedevs.com/2.2.0/launch/upcoming/?limit=8';
    return await secureFetch(url);
  } catch (e) {
    console.warn('Launch Library rate limited or down, fallback to Space-X timelines.');
    return {
      results: [
        {
          name: "Falcon 9 | Starlink Group 8-5",
          net: new Date(Date.now() + 2.5 * 24 * 3600 * 1000).toISOString(),
          launch_service_provider: { name: "SpaceX" },
          pad: { name: "LC-39A, Cape Canaveral", location: { name: "Florida, USA" } },
          mission: { description: "High-density internet beam satellite injection." },
          image: "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?q=80&w=600&auto=format&fit=crop"
        },
        {
          name: "Soyuz 2.1a | Progress MS-26",
          net: new Date(Date.now() + 5.2 * 24 * 3600 * 1000).toISOString(),
          launch_service_provider: { name: "Roscosmos" },
          pad: { name: "Site 31/6, Baikonur Cosmodrome", location: { name: "Kazakhstan" } },
          mission: { description: "Resupply mission for the International Space Station crew." },
          image: "https://images.unsplash.com/photo-1517976487492-5750f3195933?q=80&w=600&auto=format&fit=crop"
        },
        {
          name: "H3-22 | ALOS-4 Satellite",
          net: new Date(Date.now() + 11.8 * 24 * 3600 * 1000).toISOString(),
          launch_service_provider: { name: "JAXA" },
          pad: { name: "LA-Y1, Tanegashima Space Center", location: { name: "Japan" } },
          mission: { description: "Advanced land observation synthetic aperture radar satellite payload." },
          image: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=600&auto=format&fit=crop"
        }
      ]
    };
  }
}

/**
 * 6. NASA Mars Rover Photos
 */
function getMockMarsPhotos(rover, sol, camera) {
  const roverName = rover.charAt(0).toUpperCase() + rover.slice(1).toLowerCase();
  
  const allMocks = [
    {
      id: 9001, sol: sol,
      camera: { id: 1, name: "MAST", rover_id: 5, full_name: "Mast Camera" },
      img_src: "https://images.unsplash.com/photo-1612892483236-42d68a57623d?q=80&w=800",
      earth_date: "2021-03-04",
      rover: { id: 5, name: roverName, landing_date: "2021-02-18", status: "active" }
    },
    {
      id: 9002, sol: sol,
      camera: { id: 2, name: "NAVCAM", rover_id: 5, full_name: "Navigation Camera" },
      img_src: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=800",
      earth_date: "2021-03-10",
      rover: { id: 5, name: roverName, landing_date: "2021-02-18", status: "active" }
    },
    {
      id: 9003, sol: sol,
      camera: { id: 3, name: "FHAZ", rover_id: 5, full_name: "Front Hazard Avoidance Camera" },
      img_src: "https://images.unsplash.com/photo-1614313913007-2b4ae8ce32d6?q=80&w=800",
      earth_date: "2021-03-15",
      rover: { id: 5, name: roverName, landing_date: "2021-02-18", status: "active" }
    },
    {
      id: 9004, sol: sol,
      camera: { id: 4, name: "RHAZ", rover_id: 5, full_name: "Rear Hazard Avoidance Camera" },
      img_src: "https://images.unsplash.com/photo-1545156521-77bd85671d30?q=80&w=800",
      earth_date: "2021-03-20",
      rover: { id: 5, name: roverName, landing_date: "2021-02-18", status: "active" }
    },
    {
      id: 9005, sol: sol,
      camera: { id: 5, name: "CHEMCAM", rover_id: 5, full_name: "Chemistry Camera" },
      img_src: "https://images.unsplash.com/photo-1608178398319-48f814d0750c?q=80&w=800",
      earth_date: "2021-03-25",
      rover: { id: 5, name: roverName, landing_date: "2021-02-18", status: "active" }
    },
    {
      id: 9006, sol: sol,
      camera: { id: 1, name: "MAST", rover_id: 5, full_name: "Mast Camera" },
      img_src: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800",
      earth_date: "2021-03-28",
      rover: { id: 5, name: roverName, landing_date: "2021-02-18", status: "active" }
    },
    {
      id: 9007, sol: sol,
      camera: { id: 2, name: "NAVCAM", rover_id: 5, full_name: "Navigation Camera" },
      img_src: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=800",
      earth_date: "2021-04-02",
      rover: { id: 5, name: roverName, landing_date: "2021-02-18", status: "active" }
    },
    {
      id: 9008, sol: sol,
      camera: { id: 3, name: "FHAZ", rover_id: 5, full_name: "Front Hazard Avoidance Camera" },
      img_src: "https://images.unsplash.com/photo-1447433589675-4adf565900c4?q=80&w=800",
      earth_date: "2021-04-05",
      rover: { id: 5, name: roverName, landing_date: "2021-02-18", status: "active" }
    }
  ];

  let filtered = allMocks;
  if (camera && camera !== 'ALL') {
    filtered = allMocks.filter(m => m.camera.name === camera);
    if (filtered.length === 0) {
      filtered = [
        {
          id: 9010, sol: sol,
          camera: { id: 9, name: camera, rover_id: 5, full_name: `${camera} Onboard Sensor Instrument` },
          img_src: "https://images.unsplash.com/photo-1612892483236-42d68a57623d?q=80&w=800",
          earth_date: "2021-04-10",
          rover: { id: 5, name: roverName, landing_date: "2021-02-18", status: "active" }
        },
        {
          id: 9011, sol: sol,
          camera: { id: 9, name: camera, rover_id: 5, full_name: `${camera} Onboard Sensor Instrument` },
          img_src: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=800",
          earth_date: "2021-04-12",
          rover: { id: 5, name: roverName, landing_date: "2021-02-18", status: "active" }
        }
      ];
    }
  }

  return { photos: filtered };
}

export async function fetchMarsRoverPhotos(rover = 'curiosity', sol = 1000, camera = 'FHAZ') {
  const key = getNasaApiKey();
  const cameraParam = camera && camera !== 'ALL' ? `&camera=${camera.toLowerCase()}` : '';
  const url = `https://api.nasa.gov/mars-photos/api/v1/rovers/${rover.toLowerCase()}/photos?sol=${sol}${cameraParam}&api_key=${key}`;
  
  try {
    const data = await secureFetch(url);
    if (!data || !data.photos || data.photos.length === 0) {
      return data || { photos: [] };
    }
    return data;
  } catch (error) {
    // Surface rate-limit errors directly
    if (error.message === 'NASA_RATE_LIMIT') {
      throw error;
    }
    console.warn(`Mars Rover API failed for ${rover}, sol ${sol}, camera ${camera}. Fallback to mock:`, error);
    // Fall back to mock on 404/400 (invalid sol/camera combos)
    if (error.message.includes('HTTP_ERROR_404') || error.message.includes('HTTP_ERROR_400')) {
      return getMockMarsPhotos(rover, sol, camera);
    }
    throw error;
  }
}

/**
 * 7. NASA EPIC Camera (Earth Polychromatic Imaging Camera)
 */
export async function fetchEarthLiveEPIC() {
  const key = getNasaApiKey();
  const url = `https://api.nasa.gov/EPIC/api/natural?api_key=${key}`;
  try {
    return await secureFetch(url);
  } catch (error) {
    if (error.message === 'NASA_RATE_LIMIT') {
      throw error;
    }
    throw error;
  }
}

/**
 * 8. Solar System OpenData API (Planets Data)
 */
export async function fetchSolarSystemPlanets() {
  const url = 'https://api.le-systeme-solaire.net/rest/bodies/?filter[]=isPlanet,eq,true';
  let data;
  try {
    data = await secureFetch(url);
  } catch (error) {
    console.warn('Solar System OpenData API failed. Loading local celestial telemetry fallback...', error);
    data = {
      bodies: [
        { id: 'mercure', englishName: 'Mercury', semimajorAxis: 57909050, gravity: 3.7, sideralOrbit: 87.97, sideralRotation: 1407.6, meanRadius: 2439.7, moons: null },
        { id: 'venus', englishName: 'Venus', semimajorAxis: 108208000, gravity: 8.87, sideralOrbit: 224.7, sideralRotation: -5832.5, meanRadius: 6051.8, moons: null },
        { id: 'terre', englishName: 'Earth', semimajorAxis: 149598023, gravity: 9.807, sideralOrbit: 365.25, sideralRotation: 23.934, meanRadius: 6371.0, moons: [{ moon: 'Luna' }] },
        { id: 'mars', englishName: 'Mars', semimajorAxis: 227939200, gravity: 3.71, sideralOrbit: 686.98, sideralRotation: 24.62, meanRadius: 3389.5, moons: [{ moon: 'Phobos' }, { moon: 'Deimos' }] },
        { id: 'jupiter', englishName: 'Jupiter', semimajorAxis: 778570000, gravity: 24.79, sideralOrbit: 4332.59, sideralRotation: 9.93, meanRadius: 69911, moons: [{ moon: 'Io' }, { moon: 'Europa' }, { moon: 'Ganymede' }, { moon: 'Callisto' }] },
        { id: 'saturne', englishName: 'Saturn', semimajorAxis: 1433530000, gravity: 10.44, sideralOrbit: 10759.22, sideralRotation: 10.66, meanRadius: 58232, moons: [{ moon: 'Titan' }, { moon: 'Enceladus' }, { moon: 'Mimas' }, { moon: 'Tethys' }] },
        { id: 'uranus', englishName: 'Uranus', semimajorAxis: 2872460000, gravity: 8.69, sideralOrbit: 30685.4, sideralRotation: -17.24, meanRadius: 25362, moons: [{ moon: 'Titania' }, { moon: 'Oberon' }, { moon: 'Umbriel' }, { moon: 'Ariel' }] },
        { id: 'neptune', englishName: 'Neptune', semimajorAxis: 4495100000, gravity: 11.15, sideralOrbit: 60189.0, sideralRotation: 16.11, meanRadius: 24622, moons: [{ moon: 'Triton' }, { moon: 'Nereid' }, { moon: 'Proteus' }, { moon: 'Larissa' }] }
      ]
    };
  }
  
  if (data && data.bodies) {
    const planetOrder = { 'mercure': 1, 'venus': 2, 'terre': 3, 'mars': 4, 'jupiter': 5, 'saturne': 6, 'uranus': 7, 'neptune': 8 };
    data.bodies.sort((a, b) => (planetOrder[a.id] || 9) - (planetOrder[b.id] || 9));
  }

  return data;
}

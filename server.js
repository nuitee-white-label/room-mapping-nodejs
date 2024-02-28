import * as dotenv from 'dotenv';
import express, { json } from 'express';
import cors from 'cors';
//import { Configuration, OpenAIApi } from 'openai';
import session from 'express-session';
import { createClient } from 'redis';
import RedisStore from "connect-redis";
import Fuse from "fuse.js"

dotenv.config();

/* Create an instance of the OpenAI API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
//const openai = new OpenAIApi(configuration);

//import geocoding key
//const apiKey = process.env.API_NINJA_KEY;
*/

// Create an instance of express
const app = express();

//Add middleware
app.use(express.json());


app.use(cors({
  origin: 'http://ec2-44-203-135-172.compute-1.amazonaws.com:5173', // specify the origin
  credentials: true // this allows the session cookie to be sent back and forth
}));



//Session creation
//connect to DB 
const client = createClient({
  host: '127.0.0.1',
  port: '6379'
});

client.connect();

client.on('ready', function () {
  console.log('Redis client ready');
  // Use the client here
});

client.on('connect', function () {
  console.log('Connected to Redis...');
});

client.on('error', function (err) {
  console.log('Redis error: ' + err);
});

app.use(
  session({
    store: new RedisStore({ client: client }),
    secret: '88K10g8flw1y7KcrN6KnXkxKflNekxjf',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 600000 },
  }),
);

app.post('/map-rooms', (req, res) => {
  const { referenceCatalog, inputCatalog } = req.body;

  // Function to map rooms
  const results = mapRooms(referenceCatalog, inputCatalog);

  res.json({ Results: results });
});



// Helper functions to extract room details
function extractRoomType(roomName) {
  const roomTypes = [
    'presidential suite', 'junior suite', 'executive room', // Most specific, moved to top for priority
    'single room', 'double room', 'triple room', 'quad room', 'family room', 
    'shared room', 'private room', 'studio room', // Specific room configurations
    'room', 'suite', 'apartment', 'studio', 'villa', 'bungalow', 
    'cottage', 'penthouse', 'loft', 'cabin', 'chalet', 'mansion', 
    'duplex', 'guesthouse', 'hostel', // General types
  ];

  // Loop through each room type and use regex for precise matching
  for (let type of roomTypes) {
    let regex = new RegExp("\\b" + type.replace(/ /g, '\\s') + "\\b", "i");
    if (regex.test(roomName)) {
      return type;
    }
  }
  return 'unknown'; // Return 'unknown' if no specific type matches
}

function extractBoardType(roomName) {
  const boardTypes = [
    'room only', 'bed and breakfast', 'half board', 'full board', 
    'all inclusive', 'self catering', 'board basis', 'breakfast included',
    'dinner included', 'lunch included', 'breakfast & dinner', 'full pension',
    'breakfast for 2', 'free breakfast', 'complimentary breakfast', 'no meals',
    'meal plan available', 'kitchenette', 'full kitchen'
  ];
  return boardTypes.find(type => roomName.toLowerCase().includes(type)) || 'unknown';
}

function extractView(roomName) {
  const views = [
    'city view', 'sea view', 'garden view', 'courtyard view', 'mountain view', 
    'beachfront', 'pool view', 'lake view', 'river view', 'panoramic view', 
    'ocean view', 'forest view', 'park view', 'street view', 'skyline view',
    'terrace view', 'courtyard area' 
  ];
  return views.find(view => roomName.toLowerCase().includes(view)) || 'unknown';
}

function extractBedType(roomName) {
  const bedTypes = [
    'single bed', 'double bed', 'queen bed', 'king bed', 'twin bed', 
    'bunk bed', 'sofa bed', 'futon', 'murphy bed', 'queen', 'king', 
    'single', 'double', 'twin', 'full bed', 'california king bed', 
    'day bed', 'trundle bed', 'extra bed', 'cot', 'rollaway bed'
  ];
  // Enhance logic to handle overlaps like "king" being in "king bed"
  return bedTypes.find(type => roomName.toLowerCase().includes(type)) || 'unknown';
}

function extractAmenities(roomName) {
  const amenities = [
    'wifi', 'air conditioning', 'heating', 'kitchen', 'workspace', 'gym', 'pool',
    'free parking', 'pet-friendly', 'washer', 'dryer', 'balcony', 'fireplace',
    'accessible', 'elevator', 'security', 'private entrance', 'smoke alarm',
    'carbon monoxide alarm', 'first aid kit', 'safety card', 'fire extinguisher',
    'no smoking', 'beach access', 'ski-in/ski-out', 'spa', 'hot tub', 'waterfront',
    'executive', 'terrace', 'smart TV', 'streaming services', 'mini-bar', 
    'coffee maker', 'soundproofing', 'private pool', 'plunge pool', 'bidet', 
    'jacuzzi', 'ensuite bathroom', 'patio', 'garden access', 'roof access', 
    'private dock', 'hammock', 'game console', 'board games', 'book collection'
  ];
  // Return all amenities found in room name
  return amenities.filter(amenity => roomName.toLowerCase().includes(amenity));
}

function extractRoomCategory(roomName) {
  const roomCategories = [
    'deluxe', 'superior', 'executive', 'club', 'presidential', 
    'junior', 'luxury', 'economy', 'standard', 'budget', 
    'accessible', 'family-friendly', 'romantic', 'honeymoon', 
    'business class', 'premium', 'boutique', 'historic', 'modern', 
    'oceanfront', 'beachfront', 'city view', 'mountain view', 
    'garden view', 'pool view', 'high floor', 'low floor', 
     'balcony', 'penthouse', // Views as categories due to their significant impact on the guest experience
  ];
  // This could return multiple matches as a room might be described with more than one category
  return roomCategories.filter(category => roomName.toLowerCase().includes(category));
}

function normalizeRoomName(roomName) {
  const normalizedRoomName = roomName.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").toLowerCase();
  
  let roomType = extractRoomType(normalizedRoomName);
  const roomCategory = extractRoomCategory(normalizedRoomName);
  if (roomCategory.length > 0 && roomType === 'unknown') {
    roomType = 'room'; // Default roomType if roomCategory is defined but no roomType
  }
  const board = extractBoardType(normalizedRoomName);
  const view = extractView(normalizedRoomName);
  const bedType = extractBedType(normalizedRoomName);
  const amenities = extractAmenities(normalizedRoomName);
  
  const combinedExtractedInfo = `${roomType} ${roomCategory.join(' ')} ${board} ${view} ${bedType} ${amenities.join(' ')}`.toLowerCase();
  
  const words = normalizedRoomName.match(/\w+/g) || [];
  
  const other = words.filter(word => !combinedExtractedInfo.includes(word));
  
  return {
      normalizedRoomName,
      roomType,
      roomCategory,
      board,
      view,
      bedType,
      amenities,
      other
  };
}
function mapRooms(referenceCatalog, inputCatalog) {
  let mappedResults = [];
  let unmappedRates = [];

  const referenceRooms = referenceCatalog[0].referenceRoomInfo;
  const supplierRooms = inputCatalog[0].supplierRoomInfo.map(room => ({
    ...normalizeRoomName(room.supplierRoomName),
    supplierRoomId: room.supplierRoomId,
    supplierRoomName: room.supplierRoomName,
  }));

  referenceRooms.forEach(refRoom => {
    const normalizedRefRoom = normalizeRoomName(refRoom.roomName);
    let bestMatches = [];
    let highestScore = -1;

    // First, find the best matching group based on room type, category, and view
    supplierRooms.forEach(supplierRoom => {
      const score = calculateMatchScore(normalizedRefRoom, supplierRoom);
      if (score > highestScore) {
        highestScore = score;
        bestMatches = [supplierRoom];
      } else if (score === highestScore) {
        bestMatches.push(supplierRoom);
      }
    });

    // Then, map all rates from the best matching group that match the board type
    if (bestMatches.length > 0 && highestScore > 0) {
      bestMatches.forEach(match => {
        mappedResults.push({
          propertyName: referenceCatalog[0].propertyName,
          propertyId: referenceCatalog[0].propertyId,
          roomId: refRoom.roomId,
          roomName: refRoom.roomName,
          cleanRoomName: normalizedRefRoom.normalizedRoomName,
          roomDescription: "Mapped based on room type, category, and attributes",
          mappedRoom: {
            supplierId: inputCatalog[0].supplierId,
            supplierRoomId: match.supplierRoomId,
            supplierRoomName: match.supplierRoomName,
            attributes: {
              roomType: match.roomType,
              board: match.board,
              view: match.view,
              bedType: match.bedType,
              cancellationPolicy: match.cancellationPolicy,
            }
          }
        });
      });
    } else {
      unmappedRates.push({
        supplierRoomName: normalizedRefRoom.normalizedRoomName,
        reason: "No suitable match found"
      });
    }
  });

  return { mappedResults, unmappedRates };
}



function calculateMatchScore(refRoom, supplierRoom) {
  let score = 0;

  // Base score for room type and category match
  if (refRoom.roomType === supplierRoom.roomType) score += 50;
  if (refRoom.roomCategory.some(category => supplierRoom.roomCategory.includes(category))) score += 30;

  // Additional matching attributes
  if (refRoom.view === supplierRoom.view && refRoom.view !== 'unknown') score += 20;

  return score;
}



// Create a route
app.get('/', async (req, res) => {
  res.status(200).send({
    message: 'Hello from Nuitee mapping assistant !',
  });
});

// Start the server
app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port localhost:${process.env.PORT}`);
});
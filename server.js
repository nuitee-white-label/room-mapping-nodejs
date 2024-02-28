import * as dotenv from 'dotenv';
import express, { json } from 'express';
import cors from 'cors';
//import { Configuration, OpenAIApi } from 'openai';
import Fuse from "fuse.js"

dotenv.config();

const app = express();

//Add middleware
app.use(express.json());


app.use(cors({
  origin: 'http://ec2-44-203-135-172.compute-1.amazonaws.com:5173', // specify the origin
  credentials: true // this allows the session cookie to be sent back and forth
}));



app.post('/map-rooms', (req, res) => {
  const { referenceCatalog, inputCatalog } = req.body;

  // Function to map rooms
  const results = mapRooms(referenceCatalog, inputCatalog);
  res.json(results);
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

function extractRoomCategory(roomName) {
  const roomCategories = [
    'deluxe', 'superior', 'executive', 'club', 'presidential', 
    'junior', 'luxury', 'economy', 'standard', 'budget', 
    'accessible', 'family-friendly', 'romantic', 'honeymoon', 
    'business class', 'premium', 'boutique', 'historic', 'modern', 
    'oceanfront', 'beachfront', 
   'high floor', 'low floor', 
     'balcony', 'penthouse', // Views as categories due to their significant impact on the guest experience
  ];
  return roomCategories.filter(category => roomName.toLowerCase().includes(category));
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
  let results = []; // This will hold the final structured data
  let unmappedRooms = []; // To track unmapped supplier rooms

  const referenceRooms = referenceCatalog[0].referenceRoomInfo;
  const supplierRooms = inputCatalog[0].supplierRoomInfo.map(room => ({
      ...normalizeRoomName(room.supplierRoomName),
      supplierRoomId: room.supplierRoomId,
      supplierRoomName: room.supplierRoomName,
      cleanSupplierRoomName: room.supplierRoomName.toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " "),
  }));

  // Track supplier rooms that have been mapped
  let mappedSupplierRoomIds = new Set();

  referenceRooms.forEach(refRoom => {
      const normalizedRefRoom = normalizeRoomName(refRoom.roomName);
      let mappedRooms = [];

      supplierRooms.forEach(supplierRoom => {
          const score = calculateMatchScore(normalizedRefRoom, supplierRoom); // Assuming this function calculates a relevance score

          if (score > 0) {
              mappedRooms.push({
                  supplierRoomId: supplierRoom.supplierRoomId,
                  supplierRoomName: supplierRoom.supplierRoomName,
                  cleanSupplierRoomName: supplierRoom.cleanSupplierRoomName,
                  matchAttributes: { // This could be adjusted based on actual attribute names
                      roomType: supplierRoom.roomType,
                      roomCategory: supplierRoom.roomCategory.join(', '),
                      board: supplierRoom.board,
                      view: supplierRoom.view,
                      bedType: supplierRoom.bedType,
                      amenities: supplierRoom.amenities.join(', '),
                  }
              });
              // Mark this supplier room as mapped
              mappedSupplierRoomIds.add(supplierRoom.supplierRoomId);
          }
      });

      if (mappedRooms.length > 0) {
          results.push({
              propertyName: referenceCatalog[0].propertyName,
              propertyId: referenceCatalog[0].propertyId,
              roomId: refRoom.roomId,
              roomName: refRoom.roomName,
              cleanRoomName: normalizedRefRoom.normalizedRoomName,
              roomDescription: { // Adjusted to safely handle potential undefined properties
                  roomType: normalizedRefRoom.roomType,
                  roomCategory: normalizedRefRoom.roomCategory.join(', '),
                  board: normalizedRefRoom.board,
                  view: normalizedRefRoom.view,
                  bedType: normalizedRefRoom.bedType,
                  amenities: normalizedRefRoom.amenities.join(', '),
              },
              mappedRooms: mappedRooms
          });
      }
  });

  // Identify unmapped supplier rooms
  supplierRooms.forEach(room => {
      if (!mappedSupplierRoomIds.has(room.supplierRoomId)) {
          unmappedRooms.push(room);
      }
  });

  // Return both results and unmappedRooms in the response
  return { 
      Results: results,
      UnmappedRooms: unmappedRooms 
  };
}


function calculateMatchScore(refRoom, supplierRoom) {
  let score = 0;

  // Room Type must match; it's a critical attribute
  if (refRoom.roomType !== supplierRoom.roomType) {
      return 0; // Different types mean different rooms
  } else {
      score += 50; // Significant score for room type match
  }

  // Room Category must have at least one overlap
  if (refRoom.roomCategory.some(category => supplierRoom.roomCategory.includes(category))) {
      score += 30; // Additional score for matching room category
  } else {
      return 0; // No matching categories mean different rooms
  }

  // View differences disqualify the match
  if (refRoom.view !== supplierRoom.view) {
      return 0; // Different views mean different rooms
  } else if (refRoom.view !== 'unknown') {
      score += 20; // Additional score for matching view, if known
  }

  // Board type is allowed to differ; it doesn't affect the score

  // Explicit amenities must match exactly
  const refAmenitiesSet = new Set(refRoom.amenities);
  const supplierAmenitiesSet = new Set(supplierRoom.amenities);
  if (refAmenitiesSet.size === supplierAmenitiesSet.size && [...refAmenitiesSet].every(value => supplierAmenitiesSet.has(value))) {
      score += 10; // Matching amenities add to the score
  } else {
      return 0; // Difference in amenities means different rooms
  }

  // Bed Type matching adds to the score but doesn't disqualify
  if (refRoom.bedType === supplierRoom.bedType || refRoom.bedType === 'unknown' || supplierRoom.bedType === 'unknown') {
      score += 10; // Matching bed type adds to the score
  }
  return score;
}

//Test route
app.get('/', async (req, res) => {
  res.status(200).send({
    message: 'Hello from Nuitee mapping assistant !',
  });
});

// Start the server
app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port localhost:${process.env.PORT}`);
});
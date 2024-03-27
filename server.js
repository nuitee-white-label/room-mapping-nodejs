import * as dotenv from 'dotenv';
import express from 'express';
import { calculateMatchScore } from './functions.js';

dotenv.config();
import { createServer } from 'node:http';

const app = express();
const server = createServer(app);

//Add middleware
app.use(express.json());

app.post('/map-rooms', (req, res) => {
  const { referenceCatalog, inputCatalog } = req.body;

  // Function to map rooms
  const results = mapRooms(referenceCatalog, inputCatalog);
  res.json(results);
});

// Helper functions to extract room details
function extractRoomType(roomName) {
  let modifiedRoomName = roomName.replace(/(\D)(\d)/g, '$1 $2').replace(/room only/gi, '').trim();

  const roomTypes = [
      'suite', 'single room', 'double room', 'triple room', 'quad room', 'family room','room',
      'shared room', 'private room', 'studio room', 'apartment', 'studio', 'villa', 'bungalow',
      'cottage', 'penthouse', 'loft', 'cabin', 'chalet', 'mansion', 'duplex', 'guesthouse', 'hostel','singe','double', 'triple', 'quad',
      // Ensure "room" is checked after more specific configurations to prevent premature matches
  ].sort((a, b) => b.length - a.length); // Sort by length to prioritize more specific terms

  const excludeBedTypePatterns = ['single', 'double', 'triple', 'quad'];
  const foundBedTypes = extractBedType(roomName); // This should return an array of bed types

  // Remove bed type terms from the modifiedRoomName if they are not meant to be identified as room types
  foundBedTypes.forEach(bedType => {
      if (excludeBedTypePatterns.includes(bedType)) {
          modifiedRoomName = modifiedRoomName.replace(new RegExp("\\b" + bedType + "\\b", 'gi'), '').trim();
      }
  });

  for (let type of roomTypes) {
      let pattern = type.replace(/ /g, '\\s'); // Replace spaces with regex space character
      let regex = new RegExp("\\b" + pattern + "\\b", "i");
      if (regex.test(modifiedRoomName)) {
          return type; // Directly return the matched room type
      }
  }

  // Fallback to "room" if no other room type is identified but the string still contains "room"
  if (modifiedRoomName.includes("room")) {
      return "room";
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
    'deluxe', 'superior', 'executive', 'club', 'presidential', 'classic',
    'junior', 'luxury', 'economy', 'standard', 'budget', 
    'accessible', 'family-friendly', 'romantic', 'honeymoon', 
    'business class', 'premium', 'boutique', 'historic', 'modern', 
    'oceanfront', 'beachfront', 'communicating', 'connected',
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

  // Normalize the room name for consistent comparison
  const normalizedRoomName = roomName.toLowerCase();

  // Directly check for predefined views in the room name
  for (const view of views) {
    if (normalizedRoomName.includes(view)) {
      return view; // Immediately return the view if found
    }
  }

  // Continue with dynamic checking only if no predefined view is matched
  const allKeywords = [
    ...views,
    ...extractRoomType(normalizedRoomName).split(' '),
    ...extractBoardType(normalizedRoomName).split(' '),
    ...extractRoomCategory(normalizedRoomName),
    ...extractBedType(normalizedRoomName),
    ...extractAmenities(normalizedRoomName),
  ].map(keyword => keyword.toLowerCase());

  // Find view keyword index
  const words = normalizedRoomName.split(' ');
  const viewIndex = words.findIndex(word => word.includes("view"));

  if (viewIndex > -1) {
    // Collect one or two words before "view" if they exist and are not in any list
    let precedingWords = words.slice(Math.max(0, viewIndex - 2), viewIndex);
    if (!precedingWords.some(word => allKeywords.includes(word))) {
      let viewDescription = [...precedingWords, "view"].join(' ');
      // If viewDescription is not in the original views list, add it dynamically
      if (!views.includes(viewDescription)) {
        return viewDescription;
      }
    }
  }

  return 'unknown'; // Return 'unknown' if no specific view matches
}


function extractBedType(roomName) {
  const bedTypes = [
    'single bed', 'double bed', 'queen bed', 'king bed', 'twin bed', 
    'bunk bed', 'double sofa bed', 'sofa bed', 'futon', 'murphy bed', 'queen', 'king', 
    'full bed', 'california king bed', 'kingsize', 'queensize',
    'day bed', 'trundle bed', 'extra bed', 'cot', 'rollaway bed', 'single sofa bed', 'sofabed'
  ];

  // Normalize roomName to lowercase once
  roomName = roomName.toLowerCase();

  // Sort bedTypes by length in descending order to prioritize longer matches first
  bedTypes.sort((a, b) => b.length - a.length);

  const foundBedTypes = bedTypes.reduce((acc, type) => {
    // Escape potential regular expression special characters in bed type names
    const escapedType = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp("\\b" + escapedType.replace(/ /g, '\\s') + "\\b", "i");
    if (regex.test(roomName)) {
      acc.push(type);
      // Remove matched type from roomName to prevent overlapping matches
      roomName = roomName.replace(regex, '').trim();
    }
    return acc;
  }, []);

  return foundBedTypes.length > 0 ? foundBedTypes : ['unknown'];
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
    'private dock', 'hammock', 'game console', 'board games', 'book collection', 'club access'
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
  let results = []; // Holds structured data for matched rooms
  let totalSupplierRooms = inputCatalog[0].supplierRoomInfo.length;
  let mappedSupplierRoomIds = new Set(); // Tracks matched supplier rooms

  // Normalize data
  const filteredReferenceRooms = referenceCatalog[0].referenceRoomInfo
      .filter(refRoom => !/^Room\s*#\d+$/.test(refRoom.roomName))
      .map(refRoom => ({...refRoom, ...normalizeRoomName(refRoom.roomName)}));

  const supplierRooms = inputCatalog[0].supplierRoomInfo
      .map(room => ({...room, ...normalizeRoomName(room.supplierRoomName)}));

  // First Pass: Strict matching
  matchRooms(filteredReferenceRooms, supplierRooms, mappedSupplierRoomIds, results, "First Pass");

  // Second Pass: Fuzzy matching with remaining unmapped supplier rooms
  let unmappedSupplierRooms = supplierRooms.filter(room => !mappedSupplierRoomIds.has(room.supplierRoomId));
  matchRooms(filteredReferenceRooms, unmappedSupplierRooms, mappedSupplierRoomIds, results, "Second Pass");

  // Calculate unmapped supplier rooms after both passes
  let unmappedRooms = supplierRooms.filter(room => !mappedSupplierRoomIds.has(room.supplierRoomId));
  let unmappedRoomsCount = unmappedRooms.length;

  return {
      Results: results,
      UnmappedRooms: unmappedRooms.length > 0 ? unmappedRooms : { Message: "There are no unmapped rooms" },
      Counts: {
          TotalSupplierRooms: totalSupplierRooms,
          MappedSupplierRooms: totalSupplierRooms - unmappedRoomsCount,
          UnmappedSupplierRooms: unmappedRoomsCount
      }
  };
}

function matchRooms(referenceRooms, supplierRooms, mappedSupplierRoomIds, results, pass) {
  referenceRooms.forEach(refRoom => {
      supplierRooms.forEach(supplierRoom => {
          if (mappedSupplierRoomIds.has(supplierRoom.supplierRoomId)) return;

          let score = calculateMatchScore(refRoom, supplierRoom, pass === "Second Pass");
          if (score > 30) {
              let match = {
                  pass,
                  supplierRoomId: supplierRoom.supplierRoomId,
                  supplierRoomName: supplierRoom.supplierRoomName,
                  matchAttributes: {
                      roomType: supplierRoom.roomType,
                      roomCategory: supplierRoom.roomCategory.join(', '),
                      board: supplierRoom.board,
                      view: supplierRoom.view,
                      bedType: supplierRoom.bedType,
                      amenities: supplierRoom.amenities.join(', '),
                  }
              };
              addMatchToResults(refRoom, match, results);
              mappedSupplierRoomIds.add(supplierRoom.supplierRoomId);
          }
      });
  });
}

function addMatchToResults(refRoom, match, results) {
  // Check if refRoom already has an entry in results
  let resultEntry = results.find(result => result.roomId === refRoom.roomId);
  if (resultEntry) {
      // If entry exists, append the new match to its mappedRooms array
      resultEntry.mappedRooms.push(match);
  } else {
      // If not, create a new entry for the refRoom with the match
      results.push({
          propertyName: refRoom.propertyName,
          propertyId: refRoom.propertyId,
          roomId: refRoom.roomId,
          roomName: refRoom.roomName,
          cleanRoomName: refRoom.normalizedRoomName,
          roomDescription: {
              roomType: refRoom.roomType,
              roomCategory: refRoom.roomCategory.join(', '),
              board: refRoom.board,
              view: refRoom.view,
              bedType: refRoom.bedType,
              amenities: refRoom.amenities.join(', '),
          },
          mappedRooms: [match]
      });
  }
}



//Test route
app.get('/', async (req, res) => {
  res.status(200).send({
    message: 'Hello from Nuitee room mapping API !',
    release: '27-March-2024'
  });
});

const port = process.env.PORT || 8080;

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
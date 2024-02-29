import express from 'express';
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
  // Pre-process the roomName to insert a space before any digit if it is directly preceded by a letter without spacing
  let modifiedRoomName = roomName.replace(/(\D)(\d)/g, '$1 $2').replace(/room only/gi, '').trim();

  const roomTypes = [
      'suite', 'executive room', 'rooms',
      'single room', 'double room', 'triple room', 'quad room', 'family room', 'shared room',
      'private room', 'studio room', // Specific room configurations
      'room', 'apartment', 'studio', 'villa', 'bungalow',
      'cottage', 'penthouse', 'loft', 'cabin', 'chalet', 'mansion',
      'duplex', 'guesthouse', 'hostel', // General types
      'single', 'double', 'triple', 'quad' // Adding singular terms for matching
  ];

  // Sort roomTypes by length in descending order to prioritize longer matches first
  roomTypes.sort((a, b) => b.length - a.length);

  for (let type of roomTypes) {
      let pattern = type.replace(/ /g, '\\s'); // Replace spaces with regex space character
      // Adjust regex to match the type followed by a non-word character or end of string
      let regex = new RegExp("\\b" + pattern + "(\\W|$)", "i");
      if (regex.test(modifiedRoomName)) {
          // Normalize the room type to handle 'double' and 'double room' equivalently
          return type.replace(/ room$/, ""); // Remove trailing " room" if present
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
    ...extractBedType(normalizedRoomName).split(' '),
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
  let results = []; // This will hold the final structured data
  let unmappedRooms = []; // To track unmapped supplier rooms

  // Initial counts
  let totalSupplierRooms = 0;

  const numericPattern = /^Room\s*#\d+$/; 
  const filteredReferenceRooms = referenceCatalog[0].referenceRoomInfo.filter(refRoom => 
      !numericPattern.test(refRoom.roomName)
  );

  const supplierRooms = inputCatalog[0].supplierRoomInfo.map(room => ({
      ...normalizeRoomName(room.supplierRoomName),
      supplierRoomId: room.supplierRoomId,
      supplierRoomName: room.supplierRoomName,
      cleanSupplierRoomName: room.supplierRoomName.toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " "),
  }));

  // Update total supplier rooms count
  totalSupplierRooms = supplierRooms.length;

  let mappedSupplierRoomIds = new Set(); // Track supplier rooms that have been mapped

  filteredReferenceRooms.forEach(refRoom => {
    const normalizedRefRoom = normalizeRoomName(refRoom.roomName);
    let mappedRooms = [];

    supplierRooms.forEach(supplierRoom => {
      // Skip this supplier room if it has already been mapped
      if (mappedSupplierRoomIds.has(supplierRoom.supplierRoomId)) return;

      const score = calculateMatchScore(normalizedRefRoom, supplierRoom); 

      if (score > 0) {
        mappedRooms.push({
            supplierRoomId: supplierRoom.supplierRoomId,
            supplierRoomName: supplierRoom.supplierRoomName,
            cleanSupplierRoomName: supplierRoom.cleanSupplierRoomName,
            matchAttributes: {
                roomType: supplierRoom.roomType,
                roomCategory: supplierRoom.roomCategory.join(', '),
                board: supplierRoom.board,
                view: supplierRoom.view,
                bedType: supplierRoom.bedType,
                amenities: supplierRoom.amenities.join(', '),
            }
        });
        // Mark this supplier room as mapped to prevent it from being matched again
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
          roomDescription: {
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

  // Calculate unmapped supplier rooms and their count
  let unmappedRoomsCount = totalSupplierRooms - mappedSupplierRoomIds.size;
  unmappedRooms = supplierRooms.filter(room => !mappedSupplierRoomIds.has(room.supplierRoomId));

  // Return results with counts
  return { 
      Results: results,
      UnmappedRooms: unmappedRooms.length > 0 ? unmappedRooms : { Message: "There are no unmapped rooms" },
      Counts: {
          TotalSupplierRooms: totalSupplierRooms,
          MappedSupplierRooms: totalSupplierRooms - unmappedRoomsCount, // or simply use mappedSupplierRoomIds.size
          UnmappedSupplierRooms: unmappedRoomsCount
      }
  };
}

function calculateMatchScore(refRoom, supplierRoom) {
  let score = 0;

  // Basic match on room type
  if (refRoom.roomType !== supplierRoom.roomType) return 0;
  score += 50; // Matching room type

  // Handling room category
  let categoryMatch = false;
  if (refRoom.roomCategory.length > 0 && supplierRoom.roomCategory.length > 0) {
      // Check if at least one category from refRoom matches any category in supplierRoom
      categoryMatch = refRoom.roomCategory.some(refCategory => 
          supplierRoom.roomCategory.some(suppCategory => 
              suppCategory.includes(refCategory) || refCategory.includes(suppCategory)));

      if (categoryMatch) {
          score += 30; // Matching room category
      } else {
          return 0; // Explicitly different rooms if there's no overlap in categories
      }
  }

  // Handling views explicitly
  if (refRoom.view !== 'unknown' && supplierRoom.view !== 'unknown') {
      if (refRoom.view === supplierRoom.view) {
          score += 20; // Matching views
      } else {
          return 0; // Explicitly different rooms if views don't match
      }
  }

  // If only roomType is present in refRoom and roomCategory is empty
  if (refRoom.roomCategory.length === 0) {
      // Check for matches in amenities and other if they are present
      let amenitiesMatch = refRoom.amenities.length > 0 && refRoom.amenities.every(amenity => supplierRoom.amenities.includes(amenity));
      let otherMatch = refRoom.other.length > 0 && refRoom.other.every(other => supplierRoom.other.includes(other));
      if (amenitiesMatch || otherMatch) score += 20; // Matching amenities or other contributes to the score
  }

  // Fallback for general match
  return score;
}







//Test route
app.get('/', async (req, res) => {
  res.status(200).send({
    message: 'Hello from Nuitee mapping assistant !',
  });
});

const port = process.env.PORT || 8080;

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
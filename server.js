import * as dotenv from 'dotenv';
import express, { json } from 'express';
import cors from 'cors';
import { calculateMatchOutcome } from './functions.js';
import { createServer } from 'node:http';

dotenv.config();

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
  // Initial normalization
  let normalizedRoomName = roomName.toLowerCase()
    .replace(/bed and breakfast/g, '')
    .replace(/(\D)(\d)/g, '$1 $2') // Space between letters and numbers
    .replace(/\b(bdr|bedroom|dbl|sgl|tpl|qd|trpl|quad|dbl room|sgl room|tpl room|quadruple)\b/g, match => {
      // Convert common abbreviations and synonyms to full terms
      const abbreviationMap = {
        'bdr': 'room',
        'bedroom': 'room',
        'dbl': 'double',
        'dbl room': 'double room',
        'sgl': 'single',
        'sgl room': 'single room',
        'tpl': 'triple',
        'tpl room': 'triple room',
        'trpl': 'triple',
        'qd': 'quad',
        'quad': 'quad room',
        'quadruple': 'quad room'
      };
      return abbreviationMap[match] || match;
    })
    .trim();

  if (normalizedRoomName.includes("communicating double rooms")) {
    console.log("occurence detected");
    let type = "connected rooms"
    return type;
  }
  if (normalizedRoomName.includes("family")) {
    console.log("occurence detected");
    let type = "family room"
    return type;
  }

  // Improved fallback logic for 'single', 'double', 'triple', 'quad'
  if (/(single|double|triple|quad|twin)(?!\s+(bed|sofa|sofabed))/.test(normalizedRoomName)) {
    // If matched at the start and not followed by bed/sofa/sofabed, return it as room type
    let type = RegExp.$1 + ' ' + "room";
    return type
  }

  // Synonyms normalization, expanded to include more variations
  const synonyms = {
    'double-double': 'double room', // Example where room might have two double beds
    'studio': 'studio room',
    'accessible': 'accessible room',
    'family': 'family room',
    'connected': 'connected rooms',
    'communicating rooms': 'connected rooms',
    'Disability access': 'accessible',
    // Extend with more synonyms as needed
  };

  // Apply synonyms normalization
  Object.entries(synonyms).forEach(([key, value]) => {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    normalizedRoomName = normalizedRoomName.replace(regex, value);
  });

  // Predefined, standardized room types
  const roomTypes = [
    'suite', 'single room', 'double room', 'triple room', 'quad room', 'family room',
    'shared room', 'private room', 'studio room', 'apartment', 'villa', 'bungalow',
    'king room', 'queen room', 'cottage', 'penthouse', 'loft', 'cabin', 'chalet', 'mansion',
    'duplex', 'guesthouse', 'hostel', 'accessible room', 'connected rooms',
    // Ensure these are already in standard form
  ];

  // Attempt to find and return a predefined, standardized room type
  for (let type of roomTypes) {
    if (normalizedRoomName.includes(type)) {
      return type;
    }
  }

  // Return "room" if nothing matches
  return "single room";
}

function extractRoomCategory(roomName) {
  // Preprocess and normalize room name
  let normalizedRoomName = roomName.toLowerCase()
    .replace("room only", "")
    .trim();

  // Dictionary for synonyms normalization
  const synonyms = {
    'exec': 'executive',
    'pres': 'presidential',
    'std': 'standard',
    'fam': 'family-friendly',
    'rom': 'romantic',
    'honeymn': 'honeymoon',
    'biz': 'business class',
    'prm': 'premium',
    'btq': 'boutique',
    'hist': 'historic',
    'mod': 'modern',
    'high-rise': 'high floor',
    'low-rise': 'low floor',
    'ground floor': 'low floor',
    'with a view': 'balcony',
    // Add other synonyms or similar terms as needed
  };

  // Apply synonyms normalization
  for (const [key, value] of Object.entries(synonyms)) {
    normalizedRoomName = normalizedRoomName.replace(new RegExp(`\\b${key}\\b`, 'g'), value);
  }

  // List of predefined room categories
  const roomCategories = [
    'deluxe', 'superior', 'executive', 'club', 'presidential', 'classic',
    'junior', 'luxury', 'economy', 'standard', 'budget',
    'family-friendly', 'romantic', 'honeymoon',
    'business class', 'premium', 'boutique', 'historic', 'modern',
    'oceanfront', 'beachfront', 'executive club',
    'high floor', 'low floor',
    'balcony',
  ];

  // Collect all matching categories
  let matchedCategories = roomCategories.filter(category => normalizedRoomName.includes(category));

  // Return array of matched categories or ['unknown'] if none are found
  return matchedCategories.length > 0 ? matchedCategories : ['unknown'];
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
    'terrace view', 'courtyard area', 'empire state view', 'fifth avenue'
  ];

  // Normalize the room name for consistent comparison
  const normalizedRoomName = roomName.toLowerCase();

  // Check directly for predefined views in the room name
  for (const view of views) {
    if (normalizedRoomName.includes(view)) {
      return view; // Immediately return the found view
    }
  }

  // If no predefined view is matched, look for the word "view" and construct the view dynamically
  const words = normalizedRoomName.split(' ');
  const viewIndex = words.findIndex(word => word === "view");

  if (viewIndex > 0) { // Ensure "view" is not the first word
    let viewDescription = words[viewIndex - 1] + ' ' + words[viewIndex];
    return viewDescription; // Return the dynamically constructed view
  }

  return 'unknown'; // Return 'unknown' if no specific view matches
}

function extractBedTypes(roomName) {
  const bedTypes = [
    'single bed', 'double bed', 'queen bed', 'king bed', 'twin bed', 'twin beds',
    'bunk bed', 'double sofa bed', 'sofa bed', 'futon', 'murphy bed',
    'full bed', 'california king bed', 'kingsize', 'queensize', 'twin sofa bed', 'twin sofabed',
    'day bed', 'trundle bed', 'extra bed', 'cot', 'rollaway bed', 'single sofa bed', 'sofabed',
    'queen beds', 'king beds', 'kingsize bed', 'kingsize beds', 'queen size bed', 'queensize bed',
    'queen size beds', 'queensize beds', 'king size bed', 'king size beds', 'kingsize beds', 'kingsize bed'
  ].sort((a, b) => b.length - a.length); // Ensure longer (more specific) names are matched first

  const sizeAndTypeNormalization = {
    'single bed': 'single', 'double bed': 'double', 'queen bed': 'queen',
    'king bed': 'king', 'twin bed': 'twin', 'twin beds': 'twin', 'bunk bed': 'bunk',
    'double sofa bed': 'double sofa', 'single sofa bed': 'single sofa',
    'sofa bed': 'single sofa', 'futon': 'futon', 'murphy bed': 'murphy',
    'full bed': 'full', 'california king bed': 'california king',
    'kingsize': 'king', 'queensize': 'queen', 'twin sofa bed': 'twin sofa',
    'twin sofabed': 'twin sofa', 'day bed': 'day', 'trundle bed': 'trundle',
    'extra bed': 'extra', 'cot': 'cot', 'rollaway bed': 'rollaway',
    'sofabed': 'single sofa', 'queen beds': 'queen', 'king beds': 'king',
    'kingsize bed': 'king', 'kingsize beds': 'king',
    // Additions to cover all specified bed types
    'queen size bed': 'queen', 'queen size beds': 'queen',
    'king size bed': 'king', 'king size beds': 'king',
    'queensize bed': 'queen', 'queensize beds': 'queen',
    'kingsize bed': 'king', 'kingsize beds': 'king',
  };

  roomName = roomName.toLowerCase();

  let contentToSearch = roomName;
  let searchOutsideParentheses = true;

  // Check if the room name has parentheses
  if (/\(.*?\)/.test(roomName)) {
    // Extract and prioritize text within the first matching parentheses
    const matchParentheses = roomName.match(/\((.*?)\)/);
    if (matchParentheses && matchParentheses[1]) {
      const parenthesesContent = matchParentheses[1];
      // Check if the parentheses content contains any bed type
      const hasBedTypeInParentheses = bedTypes.some(type => parenthesesContent.includes(type));
      if (hasBedTypeInParentheses) {
        // Prioritize this text and ignore the rest of the string
        contentToSearch = parenthesesContent;
        searchOutsideParentheses = false;
      }
    }
  }

  let bedTypeCounts = {};
  const extractFromText = (text) => {
    bedTypes.forEach(type => {
      const regex = new RegExp("\\b(\\d+\\s)?" + type.replace(/ /g, '\\s') + "\\b", "g");
      let match;
      while ((match = regex.exec(text)) !== null) {
        // Remove matched string to prevent re-matching
        text = text.replace(match[0], "");

        let quantity = match[1] ? parseInt(match[1], 10) : 1;
        let normalizedType = sizeAndTypeNormalization[type];
        if (!bedTypeCounts[normalizedType]) {
          bedTypeCounts[normalizedType] = quantity;
        } else {
          bedTypeCounts[normalizedType] += quantity;
        }
      }
    });
  };

  // Extract bed types from prioritized content
  extractFromText(contentToSearch);

  // If no beds found in parentheses, search the entire room name (excluding previously searched parentheses content)
  if (searchOutsideParentheses && Object.keys(bedTypeCounts).length === 0) {
    extractFromText(roomName.replace(/\(.*?\)/g, ""));
  }

  const foundBedTypes = Object.entries(bedTypeCounts).map(([type, quantity]) => ({
    type,
    quantity
  }));

  return foundBedTypes.length > 0 ? foundBedTypes : [{ type: 'unknown' }];
}

function extractAmenities(roomName) {
  const amenities = [
    'wifi', 'air conditioning', 'heating', 'kitchen', 'workspace', 'gym', 'pool',
    'free parking', 'pet-friendly', 'washer', 'dryer', 'balcony', 'fireplace',
    'accessible', 'elevator', 'security', 'private entrance', 'smoke alarm',
    'carbon monoxide alarm', 'first aid kit', 'safety card', 'fire extinguisher',
    'no smoking', 'beach access', 'ski-in/ski-out', 'spa', 'hot tub', 'waterfront',
    'terrace', 'smart TV', 'streaming services', 'mini-bar',
    'coffee maker', 'soundproofing', 'private pool', 'plunge pool', 'bidet',
    'jacuzzi', 'ensuite bathroom', 'patio', 'garden access', 'roof access',
    'private dock', 'hammock', 'game console', 'board games', 'book collection', 'club access'
  ];
  // Return all amenities found in room name
  return amenities.filter(amenity => roomName.toLowerCase().includes(amenity));
}

function normalizeRoomName(roomName) {
  const numberWordsToDigits = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    // Extend as necessary
  };

  function replaceWordsWithDigits(match) {
    return numberWordsToDigits[match.toLowerCase()] || match;
  }
  let normalizedRoomName = roomName.toLowerCase();
  // Preserve data in parentheses by replacing them with a unique placeholder
  const placeholders = [];
  normalizedRoomName = normalizedRoomName.replace(/\((.*?)\)/g, (match, p1) => {
    const placeholder = `<<${placeholders.length}>>`;
    placeholders.push(match); // Store the original text including parentheses
    return placeholder;
  });

  // Normalize the room name outside of parentheses
  normalizedRoomName = normalizedRoomName.toLowerCase()
    .replace(/[^\w\s<<>>]|_/g, " ") // Ignore placeholders when replacing non-word characters
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, replaceWordsWithDigits)
    .replace(/\s+/g, " ")
    .trim();

  // Restore the data in parentheses from placeholders
  normalizedRoomName = normalizedRoomName.replace(/<<(\d+)>>/g, (match, index) => placeholders[index]);

  // Insert a space before opening parenthesis if there wasn't any
  normalizedRoomName = normalizedRoomName.replace(/(\S)\(/g, "$1 (");

  // Proceed with the rest of the normalization process
  const roomType = extractRoomType(normalizedRoomName);
  const roomCategory = extractRoomCategory(normalizedRoomName);
  const board = extractBoardType(normalizedRoomName);
  const view = extractView(normalizedRoomName);
  const bedType = extractBedTypes(normalizedRoomName);
  const amenities = extractAmenities(normalizedRoomName);

  const bedTypeStrings = bedType.map(bedType => bedType.type).join(' '); // Adjust 'type' as needed based on your object structure

  // Concatenate all extracted info into a single string, including bedTypeStrings now
  const combinedExtractedInfo = `${roomType} ${roomCategory} ${board} ${view} ${bedTypeStrings} ${amenities.join(' ')}`.toLowerCase();

  // Extract words that are not part of the combined info
  const words = normalizedRoomName.match(/\w+/g) || [];
  const other = words.filter(word => !combinedExtractedInfo.includes(word.toLowerCase()));

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
  let firstPassMatchCount = 0; // Counter for first pass matches
  let secondPassMatchCount = 0;  // Counter for second pass matches
  let thirdPassMatchCount = 0;

  // Normalize data
  const filteredReferenceRooms = referenceCatalog[0].referenceRoomInfo
    .filter(refRoom => !/^Room\s*#\d+$/.test(refRoom.roomName))
    .map(refRoom => ({ ...refRoom, ...normalizeRoomName(refRoom.roomName) }));

  console.log(filteredReferenceRooms);

  const supplierRooms = inputCatalog[0].supplierRoomInfo
    .map(room => ({ ...room, ...normalizeRoomName(room.supplierRoomName) }));

  // First Pass: Strict matching
  firstPassMatchCount = matchRooms(filteredReferenceRooms, supplierRooms, mappedSupplierRoomIds, results, "First Pass");

  // Second Pass: Fuzzy matching with remaining unmapped supplier rooms
  let unmappedSupplierRooms = supplierRooms.filter(room => !mappedSupplierRoomIds.has(room.supplierRoomId));
  secondPassMatchCount = matchRooms(filteredReferenceRooms, unmappedSupplierRooms, mappedSupplierRoomIds, results, "Second Pass");

  let remainingSupplierRooms = supplierRooms.filter(room => !mappedSupplierRoomIds.has(room.supplierRoomId));
  thirdPassMatchCount = matchRooms(filteredReferenceRooms, remainingSupplierRooms, mappedSupplierRoomIds, results, "Third Pass");

  let unmappedRooms = supplierRooms.filter(room => !mappedSupplierRoomIds.has(room.supplierRoomId));
  let unmappedRoomsCount = unmappedRooms.length;

  return {
    Results: results,
    UnmappedRooms: unmappedRooms.length > 0 ? unmappedRooms : { Message: "There are no unmapped rooms" },
    Counts: {
      TotalSupplierRooms: totalSupplierRooms,
      FirstPassMatches: firstPassMatchCount,
      SecondPassMatches: secondPassMatchCount,
      thirdPassMatches: thirdPassMatchCount,
      MappedSupplierRooms: firstPassMatchCount + secondPassMatchCount + thirdPassMatchCount,
      UnmappedSupplierRooms: unmappedRoomsCount
    }
  };
}

function matchRooms(referenceRooms, supplierRooms, mappedSupplierRoomIds, results, pass) {
  let matchCount = 0;

  // Loop through each reference room to evaluate it against all supplier rooms
  referenceRooms.forEach(referenceRoom => {
    let roomMatched = false;

    // Loop through each supplier room for the current reference room
    supplierRooms.forEach(supplierRoom => {
      // Skip already mapped rooms
      if (mappedSupplierRoomIds.has(supplierRoom.supplierRoomId)) return;

      let outcome = calculateMatchOutcome(referenceRoom, supplierRoom);

      // Check if the outcome meets your criteria for a match
      if (isMatchBasedOnOutcome(outcome, pass)) {
        matchCount++;
        let match = {
          pass,
          supplierRoomId: supplierRoom.supplierRoomId,
          supplierRoomName: supplierRoom.supplierRoomName,
          cleanRoomName: supplierRoom.normalizedRoomName,
          matchAttributes: outcome,
          roomDescription: {
            roomType: supplierRoom.roomType,
            roomCategory: supplierRoom.roomCategory,
            board: supplierRoom.board,
            view: supplierRoom.view,
            amenities: supplierRoom.amenities.join(', '),
            bedType: supplierRoom.bedType,
          },
        };
        // Add the match to the results and mark the supplier room as mapped
        addMatchToResults(referenceRoom, match, results);
        mappedSupplierRoomIds.add(supplierRoom.supplierRoomId);
        roomMatched = true; // Mark as matched to skip further processing
        return; // Exit the current iteration since a match is found
      }
    });
  });

  return matchCount;
}

function isMatchBasedOnOutcome(outcome, pass) {
  //console.log("Outcome at start:", outcome); // Print the outcome at the beginning
  let result; // Initialize a variable to hold the result
  // Check conditions based on the pass
  switch (pass) {
    case 'First Pass':
      result = outcome.matchedRoomType === true &&
        outcome.matchedRoomCategory === true &&
        (outcome.matchedView === true || outcome.matchedView === null) &&
        (outcome.matchedAmenities === true || outcome.matchedAmenities === null) &&
        (outcome.bedTypes === true || outcome.bedTypes === null);
      break;

    case 'Second Pass':
      result = (outcome.matchedRoomType === true) &&
        ((outcome.matchedRoomCategory === true || outcome.matchedRoomCategory === 'partial') &&
          (outcome.matchedView === true || outcome.matchedView === null) &&
          (outcome.matchedAmenities === true || outcome.matchedAmenities === null || outcome.matchedAmenities === 'partial') &&
          (outcome.bedTypes === true || outcome.bedTypes === 'partial' || outcome.bedTypes === null));
      break;

    case 'Third Pass':
      result = (outcome.matchedRoomType === true) &&
        (outcome.matchedRoomCategory === true || outcome.matchedRoomCategory === null || outcome.matchedRoomCategory === 'supplierInfo') &&
        (outcome.matchedView === true || outcome.matchedView === null || outcome.matchedView === 'supplierInfo') &&
        (outcome.matchedAmenities === true || outcome.matchedAmenities === null || outcome.matchedAmenities === 'supplierInfo' || outcome.matchedAmenities === 'partial') &&
        (outcome.bedTypes === true || outcome.bedTypes === 'partial' || outcome.bedTypes === null || outcome.bedTypes === 'supplierInfo');
      break;

    default:
      console.error('Unknown pass:', pass);
      result = false; // Handle unexpected pass values
  }

  //console.log("Returning:", result); // Print what the function will return
  return result; // Return the result
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
        roomCategory: refRoom.roomCategory,
        board: refRoom.board,
        view: refRoom.view,
        amenities: refRoom.amenities.join(', '),
        bedType: refRoom.bedType,
      },
      mappedRooms: [match]
    });
  }
}

//Test route
app.get('/', async (req, res) => {
  res.status(200).send({
    message: 'Hello from Nuitee room mapping API v0.4 !',
  });
});

const port = process.env.PORT || 8080;

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
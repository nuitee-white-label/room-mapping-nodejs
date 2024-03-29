export function calculateMatchOutcome(refRoom, supplierRoom) {
  let outcome = {
      matchedRoomType: null,
      matchedRoomCategory: null,
      matchedView: null,
      matchedAmenities: null, // Implement specific logic if needed
      bedTypes: null,
  };


  // Room Type Comparison
  outcome.matchedRoomType = compareStringAttributes(refRoom.roomType, supplierRoom.roomType);
  //console.log("refRoomType:", refRoom.roomType, "supplierRoomType:", supplierRoom.roomType);
  //console.log(outcome.matchedRoomType);

  // Room Category Comparison
  outcome.matchedRoomCategory = compareArrayAttributes(refRoom.roomCategory, supplierRoom.roomCategory);
  //console.log("refRoomCategory:", refRoom.roomCategory, "supplierRoomCategory:", supplierRoom.roomCategory);
  //console.log(outcome.matchedRoomCategory);

  // View Comparison
  outcome.matchedView = compareStringAttributes(refRoom.view, supplierRoom.view);

  // Assumed logic for matchedAmenities, needs specific comparison logic
  outcome.matchedAmenities = compareArrayAttributes(refRoom.amenities, supplierRoom.amenities);

  // Bed Type Comparison
  outcome.bedTypes = calculateBedTypeOutcome(refRoom.bedType, supplierRoom.bedType);
  //console.log("refBedtype:", refRoom.bedType, "supplierBedType:", supplierRoom.bedType);
  //console.log(outcome.bedTypes)
  return outcome;
}

function compareStringAttributes(refAttribute, supplierAttribute) {
  // Helper function to check if a value is considered to have no information
  const isNoInfo = (value) => [undefined, null, "", "unknown"].includes(value);

  // Determine the presence of meaningful information for each attribute
  const hasRefInfo = !isNoInfo(refAttribute);
  const hasSupplierInfo = !isNoInfo(supplierAttribute);

  // Process according to the business rules
  if (hasRefInfo && hasSupplierInfo) {
    // Both have information, check if they are similar
    if (refAttribute === supplierAttribute) {
      return true;
    }
    // Check if both strings contain "room" as a fallback before returning false
    const bothContainRoom = refAttribute.includes("room") && supplierAttribute.includes("room");
    if (bothContainRoom) {
      return "partial";
    }
    // If not similar and no special "room" condition met, return false
    return false;
  } else if (hasSupplierInfo && !hasRefInfo) {
    // Only supplier attribute has information
    return "supplierInfo";
  } else if (!hasSupplierInfo && hasRefInfo) {
    // Only reference attribute has information
    return "refInfo";
  } else if (!hasRefInfo && !hasSupplierInfo) {
    // Both are "unknown" or don't have information
    return null;
  }
}


function compareArrayAttributes(refArray, supplierArray) {
  // Helper function to check if an array is considered to have no information
  const isNoInfoArray = (array) => array.length === 0 || array[0] === "unknown";

  // Determine the presence of meaningful information for each array
  const hasRefInfo = !isNoInfoArray(refArray);
  const hasSupplierInfo = !isNoInfoArray(supplierArray);

  // Process according to the business rules for arrays
  if (hasRefInfo && hasSupplierInfo) {
    // Both arrays have information, proceed with comparison
    const refSet = new Set(refArray);
    const supplierSet = new Set(supplierArray);
    const intersection = new Set([...refArray].filter(x => supplierSet.has(x)));

    if (intersection.size === refSet.size && intersection.size === supplierSet.size) {
      // All values match
      return true;
    } else if (intersection.size > 0) {
      // At least one value matches
      return "partial";
    } else {
      // Both have info, but no matches
      return false;
    }
  } else if (hasSupplierInfo && !hasRefInfo) {
    // Only supplier array has information
    return "supplierInfo";
  } else if (!hasSupplierInfo && hasRefInfo) {
    // Only reference array has information
    return "refInfo";
  } else if (!hasRefInfo && !hasSupplierInfo) {
    // Both arrays are considered to have no info
    return null;
  }
}




function calculateBedTypeOutcome(refBedTypes, supplierBedTypes) {
  // Check for 'unknown' or missing information in refBedTypes
  const refHasUnknownOrMissing = !refBedTypes || refBedTypes.length === 0 || refBedTypes.every(bed => bed.type === 'unknown');
  
  // Check for 'unknown' or missing information in supplierBedTypes
  const supplierHasUnknownOrMissing = !supplierBedTypes || supplierBedTypes.length === 0 || supplierBedTypes.every(bed => bed.type === 'unknown');

  // If refBedTypes is missing or unknown and supplierBedTypes has info, return "supplierInfo"
  if (refHasUnknownOrMissing && !supplierHasUnknownOrMissing) {
    return "supplierInfo";
  }
  //
  if (!refHasUnknownOrMissing && supplierHasUnknownOrMissing) {
    return "refInfo";
  }

  // If both are missing or unknown, return null
  if (refHasUnknownOrMissing && supplierHasUnknownOrMissing) {
    return null;
  }

  // Aggregate quantities for comparison
  const aggregateQuantities = bedTypes => bedTypes.reduce((acc, { type, quantity }) => {
    acc[type] = (acc[type] || 0) + quantity; // Sum quantities for each bed type
    return acc;
  }, {});

  const refQuantities = aggregateQuantities(refBedTypes);
  const suppQuantities = aggregateQuantities(supplierBedTypes);

  const refTypes = Object.keys(refQuantities);
  const suppTypes = Object.keys(suppQuantities);
  let partialMatchFound = false;

  // Check for at least one exact match in bed types and quantities
  refTypes.forEach(type => {
    if (suppTypes.includes(type) && refQuantities[type] === suppQuantities[type]) {
      partialMatchFound = true;
    }
  });

  // If partial match found and supplier has more bed types, return "partial"
  if (partialMatchFound && suppTypes.length > refTypes.length) {
    return "partial";
  } else if (!partialMatchFound) {
    // If no partial match found, return false
    return false;
  } else {
    // If all matches found, return true
    return true;
  }
}

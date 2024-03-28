export function calculateMatchOutcome(refRoom, supplierRoom) {
  let outcome = {
      matchedRoomType: null,
      matchedRoomCategory: null,
      matchedView: null,
      matchedAmenities: null, // Implement specific logic if needed
      bedTypes: null,
  };


  // Room Type Comparison
  outcome.matchedRoomType = compareWithSupplierInfo(refRoom.roomType, supplierRoom.roomType);

  // Room Category Comparison
  outcome.matchedRoomCategory = compareWithSupplierInfo(refRoom.roomCategory, supplierRoom.roomCategory);

  // View Comparison
  outcome.matchedView = compareWithSupplierInfo(refRoom.view, supplierRoom.view);

  // Assumed logic for matchedAmenities, needs specific comparison logic
  outcome.matchedAmenities = compareWithSupplierInfo(refRoom.amenities, supplierRoom.amenities);

  // Bed Type Comparison
  outcome.bedTypes = calculateBedTypeOutcome(refRoom.bedType, supplierRoom.bedType);
  return outcome;
}

function compareWithSupplierInfo(refAttribute, supplierAttribute) {
  // Check for "no information" values
  const isNoInfo = (value) => [undefined, null, "", "unknown"].includes(value);
  
  // Determine if the attributes have meaningful information
  const hasRefInfo = !isNoInfo(refAttribute) && !(Array.isArray(refAttribute) && refAttribute.every(isNoInfo));
  const hasSupplierInfo = !isNoInfo(supplierAttribute) && !(Array.isArray(supplierAttribute) && supplierAttribute.every(isNoInfo));
  
  // If both attributes are arrays, compare for full and partial matches
  if (Array.isArray(refAttribute) && Array.isArray(supplierAttribute)) {
    const fullMatch = refAttribute.slice().sort().join(',') === supplierAttribute.slice().sort().join(',');
    if (fullMatch) {
      return true; // Full match found
    }
    
    const partialMatch = refAttribute.some(item => supplierAttribute.includes(item));
    return partialMatch ? "partial" : "supplierInfo"; // Changed from false to "supplierInfo" to indicate unmatched supplier info
  }
  // For non-array attributes, direct comparison
  else if (!Array.isArray(refAttribute) && !Array.isArray(supplierAttribute)) {
    return refAttribute === supplierAttribute ? true : (hasSupplierInfo ? "supplierInfo" : false);
  }
  // Handling cases where one is an array and the other is not
  else if (hasRefInfo && !hasSupplierInfo) {
    return "refInfo";
  }
  else if (!hasRefInfo && hasSupplierInfo) {
    return "supplierInfo";
  }
  
  // Default to "unknown" if neither or both are missing information
  return null;
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

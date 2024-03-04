
export function calculateMatchScore(refRoom, supplierRoom, isFuzzyMatch) {
    let score = 0;
  
    // Basic match on room type
    if (refRoom.roomType === supplierRoom.roomType) {
      score += 50; // Matching room type adds a significant score
    } else if (isFuzzyMatch) {
      // In a fuzzy match, allow some leniency for room type
      score += 25; // Partial score for room type similarity in fuzzy matching
    } else {
      return 0; // No match on room type in strict matching
    }
  
    // Handling room category
    let categoryMatch = refRoom.roomCategory.length > 0 && supplierRoom.roomCategory.length > 0 &&
                        refRoom.roomCategory.some(refCategory => supplierRoom.roomCategory.includes(refCategory));
    if (categoryMatch) {
      score += 30; // Matching room category adds to the score
    } else if (!isFuzzyMatch) {
      // In strict matching, mismatching categories disqualify the match
      return 0;
    }
  
    // Explicit handling of views
    if (refRoom.view !== 'unknown' && supplierRoom.view !== 'unknown') {
      if (refRoom.view === supplierRoom.view) {
        score += 20; // Matching view adds to the score
      } else if (!isFuzzyMatch) {
        // In strict matching, differing views disqualify the match
        return 0;
      }
    }
  
    // Nuanced bed type matching using provided functions
    const bedTypeSimilarityScore = calculateBedTypeSimilarityScore(refRoom.bedType, supplierRoom.bedType);
    if (bedTypeSimilarityScore === 0 && !isFuzzyMatch) {
      return 0; // Bed type mismatch disqualifies the match in strict mode
    } else {
      score += bedTypeSimilarityScore; // Add similarity score for bed types
    }
  
    // For fuzzy matching, consider amenities and "other" attributes if room category was not a direct match
    if (isFuzzyMatch && !categoryMatch) {
      let amenitiesMatchScore = calculateAmenitiesMatchScore(refRoom.amenities, supplierRoom.amenities);
      score += amenitiesMatchScore; // Adjusted score based on matching amenities proportion
    }
  
    // Text similarity for room names (fuzzy matching phase)
    if (isFuzzyMatch) {
      let nameSimilarityScore = calculateNameSimilarityScore(refRoom.normalizedRoomName, supplierRoom.normalizedRoomName);
      score += nameSimilarityScore; // Adjust score based on name similarity
    }
  
    return score;
  }
  
  // Placeholder for calculating amenities match score (implement based on your criteria)
  function calculateAmenitiesMatchScore(refAmenities, supplierAmenities) {
    let matchedAmenities = refAmenities.filter(amenity => supplierAmenities.includes(amenity)).length;
    let totalAmenities = refAmenities.length;
    return (matchedAmenities / totalAmenities) * 10; // Up to 10 points based on proportion of matched amenities
  }
  
  // Placeholder for calculating name similarity score (implement using an actual similarity algorithm)
  function calculateNameSimilarityScore(refName, supplierName) {
    // Split names into words and convert to sets to remove duplicates
    let refWords = new Set(refName.toLowerCase().split(/\s+/));
    let supplierWords = new Set(supplierName.toLowerCase().split(/\s+/));
  
    // Calculate intersection (words in both sets)
    let intersection = new Set([...refWords].filter(word => supplierWords.has(word)));
  
    // Calculate union (unique words in both sets)
    let union = new Set([...refWords, ...supplierWords]);
  
    // Calculate Jaccard similarity coefficient
    let similarity = intersection.size / union.size;
  
    // Convert similarity to a score (e.g., 0 to 30 scale)
    let score = similarity * 30;
  
    return score;
  }
  
  function calculateBedTypeSimilarityScore(refBedTypes, supplierBedTypes) {
    // Normalize bed types for comparison (e.g., "queen" vs. "queensize")
    const normalizedRefBedTypes = refBedTypes.map(normalizeBedType);
    const normalizedSupplierBedTypes = supplierBedTypes.map(normalizeBedType);
  
    // Significant difference detection (e.g., "king" vs. "queen")
    if (normalizedRefBedTypes.includes("king") && normalizedSupplierBedTypes.includes("queen") ||
        normalizedRefBedTypes.includes("queen") && normalizedSupplierBedTypes.includes("king")) {
        return 0; // Explicit mismatch
    }
  
    // Consider additional beds like "sofa bed" without overriding the significance of primary bed types
    let similarityScore = 10; // Base score for having some overlap in bed types
    if (normalizedRefBedTypes.every(type => normalizedSupplierBedTypes.includes(type)) &&
        normalizedSupplierBedTypes.every(type => normalizedRefBedTypes.includes(type))) {
        similarityScore += 10; // Increase score for exact match
    }
  
    return similarityScore;
  }
  
  function normalizeBedType(bedType) {
    // Normalize bed type strings for comparison
    if (bedType.includes("queen")) return "queen";
    if (bedType.includes("king")) return "king";
    if (bedType.includes("double")) return "double";
    if (bedType.includes("single")) return "single";
    if (bedType.includes("sofa")) return "sofa bed";
    return bedType; // Return original if no normalization rule applies
  }
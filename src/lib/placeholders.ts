// Generic placeholder images for different asset types
export const VERTICAL_CONTEXTS: Record<string, string> = {
  "Hotels & Resorts": "luxury resort amenities and guest experiences",
  "Multifamily Real Estate": "modern apartment community lifestyle",
  "Entertainment Venues": "vibrant entertainment and events",
  "Physical Therapy": "healthcare and wellness services",
  "Corporate Offices": "professional business environment",
  "Education": "educational programs and learning",
  "Gyms": "fitness and health facilities",
  "Restaurants": "dining experiences and culinary delights",
  "Retail": "shopping and retail experiences",
  "Healthcare": "medical services and patient care",
  "Technology": "innovative tech solutions",
  "Finance": "financial services and solutions",
  "Real Estate": "property and real estate services",
  "Automotive": "automotive sales and services",
  "Travel": "travel and tourism experiences",
} as const;

// Generate unique placeholder based on campaign context
export const getCampaignPlaceholder = (
  assetType: string,
  vertical?: string,
  campaignName?: string
): string => {
  const seed = campaignName ? hashString(campaignName) : Date.now();
  const variants = getPlaceholderVariants(assetType);
  const variantIndex = seed % variants.length;
  return variants[variantIndex];
};

// Simple hash function for consistent seeding
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Get placeholder variants by asset type - Generic business images
const getPlaceholderVariants = (assetType: string): string[] => {
  // Generic business and marketing placeholder images
  const businessImages = [
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80", // Team collaboration
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80", // Office meeting
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80", // Business presentation
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80", // Creative workspace
  ];

  const marketingImages = [
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80", // Analytics dashboard
    "https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=800&q=80", // Marketing strategy
    "https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=800&q=80", // Digital marketing
    "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80", // Team working
  ];

  switch (assetType) {
    case "video":
      return [
        businessImages[2],
        marketingImages[0],
        businessImages[0],
      ];
    case "email":
      return [
        marketingImages[2],
        businessImages[1],
        marketingImages[1],
      ];
    case "landing_page":
    case "website":
      return [
        businessImages[3],
        marketingImages[3],
        businessImages[0],
      ];
    case "voice":
      return [
        businessImages[1],
        marketingImages[0],
        businessImages[2],
      ];
    default:
      return [
        marketingImages[0],
        businessImages[0],
      ];
  }
};

// Legacy function for backward compatibility
export const getAssetPlaceholder = (assetType: string): string => {
  return getCampaignPlaceholder(assetType);
};

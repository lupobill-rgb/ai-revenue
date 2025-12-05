// Generic placeholder images for different asset types
export const VERTICAL_CONTEXTS: Record<string, string> = {
  "Biotechnology & Pharmaceuticals": "pharmaceutical research and medical innovation",
  "Healthcare & Medical": "healthcare services and patient care",
  "Technology & SaaS": "innovative tech solutions and software",
  "Financial Services": "financial advisory and wealth management",
  "Professional Services": "consulting and business solutions",
  "Manufacturing": "precision manufacturing and production",
  "Retail & E-commerce": "retail experiences and online shopping",
  "Real Estate": "property and real estate services",
  "Education & Training": "educational programs and learning",
  "Hospitality & Travel": "hospitality and travel experiences",
  "Media & Entertainment": "media and entertainment content",
  "Non-Profit": "community impact and social good",
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

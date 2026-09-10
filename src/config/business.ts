export const business = {
  name: "Xerom SimRacing & Cafe",
  shortName: "Xerom",
  timezone: "Asia/Kuala_Lumpur",
  phoneDisplay: "012-940 1440",
  phoneInternational: "+60129401440",
  whatsappNumber: "60129401440",
  instagramHandle: "xerom.my",
  instagramUrl: "https://www.instagram.com/xerom.my",
  mapsUrl: "https://maps.app.goo.gl/aPavdDoFPr1ywc9W8",
  address: {
    street: "30-1, 3/KS06, Jalan Batu Nilam",
    locality: "Bandar Bukit Tinggi 1",
    postalCode: "41200",
    city: "Klang",
    region: "Selangor",
    country: "Malaysia",
  },
  coordinates: { latitude: 3.0095979, longitude: 101.4357844 },
} as const;

export const contactLinks = {
  phone: `tel:${business.phoneInternational}`,
  whatsapp: `https://wa.me/${business.whatsappNumber}`,
  instagram: business.instagramUrl,
  directions: business.mapsUrl,
} as const;

import hero from "@/assets/images/social-group-hero.placeholder-ai.1600x900.jpg";
import heroAvif640 from "@/assets/images/social-group-hero.placeholder-ai.640x360.avif";
import heroAvif960 from "@/assets/images/social-group-hero.placeholder-ai.960x540.avif";
import heroAvif1600 from "@/assets/images/social-group-hero.placeholder-ai.1600x900.avif";
import heroWebp640 from "@/assets/images/social-group-hero.placeholder-ai.640x360.webp";
import heroWebp960 from "@/assets/images/social-group-hero.placeholder-ai.960x540.webp";
import heroWebp1600 from "@/assets/images/social-group-hero.placeholder-ai.1600x900.webp";
import regularRig from "@/assets/images/regular-rig.1200x900.jpg";
import regularRigSmall from "@/assets/images/regular-rig.480x360.jpg";
import proRig from "@/assets/images/pro-rig.1200x900.jpg";
import proRigSmall from "@/assets/images/pro-rig.480x360.jpg";
import ps5Lounge from "@/assets/images/ps5-lounge.1200x900.jpg";
import ps5LoungeSmall from "@/assets/images/ps5-lounge.480x360.jpg";
import cafe from "@/assets/images/cafe-atmosphere.1200x900.jpg";
import cafeSmall from "@/assets/images/cafe-atmosphere.480x360.jpg";

export const media = {
  hero,
  heroSources: { heroAvif640, heroAvif960, heroAvif1600, heroWebp640, heroWebp960, heroWebp1600 },
  regularRig,
  regularRigSmall,
  proRig,
  proRigSmall,
  ps5Lounge,
  ps5LoungeSmall,
  cafe,
  cafeSmall,
} as const;

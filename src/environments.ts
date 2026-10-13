export type Environment = { id: string; name: string; description: string };

export const ENVIRONMENTS: Record<string, Environment> = {
  tidepools: {
    id: "tidepools",
    name: "Tidepool Shore",
    description:
      "Rocky shoreline where a warm shallow sea meets dry cliffs. Tides flood and drain the pools twice a day. Mild temperatures, mixed sun and shade, food both in the water and on land.",
  },
  deepOcean: {
    id: "deepOcean",
    name: "Deep Ocean",
    description:
      "Pitch-black sea floor at 3000 meters. Near freezing water, crushing pressure, no sunlight. The only food comes from mineral-rich hydrothermal vents.",
  },
  desert: {
    id: "desert",
    name: "Scorching Desert",
    description:
      "Open sand and rock at 50C by day. No standing water for months, blinding sun, sparse prey, fast predators hunting in the open.",
  },
  rainforest: {
    id: "rainforest",
    name: "Flooded Rainforest",
    description:
      "Warm, dripping forest under a closed canopy. Rain most days, standing water everywhere, thick insect life, and predators hunting in near-darkness on the forest floor.",
  },
  iceAge: {
    id: "iceAge",
    name: "Ice Age",
    description:
      "The seas have frozen over and the land is under snow. -30C for most of the year, long dark winters, very little food, open water only through cracks in the ice.",
  },
};

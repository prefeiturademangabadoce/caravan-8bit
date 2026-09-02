// Salt-Scoured Campaign Memory: every delivery leaves marks—rivalries, scars, debts, and grudges that follow the convoy.

export interface Faction {
  id: string;
  name: string;
  attitude: number; // -100 (hostile) to 100 (allied)
  known: boolean;
}

export interface Villain {
  id: string;
  name: string;
  title: string;
  grudge: number; // 0-100, how much they hate you
  lastSeen: number; // delivery number
  threat: "minor" | "moderate" | "severe" | "legendary";
  history: string[];
}

export interface Scar {
  id: string;
  name: string;
  description: string;
  deliveryEarned: number;
  mechanicalEffect: string;
}

export interface Relationship {
  factionId: string;
  level: "unknown" | "neutral" | "friendly" | "allied" | "hostile" | "at-war";
  tradesCompleted: number;
  betrayals: number;
  favorsOwed: number;
}

export interface CampaignRecord {
  deliveriesCompleted: number;
  totalCargoDelivered: number;
  convoysLost: number;
  raidersDefeated: number;
  factionsMet: number;
  villainsCreated: Villain[];
  scars: Scar[];
  relationships: Relationship[];
  legacyScore: number;
  lastDeliveryDay: number;
}

export interface ChoicePoint {
  id: string;
  delivery: number;
  title: string;
  choice: string;
  consequence: string;
  affectedFactions?: string[];
  createdVillain?: string;
}

export const INITIAL_CAMPAIGN: CampaignRecord = {
  deliveriesCompleted: 0,
  totalCargoDelivered: 0,
  convoysLost: 0,
  raidersDefeated: 0,
  factionsMet: 0,
  villainsCreated: [],
  scars: [],
  relationships: [],
  legacyScore: 0,
  lastDeliveryDay: 0,
};

const FACTION_TEMPLATES = [
  { name: "Dusthook Syndicate", baseAttitude: 10 },
  { name: "Watergate Collective", baseAttitude: 20 },
  { name: "Salt Flat Nomads", baseAttitude: 0 },
  { name: "Ridge Raiders", baseAttitude: -40 },
  { name: "Kettle Traders", baseAttitude: 15 },
  { name: "Relic Hunters", baseAttitude: 5 },
  { name: "Storm Chasers", baseAttitude: -10 },
  { name: "Old Road Guardians", baseAttitude: 25 },
];

const VILLAIN_NAMES = [
  { name: "Ghal the Unbound", title: "Raider King" },
  { name: "Sister Ash", title: "Cult Leader" },
  { name: "Baron Rust", title: "Scrap Lord" },
  { name: "The Pale Driver", title: "Ghost of the Flats" },
  { name: "Cogwright", title: "Machine Priest" },
  { name: "Vera Chainbreaker", title: "Mercenary Captain" },
  { name: "Old Scratch", title: "Desert Witch" },
  { name: "Krell the Patient", title: "Debt Collector" },
];

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

export function createFaction(templateIndex?: number): Faction {
  const template = FACTION_TEMPLATES[templateIndex ?? Math.floor(Math.random() * FACTION_TEMPLATES.length)];
  return {
    id: generateId("faction"),
    name: template.name,
    attitude: template.baseAttitude + Math.floor(Math.random() * 21) - 10,
    known: false,
  };
}

export function spawnVillain(delivery: number, triggerChoice?: string): Villain {
  const template = VILLAIN_NAMES[Math.floor(Math.random() * VILLAIN_NAMES.length)];
  return {
    id: generateId("villain"),
    name: template.name,
    title: template.title,
    grudge: 50 + Math.floor(Math.random() * 30),
    lastSeen: delivery,
    threat: "minor",
    history: [triggerChoice ?? `First crossed paths on Delivery ${delivery}`],
  };
}

export function updateVillainGrudge(villain: Villain, delta: number, event: string): Villain {
  return {
    ...villain,
    grudge: Math.max(0, Math.min(100, villain.grudge + delta)),
    lastSeen: villain.lastSeen, // unchanged unless they appear again
    history: [...villain.history, `${event} (${delta >= 0 ? "+" : ""}${delta})`],
    threat: villain.grudge >= 80 ? "legendary" : villain.grudge >= 60 ? "severe" : villain.grudge >= 40 ? "moderate" : "minor",
  };
}

export function earnScar(delivery: number, traumaLevel: number): Scar | null {
  if (traumaLevel < 30) return null;
  
  const scarTemplates = [
    { name: "Sandburn Scars", desc: "Face marked by storm-blown grit", effect: "-5 morale in sandstorms" },
    { name: "Raider's Mark", desc: "Knife wound from close combat", effect: "+10% fight success but -5 hull" },
    { name: "Oasis Debt", desc: "Unpaid favor to water traders", effect: "Trade costs increased by 1 scrap" },
    { name: "Ghost Sight", desc: "Saw something in the deep desert", effect: "Random encounters more frequent" },
    { name: "Broken Compass", desc: "Trust lost in navigation", effect: "Pathfinding reveals one less tile" },
    { name: "Hull Patchwork", desc: "Lead hauler barely held together", effect: "Starting health reduced by 10" },
    { name: "Crew Lost", desc: "A driver didn't make it back", effect: "-10 starting morale per delivery" },
    { name: "The Desert Remembers", desc: "Your name is known out there", effect: "Villains gain +5 initial grudge" },
  ];
  
  const template = scarTemplates[Math.min(traumaLevel / 15, scarTemplates.length - 1)];
  return {
    id: generateId("scar"),
    name: template.name,
    description: template.desc,
    deliveryEarned: delivery,
    mechanicalEffect: template.effect,
  };
}

export function calculateLegacyScore(record: CampaignRecord): number {
  let score = 0;
  score += record.deliveriesCompleted * 100;
  score += record.totalCargoDelivered;
  score -= record.convoysLost * 250;
  score += record.raidersDefeated * 25;
  score += record.factionsMet * 15;
  score -= record.villainsCreated.length * 30;
  score += record.scars.length * -5; // scars are bittersweet
  
  // Relationship bonuses
  record.relationships.forEach(rel => {
    if (rel.level === "allied") score += 100;
    if (rel.level === "friendly") score += 40;
    if (rel.level === "hostile") score -= 30;
    if (rel.level === "at-war") score -= 80;
  });
  
  return Math.max(0, score);
}

export function getRelationshipLevel(attitude: number): Relationship["level"] {
  if (attitude >= 80) return "allied";
  if (attitude >= 40) return "friendly";
  if (attitude >= -20) return "neutral";
  if (attitude >= -60) return "hostile";
  return "at-war";
}

export function trackChoice(record: CampaignRecord, choice: ChoicePoint): CampaignRecord {
  const updated = { ...record };
  
  // Check if this creates a villain
  if (choice.createdVillain) {
    const existing = updated.villainsCreated.find(v => v.id === choice.createdVillain);
    if (!existing) {
      const villain = spawnVillain(choice.delivery, choice.title);
      villain.id = choice.createdVillain;
      updated.villainsCreated.push(villain);
    }
  }
  
  // Update affected factions
  if (choice.affectedFactions) {
    choice.affectedFactions.forEach(factionId => {
      const rel = updated.relationships.find(r => r.factionId === factionId);
      if (rel) {
        rel.tradesCompleted += choice.choice.includes("trade") || choice.choice.includes("help") ? 1 : 0;
        rel.betrayals += choice.choice.includes("betray") || choice.choice.includes("attack") ? 1 : 0;
      } else {
        updated.relationships.push({
          factionId,
          level: "neutral",
          tradesCompleted: 0,
          betrayals: 0,
          favorsOwed: 0,
        });
      }
    });
  }
  
  updated.legacyScore = calculateLegacyScore(updated);
  return updated;
}

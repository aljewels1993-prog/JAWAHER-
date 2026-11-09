/**
 * The 10 stages, split into two worlds of 5. Each stage is inspired by one of
 * Oman's governorates (Al Batinah North + South share stage 9, so all 11 are
 * represented). `map` is the marker position on the adventure map in
 * longitude/latitude; `theme` drives the look of the level; `gen` drives the
 * level generator (difficulty rises stage by stage).
 */
export const WORLDS = [
  { id: 1, name: 'The Southern Treasures', nameAr: 'كنوز الجنوب', stages: [1, 2, 3, 4, 5] },
  { id: 2, name: 'The Northern Treasures', nameAr: 'كنوز الشمال', stages: [6, 7, 8, 9, 10] },
];

export const STAGES = [
  {
    id: 1, world: 1, name: 'Salalah Green Valleys', nameAr: 'وديان صلالة الخضراء',
    governorate: 'Dhofar', governorateAr: 'محافظة ظفار', map: [54.1, 17.05],
    theme: { sky: ['#5ec8ff', '#d9f4ff'], ground: 'grass', hills: '#3fae4a', far: '#7fcf6a', deco: ['palm', 'frankincense', 'bush', 'fort'], sea: true, mist: true },
    gen: { length: 150, seed: 11, enemies: 3, plants: 1, movers: 1, pits: 2 },
  },
  {
    id: 2, world: 1, name: 'Duqm Rock Garden', nameAr: 'حديقة صخور الدقم',
    governorate: 'Al Wusta', governorateAr: 'محافظة الوسطى', map: [57.6, 19.65],
    theme: { sky: ['#4fb7f5', '#fde7c4'], ground: 'sand', hills: '#d9a35b', far: '#e8c48a', deco: ['rock', 'palm', 'bush'], sea: true },
    gen: { length: 160, seed: 23, enemies: 4, plants: 1, movers: 2, pits: 3 },
  },
  {
    id: 3, world: 1, name: 'Sur Dhow Harbour', nameAr: 'ميناء السفن في صور',
    governorate: 'Ash Sharqiyah South', governorateAr: 'محافظة جنوب الشرقية', map: [59.5, 22.55],
    theme: { sky: ['#38a9f0', '#c9f1ff'], ground: 'grass', hills: '#35a046', far: '#6ccf8a', deco: ['palm', 'dhow', 'fort', 'bush'], sea: true },
    gen: { length: 170, seed: 37, enemies: 5, plants: 2, movers: 2, pits: 3 },
  },
  {
    id: 4, world: 1, name: 'Wahiba Golden Dunes', nameAr: 'كثبان رمال الشرقية',
    governorate: 'Ash Sharqiyah North', governorateAr: 'محافظة شمال الشرقية', map: [58.7, 22.05],
    theme: { sky: ['#ffb36b', '#ffe9b8'], ground: 'sand', hills: '#e3a54d', far: '#f0c77a', deco: ['dune', 'palm', 'tent', 'camel'] },
    gen: { length: 175, seed: 41, enemies: 5, plants: 2, movers: 3, pits: 4 },
  },
  {
    id: 5, world: 1, name: 'Nizwa Fort Oasis', nameAr: 'واحة قلعة نزوى',
    governorate: 'Ad Dakhiliyah', governorateAr: 'محافظة الداخلية', map: [57.53, 22.93],
    theme: { sky: ['#4cc2f2', '#e6f8ff'], ground: 'grass', hills: '#2f9e57', far: '#9a7b5c', deco: ['fort', 'palm', 'mountain', 'bush'] },
    gen: { length: 185, seed: 53, enemies: 6, plants: 2, movers: 3, pits: 4 },
  },
  {
    id: 6, world: 2, name: 'Ibri Ancient Towers', nameAr: 'أبراج عبري القديمة',
    governorate: 'Ad Dhahirah', governorateAr: 'محافظة الظاهرة', map: [56.52, 23.22],
    theme: { sky: ['#6aa9ff', '#ffe3c9'], ground: 'sand', hills: '#c98d55', far: '#a8754e', deco: ['beehive', 'palm', 'rock'] },
    gen: { length: 190, seed: 61, enemies: 6, plants: 3, movers: 3, pits: 4 },
  },
  {
    id: 7, world: 2, name: 'Buraimi Palm Gardens', nameAr: 'بساتين نخيل البريمي',
    governorate: 'Al Buraimi', governorateAr: 'محافظة البريمي', map: [55.79, 24.25],
    theme: { sky: ['#52c4ff', '#e8fff0'], ground: 'grass', hills: '#3c9e3f', far: '#86c96a', deco: ['palm', 'falaj', 'fort', 'bush'] },
    gen: { length: 195, seed: 71, enemies: 7, plants: 3, movers: 4, pits: 5 },
  },
  {
    id: 8, world: 2, name: 'Musandam Fjords', nameAr: 'خلجان مسندم',
    governorate: 'Musandam', governorateAr: 'محافظة مسندم', map: [56.25, 26.18],
    theme: { sky: ['#2f8fe0', '#bfe9ff'], ground: 'rock', hills: '#8d6e5a', far: '#6f8fa6', deco: ['mountain', 'dhow', 'rock'], sea: true },
    gen: { length: 200, seed: 83, enemies: 7, plants: 3, movers: 4, pits: 5 },
  },
  {
    id: 9, world: 2, name: 'Sohar & Rustaq Forts', nameAr: 'قلاع صحار والرستاق',
    governorate: 'Al Batinah North & South', governorateAr: 'محافظتا شمال وجنوب الباطنة', map: [56.9, 24.0],
    theme: { sky: ['#4ab8ff', '#fff2d6'], ground: 'grass', hills: '#2f9a4a', far: '#7aa86a', deco: ['fort', 'palm', 'bush', 'mountain'], sea: true },
    gen: { length: 205, seed: 97, enemies: 8, plants: 4, movers: 4, pits: 5 },
  },
  {
    id: 10, world: 2, name: 'Muscat – Burj Al Sahwa', nameAr: 'مسقط – برج الصحوة',
    governorate: 'Muscat', governorateAr: 'محافظة مسقط', map: [58.3, 23.55],
    theme: { sky: ['#7b6cd9', '#ffd59e'], ground: 'grass', hills: '#2f9a57', far: '#7c8fb0', deco: ['palm', 'fort', 'mountain', 'bush'], dusk: true },
    gen: { length: 200, seed: 109, enemies: 8, plants: 4, movers: 5, pits: 5, final: true },
  },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
export const TOTAL_STAGES = STAGES.length;

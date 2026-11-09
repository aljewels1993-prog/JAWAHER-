/**
 * Vocabulary for Grade 6 English, Unit 3: PLACES.
 * Every question in the game is generated from this table, so teachers can
 * edit clues, sentences and activities here without touching game code.
 */
export const WORDS = [
  {
    id: 'castle', word: 'Castle', emoji: '🏰', color: '#b39ddb',
    clue: 'Kings and queens lived here a long time ago. It has thick stone walls and towers.',
    activity: 'learn about history',
    sentence: 'The old ___ has thick stone walls and four tall towers.',
    example: 'People can learn about history at a castle.',
    confuse: ['palace', 'tower'],
  },
  {
    id: 'harbour', word: 'Harbour', emoji: '⚓', color: '#4dd0e1',
    clue: 'Ships stop here.',
    activity: 'see big ships and fishing boats',
    sentence: 'The fishing boats come back to the ___ every evening.',
    example: 'People can see ships and boats at a harbour.',
    confuse: [],
  },
  {
    id: 'stadium', word: 'Stadium', emoji: '🏟️', color: '#81c784',
    clue: 'People watch football matches here.',
    activity: 'watch football matches',
    sentence: 'Thousands of fans watched the football match at the ___.',
    example: 'People can watch football matches at a stadium.',
    confuse: ['sports_centre'],
  },
  {
    id: 'tower', word: 'Tower', emoji: '🗼', color: '#ffb74d',
    clue: 'It is very tall and thin. You can see the whole city from the top.',
    activity: 'see the whole city from the top',
    sentence: 'We climbed to the top of the ___ and saw the whole city.',
    example: 'People can see the whole city from a tower.',
    confuse: ['skyscraper', 'castle'],
  },
  {
    id: 'skyscraper', word: 'Skyscraper', emoji: '🏙️', color: '#64b5f6',
    clue: 'It is a very, very tall building with lots of floors. It almost touches the clouds!',
    activity: 'go up a hundred floors in a lift',
    sentence: 'That ___ has 100 floors. It almost touches the clouds!',
    example: 'People can work or live on very high floors in a skyscraper.',
    confuse: ['tower', 'office_building', 'apartment_building'],
  },
  {
    id: 'factory', word: 'Factory', emoji: '🏭', color: '#a1887f',
    clue: 'Workers make things like cars, toys and clothes here.',
    activity: 'make cars and machines',
    sentence: 'My uncle makes car parts in a big ___.',
    example: 'People can make cars, toys and clothes in a factory.',
    confuse: [],
  },
  {
    id: 'hospital', word: 'Hospital', emoji: '🏥', color: '#ef5350',
    clue: 'Doctors and nurses work here.',
    activity: 'see a doctor when they are ill',
    sentence: 'When I broke my arm, I went to the ___.',
    example: 'People can see a doctor at a hospital.',
    confuse: [],
  },
  {
    id: 'palace', word: 'Palace', emoji: '👑', color: '#ffd54f',
    clue: 'A king or a queen lives here. It is big, beautiful and has golden domes.',
    activity: 'see where a king or queen lives',
    sentence: 'The queen lives in a beautiful ___ with golden gates.',
    example: 'People can see beautiful rooms in a palace.',
    confuse: ['castle'],
  },
  {
    id: 'swimming_pool', word: 'Swimming pool', emoji: '🏊', color: '#26c6da',
    clue: 'People swim here.',
    activity: 'swim',
    sentence: 'I put on my swimsuit and jumped into the ___.',
    example: 'People can swim at a swimming pool.',
    confuse: ['sports_centre'],
  },
  {
    id: 'sports_centre', word: 'Sports centre', emoji: '🏀', color: '#ff8a65',
    clue: 'People play basketball, badminton and other sports inside this building.',
    activity: 'play basketball and badminton',
    sentence: 'We play basketball and badminton at the ___ after school.',
    example: 'People can play basketball and badminton at a sports centre.',
    confuse: ['stadium', 'swimming_pool'],
  },
  {
    id: 'office_building', word: 'Office building', emoji: '🏢', color: '#90a4ae',
    clue: 'People work at desks with computers in this building.',
    activity: 'work at desks with computers',
    sentence: 'My mum works at a computer on the fifth floor of an ___.',
    example: 'People can work at computers in an office building.',
    confuse: ['skyscraper'],
  },
  {
    id: 'apartment_building', word: 'Apartment building', emoji: '🏘️', color: '#f48fb1',
    clue: 'Many families live here in flats, one on top of the other.',
    activity: 'live with their families',
    sentence: 'Our flat is on the third floor of a big ___.',
    example: 'Families can live in flats in an apartment building.',
    confuse: ['skyscraper'],
  },
];

export const WORD_BY_ID = Object.fromEntries(WORDS.map((w) => [w.id, w]));

/** "a castle" / "an office building" */
export function withArticle(id) {
  const w = WORD_BY_ID[id].word.toLowerCase();
  return (/^[aeiou]/.test(w) ? 'an ' : 'a ') + w;
}

/** The six missions. Each one restores two building names in the city. */
export const MISSIONS = [
  { id: 1, title: 'Word Hunter', icon: '🔎', blurb: 'Match each place with its word.', restores: ['castle', 'harbour'] },
  { id: 2, title: 'Guess the Place', icon: '🐻', blurb: 'Listen to Bear\'s clues and guess.', restores: ['stadium', 'tower'] },
  { id: 3, title: 'City Explorer', icon: '🗺️', blurb: 'Walk around the 3D city and find places.', restores: ['skyscraper', 'factory'] },
  { id: 4, title: 'The Mystery Quiz', icon: '❓', blurb: '15 mystery questions. Can you solve them?', restores: ['hospital', 'palace'] },
  { id: 5, title: 'Speaking Adventure', icon: '🎤', blurb: 'Record your voice and talk about places.', restores: ['swimming_pool', 'sports_centre'] },
  { id: 6, title: 'The Golden Treasure', icon: '🗝️', blurb: 'Win 5 golden keys and open the chest!', restores: ['office_building', 'apartment_building'] },
];

/** Scoring rules (from the brief). */
export const SCORING = { correct: 10, levelBonus: 20 };

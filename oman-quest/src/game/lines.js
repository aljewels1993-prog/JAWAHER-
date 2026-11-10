/**
 * What the hero says, grouped by situation. Each line exists in English and
 * Arabic (same index) so she can speak in the student's language, or fall
 * back to English when the device has no Arabic voice.
 *
 * mood decides how she sounds and looks:
 *  happy   – bright, quick voice, gold bubble, she cheers
 *  excited – even higher and faster
 *  sad     – slow, low voice, blue bubble, she droops
 *  calm    – gentle, warm voice for hints and learning moments
 */
export const LINES = {
  correct: { mood: 'happy', list: [
    ['Yay! You got it!', 'ياي! إجابة صحيحة!'],
    ['Wow, brilliant!', 'واو، رائع!'],
    ['Excellent work!', 'عمل ممتاز!'],
    ['You are a grammar star!', 'أنتِ نجمة القواعد!'],
    ['Woohoo! Perfect!', 'هيييه! ممتاز جدًا!'],
    ['Super smart!', 'ذكية جدًا!'],
    ['Fantastic! Keep going!', 'مذهل! استمري!'],
    ['I knew you could do it!', 'كنت أعرف أنكِ تستطيعين!'],
    ['Amazing! High five!', 'مدهش! صفّقي معي!'],
    ['That is exactly right!', 'هذا صحيح تمامًا!'],
    ['Hooray! Well done!', 'مرحى! أحسنتِ!'],
    ['You make Oman proud!', 'عُمان فخورة بكِ!'],
    ['Great thinking!', 'تفكير رائع!'],
    ['Spot on! You are on fire!', 'إصابة مباشرة! أنتِ متألقة!'],
  ] },
  wrong: { mood: 'sad', list: [
    ['Oh no… not this one.', 'أوه لا… ليست هذه.'],
    ['Hmm, that is not quite right.', 'همم، هذه ليست صحيحة تمامًا.'],
    ['Oops… let us try again.', 'أوبس… لنحاول مرة أخرى.'],
    ['Aww, so close!', 'آه، كنتِ قريبة جدًا!'],
    ['Not this time… read the clue.', 'ليس هذه المرة… اقرئي التلميح.'],
    ['Oh dear… think again, slowly.', 'يا إلهي… فكري مرة أخرى بهدوء.'],
    ['That makes me a little sad… try once more!', 'هذا أحزنني قليلًا… حاولي مرة أخرى!'],
    ['Hmm… look at the key words.', 'همم… انظري إلى الكلمات المفتاحية.'],
    ['No worries, mistakes help us learn.', 'لا بأس، الأخطاء تعلّمنا.'],
    ['Oh… I believe in you, try again!', 'أوه… أنا أثق بكِ، حاولي مجددًا!'],
  ] },
  reveal: { mood: 'calm', list: [
    ['That is okay. Let us learn it together.', 'لا بأس. لنتعلّمها معًا.'],
    ['Now we both know the rule!', 'الآن كلتانا تعرف القاعدة!'],
    ['Remember this one for next time.', 'تذكّري هذه للمرة القادمة.'],
    ['Every mistake makes you stronger.', 'كل خطأ يجعلكِ أقوى.'],
    ['Let us read the explanation together.', 'لنقرأ الشرح معًا.'],
  ] },
  hint: { mood: 'calm', list: [
    ['Here is a little clue for you.', 'إليكِ تلميحًا صغيرًا.'],
    ['Think carefully… you can do it.', 'فكري جيدًا… تستطيعين.'],
    ['Look at the sentence again.', 'انظري إلى الجملة مرة أخرى.'],
    ['A clue! Now try your best.', 'تلميح! الآن ابذلي جهدكِ.'],
  ] },
  streak: { mood: 'excited', list: [
    ['%n in a row! You are unstoppable!', '%n إجابات متتالية! لا أحد يوقفكِ!'],
    ['%n correct answers in a row! Wow!', '%n إجابات صحيحة متتالية! واو!'],
    ['Streak of %n! Amazing!', 'سلسلة من %n! مذهل!'],
  ] },
  star: { mood: 'happy', list: [
    ['A shiny star!', 'نجمة لامعة!'],
    ['Twinkle twinkle! Got it!', 'تلألأت النجمة! أمسكتها!'],
    ['Another star for my treasure!', 'نجمة جديدة لكنزي!'],
    ['Stars make me so happy!', 'النجوم تسعدني كثيرًا!'],
    ['Look how it sparkles!', 'انظري كيف تلمع!'],
  ] },
  allStars: { mood: 'excited', list: [
    ['All the stars! Three stars for us!', 'كل النجوم! ثلاث نجوم لنا!'],
    ['I found every star!', 'وجدتُ كل النجوم!'],
  ] },
  coin: { mood: 'happy', list: [
    ['Ching! Gold!', 'تشينغ! ذهب!'],
    ['More coins!', 'عملات أكثر!'],
    ['Shiny gold!', 'ذهب لامع!'],
    ['Coins, coins, coins!', 'عملات، عملات!'],
  ] },
  power: { mood: 'excited', list: [
    ['Super power! Whee!', 'قوة خارقة! وييي!'],
    ['I feel so strong!', 'أشعر بالقوة!'],
    ['Watch me fly!', 'انظري كيف أطير!'],
  ] },
  hurt: { mood: 'sad', list: [
    ['Ouch! That hurt.', 'آخ! هذا يؤلم.'],
    ['Oh no, my heart!', 'أوه لا، قلبي!'],
    ['Ow ow ow…', 'آي آي آي…'],
    ['Careful… those grumpy dates!', 'انتبهي… حبات التمر الغاضبة!'],
  ] },
  fall: { mood: 'sad', list: [
    ['Whoa… I fell down.', 'أوه… سقطتُ.'],
    ['Oops, let us jump more carefully.', 'أوبس، لنقفز بحذر أكثر.'],
  ] },
  checkpoint: { mood: 'happy', list: [
    ['Checkpoint! Progress saved!', 'نقطة تفتيش! تم الحفظ!'],
    ['Yay, a flag! We are safe here.', 'ياي، علم! نحن بأمان هنا.'],
  ] },
  locked: { mood: 'calm', list: [
    ['The gate is locked. Let us answer the grammar blocks first.', 'البوابة مقفلة. لنجب عن صناديق القواعد أولًا.'],
    ['We need all five purple blocks to open it.', 'نحتاج الصناديق البنفسجية الخمسة لفتحها.'],
  ] },
  start: { mood: 'excited', list: [
    ["Let's go! Adventure time!", 'هيا بنا! وقت المغامرة!'],
    ['Ready, set, jump!', 'استعدي، انطلقي، اقفزي!'],
    ['Oman is waiting for us!', 'عُمان تنتظرنا!'],
    ['I am so excited! Let us learn and play!', 'أنا متحمسة جدًا! لنتعلم ونلعب!'],
  ] },
  tap: { mood: 'happy', list: [
    ["Hi! Let's find the purple blocks!", 'مرحبًا! لنبحث عن الصناديق البنفسجية!'],
    ['Jump on the grumpy dates!', 'اقفزي فوق حبات التمر الغاضبة!'],
    ['Collect every star for three stars!', 'اجمعي كل النجوم لتحصلي على ثلاث نجوم!'],
    ['English is fun!', 'الإنجليزية ممتعة!'],
    ['Hold jump to jump higher!', 'اضغطي القفز مطولًا لقفزة أعلى!'],
    ['Hee hee, that tickles!', 'هههه، هذا يدغدغ!'],
    ['You are my best friend!', 'أنتِ أفضل صديقة لي!'],
    ['Look for the glowing pipes, they hide secrets!', 'ابحثي عن الأنابيب المضيئة، فيها أسرار!'],
  ] },
  finish: { mood: 'excited', list: [
    ['We did it! Stage complete!', 'فعلناها! أكملنا المرحلة!'],
    ['Hooray! On to the next adventure!', 'مرحى! إلى المغامرة التالية!'],
    ['Yes! You are a champion!', 'نعم! أنتِ بطلة!'],
  ] },
  gameover: { mood: 'sad', list: [
    ['Oh no, no more hearts… but we never give up!', 'أوه لا، نفدت القلوب… لكننا لا نستسلم!'],
    ['Aww… let us try again together.', 'آه… لنحاول مجددًا معًا.'],
  ] },
};

const last = {};
/**
 * Pick a line for a situation without repeating the previous one.
 * Returns { en, ar, mood }. `%n` is replaced by n.
 */
export function line(kind, n) {
  const group = LINES[kind];
  const list = group.list;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === last[kind]) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
  last[kind] = i;
  const [en, ar] = list[i].map((s) => s.replace('%n', String(n ?? '')));
  return { en, ar, mood: group.mood };
}

/**
 * Pacing, so encouragement stays special instead of appearing every time:
 * she speaks after roughly one answer in three, and always on streak
 * milestones (5 and 10 in a row).
 */
export const ENCOURAGE_EVERY = 3;
const pace = { since: 0 };
export function encourageNow({ streak = 0 } = {}) {
  pace.since += 1;
  if ([5, 10].includes(streak) || pace.since >= ENCOURAGE_EVERY) { pace.since = 0; return true; }
  return false;
}
export function resetEncouragePace() { pace.since = 0; }

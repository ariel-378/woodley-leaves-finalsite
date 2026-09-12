// ============================================================================
//  CENTERSPREAD CONTENT (The Woodley Leaves) — the centerspread pieces shown
//  on centerspread.html. Editors manage these from the "Centerspread" tab in
//  the editor dashboard; this file is the shipped default (like articles.js).
//
//  Piece types: "poem" (stanzas), "prose" (paragraphs), "image" (a painting or
//  photo). Any piece may carry an optional `reveal: { summary, answer }`.
//  Poem/prose `body`: blank line separates stanzas/paragraphs; single newline
//  separates lines within a stanza.
// ============================================================================
window.WL_CENTERSPREAD = {
  pieces: [
    {
      id: "spring-poem",
      type: "poem",
      kicker: "Poem",
      title: "Spring at Maret",
      byline: "By Poppy Trelawney",
      body:
        "At long last the snow banks from past winter storms\n" +
        "Are melting beneath all the sun rays so warm\n" +
        "After months bundled up in a warm, cozy den\n" +
        "Our favorite mascot emerges again\n" +
        "\n" +
        "Blinking, his green eyes adjust to the light\n" +
        "Part of him misses the long winter's night\n" +
        "But this frog has a duty, for there is a pond\n" +
        "That needs protecting, so he stifles his yawn\n" +
        "\n" +
        "Besides, he thinks, there's no time to be tired\n" +
        "When the front lawn of Woodley remains unadmired\n" +
        "For the grass and the trees are both greener than ever\n" +
        "As an English class reads, enjoying the weather\n" +
        "\n" +
        "He walks around Woodley, where flowers are blooming\n" +
        "As lunch eaters run from the bumble bees looming\n" +
        "Shouts carry up from the turf field below\n" +
        "As friends find lacrosse, base, and soft balls to throw\n" +
        "\n" +
        "The frog knows the best times have not happened yet\n" +
        "For soon will come field day, spring fling, and the fête\n" +
        "Our mascot's green heart beats happily in his chest\n" +
        "For spring at Maret is always just the best",
    },
    {
      id: "guess-who",
      type: "poem",
      kicker: "Guess Who",
      title: "On a rainy April morning…",
      byline: "By Saoirse Boyle",
      body:
        "On a rainy April morning\n" +
        "My cereal was frozen cold,\n" +
        "Shampoo exploded without warning,\n" +
        "Alright, am I really getting trolled?\n" +
        "\n" +
        "It only worsened as the day went on —\n" +
        "I found my stapler in the jell-o,\n" +
        "And mashed potatoes in my lawn.\n" +
        "It just can't be a coincidence, I bellow!\n" +
        "\n" +
        "Then, I was carried by a rainbow horse\n" +
        "To find a message in the pool\n" +
        "It's the first day of — why, of course…",
      reveal: { summary: "Reveal the answer", answer: "I'm the April Fool!" },
    },
    {
      id: "guess-teacher",
      type: "prose",
      kicker: "Guess the Teacher",
      title: "A Day in the Life of a Grade Dean",
      byline: "By Barnaby Quill",
      body:
        "Have you ever wondered how a Maret grade dean goes through a typical Monday? This grade dean starts her morning off bright and early at 6 a.m. She wakes up her children, gets them ready for their day, and walks and feeds her dog, Saint. Then, she makes a crucial stop at Starbucks before dropping her younger daughter off with her carpool and dropping her elder daughter off at school. While this grade dean has many stops on her way to Maret, she makes the miles fly by immersing herself in an audiobook. After beginning her journey at 6:50, she finally arrives at school at 8:10.\n" +
        "\n" +
        "Monday is hectic for this grade dean, as she teaches two classes: Literature of Our Multicentric World and Black Women Writers. She also passes out snacks to hungry students after Convocation — a very important job. But feeding herself is not as easy because she often finds herself splitting her lunch time between many meetings. After lunch, this grade dean meets with Mr. Alvarez to discuss upper school business. Her meeting day is not yet done, however, as she also has an important meeting with our student council representatives. Finally, she ends the school day with an Office of Equity, Inclusion, and Belonging meeting.\n" +
        "\n" +
        "After school, this grade dean picks up her younger daughter from school, goes home, and comes full circle with a walk with her dog. On Monday evenings, she usually goes, reluctantly, to the grocery store, ideally Target, makes dinner, and helps her daughter with homework. By 11 p.m., she ends her day, getting sleep to prepare for her return to Maret on Tuesday! Are you ready to make your guess?",
      reveal: { summary: "Reveal the teacher", answer: "If you guessed the one and only Ms. Delgado, you are correct!" },
    },
    {
      id: "clue-to-the-code",
      type: "image",
      kicker: "Riddle Game",
      title: "Clue to the Code",
      byline: "By Orson Pace",
      image: "media/riddle-2.png",
      alt: "Clue to the Code riddle",
    },
  ],

  // Which interactive puzzles appear below the centerspread pieces. Omit or set true
  // to show; false to hide. Editors toggle these from the Centerspread tab.
  puzzles: {
    crossword: true,
    spellingbee: true,
    connections: false,   // disabled in the original; toggle on from the editor
    wordsearch: true,
  },
};

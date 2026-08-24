/* ============================================================
   Question of the Day — the question bank.

   A flat, ordered list of silly two-way questions for the
   /question-of-the-day/ tool. Roughly 60% absurd "would you rather"
   dilemmas, 25% silly debates with two defensible sides, 15% harmless
   preference splits. Every entry is a genuine two-way choice; `a` and `b`
   are short button labels, not sentences.

   ORDER IN THIS FILE DOES NOT MATTER. Each instance stores its own shuffled
   array of indexes into this bank (seeded per instance), and today's question
   is order[ daysSince(createdDate) % order.length ]. Two teams created on the
   same day therefore see completely different sequences, and nothing ever has
   to be advanced by a cron job or by the organiser. Because instances hold
   indexes into this array, only APPEND — never reorder or delete entries, or
   every live instance's sequence shifts underneath it.

   SAFETY RULES for anything added here. This gets shared with whole offices,
   including people who never opted in, so every question must be
   workplace-safe and inclusive. Nothing involving: sex or romance; alcohol or
   drugs; religion; politics; money or salary; appearance, body size or health;
   death or injury of real people; anything targeting a nationality, gender,
   age or group; and nothing that pressures a personal disclosure. Also avoid
   the quietly divisive office questions (home vs office, reply-all etiquette)
   — they start arguments instead of breaking the ice. Absurd and silly is the
   entire point; keep it there.

   Limits the tool relies on: text <= 140 chars, a and b <= 60 chars each, no
   duplicate text. Australian flavour appears in a handful of entries, but
   every question still makes sense to a reader who has never been here.
   ============================================================ */

export const QUESTIONS = [
  // 1-10
  { text: "Would you rather sneeze glitter or hiccup bubbles?", a: "Sneeze glitter", b: "Hiccup bubbles" },
  { text: "Pineapple on pizza?", a: "Yes please", b: "No thanks" },
  { text: "Would you rather live in outer space or under the sea?", a: "Outer space", b: "Under the sea" },
  { text: "If a turtle loses its shell, is it naked or homeless?", a: "Naked", b: "Homeless" },
  { text: "Would you rather have a laugh that sounds like a car horn or a goat?", a: "Car horn", b: "Goat" },
  { text: "Is a hot dog a sandwich?", a: "Sandwich", b: "Not a sandwich" },
  { text: "Would you rather have a pet dinosaur the size of a cat or a pet cat the size of a dinosaur?", a: "Tiny dinosaur", b: "Giant cat" },
  { text: "Tea or coffee?", a: "Tea", b: "Coffee" },
  { text: "Would you rather be able to talk to animals or make any plant grow instantly?", a: "Talk to animals", b: "Grow plants" },
  { text: "Is a straw one hole or two holes?", a: "One hole", b: "Two holes" },

  // 11-20
  { text: "Would you rather be able to fly slowly or run very fast?", a: "Fly slowly", b: "Run fast" },
  { text: "Is cereal a soup?", a: "Soup", b: "Not soup" },
  { text: "Would you rather taste colours or see sounds?", a: "Taste colours", b: "See sounds" },
  { text: "Toilet roll: over or under?", a: "Over", b: "Under" },
  { text: "Would you rather be able to breathe underwater or walk through walls?", a: "Breathe underwater", b: "Walk through walls" },
  { text: "Is a tomato a fruit or a vegetable?", a: "Fruit", b: "Vegetable" },
  { text: "Would you rather have a spotlight that follows you or a red carpet that unrolls ahead of you?", a: "Spotlight", b: "Red carpet" },
  { text: "Crunchy or smooth peanut butter?", a: "Crunchy", b: "Smooth" },
  { text: "Would you rather be chased by one horse-sized duck or a hundred duck-sized horses?", a: "One giant duck", b: "A hundred tiny horses" },
  { text: "Is water wet?", a: "Wet", b: "Not wet" },

  // 21-30
  { text: "Would you rather have hands for feet or feet for hands?", a: "Hands for feet", b: "Feet for hands" },
  { text: "Is it a potato scallop or a potato cake?", a: "Potato scallop", b: "Potato cake" },
  { text: "Would you rather live in a treehouse or a lighthouse?", a: "Treehouse", b: "Lighthouse" },
  { text: "Cats or dogs?", a: "Cats", b: "Dogs" },
  { text: "Would you rather have a rewind button or a pause button for your day?", a: "Rewind", b: "Pause" },
  { text: "Is a chair with only one leg still a chair?", a: "Still a chair", b: "Not a chair" },
  { text: "Would you rather always speak in rhyme or always whisper?", a: "Always rhyme", b: "Always whisper" },
  { text: "Window seat or aisle seat?", a: "Window", b: "Aisle" },
  { text: "Would you rather ride a giant snail everywhere or a very small horse?", a: "Giant snail", b: "Very small horse" },
  { text: "Do fish get thirsty?", a: "Definitely", b: "Definitely not" },

  // 31-40
  { text: "Would you rather everything you touch turns to jelly or everything you eat tastes like toast?", a: "Jelly touch", b: "Toast taste" },
  { text: "Is a sausage roll a type of pie?", a: "It is a pie", b: "Not a pie" },
  { text: "Would you rather have a nose that glows when you fib or ears that flap when you are excited?", a: "Glowing nose", b: "Flapping ears" },
  { text: "Milk chocolate or dark chocolate?", a: "Milk", b: "Dark" },
  { text: "Would you rather have a robot butler that judges you or a parrot that repeats your thoughts?", a: "Judgy robot", b: "Blabbing parrot" },
  { text: "Milk first or cereal first?", a: "Milk first", b: "Cereal first" },
  { text: "Would you rather have endless free ice cream or endless free flights?", a: "Endless ice cream", b: "Endless flights" },
  { text: "Does the week start on Monday or Sunday?", a: "Monday", b: "Sunday" },
  { text: "Would you rather have a dragon or be a dragon?", a: "Have a dragon", b: "Be a dragon" },
  { text: "Sweet or savoury breakfast?", a: "Sweet", b: "Savoury" },

  // 41-50
  { text: "Would you rather your shadow acted on its own or your reflection waved back a second late?", a: "Rogue shadow", b: "Late reflection" },
  { text: "Is the letter H said aitch or haitch?", a: "Aitch", b: "Haitch" },
  { text: "Would you rather spend one day as a bird or one day as a fish?", a: "A bird", b: "A fish" },
  { text: "Would you rather visit the past for a day or the future for a day?", a: "The past", b: "The future" },
  { text: "Would you rather hop everywhere like a kangaroo or waddle everywhere like a penguin?", a: "Hop", b: "Waddle" },
  { text: "Is the ibis a bin chicken or a magnificent bird?", a: "Bin chicken", b: "Magnificent bird" },
  { text: "Would you rather have permanently squeaky shoes or a shoelace that never stays tied?", a: "Squeaky shoes", b: "Untied lace" },
  { text: "Books: paper or screen?", a: "Paper", b: "Screen" },
  { text: "Would you rather be the best in the world at something useless or pretty good at everything?", a: "Best at something useless", b: "Pretty good at everything" },
  { text: "Is a puddle just a very small lake?", a: "A small lake", b: "Just a puddle" },

  // 51-60
  { text: "Would you rather remember every dream you have or never dream again?", a: "Remember every dream", b: "Never dream" },
  { text: "Fitted sheet: folded or rolled?", a: "Folded", b: "Rolled" },
  { text: "Would you rather everything you write appear in Comic Sans or everything you type be in capitals?", a: "Comic Sans", b: "ALL CAPS" },
  { text: "Is a smoothie a drink or a meal?", a: "A drink", b: "A meal" },
  { text: "Would you rather live in a world with no stairs or no doors?", a: "No stairs", b: "No doors" },
  { text: "Hot chips: tomato sauce or gravy?", a: "Tomato sauce", b: "Gravy" },
  { text: "Would you rather have a garden that grows spaghetti or a tap that pours lemonade?", a: "Spaghetti garden", b: "Lemonade tap" },
  { text: "Is W a double U or a double V?", a: "Double U", b: "Double V" },
  { text: "Would you rather speak every language or play every instrument?", a: "Every language", b: "Every instrument" },
  { text: "Vegemite on toast: thin scrape or thick spread?", a: "Thin scrape", b: "Thick spread" },

  // 61-70
  { text: "Would you rather have a chair that follows you or a table that appears whenever you need one?", a: "Following chair", b: "Instant table" },
  { text: "Are penguins birds that gave up flying or fish that got ambitious?", a: "Birds that gave up", b: "Ambitious fish" },
  { text: "Would you rather your pet could text you or your plants could text you?", a: "Texting pet", b: "Texting plants" },
  { text: "Would you rather have a tiny door in your wall that opens onto a library or a garden?", a: "Library", b: "Garden" },
  { text: "Would you rather sleep standing up like a horse or upside down like a bat?", a: "Standing up", b: "Upside down" },
  { text: "Is a hallway a room?", a: "A room", b: "Not a room" },
  { text: "Would you rather wear a cape everywhere or a top hat everywhere?", a: "Cape", b: "Top hat" },
  { text: "Would you rather have a fridge that restocks itself or a washing basket that empties itself?", a: "Self-stocking fridge", b: "Self-emptying basket" },
  { text: "Would you rather cartwheel into every room or moonwalk out of every room?", a: "Cartwheel in", b: "Moonwalk out" },
  { text: "Is a raisin a grape that gave up or a grape that levelled up?", a: "Gave up", b: "Levelled up" },

  // 71-80
  { text: "Would you rather have a phone that only works in the shower or only works up a tree?", a: "In the shower", b: "Up a tree" },
  { text: "Is a jaffle a toastie or its own thing entirely?", a: "A toastie", b: "Its own thing" },
  { text: "Would you rather shrink to the size of a mouse or grow to the size of a giraffe once a day?", a: "Mouse-sized", b: "Giraffe-sized" },
  { text: "Pizza: thin crust or thick crust?", a: "Thin crust", b: "Thick crust" },
  { text: "Would you rather have a car that runs on compliments or a bike that pedals itself?", a: "Compliment car", b: "Self-pedalling bike" },
  { text: "Is a snowman a sculpture?", a: "A sculpture", b: "Not a sculpture" },
  { text: "Would you rather live in a house made of biscuits or a house made of bubble wrap?", a: "Biscuit house", b: "Bubble wrap house" },
  { text: "Would you rather every book you open be a surprise or every film you watch be a surprise?", a: "Surprise books", b: "Surprise films" },
  { text: "Would you rather every meal be breakfast food or every meal be dessert?", a: "Breakfast forever", b: "Dessert forever" },
  { text: "Is silence a sound?", a: "A sound", b: "Not a sound" },

  // 81-90
  { text: "Would you rather be famous for a terrible dance or a magnificent sneeze?", a: "Terrible dance", b: "Magnificent sneeze" },
  { text: "Would you rather live somewhere it never rains or somewhere it rains gently every night?", a: "Never rains", b: "Rains every night" },
  { text: "Would you rather have shoes that never get wet or a jacket that is always the right warmth?", a: "Dry shoes", b: "Perfect jacket" },
  { text: "Is a piano a percussion instrument or a string instrument?", a: "Percussion", b: "String" },
  { text: "Would you rather control the weather in one room or the temperature of any drink?", a: "Room weather", b: "Drink temperature" },
  { text: "Popcorn: sweet or salty?", a: "Sweet", b: "Salty" },
  { text: "Would you rather have a sloth chauffeur or a cheetah courier?", a: "Sloth chauffeur", b: "Cheetah courier" },
  { text: "Would you rather have a llama as a housemate or an emu as a co-pilot?", a: "Llama housemate", b: "Emu co-pilot" },
  { text: "Would you rather be able to make one object float forever or make one object invisible?", a: "Make it float", b: "Make it invisible" },
  { text: "Tim Tam Slam: with tea or with hot chocolate?", a: "Tea", b: "Hot chocolate" },

  // 91-100
  { text: "Would you rather live inside a video game or inside a cartoon?", a: "Video game", b: "Cartoon" },
  { text: "Is a beach still a beach without sand?", a: "Still a beach", b: "Not a beach" },
  { text: "Would you rather have a pocket-sized helicopter or a foldable canoe?", a: "Pocket helicopter", b: "Foldable canoe" },
  { text: "Pancakes or waffles?", a: "Pancakes", b: "Waffles" },
  { text: "Would you rather every animal you meet be mildly suspicious of you or mildly obsessed with you?", a: "Suspicious", b: "Obsessed" },
  { text: "Is a hot air balloon an aircraft or a vibe?", a: "An aircraft", b: "A vibe" },
  { text: "Would you rather wear flippers all day or oven mitts all day?", a: "Flippers", b: "Oven mitts" },
  { text: "Roller coaster: front seat or back seat?", a: "Front seat", b: "Back seat" },
  { text: "Would you rather have a lifetime supply of socks or a lifetime supply of umbrellas?", a: "Socks", b: "Umbrellas" },
  { text: "In a band name, is 'The' part of the name?", a: "Part of it", b: "Not part of it" },

  // 101-110
  { text: "Would you rather teleport only to places you have been or fly 30 cm above the ground?", a: "Limited teleport", b: "Low flying" },
  { text: "Sauce on a meat pie: essential or optional?", a: "Essential", b: "Optional" },
  { text: "Would you rather always be ten minutes early or never wait in a queue again?", a: "Always early", b: "Never queue" },
  { text: "Would you rather instantly assemble any flat-pack furniture or instantly wrap any present?", a: "Flat-pack master", b: "Perfect wrapping" },
  { text: "Would you rather have all your food served in a cone or all your drinks served in a bowl?", a: "Food in a cone", b: "Drinks in a bowl" },
  { text: "Does pressing a lift button twice make it arrive faster?", a: "Definitely faster", b: "No difference" },
  { text: "Would you rather have a boomerang that comes back to someone else or a frisbee that hovers?", a: "Wrong-way boomerang", b: "Hovering frisbee" },
  { text: "Would you rather have a mirror that hypes you up or a doormat that greets your guests?", a: "Hyping mirror", b: "Chatty doormat" },
  { text: "Would you rather be followed everywhere by a marching band or a completely silent mime?", a: "Marching band", b: "Silent mime" },
  { text: "Is a hedge a wall made of plant or a plant pretending to be a wall?", a: "A wall", b: "A plant" },

  // 111-120
  { text: "Would you rather have a tail you can control or wings that do not quite work?", a: "Working tail", b: "Useless wings" },
  { text: "Weekend mornings: sleep in or up early?", a: "Sleep in", b: "Up early" },
  { text: "Would you rather have a shower that sings back or a fridge that applauds your choices?", a: "Singing shower", b: "Applauding fridge" },
  { text: "Would you rather have a garden gnome that moves at night or a scarecrow that waves at you?", a: "Moving gnome", b: "Waving scarecrow" },
  { text: "Would you rather talk to trees or understand exactly what babies mean?", a: "Talk to trees", b: "Understand babies" },
  { text: "Fairy bread: sprinkles edge to edge or a bit sparse?", a: "Edge to edge", b: "A bit sparse" },
  { text: "Would you rather every photo of you be blurry or every photo be taken mid-blink?", a: "Blurry", b: "Mid-blink" },
  { text: "Is a shopping trolley with a wobbly wheel cursed or just tired?", a: "Cursed", b: "Just tired" },
  { text: "Would you rather be able to summon rain or summon a rainbow?", a: "Summon rain", b: "Summon a rainbow" },
  { text: "Beach footwear: thongs or flip-flops?", a: "Thongs", b: "Flip-flops" },

  // 121-130
  { text: "Would you rather be a professional whistler or a professional bubble wrap popper?", a: "Whistler", b: "Bubble wrap popper" },
  { text: "Chocolate bar: break it into squares or bite straight in?", a: "Squares", b: "Bite straight in" },
  { text: "Would you rather it rained marshmallows once a year or snowed confetti once a month?", a: "Marshmallow rain", b: "Confetti snow" },
  { text: "Would you rather have an office chair that spins forever or a desk that lifts you to the ceiling?", a: "Endless spin", b: "Ceiling desk" },
  { text: "Would you rather have a doorbell that plays your favourite song or a phone that crows like a rooster?", a: "Song doorbell", b: "Rooster ringtone" },
  { text: "Do you say the alphabet or sing it?", a: "Say it", b: "Sing it" },
  { text: "Would you rather commute by zip line or by pogo stick?", a: "Zip line", b: "Pogo stick" },
  { text: "Would you rather have a pen that writes in any colour you think of or paper that never runs out?", a: "Magic pen", b: "Endless paper" },
  { text: "Would you rather have perfect handwriting forever or perfect parking forever?", a: "Perfect handwriting", b: "Perfect parking" },
  { text: "How good is the weekend: is Friday arvo or Saturday morning the best bit?", a: "Friday arvo", b: "Saturday morning" },

  // 131-140
  { text: "Would you rather have a backpack that never feels heavy or a bottle always full of cold water?", a: "Weightless backpack", b: "Endless cold water" },
  { text: "Is an egg breakfast food or anytime food?", a: "Breakfast only", b: "Anytime" },
  { text: "Would you rather be able to nap comfortably anywhere or never need a nap again?", a: "Nap anywhere", b: "Never need naps" },
  { text: "Would you rather always know the lyrics or always know the dance moves?", a: "The lyrics", b: "The dance moves" },
  { text: "Would you rather know the name of every star or every biscuit in the biscuit aisle?", a: "Every star", b: "Every biscuit" },
  { text: "Is a doughnut a cake or a bread?", a: "Cake", b: "Bread" },
  { text: "Would you rather be able to mute one sound forever or turn one sound up forever?", a: "Mute a sound", b: "Turn one up" },
  { text: "Always autumn or always spring?", a: "Autumn", b: "Spring" },
  { text: "Would you rather always know the time without a clock or always know which way is north?", a: "Know the time", b: "Know north" },
  { text: "Would you rather high five someone from across the room or fist bump straight through a wall?", a: "Long-range high five", b: "Through-wall fist bump" },

  // 141-150
  { text: "Would you rather your thoughts be narrated by a nature documentary host or a sports commentator?", a: "Nature host", b: "Sports commentator" },
  { text: "Would you rather have a pet rock that rolls after you or a small cloud that rains on request?", a: "Pet rock", b: "Pet cloud" },
  { text: "Would you rather have a slide instead of stairs or a rope ladder instead of a lift?", a: "Slide", b: "Rope ladder" },
  { text: "Long weekend: go somewhere or stay home doing nothing?", a: "Go somewhere", b: "Stay home" },
  { text: "Would you rather everything smelled faintly of popcorn or faintly of fresh laundry?", a: "Popcorn", b: "Fresh laundry" },
  { text: "Would you rather sing every phone greeting or dance every goodbye?", a: "Sing hello", b: "Dance goodbye" },
  { text: "Would you rather have a trampoline that follows you or a hammock that appears on command?", a: "Following trampoline", b: "Instant hammock" },
  { text: "Is a rubber duck a toy or a colleague?", a: "A toy", b: "A colleague" },
  { text: "Would you rather own a lamp that grants terrible wishes or a map that shows where you left things?", a: "Terrible wish lamp", b: "Lost things map" },
  { text: "Would you rather have socks that always match or cables that never tangle?", a: "Matching socks", b: "Tangle-free cables" },

  // 151-160
  { text: "Would you rather have shoes that bounce or gloves that stick to anything?", a: "Bouncy shoes", b: "Sticky gloves" },
  { text: "Is the magpie warble the best bird sound going or wildly overrated?", a: "Best sound going", b: "Wildly overrated" },
  { text: "Would you rather always find your keys or always find the end of the sticky tape?", a: "Find your keys", b: "Find the tape end" },
  { text: "Perfect Saturday: beach or bush?", a: "Beach", b: "Bush" },
  { text: "Would you rather swim like a dolphin or climb like a gecko?", a: "Swim like a dolphin", b: "Climb like a gecko" },
  { text: "Lasagne: middle piece or corner piece?", a: "Middle piece", b: "Corner piece" },
  { text: "Would you rather have a tiny orchestra living in your bag or a tiny bakery in your desk drawer?", a: "Tiny orchestra", b: "Tiny bakery" },
  { text: "Would you rather be able to change the colour of anything by touching it or change how it feels?", a: "Change colour", b: "Change texture" },
  { text: "Would you rather always get the good shopping trolley or always find a park right out the front?", a: "Good trolley", b: "Perfect park" },
  { text: "Would you rather ride an escalator that never ends or a lift that travels sideways?", a: "Endless escalator", b: "Sideways lift" },
];

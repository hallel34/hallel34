import type { GameConfig } from './types';

const demoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#87CEEB"/><circle cx="340" cy="50" r="28" fill="#FFD93D"/><path d="M40 160 A160 160 0 0 1 360 160" fill="none" stroke="#E4572E" stroke-width="10"/><path d="M55 160 A145 145 0 0 1 345 160" fill="none" stroke="#F2A007" stroke-width="10"/><path d="M70 160 A130 130 0 0 1 330 160" fill="none" stroke="#5B8C5A" stroke-width="10"/><rect y="220" width="400" height="80" fill="#7CB668"/><rect x="150" y="150" width="100" height="75" fill="#FFF6E9"/><polygon points="140,150 200,105 260,150" fill="#E4572E"/><rect x="188" y="185" width="24" height="40" fill="#8B5E34"/><rect x="60" y="165" width="14" height="60" fill="#8B5E34"/><circle cx="67" cy="150" r="32" fill="#5B8C5A"/><g stroke="#33231A" stroke-width="4" stroke-linecap="round"><circle cx="300" cy="215" r="10" fill="#FFD9B3"/><line x1="300" y1="225" x2="300" y2="255"/><line x1="300" y1="235" x2="285" y2="245"/><line x1="300" y1="235" x2="315" y2="245"/><line x1="300" y1="255" x2="290" y2="280"/><line x1="300" y1="255" x2="310" y2="280"/><circle cx="325" cy="222" r="8" fill="#FFD9B3"/><line x1="325" y1="230" x2="325" y2="252"/><line x1="325" y1="252" x2="317" y2="278"/><line x1="325" y1="252" x2="333" y2="278"/></g></svg>`;

export const DEMO_PHOTO_URL = `data:image/svg+xml;utf8,${encodeURIComponent(demoSvg)}`;

export const DEMO_CONFIG: GameConfig = {
  celebrantName: 'נועה (דוגמה)',
  showAnswers: true,
  stageOrder: ['life-order', 'photo-puzzle', 'family-tree', 'flashlight-objects', 'values-card'],
  world: {
    goal: 'המתנה של נועה נעולה בכספת בחדר ההורים! 🔐 שוטטו בבית, פתרו את חמש החידות, מצאו את מפתח הזהב ואת פתק הקוד — ופתחו את הכספת.',
    items: {
      'brass-key': { label: 'מפתח זהב', emoji: '🗝️' },
      'code-note': { label: 'פתק עם קוד', emoji: '📝' },
    },
    placements: {
      // The race plays on the living-room TV; winning it earns the gold key.
      'life-order': { room: 'living', hotspot: 'tv', mode: 'overlay', givesItem: 'brass-key' },
      'photo-puzzle': { room: 'bedroom1', hotspot: 'desk', mode: 'overlay' },
      'family-tree': {
        room: 'hallway', hotspot: 'picture', mode: 'inroom',
        inRoom: {
          kind: 'riddle',
          prompt: 'מאחורי תמונת המשפחה במסדרון מסתתרת חידה: "יש לי שורשים וענפים אבל אין לי עלים — ובמשפחה של נועה, מי נמצא בדור הוותיק ביותר?"',
          options: ['הסבים והסבתות', 'האח הקטן יונתן', 'הכלבה לונה', 'השכנים ממול'],
          correctIndex: 0,
          successText: 'נכון! הסבים והסבתות הם השורשים של עץ המשפחה — והמסדרון נפתח להמשך.',
        },
      },
      'flashlight-objects': { room: 'bedroom1', hotspot: 'wardrobe', mode: 'overlay' },
      'values-card': {
        room: 'living', hotspot: 'bookshelf', mode: 'inroom',
        inRoom: {
          kind: 'code',
          prompt: 'על מדף הספרייה עומדת קופסת עץ ישנה, נעולה במנעול קוד בן 3 ספרות. את הקוד תמצאו על פתק שמסתתר איפשהו בבית…',
          code: '412',
          successText: 'הקופסה נפתחה! בפנים נמצא מכתב מנועה: "הערך שלי הוא שליחות — לעשות טוב בעולם".',
        },
      },
    },
    pickups: [
      {
        id: 'fridge-note', room: 'kitchen', hotspot: 'fridge', itemId: 'code-note',
        foundText: 'על המקרר, מתחת למגנט בצורת לב, מסתתר פתק: "הקוד לקופסת העץ בספרייה: 412"',
      },
    ],
    finalTarget: { room: 'bedroom2', hotspot: 'safe', label: 'הכספת עם המתנה', requiresItem: 'brass-key', requiresAllStages: true },
  },
  contents: {
    'life-order': {
      instructions: 'סדרו את התחנות בחייה של נועה מהמוקדמת למאוחרת ביותר!',
      hints: ['התחילו מהלידה — זו תמיד התחנה הראשונה.', 'הגן מגיע לפני בית הספר, ובת המצווה היא האחרונה.'],
      answerText: 'נועה נולדה, הלכה לגן, עלתה לכיתה א׳, אימצה כלב, הצטרפה לתנועת נוער — ועכשיו חוגגת בת מצווה!',
      stations: [
        { label: 'נועה נולדה 👶', emoji: '👶' },
        { label: 'יום ראשון בגן', emoji: '🎒' },
        { label: 'עלייה לכיתה א׳', emoji: '✏️' },
        { label: 'אימצנו את הכלבה לונה', emoji: '🐶' },
        { label: 'הצטרפות לתנועת הנוער', emoji: '🏕️' },
        { label: 'בת מצווה!', emoji: '🎉' },
      ],
    },
    'mirror-text': {
      instructions: 'הטקסט במראה הפוך! קראו אותו ומצאו את התכונות שהמורה כתבה על נועה.',
      hints: ['קראו מילה־מילה, מהסוף להתחלה.', 'חפשו שלוש מילים שמתארות אופי, לא מעשים.'],
      answerText: 'המורה חדווה כתבה שנועה נדיבה, סקרנית ומנהיגה טבעית.',
      sourceTitle: 'המורה חדווה, כיתה ד׳',
      cardText: 'נועה היא תלמידה נדיבה שתמיד חולקת עם חברותיה, סקרנית ושואלת שאלות חכמות, ומנהיגה שכולן הולכות אחריה בשמחה.',
      question: 'אילו שלוש תכונות המורה ציינה על נועה?',
      keywords: ['נדיבה', 'סקרנית', 'מנהיגה'],
    },
    'photo-puzzle': {
      instructions: 'התמונה חתוכה לחתיכות! הרכיבו אותה וגלו מה מסתתר בה.',
      hints: ['התחילו מהפינות — השמש והקשת הכי קלות לזיהוי.', 'הבית נמצא במרכז התמונה.'],
      answerText: 'בתמונה רואים את הבית של משפחתה של נועה, עם קשת בענן וכל המשפחה בחצר.',
      imageUrl: DEMO_PHOTO_URL,
      caption: 'הבית של נועה ביום שמש עם קשת',
      targetColor: '#E4572E',
      targetColorName: 'כתום',
    },
    'target-shooting': {
      instructions: 'פגעו רק במטרות שהן שאיפות אמיתיות של נועה!',
      hints: ['נועה חולמת לעזור לאנשים ולבעלי חיים.', 'היא אוהבת מדע ורפואה מאז שהייתה קטנה.'],
      answerText: 'נועה חולמת להיות רופאה, להקים מקלט לכלבים ולטייל בעולם.',
      question: 'מה נועה רוצה להיות ולעשות כשתגדל?',
      correct: ['להיות רופאה', 'מקלט לכלבים', 'לטייל בעולם'],
      wrong: ['להיות מפורסמת בטיקטוק', 'לזכות בלוטו', 'לאכול רק ממתקים', 'לישון כל היום'],
    },
    'family-tree': {
      instructions: 'מאחורי תמונת המשפחה במסדרון מסתתרת חידת עץ משפחה — ענו עליה נכון.',
      hints: ['חשבו על עץ אמיתי: מי הם ה"שורשים" של המשפחה?', 'הדור הוותיק ביותר הוא גם הדור הראשון של המשפחה.'],
      answerText: 'משפחתה של נועה: סבא וסבתא משני הצדדים, אבא ואמא, נועה ואחיה הקטן יונתן.',
      slots: [
        { id: 'gf1', role: 'סבא מצד אבא', name: 'סבא אברהם', gen: 0 },
        { id: 'gm1', role: 'סבתא מצד אבא', name: 'סבתא שרה', gen: 0 },
        { id: 'gf2', role: 'סבא מצד אמא', name: 'סבא יצחק', gen: 0 },
        { id: 'gm2', role: 'סבתא מצד אמא', name: 'סבתא רותי', gen: 0 },
        { id: 'dad', role: 'אבא', name: 'אבא דוד', gen: 1 },
        { id: 'mom', role: 'אמא', name: 'אמא מיכל', gen: 1 },
        { id: 'noa', role: 'כלת בת המצווה', name: 'נועה', gen: 2 },
        { id: 'bro', role: 'אח קטן', name: 'יונתן', gen: 2 },
      ],
      decoys: ['דודה חנה', 'השכן אבי'],
    },
    'events-calendar': {
      instructions: 'אילו אירועים באמת קרו בחייה של נועה? בחרו רק את האמיתיים!',
      hints: ['נועה באמת שברה יד בכיתה ג׳ בנפילה מאופניים.', 'היא מעולם לא הייתה בחו״ל עם המשפחה — זה עוד חלום.'],
      answerText: 'האירועים האמיתיים: שברה יד בכיתה ג׳, זכתה בתחרות ציור, למדה לרכוב על אופניים ואימצה כלבה.',
      trueEvents: ['שברה יד בכיתה ג׳', 'זכתה בתחרות ציור עירונית', 'למדה לרכוב על אופניים בלי גלגלי עזר', 'אימצה את הכלבה לונה'],
      decoyEvents: ['טסה עם המשפחה ללונדון', 'הופיעה בטלוויזיה', 'זכתה באליפות שחמט', 'פגשה את ראש הממשלה'],
    },
    'hobbies-runner': {
      instructions: 'רוצו עם נועה ואספו רק את התחביבים האמיתיים שלה!',
      hints: ['נועה מנגנת ומציירת כבר שנים.', 'היא לא אוהבת כדורגל — זה התחביב של אחיה.'],
      answerText: 'התחביבים של נועה: נגינה בפסנתר, ציור, קריאת ספרים ושחייה.',
      correct: [
        { label: 'פסנתר', emoji: '🎹' },
        { label: 'ציור', emoji: '🎨' },
        { label: 'קריאה', emoji: '📚' },
        { label: 'שחייה', emoji: '🏊' },
      ],
      wrong: [
        { label: 'כדורגל', emoji: '⚽' },
        { label: 'משחקי מחשב', emoji: '🎮' },
        { label: 'איסוף בולים', emoji: '📮' },
        { label: 'סקייטבורד', emoji: '🛹' },
      ],
    },
    'flashlight-objects': {
      instructions: 'החדר חשוך! האירו בפנס ומצאו את שני החפצים ששייכים לנועה.',
      hints: ['חפשו משהו שקשור למוזיקה ומשהו שקשור לציור.', 'החפצים של נועה מסתתרים ליד הקצוות.'],
      answerText: 'החפצים של נועה בחדר: תווי הנגינה שלה וקופסת הצבעים האהובה.',
      correct: [
        { label: 'דף תווים', emoji: '🎼' },
        { label: 'קופסת צבעים', emoji: '🖍️' },
      ],
      decoys: [
        { label: 'כדורגל', emoji: '⚽' },
        { label: 'קסדת אופניים', emoji: '⛑️' },
        { label: 'בקר משחק', emoji: '🎮' },
        { label: 'מפתח ברגים', emoji: '🔧' },
        { label: 'כובע שף', emoji: '👨‍🍳' },
        { label: 'טלסקופ', emoji: '🔭' },
      ],
    },
    'inspiration-message': {
      instructions: 'הקשיבו לסיפור של סבתא רותי וענו על השאלה בסופו.',
      hints: ['המשפט מסתתר ממש באמצע הסיפור.', 'סבתא מדברת על לתת בלי לצפות לתמורה.'],
      answerText: 'המשפט של סבתא רותי: ״טוב לב אחד קטן משנה עולם שלם״ — וזה המוטו של נועה.',
      storyText: 'כשהייתי ילדה קטנה, אמא שלי הייתה אומרת לי בכל בוקר לפני בית הספר: ״טוב לב אחד קטן משנה עולם שלם״. פעם אחת נתתי את הסנדוויץ׳ שלי לילדה שלא הביאה אוכל, ובאותו יום היא הפכה לחברה הכי טובה שלי לכל החיים. נועה שלי, תזכרי תמיד — לא צריך להיות גדולה כדי לשנות, צריך רק לב פתוח.',
      question: 'מהו המשפט שסבתא רותי חזרה עליו בכל בוקר?',
      options: ['טוב לב אחד קטן משנה עולם שלם', 'מי שממהר — מגיע ראשון', 'כסף קונה הכול בחיים', 'כל אחד לעצמו'],
      correctIndex: 0,
      speakerName: 'סבתא רותי',
    },
    'compass-facts': {
      instructions: 'המצפן מתבלבל! רק שניים מהמספרים נכונים — מצאו אותם.',
      hints: ['נועה בת 12 — חשבו אילו מספרים קשורים לגיל ולמשפחה.', 'יש לה אח אחד בלבד, לא שלושה.'],
      answerText: 'העובדות הנכונות: לנועה יש 1 אח, והיא קראה 42 ספרים השנה!',
      facts: [
        { text: 'מספר האחים של נועה', number: 1, isTrue: true , bearing: 30 },
        { text: 'ספרים שנועה קראה השנה', number: 42, isTrue: true , bearing: 80 },
        { text: 'שנים שנועה מנגנת בפסנתר', number: 9, isTrue: false , bearing: 140 },
        { text: 'כלבים שיש למשפחה', number: 4, isTrue: false , bearing: 200 },
        { text: 'שפות שנועה מדברת', number: 5, isTrue: false , bearing: 260 },
        { text: 'מדינות שנועה ביקרה בהן', number: 7, isTrue: false , bearing: 320 },
      ],
    },
    'values-card': {
      instructions: 'קופסת העץ בספרייה נעולה בקוד — מצאו את הפתק עם הקוד ופתחו אותה.',
      hints: ['הקוד מסתתר על פתק במטבח — חפשו טוב על המקרר.', 'הספרות הן 4, 1, 2 — בדיוק בסדר הזה.'],
      answerText: 'הערך של נועה הוא שליחות — היא מאמינה שלכל אחת יש תפקיד לעשות טוב בעולם.',
      storyText: 'נועה מאמינה שכל אחת מאיתנו הגיעה לעולם עם שליחות קטנה משלה. היא אוספת צעצועים לילדים בבית החולים, עוזרת לשכנה המבוגרת עם הקניות, ומאמינה שטוב קטן שעושים היום גדל והופך לטוב גדול מחר.',
      answerWord: 'שליחות',
      cards: [
        { statement: 'לכל אחת יש שליחות — תפקיד לעשות טוב בעולם', isCorrect: true },
        { statement: 'הכי חשוב להיות הכי מפורסמת בכיתה', isCorrect: false },
        { statement: 'צריך לשמור הכול לעצמי ולא לחלוק', isCorrect: false },
        { statement: 'מנצח רק מי שמגיע ראשון', isCorrect: false },
      ],
    },
  },
};

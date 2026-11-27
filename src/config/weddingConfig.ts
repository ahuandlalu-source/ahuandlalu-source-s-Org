import type {WeddingConfig} from '../types/wedding';

/**
 * CENTRALIZED WEDDING CONTENT CONFIGURATION
 * -----------------------------------------------------------------------
 * Serves as the initial seed for the CMS database/store and fallback defaults.
 */
export const weddingConfig: WeddingConfig = {
  meta: {
    isPlaceholderData: false,
    placeholderNotice: {
      en: 'Wedding Invitation',
      ml: 'വിവാഹ ക്ഷണക്കത്ത്',
    },
  },
  invitation: {
    phrase: {
      en: 'With the blessings of our elders and families, we invite you to celebrate the beginning of our forever.',
      ml: 'മുതിർന്നവരുടെയും കുടുംബാംഗങ്ങളുടെയും അനുഗ്രഹങ്ങളോടെ, ഞങ്ങളുടെ പുതിയ ജീവിതയാത്രയിലേക്ക് ഏവരെയും സ്നേഹപൂർവ്വം ക്ഷണിക്കുന്നു.',
    },
    blessing: {
      en: 'Om Shri Ganeshaya Namah',
      ml: 'ശ്രീ ഗുരുവായൂരപ്പൻ ശരണം',
    },
    openButtonLabel: {
      en: 'Open Invitation',
      ml: 'ക്ഷണക്കത്ത് തുറക്കുക',
    },
  },
  hero: {
    invitationMessage: {
      en: 'Together with our families, we joyfully invite your presence and blessings as we unite in sacred matrimony.',
      ml: 'ഞങ്ങളുടെ കുടുംബാംഗങ്ങളോടൊപ്പം ചേർന്ന്, ഈ മംഗള മുഹൂർത്തത്തിൽ നിങ്ങളുടെ സാന്നിധ്യവും അനുഗ്രഹവും തേടുന്നു.',
    },
    backgroundVideoUrl: null,
    fallbackImageUrl: '/src/assets/images/hero_kerala_mandapam_1795792257391.jpg',
    fallbackImageAlt: {
      en: 'Traditional Kerala Hindu wedding mandapam lit with brass nilavilakku lamps and white jasmine garlands',
      ml: 'നിലവിളക്കുകളും മുല്ലപ്പൂമാലകളും കൊണ്ട് അലങ്കരിച്ച പരമ്പരാഗത കേരളീയ വിവാഹ മണ്ഡപം',
    },
    additionalInfo: {
      en: 'Traditional Kerala attire (Kasavu saree / Mundu) warmly welcomed.',
      ml: 'പരമ്പരാഗത കേരളീയ വസ്ത്രധാരണം (കസവ് സാരി / മുണ്ട്) സ്വാഗതാർഹമാണ്.',
    },
  },
  dateAndTime: {
    muhurthamIso: '2027-01-24T10:15:00+05:30',
    calendarEndIso: '2027-01-24T14:30:00+05:30',
    displayDate: {
      en: 'Sunday, 24 January 2027',
      ml: '2027 ജനുവരി 24, ഞായറാഴ്ച',
    },
    muhurthamWindow: {
      en: '10:15 AM – 11:05 AM IST',
      ml: 'രാവിലെ 10:15 – 11:05',
    },
    malayalamCalendarDate: {
      en: 'Makaram 10, 1202 · Punartham Nakshatram',
      ml: '1202 മകരം 10 · പുണർതം നക്ഷത്രം',
    },
  },
  venue: {
    name: {
      en: 'Guruvayur Sri Krishna Temple & Panchajanyam Courtyard',
      ml: 'ഗുരുവായൂർ ശ്രീകൃഷ്ണ ക്ഷേത്രവും പാഞ്ചജന്യം വേദിയും',
    },
    addressLine1: {
      en: 'East Nada, Guruvayur',
      ml: 'കിഴക്കേ നട, ഗുരുവായൂർ',
    },
    addressLine2: {
      en: 'Thrissur District, Kerala 680101, India',
      ml: 'തൃശ്ശൂർ ജില്ല, കേരളം 680101',
    },
    googleMapsUrl: 'https://maps.google.com/?q=Guruvayur+Temple+Thrissur+Kerala',
    directionsHint: {
      en: '45 minutes from Thrissur Railway Station · Courtyard parking available at East Nada.',
      ml: 'തൃശ്ശൂർ റെയിൽവേ സ്റ്റേഷനിൽ നിന്ന് 45 മിനിറ്റ് യാത്ര · കിഴക്കേ നടയിൽ പാർക്കിംഗ് സൗകര്യം.',
    },
  },
  couple: {
    bride: {
      id: 'bride',
      nickname: {
        en: 'Meera',
        ml: 'മീര',
      },
      fullName: {
        en: 'Meera Krishnan Nair',
        ml: 'മീര കൃഷ്ണൻ നായർ',
      },
      roleLabel: {
        en: 'The Bride',
        ml: 'വധു',
      },
      portraitUrl: '/src/assets/images/bride_portrait_1795792257884.jpg',
      portraitAlt: {
        en: 'Bride portrait in traditional Kerala ivory and gold kasavu saree',
        ml: 'പരമ്പരാഗത കേരള കസവ് സാരിയിലുള്ള വധുവിന്റെ ചിത്രം',
      },
      fatherName: {
        en: 'Sri Krishnanunni Nair',
        ml: 'ശ്രീ കൃഷ്ണനുണ്ണി നായർ',
      },
      motherName: {
        en: 'Smt. Devaki Amma',
        ml: 'ശ്രീമതി ദേവകി അമ്മ',
      },
      paternalGrandparents: {
        en: 'Late Sri Narayanan Nair & Smt. Lakshmikutty Amma',
        ml: 'പരേതനായ ശ്രീ നാരായണൻ നായർ & ശ്രീമതി ലക്ഷ്മിക്കുട്ടി അമ്മ',
      },
      maternalGrandparents: {
        en: 'Sri Sankaran Nair & Smt. Janaki Amma',
        ml: 'ശ്രീ ശങ്കരൻ നായർ & ശ്രീമതി ജാനകി അമ്മ',
      },
      hometown: {
        en: 'Pattambi, Palakkad, Kerala',
        ml: 'പട്ടാമ്പി, പാലക്കാട്',
      },
      personalIntro: {
        en: 'An architect who loves quiet monsoon mornings, classical Carnatic music, and heritage courtyard homes.',
        ml: 'ശാന്തമായ മഴക്കാല പ്രഭാതങ്ങളും ശാസ്ത്രീയ സംഗീതവും പഴയ തറവാടുകളുടെ വാസ്തുവിദ്യയും ഇഷ്ടപ്പെടുന്ന ആർക്കിടെക്റ്റ്.',
      },
      additionalNote: {
        en: 'With family love and blessings.',
        ml: 'കുടുംബത്തിന്റെ സ്നേഹാശംസകളോടെ.',
      },
    },
    groom: {
      id: 'groom',
      nickname: {
        en: 'Arjun',
        ml: 'അർജുൻ',
      },
      fullName: {
        en: 'Arjun Madhavan Menon',
        ml: 'അർജുൻ മാധവൻ മേനോൻ',
      },
      roleLabel: {
        en: 'The Groom',
        ml: 'വരൻ',
      },
      portraitUrl: '/src/assets/images/groom_portrait_1795792258281.jpg',
      portraitAlt: {
        en: 'Groom portrait in ivory silk jubba and Kerala kasavu mundu',
        ml: 'കസവ് മുണ്ടും ജുബ്ബയും ധരിച്ച വരന്റെ ചിത്രം',
      },
      fatherName: {
        en: 'Sri Madhavan Kutty Menon',
        ml: 'ശ്രീ മാധവൻ കുട്ടി മേനോൻ',
      },
      motherName: {
        en: 'Smt. Radhika Menon',
        ml: 'ശ്രീമതി രാധിക മേനോൻ',
      },
      paternalGrandparents: {
        en: 'Sri Govindan Menon & Late Smt. Sharada Menon',
        ml: 'ശ്രീ ഗോവിന്ദൻ മേനോൻ & പരേതയായ ശ്രീമതി ശാരദ മേനോൻ',
      },
      maternalGrandparents: {
        en: 'Sri Vasudevan Pillai & Smt. Sumathi Amma',
        ml: 'ശ്രീ വാസുദേവൻ പിള്ള & ശ്രീമതി സുമതി അമ്മ',
      },
      hometown: {
        en: 'Tripunithura, Ernakulam, Kerala',
        ml: 'തൃപ്പൂണിത്തുറ, എറണാകുളം',
      },
      personalIntro: {
        en: 'A renewable energy engineer who enjoys morning temple walks, filter coffee, and sketching coastal Kerala landscapes.',
        ml: 'പ്രഭാത ക്ഷേത്രദർശനവും കാപ്പിയും കേരളത്തിലെ പ്രകൃതിദൃശ്യങ്ങൾ വരയ്ക്കുന്നതും ഇഷ്ടപ്പെടുന്ന എൻജിനീയർ.',
      },
      additionalNote: {
        en: 'With family love and blessings.',
        ml: 'കുടുംബത്തിന്റെ സ്നേഹാശംസകളോടെ.',
      },
    },
  },
  familyMembers: [
    {
      id: 'fam-bride-sister',
      side: 'bride',
      name: {
        en: 'Ananya Krishnan',
        ml: 'അനന്യ കൃഷ്ണൻ',
      },
      relationship: {
        en: 'Sister of the Bride',
        ml: 'വധുവിന്റെ സഹോദരി',
      },
      note: {
        en: 'Hosting family welcome at East Nada',
        ml: 'സ്വീകരണ ചുമതല',
      },
      order: 1,
      visible: true,
    },
    {
      id: 'fam-groom-uncle',
      side: 'groom',
      name: {
        en: 'Sri Unnikrishnan Menon',
        ml: 'ശ്രീ ഉണ്ണികൃഷ്ണൻ മേനോൻ',
      },
      relationship: {
        en: 'Maternal Uncle of the Groom',
        ml: 'വരന്റെ അമ്മാവൻ',
      },
      note: {
        en: 'Leading the Varapooja blessings',
        ml: 'വരപൂജ ആശീർവാദം',
      },
      order: 2,
      visible: true,
    },
  ],
  events: [
    {
      id: 'mehendi-sangeet',
      title: {
        en: 'Haldi & Family Gathering',
        ml: 'ഹൽദി & കുടുംബ സംഗമം',
      },
      dateLabel: {
        en: 'Saturday, 23 January 2027',
        ml: '2027 ജനുവരി 23, ശനിയാഴ്ച',
      },
      timeRange: {
        en: '4:30 PM – 8:00 PM IST',
        ml: 'വൈകുന്നേരം 4:30 – 8:00',
      },
      venueName: {
        en: 'Thekkini Heritage Lawn, Thrissur',
        ml: 'തെക്കിനി ഹെറിറ്റേജ് ലോൺ, തൃശ്ശൂർ',
      },
      description: {
        en: 'An intimate evening of turmeric blessings, traditional lamps, and warm family hospitality.',
        ml: 'കുടുംബാംഗങ്ങളുടെയും സുഹൃത്തുക്കളുടെയും സ്നേഹസാന്നിധ്യത്തിൽ ഒരു സായാഹ്ന സംഗമം.',
      },
      order: 1,
      visible: true,
    },
    {
      id: 'varapooja-kashiyatra',
      title: {
        en: 'Varapooja & Reception at Nada',
        ml: 'വരപൂജയും സ്വീകരണവും',
      },
      dateLabel: {
        en: 'Sunday, 24 January 2027',
        ml: '2027 ജനുവരി 24, ഞായറാഴ്ച',
      },
      timeRange: {
        en: '9:00 AM – 9:45 AM IST',
        ml: 'രാവിലെ 9:00 – 9:45',
      },
      venueName: {
        en: 'Guruvayur East Nada Mandapam',
        ml: 'ഗുരുവായൂർ കിഴക്കേ നട മണ്ഡപം',
      },
      description: {
        en: 'Traditional welcoming of the groom and his family accompanied by Panchavadyam and Nadaswaram.',
        ml: 'നാദസ്വരത്തിന്റെയും പഞ്ചവാദ്യത്തിന്റെയും അകമ്പടിയോടെ വരനെയും കുടുംബത്തെയും സ്വീകരിക്കുന്നു.',
      },
      order: 2,
      visible: true,
    },
    {
      id: 'muhurtham',
      title: {
        en: 'Thalikettu & Kanyadaanam Muhurtham',
        ml: 'താലികെട്ട് ശുഭ മുഹൂർത്തം',
      },
      dateLabel: {
        en: 'Sunday, 24 January 2027',
        ml: '2027 ജനുവരി 24, ഞായറാഴ്ച',
      },
      timeRange: {
        en: '10:15 AM – 11:05 AM IST',
        ml: 'രാവിലെ 10:15 – 11:05',
      },
      venueName: {
        en: 'Sri Krishna Temple Mandapam',
        ml: 'ശ്രീകൃഷ്ണ ക്ഷേത്ര മണ്ഡപം',
      },
      description: {
        en: 'Sacred tying of the Thali, exchange of Pudava and jasmine garlands, and Vedic blessings around the Nilavilakku.',
        ml: 'നിലവിളക്കിനെ സാക്ഷിയാക്കി താലികെട്ടും പുടവ കൈമാറ്റവും തുളസി-മുല്ലപ്പൂ മാല ചാർത്തലും.',
      },
      isMuhurtham: true,
      order: 3,
      visible: true,
    },
    {
      id: 'kalyana-sadya',
      title: {
        en: 'Traditional Kalyana Sadya',
        ml: 'കല്യാണ സദ്യ',
      },
      dateLabel: {
        en: 'Sunday, 24 January 2027',
        ml: '2027 ജനുവരി 24, ഞായറാഴ്ച',
      },
      timeRange: {
        en: '11:45 AM – 2:30 PM IST',
        ml: 'രാവിലെ 11:45 – ഉച്ചയ്ക്ക് 2:30',
      },
      venueName: {
        en: 'Panchajanyam Dining Pavilion',
        ml: 'പാഞ്ചജന്യം ഭക്ഷണശാല',
      },
      description: {
        en: 'A festive plantain-leaf vegetarian feast featuring traditional Palada Payasam and twenty-four classic delicacies.',
        ml: 'പാലട പ്രഥമനും വിഭവസമൃദ്ധമായ കല്യാണ സദ്യയും വാഴയിലയിൽ വിളമ്പുന്നു.',
      },
      order: 4,
      visible: true,
    },
  ],
  media: {
    musicEnabled: true,
    musicUrl: null,
    musicTitle: {
      en: 'Classical Kerala Temple Ambience',
      ml: 'കേരളീയ ശാസ്ത്രീയ സംഗീതം',
    },
    photos: [],
    videos: [],
  },
  sections: [
    {
      key: 'couple',
      enabled: true,
      order: 1,
      heading: {en: 'Two Families, One Sacred Bond', ml: 'രണ്ട് കുടുംബങ്ങൾ, ഒരു പവിത്ര ബന്ധം'},
      subtitle: {
        en: 'Select either portrait to read family lineage and personal notes.',
        ml: 'കുടുംബ വിവരങ്ങൾ കാണുവാൻ ചിത്രത്തിൽ ക്ലിക്ക് ചെയ്യുക.',
      },
    },
    {
      key: 'family',
      enabled: true,
      order: 2,
      heading: {en: 'Our Loved Ones & Elders', ml: 'കുടുംബാംഗങ്ങളും ആശീർവാദങ്ങളും'},
      subtitle: {
        en: 'With gratitude to the family members welcoming you.',
        ml: 'ഏവരെയും സ്നേഹപൂർവ്വം സ്വാഗതം ചെയ്യുന്ന പ്രിയപ്പെട്ടവർ.',
      },
    },
    {
      key: 'countdown',
      enabled: true,
      order: 3,
      heading: {
        en: 'Counting Moments to the Muhurtham',
        ml: 'മംഗള മുഹൂർത്തത്തിലേക്കുള്ള കാത്തിരിപ്പ്',
      },
    },
    {
      key: 'details',
      enabled: true,
      order: 4,
      heading: {en: 'Wedding Details & Schedule', ml: 'വിവാഹ വിവരങ്ങളും സമയക്രമവും'},
    },
    {
      key: 'gallery',
      enabled: true,
      order: 5,
      heading: {en: 'Pre-Wedding & Heritage Gallery', ml: 'വിവാഹ ആൽബം'},
      subtitle: {
        en: 'Visual moments curated from the couple’s photography archive.',
        ml: 'വധൂവരന്മാരുടെ വിവാഹ ആൽബത്തിൽ നിന്നുള്ള മനോഹര നിമിഷങ്ങൾ.',
      },
    },
  ],
  languageSettings: {
    defaultLanguage: 'en',
    malayalamEnabled: true,
    showLanguageSwitcher: true,
  },
  socialSharing: {
    title: 'Meera & Arjun — Kerala Hindu Wedding Invitation',
    description:
      'Join us in Guruvayur, Kerala to bless Meera & Arjun as they begin their life together.',
    imageUrl: '/src/assets/images/og_wedding_preview_1795792259732.jpg',
    siteName: 'Meera & Arjun Wedding',
  },
  footer: {
    blessingQuote: {
      en: '“May this union be blessed with harmony, grace, and lifelong companionship.”',
      ml: '“സ്നേഹവും സമാധാനവും ഐശ്വര്യവും നിറഞ്ഞ ഒരു ദാമ്പത്യ ജീവിതം ആശംസിക്കുന്നു.”',
    },
    hostsLine: {
      en: 'With warm regards from the Nair & Menon Families',
      ml: 'സ്നേഹപൂർവ്വം, നായർ & മേനോൻ കുടുംബാംഗങ്ങൾ',
    },
    showDateAndNames: true,
    showCredit: false,
    creditName: '',
    creditUrl: '',
  },
};

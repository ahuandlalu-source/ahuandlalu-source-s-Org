import type {Language} from '../types/wedding';

export interface UIStrings {
  nav: {
    couple: string;
    schedule: string;
    gallery: string;
    videos: string;
    directions: string;
    rsvp: string;
    wishes: string;
  };
  invitation: {
    auspiciousInvocation: string;
    closedNote: string;
    reducedMotionHint: string;
  };
  hero: {
    muhurthamLabel: string;
    dateLabel: string;
    venueLabel: string;
    scrollPrompt: string;
  };
  couple: {
    sectionKicker: string;
    sectionTitle: string;
    sectionSubtitle: string;
    knowMore: string;
    returnToPortrait: string;
    closeProfileAria: string;
    fullNameLabel: string;
    parentsLabel: string;
    fatherPrefix: string;
    motherPrefix: string;
    grandparentsLabel: string;
    paternalLabel: string;
    maternalLabel: string;
    hometownLabel: string;
    aboutLabel: string;
    placeholderTag: string;
  };
  countdown: {
    sectionKicker: string;
    sectionTitle: string;
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
    timezoneNote: string;
    celebratedTitle: string;
    celebratedMessage: string;
  };
  details: {
    sectionKicker: string;
    sectionTitle: string;
    dateTitle: string;
    muhurthamTitle: string;
    venueTitle: string;
    getDirections: string;
    addToCalendar: string;
    scheduleHeading: string;
    muhurthamHighlight: string;
  };
  gallery: {
    sectionKicker: string;
    sectionTitle: string;
    sectionSubtitle: string;
    placeholderBadge: string;
    previousPhoto: string;
    nextPhoto: string;
    closeLightbox: string;
    keyboardHint: string;
  };
  videos: {
    sectionKicker: string;
    sectionTitle: string;
    sectionSubtitle: string;
    watchVideo: string;
    closeVideo: string;
    loadingVideo: string;
    errorTitle: string;
    errorBody: string;
    retryPlayback: string;
    simulateErrorLabel: string;
    placeholderPreviewTitle: string;
    placeholderPreviewBody: string;
  };
  rsvp: {
    sectionKicker: string;
    guestNameLabel: string;
    guestNamePlaceholder: string;
    attendanceLabel: string;
    attendingOption: string;
    notAttendingOption: string;
    attendeeCountLabel: string;
    messageLabel: string;
    messagePlaceholder: string;
    submitButton: string;
    submittingButton: string;
    successTitle: string;
    successAttending: string;
    successNotAttending: string;
    duplicateNote: string;
    sendAnother: string;
  };
  wishes: {
    sectionKicker: string;
    guestNameLabel: string;
    guestNamePlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    emojiLabel: string;
    photoLabel: string;
    photoHint: string;
    removePhoto: string;
    previewButton: string;
    previewHeading: string;
    previewNote: string;
    editButton: string;
    confirmSendButton: string;
    sendingButton: string;
    successTitle: string;
    successModerated: string;
    successPublished: string;
    sendAnother: string;
    wallHeading: string;
    wallEmpty: string;
    wallLoading: string;
  };
  music: {
    play: string;
    pause: string;
    mute: string;
    unmute: string;
    unavailable: string;
    playingLabel: string;
    pausedLabel: string;
  };
  footer: {
    backToTop: string;
    placeholderBanner: string;
  };
}

export const translations: Record<Language, UIStrings> = {
  en: {
    nav: {
      couple: 'The Couple',
      schedule: 'Ceremonies',
      gallery: 'Gallery',
      videos: 'Films',
      directions: 'Venue',
      rsvp: 'RSVP',
      wishes: 'Wishes',
    },
    invitation: {
      auspiciousInvocation: 'Shubha Vivaha Nimantranam',
      closedNote: 'Sample Invitation Card',
      reducedMotionHint: 'Tap to reveal the invitation',
    },
    hero: {
      muhurthamLabel: 'Muhurtham',
      dateLabel: 'Wedding Day',
      venueLabel: 'Venue',
      scrollPrompt: 'Scroll to explore',
    },
    couple: {
      sectionKicker: 'The Bride & Groom',
      sectionTitle: 'Two Families, One Sacred Bond',
      sectionSubtitle: 'Select either portrait to read family lineage and personal notes.',
      knowMore: 'Know More',
      returnToPortrait: 'Return to Portrait',
      closeProfileAria: 'Close family details and return to portrait',
      fullNameLabel: 'Full Name',
      parentsLabel: 'Parents',
      fatherPrefix: 'Son/Daughter of Sri',
      motherPrefix: '& Smt.',
      grandparentsLabel: 'Grandparents',
      paternalLabel: 'Paternal',
      maternalLabel: 'Maternal',
      hometownLabel: 'Ancestral Home',
      aboutLabel: 'Personal Note',
      placeholderTag: 'Sample Placeholder Details',
    },
    countdown: {
      sectionKicker: 'The Auspicious Hour',
      sectionTitle: 'Counting Moments to the Muhurtham',
      days: 'Days',
      hours: 'Hours',
      minutes: 'Minutes',
      seconds: 'Seconds',
      timezoneNote: 'Indian Standard Time (IST · UTC+05:30)',
      celebratedTitle: 'United in Grace & Blessings',
      celebratedMessage:
        'Thank you for sharing in the joy, prayers, and warmth of our wedding celebration.',
    },
    details: {
      sectionKicker: 'Ceremony & Venue',
      sectionTitle: 'Wedding Details & Schedule',
      dateTitle: 'Wedding Date',
      muhurthamTitle: 'Auspicious Muhurtham',
      venueTitle: 'Temple & Courtyard Venue',
      getDirections: 'Get Directions',
      addToCalendar: 'Save Calendar Reminder',
      scheduleHeading: 'Order of Ceremonies',
      muhurthamHighlight: 'Muhurtham',
    },
    gallery: {
      sectionKicker: 'Captured Moments',
      sectionTitle: 'Pre-Wedding & Heritage Gallery',
      sectionSubtitle: 'Sample visual placeholders curated in readiness for the couple’s photography archive.',
      placeholderBadge: 'Sample Placeholder',
      previousPhoto: 'Previous photograph',
      nextPhoto: 'Next photograph',
      closeLightbox: 'Close gallery viewer',
      keyboardHint: 'Use arrow keys to navigate · Esc to close',
    },
    videos: {
      sectionKicker: 'Moving Memories',
      sectionTitle: 'Wedding Film & Highlights',
      sectionSubtitle: 'Curated film previews. Production videos will stream from dedicated media storage.',
      watchVideo: 'Play Film',
      closeVideo: 'Close video player',
      loadingVideo: 'Preparing video playback…',
      errorTitle: 'Playback Unavailable',
      errorBody:
        'We could not load this video stream right now. Please check your connection or try again.',
      retryPlayback: 'Try Again',
      simulateErrorLabel: 'Test Error State',
      placeholderPreviewTitle: 'Sample Film Placeholder',
      placeholderPreviewBody:
        'No production video file is linked yet in Phase 1. This preview demonstrates the responsive player controls and error handling.',
    },
    rsvp: {
      sectionKicker: 'Kindly Respond',
      guestNameLabel: 'Guest Name',
      guestNamePlaceholder: 'Enter your full name',
      attendanceLabel: 'Will you attend?',
      attendingOption: 'Joyfully Attending',
      notAttendingOption: 'Unable to Attend',
      attendeeCountLabel: 'Number of Attendees',
      messageLabel: 'Message to the Couple',
      messagePlaceholder: 'Dietary notes, travel details, or a short blessing (optional)',
      submitButton: 'Send RSVP',
      submittingButton: 'Saving RSVP…',
      successTitle: 'Thank You — Your RSVP Is Confirmed',
      successAttending:
        'We are delighted that you will join us in celebrating this auspicious occasion.',
      successNotAttending:
        'Thank you for letting us know. We will hold your warm wishes close in our hearts.',
      duplicateNote: 'Your RSVP was already recorded safely.',
      sendAnother: 'Submit Another Family RSVP',
    },
    wishes: {
      sectionKicker: 'Messages of Love',
      guestNameLabel: 'Your Name',
      guestNamePlaceholder: 'Enter your name or family name',
      messageLabel: 'Wedding Wishes',
      messagePlaceholder: 'Write a blessing, memory, or message of love for the couple…',
      emojiLabel: 'Add a Blessing Symbol (Optional)',
      photoLabel: 'Attach a Photograph (Optional)',
      photoHint: 'JPEG, PNG, WebP, or GIF up to 5 MB',
      removePhoto: 'Remove Photo',
      previewButton: 'Preview Wishes',
      previewHeading: 'Preview Your Wedding Wish Card',
      previewNote:
        'Please review how your card will appear before confirming and sending.',
      editButton: 'Edit Your Wishes',
      confirmSendButton: 'Confirm & Send',
      sendingButton: 'Sending Wishes…',
      successTitle: 'Thank You for Your Warm Wishes',
      successModerated:
        'Your wish has been saved safely and may appear on the public Wishes Wall once reviewed by the families.',
      successPublished:
        'Your wish has been saved and published to the Wedding Wishes Wall.',
      sendAnother: 'Write Another Wish',
      wallHeading: 'Wedding Wishes Wall',
      wallEmpty: 'Be the first to share a blessing and warm wish for the couple.',
      wallLoading: 'Loading wedding wishes…',
    },
    music: {
      play: 'Play wedding ambience',
      pause: 'Pause wedding ambience',
      mute: 'Mute music',
      unmute: 'Unmute music',
      unavailable: 'Audio unavailable',
      playingLabel: 'Ambience On',
      pausedLabel: 'Ambience Paused',
    },
    footer: {
      backToTop: 'Return to Top',
      placeholderBanner:
        'Phase 1 Public Preview · Sample placeholder names, dates, and media are displayed until real wedding details are configured.',
    },
  },
  ml: {
    nav: {
      couple: 'വധൂവരന്മാർ',
      schedule: 'ചടങ്ങുകൾ',
      gallery: 'ചിത്രങ്ങൾ',
      videos: 'വീഡിയോ',
      directions: 'വേദി',
      rsvp: 'പങ്കാളിത്തം',
      wishes: 'ആശംസകൾ',
    },
    invitation: {
      auspiciousInvocation: 'ശുഭ വിവാഹ ക്ഷണക്കത്ത്',
      closedNote: 'മാതൃകാ ക്ഷണക്കത്ത് (Placeholder)',
      reducedMotionHint: 'ക്ഷണക്കത്ത് തുറക്കുവാൻ അമർത്തുക',
    },
    hero: {
      muhurthamLabel: 'മുഹൂർത്തം',
      dateLabel: 'വിവാഹ തീയതി',
      venueLabel: 'വേദി',
      scrollPrompt: 'താഴേക്ക് സ്ക്രോൾ ചെയ്യുക',
    },
    couple: {
      sectionKicker: 'വധുവും വരനും',
      sectionTitle: 'രണ്ട് കുടുംബങ്ങൾ, ഒരു പവിത്ര ബന്ധം',
      sectionSubtitle: 'കുടുംബ വിവരങ്ങൾ കാണുവാൻ ചിത്രത്തിൽ ക്ലിക്ക് ചെയ്യുക.',
      knowMore: 'കൂടുതൽ അറിയുക',
      returnToPortrait: 'തിരികെ പോവുക',
      closeProfileAria: 'വിവരങ്ങൾ അടച്ച് ചിത്രത്തിലേക്ക് മടങ്ങുക',
      fullNameLabel: 'പൂർണ്ണ നാമം',
      parentsLabel: 'മാതാപിതാക്കൾ',
      fatherPrefix: 'ശ്രീ',
      motherPrefix: '& ശ്രീമതി',
      grandparentsLabel: 'മുത്തശ്ശീമുത്തശ്ശന്മാർ',
      paternalLabel: 'പിതൃവഴി',
      maternalLabel: 'മാതൃവഴി',
      hometownLabel: 'സ്വദേശം',
      aboutLabel: 'കുറിപ്പ്',
      placeholderTag: 'മാതൃകാ വിവരങ്ങൾ (Placeholder)',
    },
    countdown: {
      sectionKicker: 'ശുഭ മുഹൂർത്തം',
      sectionTitle: 'മംഗള മുഹൂർത്തത്തിലേക്കുള്ള കാത്തിരിപ്പ്',
      days: 'ദിവസം',
      hours: 'മണിക്കൂർ',
      minutes: 'മിനിറ്റ്',
      seconds: 'സെക്കൻഡ്',
      timezoneNote: 'ഇന്ത്യൻ സമയം (IST · UTC+05:30)',
      celebratedTitle: 'അനുഗ്രഹങ്ങളോടെ ഒന്നായി',
      celebratedMessage:
        'ഞങ്ങളുടെ വിവാഹ ചടങ്ങിൽ പങ്കുചേർന്ന് ആശീർവദിച്ച ഏവർക്കും ഹൃദയം നിറഞ്ഞ നന്ദി.',
    },
    details: {
      sectionKicker: 'ചടങ്ങുകളും വേദിയും',
      sectionTitle: 'വിവാഹ വിവരങ്ങളും സമയക്രമവും',
      dateTitle: 'വിവാഹ തീയതി',
      muhurthamTitle: 'ശുഭ മുഹൂർത്തം',
      venueTitle: 'ക്ഷേത്രവും വേദിയും',
      getDirections: 'വഴി കാണുക',
      addToCalendar: 'കലണ്ടറിൽ ചേർക്കുക',
      scheduleHeading: 'വിവാഹ ചടങ്ങുകൾ',
      muhurthamHighlight: 'മുഹൂർത്തം',
    },
    gallery: {
      sectionKicker: 'ഓർമ്മച്ചിത്രങ്ങൾ',
      sectionTitle: 'വിവാഹ ആൽബം',
      sectionSubtitle: 'യഥാർത്ഥ ചിത്രങ്ങൾ ചേർക്കുന്നതുവരെ ഉപയോഗിക്കുന്ന മാതൃകാ ചിത്രങ്ങൾ.',
      placeholderBadge: 'മാതൃകാ ചിത്രം',
      previousPhoto: 'മുൻപത്തെ ചിത്രം',
      nextPhoto: 'അടുത്ത ചിത്രം',
      closeLightbox: 'അടയ്ക്കുക',
      keyboardHint: 'അമ്പടയാള കീകൾ ഉപയോഗിക്കുക · അടയ്ക്കാൻ Esc',
    },
    videos: {
      sectionKicker: 'ചലച്ചിത്ര ഓർമ്മകൾ',
      sectionTitle: 'വിവാഹ വീഡിയോകൾ',
      sectionSubtitle: 'മാതൃകാ വീഡിയോ പ്രിവ്യൂ. യഥാർത്ഥ വീഡിയോകൾ അടുത്ത ഘട്ടത്തിൽ ചേർക്കുന്നതാണ്.',
      watchVideo: 'കാണുക',
      closeVideo: 'വീഡിയോ പ്ലെയർ അടയ്ക്കുക',
      loadingVideo: 'വീഡിയോ തയ്യാറാകുന്നു…',
      errorTitle: 'വീഡിയോ ലഭ്യമല്ല',
      errorBody: 'ഈ വീഡിയോ ഇപ്പോൾ ലഭ്യമാക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.',
      retryPlayback: 'വീണ്ടും ശ്രമിക്കുക',
      simulateErrorLabel: 'പിശക് പരിശോധിക്കുക',
      placeholderPreviewTitle: 'മാതൃകാ വീഡിയോ (Placeholder)',
      placeholderPreviewBody:
        'ഘട്ടം 1-ൽ മാതൃകാ പ്രിവ്യൂ മാത്രമാണ് ഉൾപ്പെടുത്തിയിരിക്കുന്നത്.',
    },
    rsvp: {
      sectionKicker: 'പങ്കാളിത്തം അറിയിക്കുക',
      guestNameLabel: 'പേര്',
      guestNamePlaceholder: 'നിങ്ങളുടെ പൂർണ്ണ നാമം നൽകുക',
      attendanceLabel: 'ചടങ്ങിൽ പങ്കെടുക്കുമോ?',
      attendingOption: 'പങ്കെടുക്കും',
      notAttendingOption: 'പങ്കെടുക്കാൻ കഴിയില്ല',
      attendeeCountLabel: 'പങ്കെടുക്കുന്നവരുടെ എണ്ണം',
      messageLabel: 'വധൂവരന്മാർക്കുള്ള കുറിപ്പ്',
      messagePlaceholder: 'പ്രത്യേക അറിയിപ്പുകളോ ആശംസകളോ ഉണ്ടെങ്കിൽ (ഐച്ഛികം)',
      submitButton: 'RSVP സമർപ്പിക്കുക',
      submittingButton: 'സേവ് ചെയ്യുന്നു…',
      successTitle: 'നന്ദി — നിങ്ങളുടെ മറുപടി ലഭിച്ചു',
      successAttending:
        'ഞങ്ങളുടെ സന്തോഷത്തിൽ പങ്കുചേരാൻ എത്തുന്നതിൽ ഏറെ സന്തോഷം.',
      successNotAttending:
        'വിവരം അറിയിച്ചതിന് നന്ദി. നിങ്ങളുടെ പ്രാർത്ഥനകളും സ്നേഹവും എന്നും ഞങ്ങളോടൊപ്പമുണ്ടാകും.',
      duplicateNote: 'നിങ്ങളുടെ RSVP ഇതിനകം രേഖപ്പെടുത്തിയിട്ടുണ്ട്.',
      sendAnother: 'മറ്റൊരു RSVP സമർപ്പിക്കുക',
    },
    wishes: {
      sectionKicker: 'സ്നേഹാശംസകൾ',
      guestNameLabel: 'നിങ്ങളുടെ പേര്',
      guestNamePlaceholder: 'പേര് അല്ലെങ്കിൽ കുടുംബപ്പേര് നൽകുക',
      messageLabel: 'വിവാഹ ആശംസകൾ',
      messagePlaceholder: 'വധൂവരന്മാർക്കായി ഹൃദയം നിറഞ്ഞ ആശംസകൾ കുറിക്കൂ…',
      emojiLabel: 'ചിഹ്നം തിരഞ്ഞെടുക്കുക (ഐച്ഛികം)',
      photoLabel: 'ചിത്രം ചേർക്കുക (ഐച്ഛികം)',
      photoHint: 'JPEG, PNG, WebP, GIF · പരമാവധി 5 MB',
      removePhoto: 'ചിത്രം നീക്കം ചെയ്യുക',
      previewButton: 'ആശംസ പ്രിവ്യൂ കാണുക',
      previewHeading: 'നിങ്ങളുടെ ആശംസാ കാർഡ് പ്രിവ്യൂ',
      previewNote:
        'അയയ്ക്കുന്നതിന് മുൻപ് നിങ്ങളുടെ ആശംസാ കാർഡ് ശരിയാണെന്ന് ഉറപ്പുവരുത്തുക.',
      editButton: 'തിരുത്തുക',
      confirmSendButton: 'ഉറപ്പാക്കി അയയ്ക്കുക',
      sendingButton: 'അയയ്ക്കുന്നു…',
      successTitle: 'സ്നേഹപൂർണ്ണമായ ആശംസകൾക്ക് നന്ദി',
      successModerated:
        'നിങ്ങളുടെ ആശംസ സുരക്ഷിതമായി ലഭിച്ചു. കുടുംബത്തിന്റെ പരിശോധനയ്ക്ക് ശേഷം ഇത് പൊതുവായി പ്രദർശിപ്പിക്കുന്നതാണ്.',
      successPublished:
        'നിങ്ങളുടെ ആശംസ ആശംസാ മതിലിൽ പ്രസിദ്ധീകരിച്ചു.',
      sendAnother: 'മറ്റൊരു ആശംസ എഴുതുക',
      wallHeading: 'സ്നേഹാശംസകളുടെ മതിൽ',
      wallEmpty: 'ആദ്യത്തെ സ്നേഹാശംസ നിങ്ങളുടേതാകട്ടെ.',
      wallLoading: 'ആശംസകൾ ലോഡ് ചെയ്യുന്നു…',
    },
    music: {
      play: 'സംഗീതം കേൾക്കുക',
      pause: 'സംഗീതം നിർത്തുക',
      mute: 'ശബ്ദം കുറയ്ക്കുക',
      unmute: 'ശബ്ദം ഓൺ ചെയ്യുക',
      unavailable: 'സംഗീതം ലഭ്യമല്ല',
      playingLabel: 'സംഗീതം ഓൺ',
      pausedLabel: 'സംഗീതം നിർത്തി',
    },
    footer: {
      backToTop: 'മുകളിലേക്ക്',
      placeholderBanner:
        'ഘട്ടം 1 മാതൃകാ പ്രിവ്യൂ · യഥാർത്ഥ വിവാഹ വിവരങ്ങൾ ചേർക്കുന്നത് വരെ മാതൃകാ പേരുകളും ചിത്രങ്ങളുമാണ് നൽകിയിരിക്കുന്നത്.',
    },
  },
};

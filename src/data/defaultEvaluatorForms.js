/** Default evaluator questionnaire definitions (Study 4.0 + 4.A). */
const DEFAULT_EVALUATOR_FORMS = {
  expertProfile: {
    title: 'Profil expert — chestionar inițial',
    intro: 'Completați o singură dată înainte de a testa personajele virtuale.',
    profileFields: [
      {
        key: 'professions',
        type: 'checkbox',
        label: 'Profession',
        options: [
          'Pneumologist',
          'Family physician',
          'Public health specialist',
          'Psychologist',
          'Medical educator',
          'Other'
        ],
        required: true,
        otherFieldKey: 'professionOther',
        otherOptionLabel: 'Other'
      },
      {
        key: 'experience',
        type: 'radio',
        label: 'Years of professional experience',
        options: ['<5 years', '5–10 years', '11–20 years', '>20 years'],
        required: true
      },
      {
        key: 'cessationCounselling',
        type: 'radio',
        label: 'Are you actively involved in smoking cessation counselling?',
        options: ['Yes', 'No'],
        required: true
      },
      {
        key: 'teaching',
        type: 'radio',
        label: 'Are you involved in teaching activities?',
        options: ['Yes', 'No'],
        required: true
      },
      {
        key: 'affiliations',
        type: 'checkbox',
        label: 'Are you affiliated with',
        options: [
          'Romanian National Stop Smoking Program',
          'Romanian Society of Pneumology',
          'Medical university',
          'Other'
        ],
        otherFieldKey: 'affiliationOther',
        otherOptionLabel: 'Other'
      }
    ],
    submitLabel: 'Continue to study'
  },
  sessionEvaluation: {
    title: 'Evaluare interacțiune cu pacientul virtual',
    intro:
      'Vă rugăm să evaluați răspunsurile pacientului virtual generate în timpul acestei interacțiuni.',
    choiceFields: [],
    showSessionMeta: false,
    showChoiceFieldsSection: false,
    likertIntro:
      'Pentru fiecare afirmație, vă rugăm să selectați gradul de acord, utilizând scala de mai jos:\n1 = Dezacord total\n2 = Dezacord\n3 = Nici acord, nici dezacord\n4 = Acord\n5 = Acord total',
    likertSections: [
      {
        key: 'main',
        title: '',
        items: [
          'Pacientul virtual a răspuns adecvat la întrebările și recomandările pe care i le-ați adresat.',
          'Răspunsurile pacientului virtual au fost în concordanță cu profilul de fumător/nefumător care i-a fost atribuit.',
          'Limbajul utilizat de pacientul virtual a fost similar cu al unui pacient real.',
          'Interacțiunea a fost utilă pentru exersarea sfatului minimal de renunțare la fumat.'
        ]
      }
    ],
    showOverallQuality: false,
    overallQualityLabel: '',
    evaluationTextFields: [
      {
        key: 'improvementSuggestions',
        label:
          '5. Vă rugăm să formulați orice sugestii concrete pentru îmbunătățirea acestui scenariu și a comportamentului pacientului virtual',
        placeholder: '',
        rows: 4
      }
    ],
    showEvaluationTextFieldsSection: true,
    showErrorReportSection: true,
    showErrorIssuesSection: true,
    showErrorIssueOptions: true,
    showErrorSeverityOptions: false,
    showErrorReportTextFieldsSection: false,
    errorReportLabel:
      '6. Vă rugăm să bifați toate tipurile de răspunsuri problematice generate de pacientul virtual pe care le-ați observat în această conversație.',
    errorIssueOptions: [
      'a. Răspunsuri incorecte sau nerelevante (de exemplu, pacientul virtual a răspuns greșit sau fără legătură cu întrebarea adresată de utilizator)',
      'b. Halucinații și erori factuale (de exemplu, pacientul virtual a inventat detalii care nu au fost menționate anterior sau a adăugat informații false)',
      'c. Incoerență conversațională (de exemplu, la început pacientul a spus s-a lăsat de fumat, iar mai târziu a afirmat că a fumat 10 țigări în ziua respectivă)',
      'd. Stil nenatural sau neautentic (de exemplu, pacientul virtual a dat un răspuns prea tehnic, ca și când ar fi specialist în domeniu și nu simplu pacient)',
      'e. Sugestibilitate excesivă (de exemplu, pacientul virtual a acceptat o sugestie a utilizatorului, chiar dacă era contrară scenariului prestabilit)',
      'f. Alt răspuns problematic'
    ],
    errorSeverityOptions: [],
    errorReportTextFields: [],
    submitLabel: 'Salvați și afișați scenariul următor'
  },
  overallEvaluation: {
    title: 'Evaluare finală a aplicației',
    intro:
      'Vă rugăm să evaluați aplicația în ansamblu, după testarea tuturor scenariilor.',
    likertIntro:
      'Pentru fiecare afirmație, vă rugăm să selectați gradul de acord, utilizând scala de mai jos:\n1 = Dezacord total\n2 = Dezacord\n3 = Nici acord, nici dezacord\n4 = Acord\n5 = Acord total',
    likertSections: [
      {
        key: 'overall',
        title: '',
        items: [
          'Pacientul virtual a răspuns suficient de rapid și fără întreruperi tehnice pe parcursul testării.',
          'Scenariile au acoperit o gamă suficient de variată de profiluri de pacienți fumători și nefumători.',
          'Aplicația oferă o varietate suficientă de profiluri demografice de pacienți.',
          'Aplicația oferă o experiență realistă și utilă pentru instruirea în acordarea sfatului minimal de renunțare la fumat.',
          'Funcționalitate tehnică (timp de reacție, întreruperi etc.)'
        ]
      }
    ],
    evaluationTextFields: [
      {
        key: 'strengths',
        label: '6. Care considerați că sunt principalele puncte forte ale aplicației?',
        placeholder: '',
        rows: 4
      },
      {
        key: 'betaImprovements',
        label:
          '7. Care sunt cele mai importante îmbunătățiri pe care le recomandați înaintea dezvoltării versiunii beta?',
        placeholder: '',
        rows: 4
      }
    ],
    submitLabel: 'Trimite evaluarea finală'
  }
};

module.exports = { DEFAULT_EVALUATOR_FORMS };

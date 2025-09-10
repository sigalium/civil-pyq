const resources = {
    // Semester 1 Resources
  'Mathematics I': {
    pyq: [
      { name: 'ESE Dec 2024', path: '/pdfs/Semester1/Mathematics I/ESE_Dec_2024.pdf' },
      { name: 'Sessional 1 Dec 2024', path: '/pdfs/Semester1/Mathematics I/MathS1_Dec2024.pdf' },
      { name: 'Sessional 2 Dec 2024', path: '/pdfs/Semester1/Mathematics I/MathS2_Dec2024.pdf' },
      { name: 'ASTU Dec 2022', path: '/pdfs/Semester1/Mathematics I/ASTU_Dec_2022.pdf' }
    ],
    lab: [
      { name: 'Assignment 2024', path: '/pdfs/Semester1/Mathematics I/Extras/Assignment2.pdf' },
      { name: 'Notes: Partial Differentiation', path: '/pdfs/Semester1/Mathematics I/Extras/Partial_Differentiation.pdf' }
    ]
  },
  'Physics': {
    pyq: [
      { name: 'ESE Dec 2024', path: '/pdfs/Semester1/Physics/ESE_Dec_2024.pdf' },
      { name: 'Sessional 1 Dec 2024', path: '/pdfs/Semester1/Physics/PhysS1_Dec2024.pdf' },
      { name: 'Sessional 2 Dec 2024', path: '/pdfs/Semester1/Physics/PhysS2_Dec2024.pdf' }
    ],
    lab: [
      { name: 'Lab Manual', path: '/pdfs/Semester1/Physics/Lab_Manual.pdf' }
    ]
  },
  'Biology': {
    pyq: [
      { name: 'ESE Dec 2024', path: '/pdfs/Semester1/Biology/ESE_Dec_2024.pdf' },
      { name: 'Sessional 1 Dec 2024', path: '/pdfs/Semester1/Biology/BioS1_Dec2024.pdf' },
      { name: 'Sessional 2 Dec 2024', path: '/pdfs/Semester1/Biology/BioS2_Dec2024.pdf' }
    ],
    lab: [
      { name: 'Notes: Protein', path: '/pdfs/Semester1/Biology/Extras/Protein.pdf' },
      { name: 'Notes: Dna', path: '/pdfs/Semester1/Biology/Extras/DNA.pdf' }
    ]
  },
  'Basic Electrical Engineering': {
    pyq: [
      { name: 'ESE Dec 2024', path: '/pdfs/Semester1/Basic Electrical Engineering/ESE_Dec_2024.pdf' },
      { name: 'ESE Dec 2023', path: '/pdfs/Semester1/Basic Electrical Engineering/ESE_Dec_2023.pdf' },
      { name: 'ASTU June 2023', path: '/pdfs/Semester1/Basic Electrical Engineering/ASTU_June_2023.pdf' }
    ],
    lab: [
      { name: 'Lab Manual', path: '/pdfs/Semester1/Basic Electrical Engineering/Lab_Manual.pdf' },
      { name: 'Data Sheet', path: '/pdfs/Semester1/Basic Electrical Engineering/Data_Sheet.pdf' }
    ]
  },
  'Workshop I': {
    pyq: [
      { name: 'All Assignments Solution', path: '/pdfs/Semester1/Workshop I/MPWAssignments.pdf' },
      { name: 'Final Assignment Fitting', path: '/pdfs/Semester1/Workshop I/FinalAssignmentFitting.pdf' },
      { name: 'Final Assignment Carpentry', path: '/pdfs/Semester1/Workshop I/FinalAssignmentCapenting.pdf' }
    ],
    lab: [
      { name: 'Assignments Template', path: '/pdfs/Semester1/Workshop I/MPWAssignmentsTemplate.pdf' },
      { name: 'Machining', path: '/pdfs/Semester1/Workshop I/Extras/Machining.pdf' },
      { name: 'Turning', path: '/pdfs/Semester1/Workshop I/Extras/turning.pdf' },
      { name: 'Welding', path: '/pdfs/Semester1/Workshop I/Extras/welding.pdf' },
      { name: 'Carpentry', path: '/pdfs/Semester1/Workshop I/Extras/carpentry.pdf' },
      { name: 'Fitting', path: '/pdfs/Semester1/Workshop I/Extras/fitting.pdf' },
      { name: 'Blacksmith', path: '/pdfs/Semester1/Workshop I/Extras/Blacksmith.pdf' }
    ]
  },
  'Idea Lab': {
    pyq: [
      { name: 'ESE Dec 2024', path: '/pdfs/Semester1/Idea Lab/ESE_Dec_2024.pdf' }
    ],
    lab: [
      { name: 'Moisture Sensor Project', path: '/pdfs/Semester1/Idea Lab/IdeaLab_FinalProject.pdf' }
    ]
  },
  'Engineering Graphics Design': {
    pyq: [
      { name: 'ESE Dec 2024', path: '/pdfs/Semester1/Engineering Graphics Design/ESE_Dec_2024.pdf' },
      { name: 'Sessional 1 Dec 2024', path: '/pdfs/Semester1/Engineering Graphics Design/EGDs1_Dec2024.pdf' },
      { name: 'Sessional 2 Dec 2024', path: '/pdfs/Semester1/Engineering Graphics Design/EGDs2_Dec2024.pdf' }
    ],
    lab: [
      { name: 'Title Box Dimention', path: '/pdfs/Semester1/Engineering Graphics Design/TitleboxDimention.pdf' }
    ]
  },

    // Semester 2 Resources

  'Mathematics II': {
    pyq: [
      { name: 'ESE June 2025', path: '/pdfs/Semester2/Mathematics II/ESE_June_2025.pdf' },
      { name: 'Sessional 1 CE June 2025', path: '/pdfs/Semester2/Mathematics II/MathS1_June2025.pdf' },
      { name: 'Sessional 2 CE June 2025', path: '/pdfs/Semester2/Mathematics II/MathS2_June2025.pdf' },
      { name: 'Sessional 1 CSE June 2025', path: '/pdfs/Semester2/Mathematics II/Sessional_1_CSE_2025.pdf' },
      { name: 'Sessional 2 CSE June 2025', path: '/pdfs/Semester2/Mathematics II/Sessional_2_CSE_2025.pdf' }
    ],
    lab: [
      { name: 'Method Of Variation Of Parameter', path: '/pdfs/Semester2/Mathematics II/Extras/Method_of_variation_of_parameters.pdf' },
      { name: 'DE of Order 1 But Higher Degree', path: '/pdfs/Semester2/Mathematics II/Extras/DEOrder1HigherDegree.pdf' },
      { name: 'Legendres Function', path: '/pdfs/Semester2/Mathematics II/Extras/Legendres_Function.pdf' },
      { name: 'Bessels Function', path: '/pdfs/Semester2/Mathematics II/Extras/Bessels_Function.pdf' }
    ]
  },
  'Chemistry': {
    pyq: [
      { name: 'ESE June 2025', path: '/pdfs/Semester2/Chemistry/ESE_June_2025.pdf' },
      { name: 'ESE LAB June 2025', path: '/pdfs/Semester2/Chemistry/ESE_Lab_June_2025.pdf' },
      { name: 'Sessional 1 June 2025', path: '/pdfs/Semester2/Chemistry/ChemS1_June20025.pdf' },
      { name: 'Sessional 2 June 2025', path: '/pdfs/Semester2/Chemistry/ChemS2_June20025.pdf' },
      { name: 'ESE Supplementary Dec 2024', path: '/pdfs/Semester2/Chemistry/ESE_Supplementary_Dec_2024.pdf' },
      { name: 'ESE Dec 2024', path: '/pdfs/Semester2/Chemistry/ESE_Dec_2024.pdf' },
      { name: 'ASTU 2022', path: '/pdfs/Semester2/Chemistry/ASTU_2022.pdf' },
      { name: 'ASTU 2019', path: '/pdfs/Semester2/Chemistry/ASTU_2019.pdf' }
    ],
    lab: [
      { name: 'Lab Manual', path: '/pdfs/Semester2/Chemistry/Lab_Manual.pdf' },
      { name: 'Notes: Green Chemistry', path: '/pdfs/Semester2/Chemistry/Extras/Green_Chemistry.pdf' },
      { name: 'Notes: Corrosion and its Prevention', path: '/pdfs/Semester2/Chemistry/Extras/corrosion_and_its_prevention.pdf' },
      { name: 'Notes: Thermodynamics', path: '/pdfs/Semester2/Chemistry/Extras/thermodynamics.pdf' },
      { name: 'Notes: Molecular Orbital', path: '/pdfs/Semester2/Chemistry/Extras/MO_Theory.pdf' },
      { name: 'Notes: Engineering Material', path: '/pdfs/Semester2/Chemistry/Extras/Engineering_materials.pdf' },
      { name: 'Notes: Fuel', path: '/pdfs/Semester2/Chemistry/Extras/Fuel.pdf' },
      { name: 'Notes: Fuel 2', path: '/pdfs/Semester2/Chemistry/Extras/Fuel2.pdf' },
    ]
  },
  'Programming in C': {
    pyq: [
      { name: 'ESE June 2025', path: '/pdfs/Semester2/Programming in C/ESE_June_2025.pdf' },
      { name: 'ESE Dec 2024', path: '/pdfs/Semester2/Programming in C/ESE_Dec_2024.pdf' }
    ],
    lab: [
      { name: 'Lab Manual', path: '/pdfs/Semester2/Programming in C/Lab_Manual.pdf' },
      { name: 'PPS NOTES', path: '/pdfs/Semester2/Programming in C/Extras/PPS_NOTES.pdf' }
      
    ]
  },
  'UHV': {
    pyq: [
      { name: 'ESE June 2025', path: '/pdfs/Semester2/UHV/ESE_June_2025.pdf' },
      { name: 'Sessional 1 2025', path: '/pdfs/Semester2/UHV/Session1_2025.pdf' },
      { name: 'ESE Supplementary Dec 2024', path: '/pdfs/Semester2/UHV/ESE_Supplementary_Dec_2024.pdf' }
    ],
    lab: [ 
      { name: 'UHV Notes', path: '/pdfs/Semester2/UHV/Extras/UHV_Notes.pdf' },
      { name: 'Handout 1', path: '/pdfs/Semester2/UHV/Extras/HANDOUT1.pdf' },
      { name: 'Handout 2', path: '/pdfs/Semester2/UHV/Extras/HANDOUT2.pdf' },
      { name: 'Handout 3', path: '/pdfs/Semester2/UHV/Extras/HANDOUT3.pdf' },
      { name: 'Handout 4', path: '/pdfs/Semester2/UHV/Extras/HANDOUT4.pdf' },
      { name: 'Handout 5', path: '/pdfs/Semester2/UHV/Extras/HANDOUT5.pdf' }
    ]
  },
  'Workshop II': {
    pyq: [
      { name: 'Turing All Experiments', path: '/pdfs/Semester2/Workshop II/Turing_All_Experiment.pdf' },
      { name: 'Machining Experiment', path: '/pdfs/Semester2/Workshop II/Machining_merged.pdf' }
    ]
  },
  'ETC': {
    pyq: [
      { name: 'ESE June 2025', path: '/pdfs/Semester2/ETC/ESE_June_2025.pdf' },
      { name: 'Sessional 2 June 2025', path: '/pdfs/Semester2/ETC/ETCs2_June2025.pdf' },
      { name: 'ESE Dec 2024', path: '/pdfs/Semester2/ETC/ESE_Dec_2024.pdf' }
    ],
    lab: [
      { name: 'Notes: Essay', path: '/pdfs/Semester2/ETC/Extras/ESSAY.pdf' },
      { name: 'Notes: Common Errors', path: '/pdfs/Semester2/ETC/Extras/common_errors.pdf' },
      { name: 'Notes: Interview & Communication', path: '/pdfs/Semester2/ETC/Extras/interview_communication_at_workplace.pdf' },
      { name: 'Notes: Dialog', path: '/pdfs/Semester2/ETC/Extras/Dialogues.pdf' }
    ]
  },
  'Japanese': {
    pyq: [
      { name: 'ESE June 2025', path: '/pdfs/Semester2/Japanese/ESE_June_2025.pdf' }
    ]
  },
  'Russian': {
    pyq: [
      { name: 'ESE June 2025', path: '/pdfs/Semester2/Russian/ESE_June_2025.pdf' },
      { name: 'Sessional 1 2025', path: '/pdfs/Semester2/Russian/Sessional_1.pdf' },
      { name: 'Sessional 2 2025', path: '/pdfs/Semester2/Russian/Sessional_2.pdf' }
    ],
    lab: [
      { name: 'Viva June 2025', path: '/pdfs/Semester2/Russian/Viva.pdf' }
    ]
  },

  // Semester 3 Resources
  'Mathematics III': {
    pyq: [
      { name: 'Sessional 1 Dec 2025', path: '/pdfs/Semester3/Mathematics III/MathsS1_2025.pdf' },
      { name: 'ESE Dec 2024', path: '/pdfs/Semester3/Mathematics III/ESE_DEC_2024.pdf' },
      { name: 'Sessional 1 Dec 2024', path: '/pdfs/Semester3/Mathematics III/MathsS1_2024.pdf' },
      { name: 'ASTU SET A Dec 2024', path: '/pdfs/Semester3/Mathematics III/ASTU_setA_DEC_2024.pdf' },
      { name: 'ASTU SET B Dec 2024', path: '/pdfs/Semester3/Mathematics III/ASTU_setB_DEC_2024.pdf' },
    ],
    lab: [
    ]
  },
  'CADD': {
    pyq: [
      { name: 'ASTU Dec 2024', path: '/pdfs/Semester3/CADD/ASTU_DEC_2024.pdf' },
    ],
  },
  'CMTE': {
    pyq: [
       ],
    lab: [
    ]
  },
  'Concrete Technology': {
    pyq: [
      { name: 'ASTU June 2025', path: '/pdfs/Semester3/Concrete Technology/ASTU_JUNE_2025.pdf' },
      ],
    lab: [
    ]
  },
  'Fluid Mechanics': {
    pyq: [
      { name: 'ESE Supplementary Dec 2024', path: '/pdfs/Semester3/Fluid Mechanics/ESE_Supplementary_Dec_2024.pdf' },
      { name: 'ESE Dec 2024', path: '/pdfs/Semester3/Fluid Mechanics/ESE_DEC_2024.pdf' },
      { name: 'ASTU Dec 2024', path: '/pdfs/Semester3/Fluid Mechanics/ASTU_DEC_2024.pdf' },
    ],
    lab: [
      { name: 'Lab Syllabus', path: '/pdfs/Semester3/Fluid Mechanics/Extras/FM_lab_syllabus.pdf' },
      { name: 'Lab Manual', path: '/pdfs/Semester3/Fluid Mechanics/Extras/FM_Lab_Manual.pdf' },
    ]
  },
  'Solid Mechanics': {
    pyq: [
      { name: 'ASTU Dec 2024', path: '/pdfs/Semester3/Solid Mechanics/ASTU_DEC_2024.pdf' },
    ],
    lab: [
      { name: 'Lab Syllabus', path: '/pdfs/Semester3/Solid Mechanics/Extras/Sm_lab_syllabus.pdf' },
      { name: 'Lab Manual', path: '/pdfs/Semester3/Solid Mechanics/Extras/SM_lab_manual.pdf' },
    ]
  },
  'MNCAC': {
    pyq: [
      { name: 'ESE Dec 2024', path: '/pdfs/Semester3/MNCAC/ESE_DEC_2024.pdf' },
    ],
    lab: [
      { name: 'NOTES: Appraoches to disability', path: '/pdfs/Semester3/MNCAC/Extras/Appraoches_to_disability.pdf' },
      { name: 'NOTES: Understanding Disability', path: '/pdfs/Semester3/MNCAC/Extras/UNDERSTANDING_DISABILITY.pdf' },
      { name: 'NOTES: Difficulties Faced By PWD', path: '/pdfs/Semester3/MNCAC/Extras/MNCAC_DIFFICULTIES_FACED_BY_PERSONS_WITH_DISABILITIES.pdf' },
      { name: 'NOTES: Prevailing Legilations', path: '/pdfs/Semester3/MNCAC/Extras/PREVAILING_LEGISLATIONS.pdf' },
    ]
  },
  'IKS': {
    pyq: [
      { name: 'ESE Dec 2024', path: '/pdfs/Semester3/IKS/ESE_DEC_2024.pdf' },
    ],
    lab: [
      { name: 'Notes: Understanding Human Body', path: '/pdfs/Semester3/IKS/Extras/Understanding_Human_Body.pdf' },
      { name: 'Notes: Understanding Swastha Vritta', path: '/pdfs/Semester3/IKS/Extras/Understanding_Swastha_Vritta.pdf' },
      { name: 'Notes: Trividha Upastambha', path: '/pdfs/Semester3/IKS/Extras/Trividha_Upastambha.pdf' },
      { name: 'Notes: Ritu Charya', path: '/pdfs/Semester3/IKS/Extras/RITU_CHARYA.pdf' },
      { name: 'Notes: Sadvritta', path: '/pdfs/Semester3/IKS/Extras/Sadvritta.pdf' },
    ]
  },

  // Semester 4 Resources
  'Surveying and Geomatics': {
    pyq: [
      { name: 'Sessional 1 June 2025', path: '/pdfs/Semester4/Surveying and Geomatics/Survey_S1_JUNE_2025.pdf' },
      { name: 'Sessional 2 June 2025', path: '/pdfs/Semester4/Surveying and Geomatics/Survey_S2_JUNE_2025.pdf' },
    ],
    lab: [
    ]
  },
  'Geotechnical Engineering': {
    pyq: [
      { name: 'Sessional 1 June 2025', path: '/pdfs/Semester4/Geotechnical Engineering/Geotechnical_S1_JUNE_2025.pdf' },
      { name: 'Sessional 2 June 2025', path: '/pdfs/Semester4/Geotechnical Engineering/Geotechnical_S2_JUNE_2025.pdf' },
    ],
  },
  'Hydraulic Engineering': {
    pyq: [
      { name: 'ESE June 2025', path: '/pdfs/Semester4/Hydraulic Engineering/ESE_JUNE_2025.pdf' },
      { name: 'Sessional 1 June 2025', path: '/pdfs/Semester4/Hydraulic Engineering/Hydraulic_S1_JUNE_2025.pdf' },
      { name: 'Sessional 2 June 2025', path: '/pdfs/Semester4/Hydraulic Engineering/Hydraulic_S2_JUNE_2025.pdf' },
       ],
    lab: [
    ]
  },
  'Transportation Engineering': {
    pyq: [
      { name: 'Sessional 1 June 2025', path: '/pdfs/Semester4/Transportation Engineering/Transportation_S1_JUNE_2025.pdf' },
      { name: 'Sessional 2 June 2025', path: '/pdfs/Semester4/Transportation Engineering/Transportation_S2_JUNE_2025.pdf' },
      ],
    lab: [
    ]
  },
  'Structural Analysis': {
    pyq: [
      { name: 'Sessional 1 June 2025', path: '/pdfs/Semester4/Structural Analysis/Structural_S1_JUNE_2025.pdf' },
      { name: 'Sessional 2 June 2025', path: '/pdfs/Semester4/Structural Analysis/Structural_S2_JUNE_2025.pdf' },
    ],
    lab: [
    ]
  },
  'Construction Engineering & Management': {
    pyq: [
      { name: 'Sessional 1 June 2025', path: '/pdfs/Semester4/Construction Engineering & Management/CEM_S1_JUNE_2025.pdf' },
      { name: 'Sessional 2 June 2025', path: '/pdfs/Semester4/Construction Engineering & Management/CEM_S2_JUNE_2025.pdf' },
    ],
    lab: [
    ]
  },
  'Civil Engineering Societal & Global Impact': {
    pyq: [
    ],
    lab: [
    ]
  },

  // Semester 5 Resources
};

export default resources;

// Chapter -> Topics taxonomy, used for the cascading dropdowns in the
// question editor (select Subject -> Chapter list updates -> select
// Chapter -> Topic list updates). Sourced from the NCERT syllabus.
//
// Note: the source syllabus groups everything under "Biology", but our
// platform splits NEET biology into Botany and Zoology (matching how NEET
// itself scores/sections them). The split below follows the standard
// coaching-institute convention (plant-related + genetics/ecology/evolution
// under Botany, animal/human-physiology under Zoology) — adjust freely if
// your institute categorizes differently.

export type Taxonomy = Record<string, Record<string, string[]>>;

export const SYLLABUS: Taxonomy = {
  Physics: {
    "Physical World": [
      "Physics and Scope",
      "Fundamental Forces in Nature",
      "Nature of Physical Laws",
      "Physics, Technology and Society",
    ],
    "Units and Measurements": [
      "Physical Quantities",
      "SI System of Units",
      "Fundamental and Derived Units",
      "Dimensional Formula",
      "Dimensional Analysis",
      "Significant Figures",
      "Scientific Notation",
      "Errors in Measurement",
      "Precision and Accuracy",
    ],
    "Motion in a Straight Line": [
      "Position and Path Length",
      "Distance and Displacement",
      "Speed",
      "Velocity",
      "Uniform Motion",
      "Non-uniform Motion",
      "Acceleration",
      "Equations of Motion",
      "Relative Velocity",
      "Position-Time Graph",
      "Velocity-Time Graph",
      "Acceleration-Time Graph",
    ],
    "Motion in a Plane": [
      "Scalars and Vectors",
      "Vector Addition",
      "Resolution of Vectors",
      "Projectile Motion",
      "Uniform Circular Motion",
    ],
    "Laws of Motion": [
      "Force",
      "Newton's First Law",
      "Newton's Second Law",
      "Newton's Third Law",
      "Momentum",
      "Impulse",
      "Friction",
      "Circular Motion Applications",
    ],
    "Work, Energy and Power": [
      "Work",
      "Kinetic Energy",
      "Work-Energy Theorem",
      "Potential Energy",
      "Conservation of Mechanical Energy",
      "Power",
    ],
    "System of Particles and Rotational Motion": [
      "Centre of Mass",
      "Motion of Centre of Mass",
      "Torque",
      "Angular Momentum",
      "Moment of Inertia",
      "Radius of Gyration",
      "Rolling Motion",
    ],
    Gravitation: [
      "Universal Law of Gravitation",
      "Gravitational Constant",
      "Acceleration due to Gravity",
      "Gravitational Potential Energy",
      "Escape Velocity",
      "Orbital Velocity",
      "Satellites",
      "Kepler's Laws",
    ],
    "Mechanical Properties of Solids": [
      "Elastic Behaviour",
      "Stress",
      "Strain",
      "Hooke's Law",
      "Young's Modulus",
      "Bulk Modulus",
      "Shear Modulus",
    ],
    "Mechanical Properties of Fluids": [
      "Pressure",
      "Pascal's Law",
      "Buoyant Force",
      "Archimedes' Principle",
      "Surface Tension",
      "Capillarity",
      "Viscosity",
      "Bernoulli's Principle",
    ],
    "Thermal Properties of Matter": [
      "Temperature",
      "Heat",
      "Thermal Expansion",
      "Specific Heat Capacity",
      "Calorimetry",
      "Heat Transfer",
      "Newton's Law of Cooling",
    ],
    Thermodynamics: [
      "Thermal Equilibrium",
      "Zeroth Law",
      "Internal Energy",
      "Heat and Work",
      "First Law of Thermodynamics",
      "Second Law of Thermodynamics",
      "Heat Engines",
      "Refrigerators",
    ],
    "Kinetic Theory": [
      "Molecular Nature of Matter",
      "Ideal Gas Equation",
      "Kinetic Theory of Gases",
      "Degrees of Freedom",
      "Mean Free Path",
    ],
    Oscillations: [
      "Periodic Motion",
      "Simple Harmonic Motion",
      "Velocity and Acceleration in SHM",
      "Energy in SHM",
      "Simple Pendulum",
      "Damped Oscillation",
      "Forced Oscillation",
      "Resonance",
    ],
    Waves: [
      "Wave Motion",
      "Types of Waves",
      "Wave Equation",
      "Speed of Wave",
      "Superposition Principle",
      "Standing Waves",
      "Sound Waves",
      "Doppler Effect",
    ],
    "Electric Charges and Fields": [
      "Electric Charge",
      "Properties of Charge",
      "Coulomb's Law",
      "Electric Field",
      "Electric Field Lines",
      "Electric Dipole",
      "Electric Flux",
      "Gauss's Law",
    ],
    "Electrostatic Potential and Capacitance": [
      "Electric Potential",
      "Potential Difference",
      "Equipotential Surfaces",
      "Capacitors",
      "Combination of Capacitors",
      "Dielectrics",
      "Energy Stored in Capacitor",
    ],
    "Current Electricity": [
      "Electric Current",
      "Drift Velocity",
      "Ohm's Law",
      "Resistivity",
      "Electrical Conductivity",
      "Combination of Resistors",
      "Kirchhoff's Laws",
      "Wheatstone Bridge",
      "Meter Bridge",
      "Potentiometer",
    ],
    "Moving Charges and Magnetism": [
      "Magnetic Force",
      "Lorentz Force",
      "Motion in Magnetic Field",
      "Biot-Savart Law",
      "Ampere's Circuital Law",
      "Force Between Parallel Conductors",
      "Cyclotron",
      "Galvanometer",
    ],
    "Magnetism and Matter": ["Bar Magnet", "Magnetic Field Lines", "Earth Magnetism", "Para, Dia and Ferromagnetism"],
    "Electromagnetic Induction": [
      "Magnetic Flux",
      "Faraday's Laws",
      "Lenz's Law",
      "Motional EMF",
      "Self Induction",
      "Mutual Induction",
    ],
    "Alternating Current": [
      "Alternating Current",
      "AC Generator",
      "RMS Value",
      "LC Oscillation",
      "LCR Circuit",
      "Power in AC",
      "Transformer",
    ],
    "Electromagnetic Waves": ["Maxwell's Theory", "Electromagnetic Spectrum", "Properties of Electromagnetic Waves"],
    "Ray Optics and Optical Instruments": [
      "Reflection",
      "Refraction",
      "Total Internal Reflection",
      "Spherical Mirrors",
      "Refraction Through Lenses",
      "Lens Formula",
      "Optical Instruments",
    ],
    "Wave Optics": ["Huygens Principle", "Interference", "Young's Double Slit Experiment", "Diffraction", "Polarisation"],
    "Dual Nature of Radiation and Matter": ["Photoelectric Effect", "Einstein's Photoelectric Equation", "de Broglie Hypothesis"],
    Atoms: ["Rutherford Model", "Bohr Model", "Hydrogen Spectrum"],
    Nuclei: ["Nuclear Composition", "Radioactivity", "Nuclear Force", "Binding Energy", "Nuclear Fission", "Nuclear Fusion"],
    "Semiconductor Electronics": [
      "Semiconductor",
      "Intrinsic Semiconductor",
      "Extrinsic Semiconductor",
      "PN Junction",
      "Diode",
      "Rectifier",
      "Transistor",
      "Logic Gates",
    ],
  },

  Chemistry: {
    "Some Basic Concepts of Chemistry": [
      "Nature of Matter",
      "Laws of Chemical Combination",
      "Dalton's Atomic Theory",
      "Mole Concept",
      "Atomic Mass",
      "Molecular Mass",
      "Empirical Formula",
      "Molecular Formula",
      "Stoichiometry",
      "Limiting Reagent",
      "Concentration Terms",
    ],
    "Structure of Atom": [
      "Atomic Models",
      "Electromagnetic Radiation",
      "Photoelectric Effect",
      "Bohr Model",
      "Quantum Mechanical Model",
      "Quantum Numbers",
      "Atomic Orbitals",
      "Electronic Configuration",
    ],
    "Classification of Elements and Periodicity in Properties": [
      "Modern Periodic Law",
      "Periodic Table",
      "Atomic Radius",
      "Ionization Enthalpy",
      "Electron Gain Enthalpy",
      "Electronegativity",
    ],
    "Chemical Bonding and Molecular Structure": [
      "Ionic Bond",
      "Covalent Bond",
      "Lewis Structure",
      "Formal Charge",
      "Resonance",
      "VSEPR Theory",
      "Valence Bond Theory",
      "Hybridization",
      "Molecular Orbital Theory",
      "Hydrogen Bonding",
    ],
    "Chemical Thermodynamics": ["System and Surroundings", "Internal Energy", "Enthalpy", "Hess's Law", "Entropy", "Gibbs Energy"],
    Equilibrium: [
      "Chemical Equilibrium",
      "Law of Mass Action",
      "Equilibrium Constant",
      "Le Chatelier Principle",
      "Ionic Equilibrium",
      "pH",
      "Buffer Solution",
      "Solubility Product",
    ],
    "Redox Reactions": ["Oxidation", "Reduction", "Oxidation Number", "Balancing Redox Reactions"],
    "Organic Chemistry – Some Basic Principles and Techniques": [
      "Classification of Organic Compounds",
      "IUPAC Nomenclature",
      "Isomerism",
      "Electronic Effects",
      "Reaction Mechanism",
      "Purification Techniques",
    ],
    Hydrocarbons: ["Alkanes", "Alkenes", "Alkynes", "Aromatic Hydrocarbons"],
    "The s-Block Elements": ["Hydrogen", "Alkali Metals", "Alkaline Earth Metals", "Important Compounds"],
    "The p-Block Elements": ["Group 13 Elements", "Group 14 Elements", "Important Compounds"],
    "Organic Chemistry – Some Basic Techniques": [
      "Qualitative Analysis",
      "Quantitative Analysis",
      "Chromatography",
      "Distillation",
      "Crystallisation",
    ],
    Solutions: [
      "Types of Solutions",
      "Solubility",
      "Vapour Pressure",
      "Raoult's Law",
      "Ideal Solution",
      "Non-Ideal Solution",
      "Colligative Properties",
    ],
    Electrochemistry: ["Electrochemical Cells", "Galvanic Cell", "Electrolytic Cell", "Nernst Equation", "Conductance", "Kohlrausch's Law"],
    "Chemical Kinetics": ["Rate of Reaction", "Rate Law", "Order of Reaction", "Molecularity", "Half-Life", "Arrhenius Equation"],
    "d and f Block Elements": ["Transition Elements", "Lanthanoids", "Actinoids", "Properties"],
    "Coordination Compounds": ["Ligands", "Coordination Number", "Nomenclature", "Isomerism", "Bonding", "Applications"],
    "Haloalkanes and Haloarenes": ["Classification", "Preparation", "Physical Properties", "Chemical Reactions"],
    "Alcohols, Phenols and Ethers": ["Alcohols", "Phenols", "Ethers", "Preparation", "Reactions"],
    "Aldehydes, Ketones and Carboxylic Acids": ["Nomenclature", "Preparation", "Physical Properties", "Chemical Properties"],
    Amines: ["Classification", "Preparation", "Properties", "Chemical Reactions", "Diazonium Salts"],
    Biomolecules: ["Carbohydrates", "Proteins", "Enzymes", "Vitamins", "Nucleic Acids"],
  },

  Botany: {
    "The Living World": ["What is Living", "Biodiversity", "Taxonomy", "Species", "Genus", "Family", "Order", "Class", "Phylum", "Kingdom", "Taxonomical Aids"],
    "Biological Classification": ["Five Kingdom Classification", "Monera", "Protista", "Fungi", "Viruses", "Viroids", "Lichens"],
    "Plant Kingdom": ["Algae", "Bryophytes", "Pteridophytes", "Gymnosperms", "Angiosperms", "Plant Life Cycles"],
    "Morphology of Flowering Plants": ["Root", "Stem", "Leaf", "Inflorescence", "Flower", "Fruit", "Seed", "Families"],
    "Anatomy of Flowering Plants": ["Tissues", "Tissue System", "Anatomy of Root", "Anatomy of Stem", "Anatomy of Leaf", "Secondary Growth"],
    "Cell: The Unit of Life": ["Cell Theory", "Cell Structure", "Cell Organelles", "Cell Membrane"],
    Biomolecules: ["Carbohydrates", "Proteins", "Lipids", "Nucleic Acids", "Enzymes"],
    "Cell Cycle and Cell Division": ["Cell Cycle", "Mitosis", "Meiosis"],
    "Photosynthesis in Higher Plants": ["Pigments", "Light Reaction", "Dark Reaction", "C3 Pathway", "C4 Pathway", "Photorespiration"],
    "Respiration in Plants": ["Glycolysis", "Krebs Cycle", "Electron Transport Chain", "Fermentation"],
    "Plant Growth and Development": ["Growth", "Plant Growth Regulators", "Photoperiodism", "Vernalisation"],
    "Sexual Reproduction in Flowering Plants": ["Flower Structure", "Microsporogenesis", "Megasporogenesis", "Pollination", "Double Fertilisation", "Seed Development"],
    "Principles of Inheritance and Variation": ["Mendel's Laws", "Monohybrid Cross", "Dihybrid Cross", "Chromosomal Theory", "Mutation"],
    "Molecular Basis of Inheritance": ["DNA Structure", "DNA Replication", "Transcription", "Genetic Code", "Translation", "Gene Regulation", "Human Genome Project"],
    Evolution: ["Origin of Life", "Evidences", "Darwinism", "Hardy-Weinberg Principle", "Speciation"],
    "Microbes in Human Welfare": ["Household Products", "Industrial Products", "Sewage Treatment", "Biogas", "Biofertilisers", "Biopesticides"],
    "Biotechnology: Principles and Processes": ["Genetic Engineering", "Restriction Enzymes", "Cloning Vectors", "PCR", "Bioreactors"],
    "Biotechnology and Its Applications": ["Genetically Modified Organisms", "Gene Therapy", "Transgenic Animals", "Biopatent", "Bioethics"],
    "Organisms and Populations": ["Population Attributes", "Population Growth", "Species Interaction", "Adaptation"],
    Ecosystem: ["Ecosystem Structure", "Energy Flow", "Food Chain", "Food Web", "Ecological Pyramid", "Ecological Succession"],
    "Biodiversity and Conservation": ["Biodiversity", "Loss of Biodiversity", "Conservation", "National Parks", "Wildlife Sanctuaries", "Biosphere Reserves", "Hotspots"],
  },

  Zoology: {
    "Animal Kingdom": ["Basis of Classification", "Non-Chordates", "Chordates"],
    "Structural Organisation in Animals": ["Animal Tissues", "Cockroach", "Frog"],
    "Breathing and Exchange of Gases": ["Respiratory Organs", "Mechanism of Breathing", "Gas Exchange", "Transport of Oxygen", "Transport of Carbon Dioxide"],
    "Body Fluids and Circulation": ["Blood", "Lymph", "Human Heart", "Cardiac Cycle", "Electrocardiogram", "Double Circulation"],
    "Excretory Products and Their Elimination": ["Human Excretory System", "Urine Formation", "Regulation of Kidney Function", "Dialysis"],
    "Locomotion and Movement": ["Skeletal System", "Muscles", "Muscle Contraction", "Joints"],
    "Neural Control and Coordination": ["Neuron", "Nerve Impulse", "Central Nervous System", "Peripheral Nervous System", "Reflex Action", "Sense Organs"],
    "Chemical Coordination and Integration": ["Endocrine Glands", "Hormones", "Mechanism of Hormone Action"],
    "Human Reproduction": ["Male Reproductive System", "Female Reproductive System", "Gametogenesis", "Menstrual Cycle", "Fertilisation", "Pregnancy", "Parturition"],
    "Reproductive Health": ["Birth Control", "Medical Termination of Pregnancy", "Infertility", "Sexually Transmitted Diseases"],
    "Human Health and Disease": ["Immunity", "Vaccination", "Allergies", "AIDS", "Cancer", "Drugs and Alcohol Abuse"],
  },
};

// A combined "Biology" view for test-building convenience — NEET's actual
// exam paper presents one Biology section (not separate Botany/Zoology
// sections), so test builders can pick a single "Biology" section instead
// of manually adding two. This is purely a UI-level merge: every chapter
// here still belongs to either Botany or Zoology underneath (see
// resolveBiologySubject below), so individual questions keep saving under
// their real subject and nothing about Question Bank browsing, DPPs, or
// Teacher subject permissions (all still Physics/Chemistry/Botany/Zoology)
// needs to change.
SYLLABUS.Biology = { ...SYLLABUS.Botany, ...SYLLABUS.Zoology };

// Chapter names don't collide between Botany and Zoology (verified against
// the taxonomy above), so a chapter unambiguously identifies its real
// subject. Given a section subject and a chosen chapter, returns the actual
// subject a Question row should be saved under. For any subject other than
// "Biology" this is just a no-op passthrough.
export function resolveBiologySubject(sectionSubject: string, chapter: string): string {
  if (sectionSubject !== "Biology") return sectionSubject;
  if (SYLLABUS.Botany[chapter]) return "Botany";
  if (SYLLABUS.Zoology[chapter]) return "Zoology";
  // Chapter not recognized (e.g. a legacy/custom chapter) — default to
  // Botany rather than saving an unresolvable "Biology" subject that
  // wouldn't match anything in the Question Bank's subject filters.
  return "Botany";
}

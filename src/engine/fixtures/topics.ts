/**
 * Engine v2 — V2-0 Fixture Topics
 *
 * 5 diverse topics with 10 slides each of pre-written content.
 * Used by the V2-0 pipeline in place of LLM-generated content.
 * V2-1 replaces these with Director + SlideWriter agents.
 */

import type { SlideRole } from "../layouts/types";
import type { Mood } from "../designSystem/generator";

// ─── Fixture Types ──────────────────────────────────────

export interface FixtureSlideContent {
  title: string;
  subtitle?: string;
  kicker?: string;
  body?: string;
  bodyItems?: string[];
  caption?: string;
  bigNumber?: { number: string; label: string; supporting?: string };
  stat1?: { number: string; label: string; supporting?: string };
  stat2?: { number: string; label: string; supporting?: string };
  stat3?: { number: string; label: string; supporting?: string };
  cards?: Array<{ icon: string; title: string; body: string }>;
  gridItems?: Array<{ icon: string; title: string; desc: string }>;
  imageAlt?: string;
  action?: string;
  speakerNotes: string;
}

export interface FixtureTopic {
  slug: string;
  title: string;
  mood: Mood;
  language: string;
  roles: SlideRole[];
  slides: FixtureSlideContent[];
}

// ─── Topic 1: Autonomous AI Agents ──────────────────────

const aiAgents: FixtureTopic = {
  slug: "ai-agents",
  title: "The Rise of Autonomous AI Agents",
  mood: "techy",
  language: "en",
  roles: [
    "cover", "agenda", "statement", "stat", "comparison",
    "data", "process", "section", "takeaways", "cta",
  ],
  slides: [
    {
      title: "The Rise of Autonomous AI Agents",
      subtitle: "How multi-agent systems are reshaping enterprise automation in 2026",
      kicker: "AI FRONTIER • 2026",
      imageAlt: "Abstract neural network visualization",
      speakerNotes: "Welcome the audience. Frame the talk around the shift from single-model AI to multi-agent orchestration.",
    },
    {
      title: "What We Will Cover",
      bodyItems: [
        "From chatbots to autonomous agents — the evolution",
        "Multi-agent architecture patterns & orchestration",
        "Enterprise adoption: metrics, ROI & case studies",
        "Building reliable agent pipelines with fallback routing",
        "The road ahead: AGI-lite systems in production",
      ],
      speakerNotes: "Walk through the agenda. Emphasize that this is about production-ready systems, not research demos.",
    },
    {
      title: "Beyond Chatbots: The Agent Paradigm",
      kicker: "THE SHIFT",
      body: "Traditional AI systems respond to prompts. Autonomous agents plan, reason, use tools, and execute multi-step workflows without human intervention. They represent a fundamental shift from reactive to proactive AI.",
      caption: "Source: Gartner 2026 AI Hype Cycle",
      imageAlt: "Comparison diagram of chatbot vs autonomous agent",
      speakerNotes: "Explain the key difference: agents have goals, not just instructions. They can decompose tasks and self-correct.",
    },
    {
      title: "The Numbers Tell the Story",
      stat1: { number: "78%", label: "Enterprise Adoption", supporting: "of Fortune 500 testing agent systems" },
      stat2: { number: "12×", label: "Productivity Gain", supporting: "in code review automation" },
      stat3: { number: "$47B", label: "Market Size by 2027", supporting: "up from $8B in 2024" },
      caption: "Source: McKinsey Digital, Q2 2026",
      bigNumber: { number: "78%", label: "Enterprise Adoption Rate", supporting: "Fortune 500 companies" },
      imageAlt: "Growth chart of AI agent market",
      speakerNotes: "These stats show explosive growth. The 12x productivity gain in code review is particularly compelling for technical audiences.",
    },
    {
      title: "Agent Architecture Patterns",
      cards: [
        { icon: "cpu", title: "Single Agent", body: "One LLM with tool access. Simple but limited context window and capability." },
        { icon: "git-branch", title: "Multi-Agent Pipeline", body: "Specialized agents in sequence. Each handles one task with handoff protocols." },
        { icon: "network", title: "Agent Swarm", body: "Dynamic agent spawning with shared memory. Most flexible but hardest to debug." },
      ],
      gridItems: [
        { icon: "cpu", title: "Single Agent", desc: "One model, multiple tools, limited scope" },
        { icon: "git-branch", title: "Pipeline", desc: "Sequential specialized agents with handoffs" },
        { icon: "network", title: "Swarm", desc: "Dynamic spawning with shared memory pool" },
        { icon: "shield", title: "Guardrailed", desc: "Constrained agents with safety boundaries" },
      ],
      speakerNotes: "Walk through the three main patterns. Most production systems use the pipeline pattern because it is easier to debug and monitor.",
    },
    {
      title: "Real-World Impact Metrics",
      stat1: { number: "340%", label: "ROI", supporting: "average return on agent investment" },
      stat2: { number: "6.2hrs", label: "Time Saved", supporting: "per developer per day" },
      stat3: { number: "94%", label: "Accuracy", supporting: "on complex reasoning tasks" },
      bodyItems: [
        "Customer support resolution time reduced by 67%",
        "Code generation accuracy improved to 94% with multi-pass verification",
        "Document processing throughput increased 15× with agent pipelines",
      ],
      caption: "Aggregated from 200+ enterprise deployments, H1 2026",
      imageAlt: "Dashboard showing agent performance metrics",
      speakerNotes: "Focus on the ROI number — 340% is what gets executive buy-in. The time savings translate directly to headcount efficiency.",
    },
    {
      title: "Building a Reliable Agent Pipeline",
      cards: [
        { icon: "search", title: "1. Researcher", body: "Gathers context from documents, APIs, and web sources with citation tracking." },
        { icon: "palette", title: "2. Specialist", body: "Domain-specific processing: code gen, data analysis, or creative writing." },
        { icon: "check-circle", title: "3. Verifier", body: "Automated QA with deterministic checks and LLM-based review loops." },
      ],
      gridItems: [
        { icon: "search", title: "Research", desc: "Context gathering with citation tracking" },
        { icon: "code", title: "Process", desc: "Domain-specific task execution" },
        { icon: "check-circle", title: "Verify", desc: "QA checks and validation loops" },
        { icon: "send", title: "Deliver", desc: "Format output and export results" },
      ],
      body: "A well-designed pipeline has clear handoff protocols, error isolation per stage, and fallback routes when primary models are unavailable.",
      speakerNotes: "This is the architecture we use in production. Key insight: error isolation prevents one failing agent from crashing the whole pipeline.",
    },
    {
      title: "The Trust & Safety Challenge",
      kicker: "CRITICAL CONCERN",
      body: "Autonomous agents amplify both capability and risk. Hallucination propagation across agent chains, unauthorized tool use, and prompt injection attacks require new safety frameworks beyond simple guardrails.",
      caption: "NIST AI Risk Framework 2.0 — Agent-specific guidelines released March 2026",
      imageAlt: "Security framework diagram for AI agents",
      bodyItems: [
        "Hallucination propagation across agent chains",
        "Unauthorized tool use and scope creep",
        "Prompt injection attacks on inter-agent communication",
        "New safety frameworks needed beyond simple guardrails",
      ],
      speakerNotes: "Don't skip this slide. Trust and safety is the #1 blocker for enterprise adoption. Mention the NIST framework update.",
    },
    {
      title: "Key Takeaways",
      bodyItems: [
        "Multi-agent systems are production-ready — 78% of Fortune 500 are testing them",
        "Pipeline architecture beats swarm for most enterprise use cases",
        "Error isolation and fallback routing are non-negotiable for reliability",
        "Trust & safety frameworks must evolve alongside agent capabilities",
        "Start small: automate one workflow end-to-end before scaling",
      ],
      speakerNotes: "Summarize the five key points. Emphasize the 'start small' advice — many teams try to boil the ocean.",
    },
    {
      title: "Ready to Build Your First Agent?",
      subtitle: "Start with a single workflow. Measure. Iterate. Scale.",
      action: "Book a Workshop →",
      speakerNotes: "Close with a clear call to action. Offer the workshop as a concrete next step.",
    },
  ],
};

// ─── Topic 2: Climate Change ────────────────────────────

const climateChange: FixtureTopic = {
  slug: "climate-change",
  title: "Climate Change: Facts & Action",
  mood: "bold",
  language: "en",
  roles: [
    "cover", "agenda", "stat", "statement", "data",
    "comparison", "process", "section", "takeaways", "cta",
  ],
  slides: [
    {
      title: "Climate Change: Facts & Action",
      subtitle: "The science, the stakes, and what we can do right now",
      kicker: "URGENT BRIEFING • 2026",
      imageAlt: "Earth from space showing weather patterns",
      speakerNotes: "Open with urgency but not doom. Frame this as an action-oriented briefing.",
    },
    {
      title: "Today's Agenda",
      bodyItems: [
        "Current state: temperature records and tipping points",
        "Economic impact: costs of inaction vs. investment",
        "Technology solutions: renewables, carbon capture, nuclear",
        "Policy frameworks: what's working and what's not",
        "Individual and corporate action steps",
      ],
      speakerNotes: "Set expectations: this is data-driven and solutions-focused, not a doom-and-gloom lecture.",
    },
    {
      title: "2025 Was the Hottest Year on Record",
      bigNumber: { number: "1.62°C", label: "Above Pre-Industrial Average", supporting: "First year exceeding 1.5°C target" },
      stat1: { number: "1.62°C", label: "Global Temp Rise", supporting: "above pre-industrial baseline" },
      stat2: { number: "423ppm", label: "CO₂ Concentration", supporting: "highest in 3 million years" },
      stat3: { number: "$380B", label: "Climate Damages", supporting: "in 2025 alone" },
      caption: "Source: IPCC AR7 Summary, WMO 2026",
      imageAlt: "Temperature anomaly graph 1850-2025",
      speakerNotes: "The 1.62°C number is shocking — we've already breached the Paris target. Let this sink in before moving on.",
    },
    {
      title: "This Is Not a Future Problem",
      kicker: "THE REALITY",
      body: "Climate change is here. Record wildfires in Southern Europe, unprecedented flooding in Southeast Asia, and crop failures across the Sahel are not projections — they are headlines from the last 12 months. The cost of inaction now exceeds the cost of transition.",
      caption: "UN Environment Programme, 2026 Adaptation Gap Report",
      imageAlt: "Collage of extreme weather events",
      speakerNotes: "Make it concrete with recent events. The audience likely remembers these headlines. Connect the abstract to the tangible.",
    },
    {
      title: "The Economics of Climate Action",
      stat1: { number: "$4.3T", label: "Annual Investment Needed", supporting: "for net-zero by 2050" },
      stat2: { number: "$178T", label: "Cost of Inaction", supporting: "cumulative GDP loss by 2070" },
      stat3: { number: "23M", label: "Green Jobs Created", supporting: "in renewable energy sector" },
      bodyItems: [
        "Every $1 invested in climate adaptation saves $4-8 in disaster costs",
        "Renewable energy is now cheaper than fossil fuels in 90% of markets",
        "Green bond market grew 34% in 2025 to $890B annual issuance",
      ],
      caption: "Sources: IEA, World Bank, BloombergNEF",
      imageAlt: "Cost comparison chart: action vs inaction",
      speakerNotes: "Lead with the ROI argument. The $178T cost of inaction vs $4.3T investment is the strongest economic case.",
    },
    {
      title: "Solution Technologies Compared",
      cards: [
        { icon: "sun", title: "Solar & Wind", body: "Mature, cost-competitive. Solar alone can meet 40% of global energy demand by 2050." },
        { icon: "atom", title: "Nuclear (SMR)", body: "Small modular reactors offer baseload power. 67 designs in licensing pipeline globally." },
        { icon: "cloud", title: "Carbon Capture", body: "Direct air capture costs dropped 60% since 2020. Now at $200-350 per ton CO₂." },
      ],
      gridItems: [
        { icon: "sun", title: "Solar & Wind", desc: "Mature, cheapest new energy source globally" },
        { icon: "atom", title: "Nuclear SMR", desc: "Reliable baseload, 67 designs in pipeline" },
        { icon: "cloud", title: "Carbon Capture", desc: "DAC costs down 60%, $200-350 per ton" },
        { icon: "battery", title: "Grid Storage", desc: "Battery costs fell 90% in a decade" },
      ],
      speakerNotes: "Don't pick winners — all these technologies are needed. The portfolio approach is key.",
    },
    {
      title: "From Policy to Practice",
      cards: [
        { icon: "landmark", title: "1. Policy", body: "Carbon pricing, building codes, and transport electrification mandates." },
        { icon: "building", title: "2. Corporate", body: "Science-based targets, supply chain decarbonization, and green procurement." },
        { icon: "user", title: "3. Individual", body: "Diet shifts, transport choices, and consumer pressure on high-emitting brands." },
      ],
      gridItems: [
        { icon: "landmark", title: "Carbon Pricing", desc: "Price signals drive fastest behavioral change" },
        { icon: "zap", title: "Electrification", desc: "Transport and heating transition to clean power" },
        { icon: "home", title: "Building Codes", desc: "Net-zero standards for new construction" },
        { icon: "shopping-bag", title: "Green Procurement", desc: "Corporate buying power shifts markets" },
      ],
      body: "Effective climate action requires coordinated effort across policy, corporate strategy, and individual behavior.",
      speakerNotes: "The three-lever model: policy sets the rules, corporates implement at scale, individuals create demand pull.",
    },
    {
      title: "Success Stories Are Emerging",
      kicker: "PROOF POINTS",
      body: "Denmark generates 84% of electricity from renewables. Costa Rica has been carbon-negative for 3 consecutive years. India installed more solar capacity in 2025 than the entire EU, reaching 250GW total.",
      caption: "These examples prove systemic change is possible when policy, technology, and investment align.",
      imageAlt: "Wind farm in Denmark at sunset",
      bodyItems: [
        "Denmark: 84% renewable electricity generation",
        "Costa Rica: carbon-negative for 3 consecutive years",
        "India: 250GW solar capacity, largest annual installation globally",
        "EU: 55% emissions reduction from 1990 levels achieved",
      ],
      speakerNotes: "End the data section on a hopeful note. These are real achievements, not targets or pledges.",
    },
    {
      title: "Key Takeaways",
      bodyItems: [
        "We have already breached 1.5°C — adaptation is now as critical as mitigation",
        "The economics decisively favor climate action over inaction",
        "Technology solutions exist and are cost-competitive today",
        "Policy, corporate action, and individual choices must work in concert",
        "Every fraction of a degree matters — 1.5°C and 2°C are worlds apart",
      ],
      speakerNotes: "Reinforce the key message: solutions exist, economics support action, but urgency is real.",
    },
    {
      title: "The Best Time to Act Was Yesterday. The Second Best Is Now.",
      subtitle: "Join the climate action coalition. Start with what you can control.",
      action: "Take the Pledge →",
      speakerNotes: "Close with this quote. Make the call to action personal and immediate.",
    },
  ],
};

// ─── Topic 3: Indian Startup Ecosystem ──────────────────

const indianStartups: FixtureTopic = {
  slug: "indian-startups",
  title: "Indian Startup Ecosystem 2026",
  mood: "warm",
  language: "hi",
  roles: [
    "cover", "agenda", "section", "stat", "comparison",
    "data", "process", "statement", "takeaways", "cta",
  ],
  slides: [
    {
      title: "Indian Startup Ecosystem 2026",
      subtitle: "Bharat ki innovation story — funding, founders, aur future",
      kicker: "STARTUP BHARAT • 2026",
      imageAlt: "Indian startup hub skyline with tech overlay",
      speakerNotes: "Welcome karo audience ko. India ki startup journey ko frame karo — 3rd largest ecosystem globally.",
    },
    {
      title: "Aaj Kya Cover Karenge",
      bodyItems: [
        "India ka unicorn landscape: 150+ unicorns aur counting",
        "Funding trends: VC recovery aur sovereign wealth inflow",
        "Tier 2-3 cities: naya startup frontier",
        "Deep tech aur AI-first companies ka rise",
        "Policy support: Startup India 3.0 aur PLI schemes",
      ],
      speakerNotes: "Agenda walk-through karo. Emphasize karo ki ye data-driven analysis hai, hype nahi.",
    },
    {
      title: "World's Third-Largest Startup Ecosystem",
      kicker: "GLOBAL STANDING",
      body: "India ne 2025 mein 112,000+ recognized startups cross kar liye. Har din average 3 new startups DPIIT registration le rahe hain. Bengaluru, Delhi-NCR aur Mumbai ke baad ab Hyderabad, Pune aur Chennai bhi top 20 global startup hubs mein aa gaye hain.",
      caption: "Source: DPIIT Annual Report 2025-26, NASSCOM",
      imageAlt: "Map of India with startup hub density",
      bodyItems: [
        "112,000+ DPIIT-recognized startups",
        "Average 3 new registrations har din",
        "6 Indian cities in global top 20 startup hubs",
        "Women-founded startups grew 48% year-over-year",
      ],
      speakerNotes: "Numbers se start karo. 112K startups is massive. Highlight the tier-2 city growth story.",
    },
    {
      title: "Funding Recovery in Full Swing",
      bigNumber: { number: "$38B", label: "Total VC Funding in 2025", supporting: "67% growth over 2024's winter levels" },
      stat1: { number: "$38B", label: "VC Funding 2025", supporting: "67% year-over-year growth" },
      stat2: { number: "156", label: "Active Unicorns", supporting: "12 new unicorns in 2025" },
      stat3: { number: "4.7M", label: "Direct Jobs Created", supporting: "by startup ecosystem" },
      caption: "Source: Tracxn, Venture Intelligence India Report",
      imageAlt: "Funding trend chart 2020-2026",
      speakerNotes: "Funding winter officially khatam. $38B is close to 2021 peak levels. But quality of capital has improved.",
    },
    {
      title: "Sector-Wise Breakdown",
      cards: [
        { icon: "brain", title: "AI / ML", body: "India ke 35% new startups AI-first hain. Enterprise AI aur GenAI applications lead kar rahe hain." },
        { icon: "heart", title: "HealthTech", body: "Telemedicine aur diagnostics ne $4.2B funding attract kiya. Rural health access biggest driver." },
        { icon: "wallet", title: "FinTech", body: "UPI pe monthly 18B transactions. Embedded finance aur cross-border payments next wave hai." },
      ],
      gridItems: [
        { icon: "brain", title: "AI / ML", desc: "35% new startups AI-first, enterprise focus" },
        { icon: "heart", title: "HealthTech", desc: "$4.2B funding, rural access driving growth" },
        { icon: "wallet", title: "FinTech", desc: "18B monthly UPI txns, embedded finance next" },
        { icon: "truck", title: "LogiTech", desc: "Supply chain AI optimization booming" },
      ],
      speakerNotes: "AI/ML is dominating. FinTech is maturing. HealthTech is the sleeper hit with massive social impact.",
    },
    {
      title: "Tier 2-3 Cities: The New Frontier",
      stat1: { number: "45%", label: "Startups from Non-Metros", supporting: "up from 28% in 2022" },
      stat2: { number: "₹2.3L Cr", label: "Economic Value", supporting: "generated by non-metro startups" },
      stat3: { number: "89", label: "Cities with Incubators", supporting: "across 25 states" },
      bodyItems: [
        "Jaipur: SaaS aur EdTech ka emerging hub",
        "Indore: AgriTech startups 3× growth",
        "Kochi: Marine tech aur sustainable innovation",
        "Bhubaneswar: Government-backed deep tech cluster",
      ],
      caption: "Non-metro startup density doubled in 3 years",
      imageAlt: "Heat map of Indian startup distribution",
      speakerNotes: "Yeh slide bahut important hai. Story is no longer just Bengaluru-Delhi. Tier 2-3 cities are creating category-defining companies.",
    },
    {
      title: "Startup Success Playbook",
      cards: [
        { icon: "target", title: "1. Problem-First", body: "India-specific problems solve karo — jugaad innovation beats copy-paste models." },
        { icon: "users", title: "2. Bharat Scale", body: "Build for 800M internet users. Vernacular-first, mobile-first, UPI-first." },
        { icon: "trending-up", title: "3. Unit Economics", body: "Path to profitability day 1 se plan karo. VC patience khatam ho gayi hai." },
      ],
      gridItems: [
        { icon: "target", title: "Problem-First", desc: "India-specific problems, not Silicon Valley copies" },
        { icon: "globe", title: "Bharat Scale", desc: "800M users, vernacular-first approach" },
        { icon: "trending-up", title: "Unit Economics", desc: "Profitability path from day one" },
        { icon: "shield", title: "Compliance", desc: "DPIIT, GST, data protection compliance early" },
      ],
      body: "Successful Indian startups solve distinctly Indian problems at Bharat scale with sustainable unit economics.",
      speakerNotes: "Practical advice: don't copy Silicon Valley. Build for India's unique constraints and opportunities.",
    },
    {
      title: "Government Push: Startup India 3.0",
      kicker: "POLICY TAILWIND",
      body: "Startup India 3.0 brings ₹25,000 crore fund-of-funds, 3-year tax holiday for DPIIT startups, simplified compliance through single-window clearance, and dedicated IP fast-track program. Combined with PLI schemes, India is creating the most startup-friendly regulatory environment in Asia.",
      caption: "Announced in Union Budget 2026-27",
      imageAlt: "Government building with startup ecosystem overlay",
      bodyItems: [
        "₹25,000 Cr fund-of-funds allocation",
        "3-year tax holiday for DPIIT registered startups",
        "Single-window compliance clearance",
        "IP fast-track program: patent grant in 6 months",
      ],
      speakerNotes: "Policy environment has never been better. The tax holiday alone saves startups crores in early years.",
    },
    {
      title: "Key Takeaways",
      bodyItems: [
        "India 3rd largest startup ecosystem globally — 156 unicorns aur growing",
        "Funding winter over: $38B in 2025, quality capital flowing",
        "Tier 2-3 cities contributing 45% of new startups",
        "AI/ML, HealthTech, FinTech — top 3 sectors by funding",
        "Build for Bharat: vernacular-first, mobile-first, unit-economics-first",
      ],
      speakerNotes: "Five key points summarize karo. End pe Bharat-scale message reinforce karo.",
    },
    {
      title: "Bharat Ka Innovation Era Shuru Ho Chuka Hai",
      subtitle: "Apna idea hai? Build karo. India is ready.",
      action: "Apply to Incubator →",
      speakerNotes: "Motivational close. Call to action — incubator application or founder community join karo.",
    },
  ],
};

// ─── Topic 4: Quantum Computing ─────────────────────────

const quantumComputing: FixtureTopic = {
  slug: "quantum-computing",
  title: "Introduction to Quantum Computing",
  mood: "elegant",
  language: "en",
  roles: [
    "cover", "agenda", "statement", "section", "data",
    "comparison", "process", "stat", "takeaways", "cta",
  ],
  slides: [
    {
      title: "Introduction to Quantum Computing",
      subtitle: "From qubits to quantum advantage — a practical primer",
      kicker: "QUANTUM FRONTIERS • 2026",
      imageAlt: "Quantum processor chip close-up",
      speakerNotes: "Set the stage: quantum computing is transitioning from physics labs to cloud services.",
    },
    {
      title: "What We Will Explore",
      bodyItems: [
        "Classical vs. quantum: why bits aren't enough",
        "Qubits, superposition, and entanglement explained",
        "Current hardware: superconducting, trapped ion, photonic",
        "Quantum algorithms with real-world applications",
        "The path to quantum advantage and error correction",
      ],
      speakerNotes: "Frame this as accessible but rigorous. No quantum mysticism — just engineering and math.",
    },
    {
      title: "Why Classical Computing Has Limits",
      kicker: "THE FUNDAMENTAL BARRIER",
      body: "Some problems scale exponentially with input size. Drug molecule simulation, cryptographic analysis, and combinatorial optimization become intractable for classical computers — even supercomputers — beyond modest input sizes. Quantum mechanics offers a fundamentally different computational model.",
      caption: "Feynman (1982): 'Nature isn't classical. If you want to simulate nature, you'd better make it quantum.'",
      imageAlt: "Exponential growth curve showing classical vs quantum scaling",
      speakerNotes: "Use the Feynman quote. Explain that this isn't about speed — it's about accessing a different computational space.",
    },
    {
      title: "The Quantum Toolkit",
      kicker: "CORE CONCEPTS",
      body: "Three principles power quantum computing: superposition allows qubits to exist in multiple states simultaneously, entanglement creates correlations that enable parallel information processing, and interference amplifies correct answers while canceling wrong ones.",
      caption: "These aren't bugs in physics — they're features we've learned to engineer.",
      imageAlt: "Bloch sphere diagram showing qubit states",
      bodyItems: [
        "Superposition: qubits in multiple states simultaneously",
        "Entanglement: correlated qubits enable parallel processing",
        "Interference: amplify correct answers, cancel wrong ones",
        "Measurement: collapse quantum state to extract classical answer",
      ],
      speakerNotes: "Don't get lost in the physics. Focus on the engineering implications: what can we BUILD with these properties.",
    },
    {
      title: "Hardware Landscape 2026",
      stat1: { number: "1,121", label: "Qubit Record", supporting: "IBM Condor processor" },
      stat2: { number: "99.9%", label: "Gate Fidelity", supporting: "Quantinuum trapped-ion H2" },
      stat3: { number: "48", label: "Logical Qubits", supporting: "first error-corrected system" },
      bodyItems: [
        "Superconducting: IBM, Google — fastest gate speeds, scalability challenges",
        "Trapped Ion: Quantinuum, IonQ — highest fidelity, slower operations",
        "Photonic: Xanadu, PsiQuantum — room temperature, networking advantages",
        "Neutral Atom: QuEra, Pasqal — excellent for optimization problems",
      ],
      caption: "Source: Quantum Computing Report, Q1 2026",
      imageAlt: "Comparison of quantum hardware approaches",
      speakerNotes: "Four main hardware approaches, each with tradeoffs. No clear winner yet — that's actually healthy for the field.",
    },
    {
      title: "Quantum vs. Classical: Where Quantum Wins",
      cards: [
        { icon: "flask", title: "Drug Discovery", body: "Simulating molecular interactions: quantum handles 100+ atoms vs. classical limit of ~40." },
        { icon: "lock", title: "Cryptography", body: "Shor's algorithm threatens RSA. Post-quantum crypto standards now mandatory by 2028." },
        { icon: "route", title: "Optimization", body: "Supply chain, portfolio optimization, and scheduling — QAOA shows 100× speedup on specific problems." },
      ],
      gridItems: [
        { icon: "flask", title: "Drug Discovery", desc: "Molecular simulation beyond classical limits" },
        { icon: "lock", title: "Cryptography", desc: "Shor's algorithm, post-quantum standards" },
        { icon: "route", title: "Optimization", desc: "QAOA for supply chain and scheduling" },
        { icon: "brain", title: "Machine Learning", desc: "Quantum kernels for feature space mapping" },
      ],
      speakerNotes: "Three killer apps. Drug discovery is nearest-term. Cryptography is the most disruptive. Optimization has the broadest applicability.",
    },
    {
      title: "Getting Started with Quantum Programming",
      cards: [
        { icon: "code", title: "1. Learn Qiskit", body: "IBM's open-source SDK. Start with circuit-level programming and transpilation." },
        { icon: "cloud", title: "2. Use Cloud QPUs", body: "Access real quantum hardware via IBM Quantum, Amazon Braket, or Azure Quantum." },
        { icon: "beaker", title: "3. Run Experiments", body: "Start with variational algorithms (VQE, QAOA) on small instances." },
      ],
      gridItems: [
        { icon: "code", title: "Qiskit / Cirq", desc: "Open-source SDKs for circuit programming" },
        { icon: "cloud", title: "Cloud QPUs", desc: "IBM Quantum, Braket, Azure Quantum access" },
        { icon: "beaker", title: "VQE / QAOA", desc: "Start with variational hybrid algorithms" },
        { icon: "book", title: "Resources", desc: "Qiskit Textbook, MIT OCW, arXiv papers" },
      ],
      body: "You don't need a physics PhD to start quantum programming. Cloud-based QPUs and high-level SDKs make experimentation accessible to any software engineer.",
      speakerNotes: "Make this actionable. Show that attendees can run a quantum circuit on real hardware today, for free.",
    },
    {
      title: "The Road to Fault-Tolerant Quantum",
      bigNumber: { number: "2029", label: "Projected Year for Quantum Advantage", supporting: "in commercially relevant problems" },
      stat1: { number: "2029", label: "Quantum Advantage Year", supporting: "commercially relevant problems" },
      stat2: { number: "10,000", label: "Logical Qubits Needed", supporting: "for useful error-corrected computation" },
      stat3: { number: "$65B", label: "Total Investment to Date", supporting: "government + private sector" },
      caption: "Source: Boston Consulting Group Quantum Institute, 2026",
      imageAlt: "Quantum computing roadmap timeline",
      speakerNotes: "2029 is the target for practical quantum advantage. But useful NISQ applications exist today in specific domains.",
    },
    {
      title: "Key Takeaways",
      bodyItems: [
        "Quantum computing exploits superposition, entanglement, and interference",
        "Four hardware approaches are competing — no single winner yet",
        "Near-term killer apps: drug discovery, cryptography, optimization",
        "Cloud QPUs make experimentation accessible to any developer today",
        "Fault-tolerant quantum advantage expected around 2029",
      ],
      speakerNotes: "Five clear takeaways. Emphasize the accessibility point — this is not just for physicists anymore.",
    },
    {
      title: "The Quantum Future Is Being Written Now",
      subtitle: "Start experimenting today. The learning curve is the moat.",
      action: "Try IBM Quantum Free Tier →",
      speakerNotes: "End with a call to action. The free tier removes all barriers to getting started.",
    },
  ],
};

// ─── Topic 5: Digital Marketing Masterclass ─────────────

const digitalMarketing: FixtureTopic = {
  slug: "digital-marketing",
  title: "Digital Marketing Masterclass",
  mood: "playful",
  language: "en",
  roles: [
    "cover", "agenda", "statement", "stat", "data",
    "comparison", "process", "section", "takeaways", "cta",
  ],
  slides: [
    {
      title: "Digital Marketing Masterclass",
      subtitle: "Data-driven strategies that convert in 2026",
      kicker: "GROWTH ENGINE • 2026",
      imageAlt: "Marketing dashboard with growth metrics",
      speakerNotes: "Welcome. This masterclass covers the strategies actually working in 2026 — not recycled 2020 advice.",
    },
    {
      title: "Session Roadmap",
      bodyItems: [
        "The attention economy: where eyeballs are in 2026",
        "Content strategy: AI-assisted creation at scale",
        "Paid media: ROAS optimization with machine learning",
        "Conversion funnels: from awareness to advocacy",
        "Measurement: attribution models that actually work",
      ],
      speakerNotes: "Walk through the roadmap. Each section has actionable takeaways they can implement immediately.",
    },
    {
      title: "Attention Is the New Currency",
      kicker: "THE BIG SHIFT",
      body: "Average human attention span dropped to 6.8 seconds in 2025. Scroll speed increased 40%. The brands winning are those who earn attention through value, not interrupt with volume. Quality over quantity is no longer a platitude — it is a survival strategy.",
      caption: "Source: Microsoft Attention Research Lab, 2025",
      imageAlt: "Graph showing declining attention spans over time",
      speakerNotes: "The 6.8-second stat always gets a reaction. Connect it to their content strategy: if you haven't hooked them in 3 seconds, you've lost them.",
    },
    {
      title: "The ROI Numbers That Matter",
      stat1: { number: "11.4×", label: "Content Marketing ROI", supporting: "vs. traditional advertising" },
      stat2: { number: "67%", label: "Buyers Research Online", supporting: "before contacting sales" },
      stat3: { number: "4.2%", label: "Average CTR on AI-Optimized Ads", supporting: "vs. 1.8% for manual" },
      bigNumber: { number: "11.4×", label: "Content ROI vs Traditional Ads", supporting: "Content marketing delivers 11.4× the ROI of traditional advertising" },
      caption: "Source: HubSpot State of Marketing, Content Marketing Institute 2026",
      imageAlt: "ROI comparison chart across marketing channels",
      speakerNotes: "The 11.4× ROI stat is your ammo for budget conversations. CTR difference shows AI-optimization is table stakes now.",
    },
    {
      title: "Channel Performance Breakdown",
      stat1: { number: "38%", label: "Short-Form Video", supporting: "highest engagement channel" },
      stat2: { number: "24%", label: "Email Marketing", supporting: "best ROI per dollar spent" },
      stat3: { number: "18%", label: "SEO + Content", supporting: "highest LTV customer acquisition" },
      bodyItems: [
        "Short-form video (TikTok, Reels, Shorts): 38% of engagement",
        "Email marketing: highest per-dollar ROI at $42 per $1 spent",
        "SEO + long-form content: best for high-LTV customer acquisition",
        "Paid social: ROAS improving with AI-driven creative optimization",
      ],
      caption: "Channel effectiveness varies by industry — these are cross-sector averages",
      imageAlt: "Channel performance comparison dashboard",
      speakerNotes: "Email marketing's ROI surprises people. Short-form video is king for awareness but email wins for conversions.",
    },
    {
      title: "AI-Powered Marketing Stack",
      cards: [
        { icon: "pen-tool", title: "Content Creation", body: "AI writes first drafts 10× faster. Human editors add brand voice and nuance for final output." },
        { icon: "target", title: "Ad Optimization", body: "ML models test 1000s of creative variations automatically. Best performers get budget in real-time." },
        { icon: "bar-chart", title: "Predictive Analytics", body: "Forecast campaign performance before launch. Identify high-value segments with propensity models." },
      ],
      gridItems: [
        { icon: "pen-tool", title: "Content AI", desc: "10× faster drafts, human-edited final output" },
        { icon: "target", title: "Ad Optimization", desc: "ML tests 1000s of variations in real-time" },
        { icon: "bar-chart", title: "Predictive Analytics", desc: "Forecast performance before launch" },
        { icon: "users", title: "Personalization", desc: "1:1 content at scale with GenAI" },
      ],
      speakerNotes: "AI isn't replacing marketers — it's amplifying them. The best teams use AI for volume and humans for strategy and brand voice.",
    },
    {
      title: "The High-Converting Funnel",
      cards: [
        { icon: "eye", title: "1. Attract", body: "Short-form video + SEO content. Hook in 3 seconds. Provide instant value." },
        { icon: "magnet", title: "2. Engage", body: "Email sequences + retargeting. Build trust with case studies and social proof." },
        { icon: "credit-card", title: "3. Convert", body: "Optimized landing pages, A/B tested CTAs, and frictionless checkout flows." },
      ],
      gridItems: [
        { icon: "eye", title: "Attract", desc: "Video + SEO: hook in 3 seconds, instant value" },
        { icon: "magnet", title: "Engage", desc: "Email + retargeting with social proof" },
        { icon: "credit-card", title: "Convert", desc: "Optimized LPs, A/B tested CTAs" },
        { icon: "heart", title: "Delight", desc: "Post-purchase nurture for advocacy and referrals" },
      ],
      body: "The modern funnel isn't linear — it's a flywheel. Every delighted customer becomes an acquisition channel through referrals and UGC.",
      speakerNotes: "Draw the flywheel on a whiteboard if you can. The key insight: post-purchase nurture is not optional — it's your cheapest acquisition channel.",
    },
    {
      title: "Attribution: Solving the Measurement Problem",
      kicker: "THE HARDEST PART",
      body: "Cookie deprecation and privacy regulations broke last-click attribution. Leading teams now use marketing mix modeling (MMM) combined with incrementality testing. First-party data strategies and server-side tracking provide the foundation for accurate measurement.",
      caption: "Google's Privacy Sandbox and Apple's ATT have fundamentally changed measurement",
      imageAlt: "Attribution model comparison diagram",
      bodyItems: [
        "Last-click attribution is dead — privacy regulations killed it",
        "Marketing Mix Modeling (MMM) + incrementality testing is the new standard",
        "First-party data strategies are non-negotiable for measurement",
        "Server-side tracking replaces client-side cookies",
      ],
      speakerNotes: "This is where most teams struggle. Be honest: perfect attribution doesn't exist. But MMM + incrementality gets you 80% of the way.",
    },
    {
      title: "Key Takeaways",
      bodyItems: [
        "Earn attention through value — 6.8-second attention spans demand quality over quantity",
        "Content marketing delivers 11.4× ROI vs traditional advertising",
        "AI amplifies marketers — use it for volume, keep humans for strategy and brand voice",
        "The funnel is a flywheel — post-purchase nurture is your cheapest acquisition channel",
        "Replace last-click with MMM + incrementality testing for real measurement",
      ],
      speakerNotes: "Five actionable takeaways. Each one is implementable this quarter.",
    },
    {
      title: "Ready to 10× Your Marketing?",
      subtitle: "Download the complete playbook with templates, tools, and benchmarks.",
      action: "Get the Playbook →",
      speakerNotes: "Lead magnet close. The playbook captures everything from the masterclass plus bonus templates.",
    },
  ],
};

// ─── Export All Topics ──────────────────────────────────

export const FIXTURE_TOPICS: FixtureTopic[] = [
  aiAgents,
  climateChange,
  indianStartups,
  quantumComputing,
  digitalMarketing,
];

export function getFixtureTopic(slug: string): FixtureTopic {
  const topic = FIXTURE_TOPICS.find((t) => t.slug === slug);
  if (!topic) throw new Error(`Fixture topic "${slug}" not found`);
  return topic;
}


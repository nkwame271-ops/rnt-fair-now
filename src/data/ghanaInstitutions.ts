// Curated list of Ghanaian tertiary institutions (public + private).
// Used for the student sign-up School/Institution dropdown.
// Students may also type a custom name; `normalizeInstitutionName` ensures
// that two students who type the same school slightly differently are
// recognized as the same institution.

export const GHANA_INSTITUTIONS: string[] = [
  // Public universities
  "University of Ghana",
  "Kwame Nkrumah University of Science and Technology",
  "University of Cape Coast",
  "University of Education, Winneba",
  "University for Development Studies",
  "University of Mines and Technology",
  "University of Professional Studies, Accra",
  "University of Health and Allied Sciences",
  "University of Energy and Natural Resources",
  "Ghana Institute of Management and Public Administration",
  "C. K. Tedam University of Technology and Applied Sciences",
  "Akenten Appiah-Menka University of Skills Training and Entrepreneurial Development",
  "Simon Diedong Dombo University of Business and Integrated Development Studies",
  "Ghana Communication Technology University",
  "University of Environment and Sustainable Development",

  // Public technical universities
  "Accra Technical University",
  "Kumasi Technical University",
  "Takoradi Technical University",
  "Cape Coast Technical University",
  "Ho Technical University",
  "Tamale Technical University",
  "Sunyani Technical University",
  "Koforidua Technical University",
  "Bolgatanga Technical University",
  "Wa Polytechnic",

  // Private universities & university colleges
  "Ashesi University",
  "Central University",
  "Valley View University",
  "Pentecost University",
  "Methodist University Ghana",
  "Catholic University of Ghana",
  "Presbyterian University Ghana",
  "All Nations University",
  "African University College of Communications",
  "Lancaster University Ghana",
  "Webster University Ghana",
  "Ghana Christian University College",
  "Wisconsin International University College",
  "Regent University College of Science and Technology",
  "BlueCrest University College",
  "Knutsford University College",
  "Garden City University College",
  "Christian Service University College",
  "Akrofi-Christaller Institute of Theology, Mission and Culture",
  "Ghana Baptist University College",
  "Heritage Christian University College",
  "Pan-African Christian University College",
  "Trinity Theological Seminary",
  "Islamic University College Ghana",
  "Spiritan University College",
  "Maranatha University College",
  "Perez University College",
  "Anglican University College of Technology",
  "Ghana Technology University College",
  "Data Link Institute",
  "Mountcrest University College",
  "Kings University College",
  "Radford University College",
  "Zenith University College",
  "Jayee University College",

  // Professional / specialized
  "Ghana Institute of Journalism",
  "National Film and Television Institute",
  "Ghana Institute of Languages",
  "Ghana School of Law",
  "Kofi Annan International Peacekeeping Training Centre",
  "Ghana Armed Forces Command and Staff College",
  "Ghana Telecom University College",

  // Colleges of Education (most recognized — students from any CoE can also type their own)
  "Accra College of Education",
  "Wesley College of Education, Kumasi",
  "Komenda College of Education",
  "Presbyterian College of Education, Akropong",
  "Mount Mary College of Education",
  "Bagabaga College of Education",
  "Ada College of Education",
];

/**
 * Normalize a school / institution name so that small typing variations
 * collapse to the same canonical record. Two students typing
 * "university of ghana", "  University of Ghana ", or "UNIVERSITY OF GHANA"
 * all resolve to "University of Ghana".
 */
export function normalizeInstitutionName(raw: string): string {
  if (!raw) return "";
  // Trim + collapse internal whitespace
  let cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  // Try exact (case-insensitive) match against the known list first
  const lower = cleaned.toLowerCase();
  const known = GHANA_INSTITUTIONS.find((s) => s.toLowerCase() === lower);
  if (known) return known;

  // Otherwise apply Title Case while preserving small connectors
  const small = new Set(["of", "and", "the", "for", "in", "on", "to", "a", "an"]);
  cleaned = cleaned
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (i > 0 && small.has(word)) return word;
      // Preserve common acronyms inside a name (e.g. KNUST, UCC)
      if (word.length <= 5 && /^[a-z]+$/.test(word) && word === word.toUpperCase()) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  return cleaned;
}

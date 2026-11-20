export interface CsvStockRow {
  line: number;
  name: string;
  dci: string;
  form: string;
  category: string;
  price: number;
  quantity: number;
}

export interface CsvParseResult {
  rows: CsvStockRow[];
  errors: string[];
}

export const STOCK_CSV_TEMPLATE = [
  "nom;dci;forme;categorie;prix;quantite",
  "Paracétamol 500 mg;Paracétamol;Boîte de 20 comprimés;Douleur & fièvre;700;40",
  "Amoxicilline 500 mg;Amoxicilline;Boîte de 12 gélules;Antibiotiques;2500;15",
  "Artéméther-Luméfantrine 20/120;Artéméther + Luméfantrine;Boîte de 6 comprimés;Paludisme;3500;12",
].join("\n");

const MAX_CSV_ROWS = 200;

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function detectDelimiter(headerLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = -1;
  for (const delimiter of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < headerLine.length; i += 1) {
      const ch = headerLine[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        count += 1;
      }
    }
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }
  return bestCount > 0 ? best : ";";
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

type ColumnKey = "name" | "dci" | "form" | "category" | "price" | "quantity";

const HEADER_ALIASES: Record<string, ColumnKey> = {
  nom: "name",
  medicament: "name",
  produit: "name",
  name: "name",
  dci: "dci",
  molecule: "dci",
  "principe actif": "dci",
  forme: "form",
  form: "form",
  presentation: "form",
  categorie: "category",
  category: "category",
  famille: "category",
  prix: "price",
  "prix fcfa": "price",
  price: "price",
  tarif: "price",
  quantite: "quantity",
  qte: "quantity",
  stock: "quantity",
  quantity: "quantity",
  qty: "quantity",
};

function parseWholeNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s\u00A0]/g, "");
  if (!/^-?\d+$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isSafeInteger(num) ? num : null;
}

export function parseStockCsv(content: string): CsvParseResult {
  const cleaned = content.replace(/^\uFEFF/, "");
  const rawLines = cleaned.split(/\r?\n/);
  const nonEmpty: Array<{ lineNumber: number; text: string }> = [];

  for (let i = 0; i < rawLines.length; i += 1) {
    const text = rawLines[i].trim();
    if (text) nonEmpty.push({ lineNumber: i + 1, text });
  }

  if (nonEmpty.length === 0) {
    return { rows: [], errors: ["Le fichier CSV est vide."] };
  }

  const headerEntry = nonEmpty[0];
  const delimiter = detectDelimiter(headerEntry.text);
  const headerCells = splitCsvLine(headerEntry.text, delimiter);
  const colIndex: Partial<Record<ColumnKey, number>> = {};

  headerCells.forEach((cell, index) => {
    const key = HEADER_ALIASES[normalizeHeader(cell)];
    if (key && colIndex[key] === undefined) {
      colIndex[key] = index;
    }
  });

  if (
    colIndex.name === undefined ||
    colIndex.price === undefined ||
    colIndex.quantity === undefined
  ) {
    return {
      rows: [],
      errors: [
        "En-têtes requis manquants : nom (ou medicament), prix (ou price) et quantite (ou stock/quantity).",
      ],
    };
  }

  const dataEntries = nonEmpty.slice(1);
  if (dataEntries.length === 0) {
    return {
      rows: [],
      errors: ["Aucune ligne de données trouvée après l'en-tête."],
    };
  }

  const rows: CsvStockRow[] = [];
  const errors: string[] = [];

  if (dataEntries.length > MAX_CSV_ROWS) {
    errors.push(
      `Import plafonné à ${MAX_CSV_ROWS} lignes (${dataEntries.length} lignes détectées).`,
    );
  }

  for (const entry of dataEntries.slice(0, MAX_CSV_ROWS)) {
    const cells = splitCsvLine(entry.text, delimiter);
    const get = (key: ColumnKey) => {
      const idx = colIndex[key];
      return idx === undefined ? "" : (cells[idx] ?? "").trim();
    };

    const name = get("name").slice(0, 120);
    const dci = get("dci").slice(0, 120);
    const form = get("form").slice(0, 120);
    const category = get("category").slice(0, 80);
    const rawPrice = get("price");
    const rawQuantity = get("quantity");

    if (!name) {
      errors.push(`Ligne ${entry.lineNumber} : nom de médicament manquant.`);
      continue;
    }

    const price = parseWholeNumber(rawPrice);
    if (price === null || price < 0 || price > 1_000_000) {
      errors.push(
        `Ligne ${entry.lineNumber} (${name}) : prix invalide (« ${rawPrice} », attendu 0 à 1 000 000).`,
      );
      continue;
    }

    const quantity = parseWholeNumber(rawQuantity);
    if (quantity === null || quantity < 0 || quantity > 99_999) {
      errors.push(
        `Ligne ${entry.lineNumber} (${name}) : quantité invalide (« ${rawQuantity} », attendu 0 à 99 999).`,
      );
      continue;
    }

    rows.push({
      line: entry.lineNumber,
      name,
      dci,
      form,
      category,
      price,
      quantity,
    });
  }

  return { rows, errors };
}

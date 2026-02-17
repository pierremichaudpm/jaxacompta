import { neon } from "@neondatabase/serverless";
import XLSX from "xlsx";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];
if (!DATABASE_URL) {
  console.error("Usage: node scripts/import-excel.mjs <DATABASE_URL>");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const wb = XLSX.readFile(
  join(__dirname, "..", "..", "JAXA_Compta_Maitre.xlsx"),
);

// ── Mapping helpers ──

const CATEGORY_MAP = {
  Bureau: "Bureau",
  "Bureau - Logiciel": "Bureau – Logiciel",
  "Part Actionnaire": "Part actionnaire",
  "Services Professionnels": "Services professionnels",
  "Frais bancaires": "Frais bancaires",
  Transport: "Transport",
  Event: "Événement",
  "Dépense Actionnaire": "Dépense actionnaire",
  "Hotel/Logement": "Hôtel / Logement",
  "Gouv.": "Gouvernement",
  Équipement: "Équipement",
  Remboursement: "Remboursement",
  "Transfert interne": "Transfert interne",
  "Revenu client": "Revenu client",
};

const PROJET_MAP = {
  Général: "Général",
  Tonic: "Tonic",
  "GTCQM PWA": "Tonic",
  WF: "WF",
  OAN: "OAN",
  CARI: "CARI",
  EISL: "EISL",
  JR: "JR",
  "Aqua - FA": "FA",
  FA: "FA",
  "WE ARE": "WE ARE",
  CTV: "CTV",
  "CTV-EVP": "CTV",
  "CTV-TA": "CTV",
};

const COMPTE_MAP = {
  "BN Mastercard": "MC",
  "Cpte 1-20": "CPT-20",
  "Cpte 2-24": "CPT-24",
  "Cpte 2-21": "CPT-21",
  "Wise Visa": "WISE",
};

const CONTACT_MAP = {
  "Vrginie Jaffredo": "Virginie Jaffredo",
  "Virginie Jaffredo": "Virginie Jaffredo",
};

const MODE_MAP = {
  Mastercard: "Mastercard",
  "Dépôt direct": "Dépôt direct",
  "Virement interac": "Virement Interac",
  "Visa - Cpte Wise": "Visa Wise",
  "Frais bancaires": "Débit",
  Transport: "Débit",
  "Dépense Actionnaire": "Dépôt direct",
  "Hotel/Logement": "Mastercard",
};

// ── Load lookup tables ──

let categories, projets, contacts, comptes;

async function loadLookups() {
  categories = await sql`SELECT id, nom FROM categories`;
  projets = await sql`SELECT id, code FROM projets`;
  contacts = await sql`SELECT id, nom FROM contacts`;
  comptes = await sql`SELECT id, code FROM comptes_bancaires`;
}

function findCategoryId(name) {
  if (!name) return null;
  const mapped = CATEGORY_MAP[name] || name;
  const cat = categories.find((c) => c.nom === mapped);
  return cat?.id || null;
}

function findProjetId(name) {
  if (!name) return null;
  const mapped = PROJET_MAP[name] || name;
  const proj = projets.find((p) => p.code === mapped);
  return proj?.id || null;
}

function findContactId(name) {
  if (!name) return null;
  const mapped = CONTACT_MAP[name] || name;
  const contact = contacts.find((c) => c.nom === mapped);
  if (contact) return contact.id;
  // Try partial match
  const partial = contacts.find(
    (c) =>
      c.nom.toLowerCase().includes(mapped.toLowerCase()) ||
      mapped.toLowerCase().includes(c.nom.toLowerCase()),
  );
  return partial?.id || null;
}

function findCompteId(name) {
  if (!name) return null;
  const mapped = COMPTE_MAP[name];
  if (!mapped) {
    // Try direct match on code
    const c = comptes.find((c) => c.code === name);
    return c?.id || null;
  }
  const compte = comptes.find((c) => c.code === mapped);
  return compte?.id || null;
}

function excelDateToISO(serial) {
  if (!serial || typeof serial !== "number") return null;
  // Excel date serial to JS date
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86400000);
  return d.toISOString().split("T")[0];
}

function parseNum(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  // Handle comma as decimal separator
  const s = String(val).replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ── Import Dépenses ──

async function importDepenses() {
  const sheet = XLSX.utils.sheet_to_json(wb.Sheets["JAXA Dépenses"], {
    header: 1,
  });
  // Header at row 2: Date, N Trans., N Reçu, Catégorie, Projet, Total TTC, TPS, TVQ, Total HT, Mode paiement, Compte Bancaire, Fournisseur
  let imported = 0,
    skipped = 0,
    errors = 0;

  for (let i = 4; i < sheet.length; i++) {
    const row = sheet[i];
    const dateSerial = row[0];
    if (!dateSerial || typeof dateSerial !== "number") {
      skipped++;
      continue;
    }

    const date = excelDateToISO(dateSerial);
    if (!date) {
      skipped++;
      continue;
    }

    const numero = row[1] ? String(row[1]) : null;
    const description = row[2] ? String(row[2]) : null;
    const categorie = row[3] ? String(row[3]).trim() : null;
    const projetRaw = row[4] ? String(row[4]).trim() : null;
    const totalTtc = parseNum(row[5]);
    const tps = parseNum(row[6]);
    const tvq = parseNum(row[7]);
    const totalHt = parseNum(row[8]);
    const modePaiement = row[9] ? String(row[9]).trim() : null;
    const compteBancaire = row[10] ? String(row[10]).trim() : null;
    const fournisseur = row[11] ? String(row[11]).trim() : null;

    if (totalTtc === 0 && totalHt === 0) {
      skipped++;
      continue;
    }

    const categorieId = findCategoryId(categorie);
    const compteId = findCompteId(compteBancaire);
    const contactId = findContactId(fournisseur);
    const mode = MODE_MAP[modePaiement] || modePaiement || "Autre";
    const taxable = tps > 0 || tvq > 0;

    // Handle multi-project (e.g. "OAN, Tonic")
    const projetIds = [];
    if (projetRaw) {
      const parts = projetRaw.split(",").map((s) => s.trim());
      for (const p of parts) {
        const pid = findProjetId(p);
        if (pid) projetIds.push(pid);
      }
    }
    const mainProjetId = projetIds.length > 0 ? projetIds[0] : null;

    try {
      const result = await sql`
        INSERT INTO transactions
          (date_transaction, type, numero, description, categorie_id, projet_id,
           contact_id, compte_id, mode_paiement, montant_ht, tps, tvq, total_ttc,
           taxable, ocr_source, notes)
        VALUES (${date}, 'dépense', ${numero}, ${description}, ${categorieId}, ${mainProjetId},
                ${contactId}, ${compteId}, ${mode}, ${totalHt}, ${tps}, ${tvq}, ${totalTtc},
                ${taxable}, false, ${null})
        RETURNING id
      `;

      // Multi-project junction
      if (projetIds.length > 1) {
        for (const pid of projetIds) {
          await sql`INSERT INTO transaction_projets (transaction_id, projet_id) VALUES (${result[0].id}, ${pid})`;
        }
      }

      imported++;
    } catch (e) {
      errors++;
      if (errors <= 5)
        console.error(`  Row ${i} error:`, e.message.substring(0, 100));
    }
  }

  console.log(
    `Dépenses: ${imported} imported, ${skipped} skipped, ${errors} errors`,
  );
}

// ── Import Revenus ──

async function importRevenus() {
  const sheet = XLSX.utils.sheet_to_json(wb.Sheets["JAXA Revenus"], {
    header: 1,
  });
  // Header at row 3: Date, N Facture, Client, Projet, Entité, Total TTC, TPS, TVQ, Total HT, Statut, N Trans., Date paiement, Compte Bancaire
  let imported = 0,
    skipped = 0,
    errors = 0;

  for (let i = 4; i < sheet.length; i++) {
    const row = sheet[i];
    const dateSerial = row[0];
    if (!dateSerial || typeof dateSerial !== "number") {
      skipped++;
      continue;
    }

    const date = excelDateToISO(dateSerial);
    if (!date) {
      skipped++;
      continue;
    }

    const numeroFacture = row[1] ? String(row[1]).trim() : null;
    const client = row[2] ? String(row[2]).trim() : null;
    const projetRaw = row[3] ? String(row[3]).trim() : null;
    const totalTtc = parseNum(row[5]);
    const tps = parseNum(row[6]);
    const tvq = parseNum(row[7]);
    const totalHt = parseNum(row[8]);
    const statut = row[9] ? String(row[9]).trim() : null;
    const numero = row[10] ? String(row[10]) : null;
    const datePaiementSerial = row[11];
    const compteBancaire = row[12] ? String(row[12]).trim() : null;

    if (totalTtc === 0 && totalHt === 0) {
      skipped++;
      continue;
    }

    const projetId = findProjetId(projetRaw);
    const contactId = findContactId(client);
    const compteId = findCompteId(compteBancaire);
    const datePaiement = excelDateToISO(datePaiementSerial);
    const taxable = tps > 0 || tvq > 0;

    try {
      await sql`
        INSERT INTO transactions
          (date_transaction, type, numero, description, categorie_id, projet_id,
           contact_id, compte_id, mode_paiement, montant_ht, tps, tvq, total_ttc,
           taxable, statut_facture, date_paiement, numero_facture, ocr_source)
        VALUES (${date}, 'revenu', ${numero}, ${numeroFacture}, ${findCategoryId("Revenu client")}, ${projetId},
                ${contactId}, ${compteId}, 'Virement Interac', ${totalHt}, ${tps}, ${tvq}, ${totalTtc},
                ${taxable}, ${statut}, ${datePaiement}, ${numeroFacture}, false)
      `;
      imported++;
    } catch (e) {
      errors++;
      if (errors <= 5)
        console.error(`  Rev row ${i} error:`, e.message.substring(0, 100));
    }
  }

  console.log(
    `Revenus: ${imported} imported, ${skipped} skipped, ${errors} errors`,
  );
}

// ── Import Taxes (periodes_fiscales) ──

async function importTaxes() {
  const ws = wb.Sheets["Taxes"];
  if (!ws) {
    console.log("Taxes sheet not found, skipping");
    return;
  }
  const sheet = XLSX.utils.sheet_to_json(ws, { header: 1 });
  // Row 2 = header: Période, TPS/TVH, TVQ, TPS Perçue, TPS Payée, TPS à remettre, Compte #, Référence
  let imported = 0;

  // Parse fiscal period rows (row 3+), aggregating main rows (which have TPS/TVH and TVQ values)
  for (let i = 3; i < sheet.length; i++) {
    const row = sheet[i];
    const periode = row[0] ? String(row[0]).trim() : "";
    if (!periode) continue;

    // Only process main period rows (have TPS/TVH column value)
    const tpsTvh = parseNum(row[1]);
    const tvq = parseNum(row[2]);
    if (tpsTvh === 0 && tvq === 0) continue;

    const tpsPercue = parseNum(row[3]);
    const reference = row[7] ? String(row[7]).trim() : null;

    // Parse period to get date range
    // Format: "02/04-2025" → month 02, day 04, year 2025
    // This represents a quarterly period
    const match = periode.match(/(\d{2})\/(\d{2})-(\d{4})/);
    if (!match) continue;

    const month = parseInt(match[1]);
    const year = parseInt(match[3]);
    // Determine quarter start/end from the month
    let dateDebut, dateFin;
    if (month <= 3) {
      dateDebut = `${year}-01-01`;
      dateFin = `${year}-03-31`;
    } else if (month <= 6) {
      dateDebut = `${year}-04-01`;
      dateFin = `${year}-06-30`;
    } else if (month <= 9) {
      dateDebut = `${year}-07-01`;
      dateFin = `${year}-09-30`;
    } else {
      dateDebut = `${year}-10-01`;
      dateFin = `${year}-12-31`;
    }

    const periodeLabel = `${year}-T${Math.ceil(month / 3)}`;

    try {
      await sql`
        INSERT INTO periodes_fiscales (periode, date_debut, date_fin, tps_percue, tps_payee, tvq_percue, tvq_payee, reference)
        VALUES (${periodeLabel}, ${dateDebut}, ${dateFin}, ${tpsPercue}, ${tpsTvh}, ${tvq}, ${tvq}, ${reference})
        ON CONFLICT DO NOTHING
      `;
      imported++;
    } catch (e) {
      console.error(`  Taxes row ${i} error:`, e.message.substring(0, 100));
    }
  }

  console.log(`Taxes: ${imported} periodes fiscales imported`);
}

// ── Main ──

async function main() {
  console.log("Loading lookups...");
  await loadLookups();
  console.log(
    `  ${categories.length} categories, ${projets.length} projets, ${contacts.length} contacts, ${comptes.length} comptes\n`,
  );

  console.log("Importing Dépenses...");
  await importDepenses();

  console.log("\nImporting Revenus...");
  await importRevenus();

  console.log("\nImporting Taxes...");
  await importTaxes();

  // Quick verification
  const [count] = await sql`SELECT COUNT(*) as total FROM transactions`;
  const [revSum] =
    await sql`SELECT COALESCE(SUM(total_ttc), 0) as total FROM transactions WHERE type = 'revenu'`;
  const [depSum] =
    await sql`SELECT COALESCE(SUM(total_ttc), 0) as total FROM transactions WHERE type = 'dépense'`;
  const [taxCount] = await sql`SELECT COUNT(*) as total FROM periodes_fiscales`;
  console.log(`\n=== VERIFICATION ===`);
  console.log(`Total transactions: ${count.total}`);
  console.log(`Total revenus: ${parseFloat(revSum.total).toFixed(2)} $`);
  console.log(`Total dépenses: ${parseFloat(depSum.total).toFixed(2)} $`);
  console.log(`Periodes fiscales: ${taxCount.total}`);
}

main().catch(console.error);

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
  TabStopPosition,
  TabStopType,
  Header,
  Footer,
  ImageRun,
  ShadingType,
  TableOfContents,
  StyleLevel,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
} from "docx";
import fs from "fs";

// ── Colors ──
const BLEU = "1B3A5C";
const TURQUOISE = "2196A4";
const GRIS_BORDER = "CCCCCC";
const GRIS_BG = "F5F5F5";
const AMBER_BG = "FFF8E1";
const AMBER_BORDER = "F59E0B";
const GREEN_BG = "F0FFF4";
const GREEN_BORDER = "22C55E";

// ── Helpers ──
function title(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, color: BLEU, font: "Arial", bold: true })],
  });
}
function h2(text) {
  return title(text, HeadingLevel.HEADING_2);
}
function h3(text) {
  return title(text, HeadingLevel.HEADING_3);
}

function para(text, opts = {}) {
  const runs = [];
  // Support simple bold markers **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: "Arial",
          size: 22,
          color: opts.color || "333333",
        }),
      );
    } else {
      runs.push(
        new TextRun({
          text: part,
          font: "Arial",
          size: 22,
          color: opts.color || "333333",
          italics: opts.italics || false,
        }),
      );
    }
  }
  return new Paragraph({
    spacing: { after: 100 },
    alignment: opts.alignment,
    children: runs,
  });
}

function bullet(text, level = 0) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const runs = parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return new TextRun({
        text: part.slice(2, -2),
        bold: true,
        font: "Arial",
        size: 22,
        color: "333333",
      });
    }
    return new TextRun({
      text: part,
      font: "Arial",
      size: 22,
      color: "333333",
    });
  });
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60 },
    children: runs,
  });
}

function numberedStep(num, text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const runs = [
    new TextRun({
      text: `${num}. `,
      bold: true,
      font: "Arial",
      size: 22,
      color: TURQUOISE,
    }),
  ];
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: "Arial",
          size: 22,
          color: "333333",
        }),
      );
    } else {
      runs.push(
        new TextRun({ text: part, font: "Arial", size: 22, color: "333333" }),
      );
    }
  }
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: 360 },
    children: runs,
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 100 }, children: [] });
}

function encadre(titre, texte, type = "astuce") {
  const bgColor = type === "astuce" ? GREEN_BG : AMBER_BG;
  const borderColor = type === "astuce" ? GREEN_BORDER : AMBER_BORDER;
  const icon = type === "astuce" ? "Astuce" : "Attention";
  const borderOpts = { style: BorderStyle.SINGLE, size: 6, color: borderColor };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: borderOpts,
              bottom: borderOpts,
              left: { style: BorderStyle.SINGLE, size: 18, color: borderColor },
              right: borderOpts,
            },
            shading: {
              type: ShadingType.CLEAR,
              fill: bgColor.replace("#", ""),
            },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: `${icon} : ${titre}`,
                    bold: true,
                    font: "Arial",
                    size: 22,
                    color: type === "astuce" ? "166534" : "92400E",
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: texte,
                    font: "Arial",
                    size: 20,
                    color: "333333",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function navigation(chemin) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: "Navigation : ",
        bold: true,
        font: "Arial",
        size: 20,
        color: TURQUOISE,
      }),
      new TextRun({
        text: chemin,
        font: "Arial",
        size: 20,
        color: "666666",
        italics: true,
      }),
    ],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ── Fiche résumé ──
function ficheResume(lettre, titre, etapes) {
  const rows = etapes.map(
    (e, i) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: TURQUOISE },
            verticalAlign: "center",
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${i + 1}`,
                    bold: true,
                    font: "Arial",
                    size: 24,
                    color: "FFFFFF",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 92, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                indent: { left: 120 },
                children: [
                  new TextRun({
                    text: e,
                    font: "Arial",
                    size: 22,
                    color: "333333",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
  );
  const borderOpts = { style: BorderStyle.SINGLE, size: 3, color: GRIS_BORDER };
  return [
    h3(`Fiche ${lettre} : ${titre}`),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: borderOpts,
        bottom: borderOpts,
        left: borderOpts,
        right: borderOpts,
        insideHorizontal: borderOpts,
        insideVertical: borderOpts,
      },
    }),
    spacer(),
  ];
}

// ══════════════════════════════════════════
// DOCUMENT
// ══════════════════════════════════════════

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22, color: "333333" } },
      heading1: {
        run: { font: "Arial", size: 32, bold: true, color: BLEU },
        paragraph: { spacing: { before: 360, after: 160 } },
      },
      heading2: {
        run: { font: "Arial", size: 26, bold: true, color: BLEU },
        paragraph: { spacing: { before: 280, after: 120 } },
      },
      heading3: {
        run: { font: "Arial", size: 22, bold: true, color: TURQUOISE },
        paragraph: { spacing: { before: 200, after: 100 } },
      },
    },
  },
  sections: [
    // ──── PAGE COUVERTURE ────
    {
      properties: {
        page: { size: { width: 12240, height: 15840 } },
      },
      children: [
        spacer(),
        spacer(),
        spacer(),
        spacer(),
        spacer(),
        spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "JAXA Compta",
              font: "Arial",
              size: 60,
              bold: true,
              color: BLEU,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Guide utilisateur",
              font: "Arial",
              size: 36,
              color: TURQUOISE,
            }),
          ],
        }),
        spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: "Application de comptabilite JAXA Production",
              font: "Arial",
              size: 24,
              color: "666666",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: "https://jaxa-compta.netlify.app",
              font: "Arial",
              size: 22,
              color: TURQUOISE,
            }),
          ],
        }),
        spacer(),
        spacer(),
        spacer(),
        spacer(),
        spacer(),
        spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: "Prepare par : Studio Micho - Pierre Michaud",
              font: "Arial",
              size: 22,
              color: "666666",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: "Pour : Virginie Jaffredo, JAXA Production inc.",
              font: "Arial",
              size: 22,
              color: "666666",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: "Fevrier 2026",
              font: "Arial",
              size: 22,
              color: "666666",
            }),
          ],
        }),
      ],
    },

    // ──── TABLE DES MATIERES ────
    {
      properties: { page: { size: { width: 12240, height: 15840 } } },
      children: [
        title("Table des matieres"),
        spacer(),
        para("1. Premiers pas"),
        para("2. Tableau de bord"),
        para("3. Saisir une transaction - Les 4 modes"),
        para("   3.1 Mode Photo (camera)"),
        para("   3.2 Mode Document (PDF, image)"),
        para("   3.3 Mode Import CSV"),
        para("   3.4 Mode Saisie manuelle"),
        para("4. Consulter les transactions"),
        para("5. Projets"),
        para("6. Facturation"),
        para("7. Budgets"),
        para("8. Rapprochement bancaire"),
        para("9. Transactions recurrentes"),
        para("10. Doublons"),
        para("11. Rapports et exports"),
        para("12. Pieces jointes"),
        para("Annexe - Fiches resume rapide"),
      ],
    },

    // ──── CHAPITRE 1 — PREMIERS PAS ────
    {
      properties: { page: { size: { width: 12240, height: 15840 } } },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "JAXA Compta - Guide utilisateur",
                  font: "Arial",
                  size: 16,
                  color: "999999",
                  italics: true,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "Page ",
                  font: "Arial",
                  size: 16,
                  color: "999999",
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: "Arial",
                  size: 16,
                  color: "999999",
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        // ── 1. Premiers pas ──
        title("1. Premiers pas"),

        h2("Se connecter"),
        para(
          "Ouvre ton navigateur (Chrome, Safari, Firefox) et va a l'adresse :",
        ),
        para("**https://jaxa-compta.netlify.app**", { color: TURQUOISE }),
        spacer(),
        numberedStep(
          1,
          "Tu arrives sur l'ecran de connexion avec le logo JAXA Compta.",
        ),
        numberedStep(
          2,
          'Entre le **mot de passe** dans le champ "Entrez le mot de passe".',
        ),
        numberedStep(3, 'Clique sur le bouton **"Se connecter"**.'),
        numberedStep(
          4,
          "Si le mot de passe est correct, tu arrives directement sur le **Tableau de bord**.",
        ),
        spacer(),
        encadre(
          "Rester connectee",
          "Une fois connectee, tu restes connectee pendant 7 jours. Tu n'as pas besoin de retaper le mot de passe a chaque visite.",
          "astuce",
        ),
        spacer(),

        h2("L'ecran d'accueil"),
        para(
          "Apres la connexion, tu arrives sur le **Tableau de bord**. C'est la page principale qui te donne une vue d'ensemble de ta comptabilite : soldes, revenus, depenses du mois, et alertes importantes.",
        ),
        spacer(),

        h2("Navigation : ou trouver quoi"),
        para(
          "La barre de navigation se trouve en haut de l'ecran. Voici les sections disponibles :",
        ),
        spacer(),
        bullet(
          "**Tableau de bord** - Vue d'ensemble (chiffres cles, graphiques, alertes)",
        ),
        bullet(
          "**Saisie** - Entrer de nouvelles transactions (4 modes possibles)",
        ),
        bullet(
          "**Transactions** - Voir, chercher, modifier et supprimer des transactions",
        ),
        bullet("**Factures** - Creer et gerer les factures clients"),
        bullet("**Projets** - Suivi par projet (revenus, depenses, marge)"),
        bullet("**Budgets** - Definir et suivre des budgets par categorie"),
        bullet(
          "**Rapprochement** - Verifier les ecritures avec les releves bancaires",
        ),
        bullet(
          "**Recurrences** - Gerer les transactions automatiques (mensuelles, etc.)",
        ),
        bullet("**Rapports** - Generer des rapports et les exporter"),
        spacer(),
        para(
          "Sur **ordinateur** : tous les menus sont visibles dans la barre du haut. Sur les ecrans plus petits, seules les icones sont affichees. Sur les ecrans tres grands, les icones ET les noms apparaissent.",
        ),
        para(
          "Sur **telephone** : un menu hamburger (trois traits) apparait en haut a gauche. Clique dessus pour acceder aux sections. Tu as aussi une icone **camera** directement dans la barre du haut pour scanner un recu rapidement.",
        ),
        spacer(),
        encadre(
          "Acces rapide camera",
          "Sur telephone, l'icone camera dans le haut de l'ecran t'amene directement au mode Photo pour scanner un recu sans passer par le menu.",
          "astuce",
        ),
        spacer(),

        h2("Installer l'app sur ton telephone"),
        para(
          "JAXA Compta peut s'installer comme une application sur ton telephone pour un acces rapide :",
        ),
        spacer(),
        h3("Sur iPhone (Safari)"),
        numberedStep(1, "Ouvre **jaxa-compta.netlify.app** dans Safari."),
        numberedStep(
          2,
          "Appuie sur le bouton de **partage** (carre avec fleche vers le haut).",
        ),
        numberedStep(3, "Choisis **\"Sur l'ecran d'accueil\"**."),
        numberedStep(4, 'Confirme en appuyant sur **"Ajouter"**.'),
        spacer(),
        h3("Sur Android (Chrome)"),
        numberedStep(1, "Ouvre **jaxa-compta.netlify.app** dans Chrome."),
        numberedStep(2, "Appuie sur les **trois points** en haut a droite."),
        numberedStep(3, "Choisis **\"Ajouter a l'ecran d'accueil\"**."),
        numberedStep(4, "Confirme."),
        spacer(),

        // ── 2. Tableau de bord ──
        pageBreak(),
        title("2. Tableau de bord"),
        navigation("Barre du haut > Tableau de bord"),
        spacer(),
        para(
          "Le tableau de bord est la premiere page que tu vois. Il te donne un apercu rapide de la sante financiere de JAXA.",
        ),
        spacer(),

        h2("Les chiffres en haut (4 cartes)"),
        spacer(),
        bullet(
          '**Solde total** - La somme des soldes de tous tes comptes bancaires. En dessous, le nombre de comptes (ex: "5 comptes").',
        ),
        bullet(
          "**Revenus (mois)** - Le total des revenus recus ce mois-ci (en vert).",
        ),
        bullet(
          "**Depenses (mois)** - Le total des depenses de ce mois (en rouge).",
        ),
        bullet(
          "**Ecart** - La difference entre revenus et depenses du mois. Vert si positif (tu gagnes plus que tu depenses), rouge si negatif.",
        ),
        spacer(),

        h2("Le graphique revenus/depenses"),
        para(
          "Un graphique en barres montre l'evolution sur les **12 derniers mois**. Les barres vertes representent les revenus, les rouges les depenses. Ca te permet de voir les tendances en un coup d'oeil.",
        ),
        spacer(),

        h2("Les projets actifs"),
        para(
          "En dessous du graphique, tu vois la liste des projets en cours avec, pour chacun, les revenus, depenses et la marge (en pourcentage). Un badge vert = marge positive, rouge = marge negative.",
        ),
        spacer(),

        h2("Les soldes par compte"),
        para(
          "Tu vois le solde actuel de chaque compte bancaire (Compte Operations, La Fissure, Whispering Forest, Mastercard, Wise).",
        ),
        spacer(),

        h2("Les alertes"),
        para(
          'Si des **budgets sont a plus de 80% depenses**, une alerte ambre apparait avec le titre **"Budgets critiques"** et le nombre de budgets concernes. Chaque budget affiche une barre de progression.',
        ),
        para(
          'Si des **factures sont en retard** (envoyees depuis plus de 30 jours et pas payees), une alerte rouge apparait avec le titre **"Factures en retard"** et le montant de chacune.',
        ),
        spacer(),

        // ── 3. Saisie ──
        pageBreak(),
        title("3. Saisir une transaction - Les 4 modes"),
        navigation("Barre du haut > Saisie"),
        spacer(),
        para(
          "La page Saisie te propose 4 facons d'enregistrer une transaction. Choisis le mode qui convient a ta situation en cliquant sur l'onglet correspondant :",
        ),
        spacer(),
        bullet(
          "**Photo** - Photographier un recu avec la camera de ton telephone",
        ),
        bullet(
          "**Document** - Deposer un fichier (PDF, image) recu par courriel",
        ),
        bullet(
          "**Import CSV** - Importer un releve bancaire complet en une fois",
        ),
        bullet("**Manuel** - Remplir un formulaire a la main"),
        spacer(),
        para(
          "Dans tous les cas, la transaction passe par un formulaire de validation avant d'etre enregistree. Tu peux toujours corriger les informations avant de sauvegarder.",
        ),
        spacer(),

        h2("3.1 Mode Photo (camera)"),
        navigation(
          "Saisie > onglet Photo   OU   icone camera dans la barre du haut (telephone)",
        ),
        spacer(),
        para(
          "Ce mode utilise la camera de ton telephone pour photographier un recu et en extraire automatiquement les informations (date, montant, fournisseur, taxes).",
        ),
        spacer(),
        numberedStep(
          1,
          'Clique sur **"Prendre une photo"** pour ouvrir la camera, ou sur **"Choisir depuis la galerie"** pour selectionner une photo existante.',
        ),
        numberedStep(
          2,
          "Photographie le recu bien a plat, avec un bon eclairage.",
        ),
        numberedStep(
          3,
          "L'application analyse l'image (message **\"Analyse OCR en cours...\"**). Attends quelques secondes.",
        ),
        numberedStep(
          4,
          'Le formulaire se remplit automatiquement avec les donnees extraites. Un badge indique le **niveau de confiance** (ex: "OCR 87%").',
        ),
        numberedStep(
          5,
          "**Verifie et corrige** si necessaire : la date, le montant, la categorie, le projet.",
        ),
        numberedStep(
          6,
          'Clique sur **"Enregistrer"** pour sauvegarder la transaction.',
        ),
        spacer(),
        encadre(
          "Bons reflexes pour la photo",
          "Pose le recu a plat sur un fond sombre. Evite les ombres et les reflets. Assure-toi que tous les chiffres sont lisibles. Plus la photo est nette, meilleure sera l'extraction.",
          "astuce",
        ),
        encadre(
          "Si l'extraction echoue",
          'Si le message "Extraction echouee" apparait, le recu est peut-etre trop flou ou mal eclaire. Reprends la photo ou passe en mode Saisie manuelle.',
          "attention",
        ),
        spacer(),

        h2("3.2 Mode Document (PDF, image)"),
        navigation("Saisie > onglet Document"),
        spacer(),
        para(
          "Ce mode est ideal quand tu recois une facture par courriel en piece jointe (PDF, JPG, PNG).",
        ),
        spacer(),
        numberedStep(
          1,
          '**Glisse le fichier** dans la zone pointillee, ou **clique** dessus pour selectionner un fichier. La zone indique : "Glissez un PDF, JPG ou PNG ici, ou cliquez pour selectionner".',
        ),
        numberedStep(
          2,
          'L\'application analyse le document (message **"Analyse de [nom du fichier]..."**).',
        ),
        numberedStep(
          3,
          "Le formulaire se pre-remplit. Verifie et corrige si necessaire.",
        ),
        numberedStep(4, 'Clique sur **"Enregistrer"**.'),
        spacer(),
        encadre(
          "Garder le document original",
          "Le fichier est automatiquement attache a la transaction comme piece jointe. Tu pourras le consulter plus tard depuis la liste des transactions.",
          "astuce",
        ),
        spacer(),

        h2("3.3 Mode Import CSV"),
        navigation("Saisie > onglet Import CSV"),
        spacer(),
        para(
          "Ce mode permet d'importer un releve bancaire complet (fichier CSV telecharge depuis Desjardins, Mastercard ou Wise) en une seule operation.",
        ),
        spacer(),
        numberedStep(
          1,
          'Clique sur **"Choisir un fichier CSV"** et selectionne le fichier telecharge depuis ta banque.',
        ),
        numberedStep(
          2,
          'L\'application detecte les colonnes du fichier et affiche **"Mapper les colonnes (X lignes detectees)"**.',
        ),
        numberedStep(
          3,
          "Verifie que les colonnes **Date**, **Description**, **Debit**, **Credit** et **Compte** sont bien associees. Corrige si necessaire.",
        ),
        numberedStep(
          4,
          'Clique sur **"Appliquer le mapping"** pour voir la previsualisation.',
        ),
        numberedStep(
          5,
          "Dans la previsualisation, tu peux decocher les lignes que tu ne veux pas importer, et choisir la **categorie** et le **projet** pour chaque ligne.",
        ),
        numberedStep(
          6,
          "Clique sur **\"Valider l'import\"** pour tout enregistrer d'un coup.",
        ),
        numberedStep(
          7,
          'Le message **"Import termine"** confirme le succes avec le nombre de transactions importees.',
        ),
        spacer(),
        encadre(
          "Obtenir le CSV chez Desjardins",
          "Connecte-toi a AccesD > Mon compte > Historique > Exporter > Format CSV. Choisis la periode souhaitee.",
          "astuce",
        ),
        encadre(
          "Doublons possibles",
          "Apres un import CSV, l'application peut detecter des doublons si certaines transactions existaient deja. Consulte la section 10 (Doublons) pour les gerer.",
          "attention",
        ),
        spacer(),

        h2("3.4 Mode Saisie manuelle"),
        navigation("Saisie > onglet Manuel"),
        spacer(),
        para(
          "Ce mode te permet de remplir directement le formulaire sans passer par un scan ou un import.",
        ),
        spacer(),

        h3("Les raccourcis"),
        para(
          "En haut de la page, tu trouveras des **boutons raccourcis** pour les transactions frequentes. Un clic et le formulaire se pre-remplit :",
        ),
        bullet("**Part actionnaire VJ** - Pour la part de Virginie"),
        bullet("**Part actionnaire PM** - Pour la part de Pierre"),
        bullet(
          "**Frais banque Cpte 20** - Frais bancaires du compte Operations",
        ),
        bullet(
          "**Frais banque Cpte 21 (FIS)** - Frais bancaires du compte La Fissure",
        ),
        bullet(
          "**Frais banque Cpte 24 (WF)** - Frais bancaires du compte Whispering Forest",
        ),
        bullet("**Frais banque MC** - Frais Mastercard"),
        bullet("**Frais banque Wise** - Frais Wise"),
        bullet("**Facture client** - Pour enregistrer un revenu"),
        bullet("**Transfert interne** - Pour un transfert entre comptes"),
        spacer(),

        h3("Le formulaire de transaction"),
        para("Voici les champs a remplir :"),
        spacer(),
        bullet(
          "**Date** - La date de la transaction (par defaut : aujourd'hui)",
        ),
        bullet(
          "**Type** - Choisis entre **Depense**, **Revenu** ou **Transfert**",
        ),
        bullet(
          "**Categorie** - Selectionne la categorie (la liste se filtre selon le type choisi)",
        ),
        bullet("**Projet** - Associe la transaction a un projet (optionnel)"),
        bullet("**Description** - Decris la transaction"),
        bullet(
          '**Contact / Fournisseur** - Selectionne le fournisseur ou client. Utilise le bouton **"+"** a cote pour en creer un nouveau sans quitter la page.',
        ),
        bullet("**Compte bancaire** - Le compte concerne"),
        bullet(
          "**Mode de paiement** - Mastercard, Visa Wise, Virement Interac, Depot direct, Debit, Comptant ou Cheque",
        ),
        bullet("**N'  Facture** - Numero de facture (optionnel)"),
        spacer(),

        h3("Les montants et les taxes"),
        bullet("**Montant HT** - Entre le montant avant taxes"),
        bullet(
          "**TPS (5%)** et **TVQ (9,975%)** - Se calculent automatiquement",
        ),
        bullet("**Total TTC** - Se calcule automatiquement (montant + taxes)"),
        bullet(
          'Si la transaction n\'est pas taxable, **decoche la case "Taxable"** et les taxes passent a 0.',
        ),
        spacer(),

        h3("Notes et piece jointe"),
        bullet("**Notes** - Ajoute un commentaire (optionnel)"),
        bullet(
          '**Piece jointe** - Tu peux attacher un fichier (image ou PDF). Clique sur "Choisir un fichier" pour uploader.',
        ),
        spacer(),
        para(
          'Termine en cliquant sur **"Enregistrer"**. Le message **"Enregistre avec succes"** confirme que tout est sauvegarde.',
        ),
        spacer(),

        encadre(
          "Ajouter un nouveau fournisseur",
          'Clique sur le bouton "+" a cote du champ "Contact / Fournisseur". Une fenetre s\'ouvre pour entrer le nom et le type (Fournisseur ou Client). Apres validation, le nouveau contact est automatiquement selectionne.',
          "astuce",
        ),
        spacer(),

        // ── 4. Transactions ──
        pageBreak(),
        title("4. Consulter les transactions"),
        navigation("Barre du haut > Transactions"),
        spacer(),
        para(
          "Cette page affiche la liste de toutes tes transactions dans un tableau.",
        ),
        spacer(),

        h2("Les filtres"),
        para(
          "Utilise les filtres en haut pour trouver rapidement ce que tu cherches :",
        ),
        bullet(
          "**Rechercher...** - Tape un mot cle (nom de fournisseur, description, etc.)",
        ),
        bullet(
          '**Projet** - Filtre par projet ("Tous les projets" par defaut)',
        ),
        bullet('**Categorie** - Filtre par categorie ("Toutes" par defaut)'),
        bullet("**Du / Au** - Filtre par periode (dates de debut et fin)"),
        spacer(),

        h2("Le tableau"),
        para(
          "Le tableau affiche : Date, Type (badge couleur), Description, Projet, Categorie, Total TTC, Compte, et les Actions.",
        ),
        para(
          "Tu peux **trier** en cliquant sur les en-tetes de colonnes **Date** ou **Total TTC**. Une petite fleche indique le sens du tri.",
        ),
        spacer(),

        h2("Les actions sur chaque ligne"),
        bullet(
          "**Icone coche verte** - La transaction est rapprochee (verifiee avec le releve bancaire)",
        ),
        bullet(
          "**Icone trombone ambre** - Une piece jointe est attachee. Clique pour la voir dans un nouvel onglet.",
        ),
        bullet(
          "**Icone fichier bleu** - Pour les revenus, telecharge la facture en PDF.",
        ),
        bullet(
          "**Icone crayon** - Modifier la transaction. Une fenetre s'ouvre avec le formulaire pre-rempli.",
        ),
        bullet(
          "**Icone poubelle rouge** - Supprimer la transaction. Une confirmation te sera demandee.",
        ),
        spacer(),

        h2("Exporter et detecter les doublons"),
        bullet(
          'Bouton **"Export Excel"** - Telecharge toutes les transactions filtrees en fichier Excel.',
        ),
        bullet(
          'Bouton **"Doublons"** - Ouvre l\'outil de detection de doublons (voir section 10).',
        ),
        spacer(),

        h2("Pagination"),
        para(
          'Si tu as beaucoup de transactions, elles sont affichees par pages. Utilise les fleches **"<"** et **">"** en bas pour naviguer. Le numero de page est indique (ex: "Page 1 / 5").',
        ),
        spacer(),

        encadre(
          "Modifier une transaction",
          "Clique sur l'icone crayon a droite de la ligne. Le formulaire s'ouvre pre-rempli. Fais tes modifications puis clique sur \"Mettre a jour\".",
          "astuce",
        ),
        spacer(),

        // ── 5. Projets ──
        pageBreak(),
        title("5. Projets"),
        navigation("Barre du haut > Projets"),
        spacer(),
        para(
          "La page Projets te montre tous tes projets sous forme de cartes dans une grille.",
        ),
        spacer(),

        h2("Comprendre les cartes"),
        para("Chaque carte affiche :"),
        bullet("**Code du projet** en gros (ex: CARI, WF, FIS)"),
        bullet('**Statut** - Badge "En cours", "Complete", etc.'),
        bullet("**Nom complet** du projet"),
        bullet(
          "**Revenus** (en vert), **Depenses** (en rouge), **Marge** (en pourcentage)",
        ),
        bullet(
          "**Barre de budget** - Si un budget est defini, une barre de progression apparait (vert < 80%, ambre 80-100%, rouge > 100%)",
        ),
        spacer(),

        h2("Voir le detail d'un projet"),
        para(
          "Clique sur une carte pour ouvrir le detail. Tu verras la liste de toutes les transactions liees a ce projet avec la date, le type, la description, le contact et le montant.",
        ),
        spacer(),

        // ── 6. Facturation ──
        pageBreak(),
        title("6. Facturation"),
        navigation("Barre du haut > Factures"),
        spacer(),
        para(
          "La page Factures te permet de creer, suivre et gerer tes factures clients.",
        ),
        spacer(),

        h2("Vue d'ensemble"),
        para("En haut de la page, 4 cartes resument la situation :"),
        bullet("**Total factures** - Nombre total de factures"),
        bullet("**Payees** - Nombre de factures payees (en vert)"),
        bullet("**En attente** - Nombre de factures en attente"),
        bullet("**Impaye** - Montant total des factures impayees (en rouge)"),
        spacer(),

        h2("Creer une nouvelle facture"),
        numberedStep(
          1,
          'Clique sur **"Nouvelle facture"** (bouton en haut a droite).',
        ),
        numberedStep(2, "Selectionne le **Client** et le **Projet**."),
        numberedStep(
          3,
          "Pour le **N' Facture**, tu peux le taper manuellement ou cliquer sur l'icone fichier a cote pour **auto-generer** un numero.",
        ),
        numberedStep(4, "Choisis la **Date** et le **Compte bancaire**."),
        numberedStep(
          5,
          'Coche ou decoche **"Taxable (TPS 5% + TVQ 9,975%)"** selon le cas.',
        ),
        numberedStep(
          6,
          "Ajoute les **lignes de facturation** : pour chaque service, entre la description, le nombre d'unites et le cout unitaire. Le montant se calcule automatiquement.",
        ),
        numberedStep(
          7,
          'Tu peux ajouter des **lignes d\'en-tete** (cocher "En-tete") pour organiser ta facture en sections.',
        ),
        numberedStep(
          8,
          "Verifie les totaux en bas : Sous-total, TPS, TVQ, Total.",
        ),
        numberedStep(
          9,
          'Clique sur **"Enregistrer + PDF"**. La facture est enregistree et le PDF se telecharge automatiquement.',
        ),
        spacer(),
        encadre(
          "Lignes de facturation",
          'Clique sur "+ Ligne" pour ajouter une nouvelle ligne. Chaque ligne peut etre un service (avec unites et cout) ou un en-tete de section. Utilise la poubelle rouge pour supprimer une ligne.',
          "astuce",
        ),
        spacer(),

        h2("Gerer les factures existantes"),
        para("Dans le tableau, chaque facture a des boutons d'action :"),
        bullet("**Icone telechargement** - Telecharge le PDF de la facture"),
        bullet(
          "**Icone courriel bleu** - Ouvre ton client mail avec un courriel pre-rempli pour envoyer la facture au client",
        ),
        bullet('**Icone dollar vert** - Marque la facture comme **"Payee"**'),
        bullet(
          '**Icone triangle rouge** - Marque la facture comme **"En retard"**',
        ),
        spacer(),
        para(
          'Tu peux filtrer les factures par statut avec le menu deroulant **"Tous statuts"** : Envoyee, Payee, En retard, En attente, A valider.',
        ),
        spacer(),

        h2("Gerer les contacts"),
        para(
          'Clique sur le bouton **"Contacts"** pour voir et modifier les informations de tes clients : nom, courriel, telephone, adresse, numeros de TPS et TVQ. Ces infos apparaissent sur les factures PDF.',
        ),
        spacer(),
        encadre(
          "Courriel du client",
          "Si le client n'a pas de courriel enregistre, le bouton d'envoi t'invitera a modifier sa fiche contact. Ajoute son courriel pour pouvoir lui envoyer les factures directement.",
          "attention",
        ),
        spacer(),

        // ── 7. Budgets ──
        pageBreak(),
        title("7. Budgets"),
        navigation("Barre du haut > Budgets"),
        spacer(),
        para(
          "Les budgets te permettent de fixer des limites de depenses par categorie et de suivre ou tu en es.",
        ),
        spacer(),

        h2("Definir un budget"),
        numberedStep(
          1,
          "Choisis l'**annee** et le **mois** (ou \"Annuel\" pour un budget sur l'annee entiere).",
        ),
        numberedStep(2, 'Clique sur **"+ Ajouter"**.'),
        numberedStep(
          3,
          "Selectionne la **categorie** de depense (ex: Services professionnels, Transport, etc.).",
        ),
        numberedStep(4, "Optionnellement, choisis un **projet** specifique."),
        numberedStep(5, "Entre le **montant budgete**."),
        numberedStep(6, 'Clique sur **"Enregistrer"**.'),
        spacer(),

        h2("Lire les barres de progression"),
        para("Chaque budget affiche une barre de couleur :"),
        bullet("**Vert** - Moins de 80% du budget depense. Tout va bien."),
        bullet(
          "**Ambre/orange** - Entre 80% et 100%. Attention, tu approches de la limite.",
        ),
        bullet("**Rouge** - 100% ou plus. Le budget est depasse."),
        spacer(),
        para(
          'A droite de chaque budget, tu vois le montant depense sur le montant budgete (ex: "1 200 $ / 2 000 $") et le montant restant.',
        ),
        spacer(),

        h2("Alertes sur le tableau de bord"),
        para(
          "Quand un budget depasse 80%, il apparait automatiquement dans la section **\"Budgets critiques\"** du tableau de bord. Tu n'as rien a faire, l'alerte est automatique.",
        ),
        spacer(),

        // ── 8. Rapprochement ──
        pageBreak(),
        title("8. Rapprochement bancaire"),
        navigation("Barre du haut > Rapprochement"),
        spacer(),
        para(
          "Le rapprochement bancaire, c'est verifier que les transactions dans JAXA Compta correspondent a ce qui apparait sur ton releve de banque. C'est un controle important pour s'assurer que rien n'a ete oublie.",
        ),
        spacer(),

        h2("Comment faire un rapprochement"),
        numberedStep(
          1,
          "Choisis le **compte** bancaire dans le menu deroulant.",
        ),
        numberedStep(
          2,
          "Selectionne la **periode** (Du / Au) qui correspond a ton releve.",
        ),
        numberedStep(
          3,
          "Entre le **solde du releve bancaire** (le montant final indique sur ton releve).",
        ),
        numberedStep(
          4,
          "Les transactions de la periode s'affichent. **Coche** chaque transaction qui apparait aussi sur ton releve bancaire.",
        ),
        numberedStep(
          5,
          "Verifie l'**ecart** en haut. S'il est a **0,00 $** avec un badge vert **\"Equilibre\"**, tout est bon.",
        ),
        numberedStep(
          6,
          'Clique sur **"Valider le rapprochement"** pour enregistrer la session.',
        ),
        spacer(),

        h2("Comprendre les cartes du resume"),
        bullet(
          "**Credits rapproches** (vert) - Total des revenus que tu as coches",
        ),
        bullet(
          "**Debits rapproches** (rouge) - Total des depenses que tu as cochees",
        ),
        bullet(
          "**Solde rapproche** - La difference entre credits et debits coches",
        ),
        bullet(
          "**Ecart** - La difference entre le solde du releve et le solde rapproche. L'objectif est d'atteindre 0 $.",
        ),
        spacer(),

        encadre(
          "Si l'ecart n'est pas a zero",
          "Ca peut vouloir dire qu'il manque une transaction dans le logiciel (frais bancaires, interets, etc.) ou qu'un montant est incorrect. Verifie ligne par ligne.",
          "attention",
        ),
        spacer(),

        // ── 9. Recurrences ──
        pageBreak(),
        title("9. Transactions recurrentes"),
        navigation("Barre du haut > Recurrences"),
        spacer(),
        para(
          "Les transactions recurrentes permettent d'automatiser les ecritures qui reviennent regulierement (part actionnaire mensuelle, frais fixes, etc.).",
        ),
        spacer(),

        h2("Creer une recurrence"),
        numberedStep(1, 'Clique sur **"+ Nouvelle"**.'),
        numberedStep(
          2,
          "Remplis le formulaire : **type** (Depense/Revenu/Transfert), **frequence** (Hebdomadaire, Mensuel, Trimestriel ou Annuel), description, categorie, montant, etc.",
        ),
        numberedStep(
          3,
          "Choisis la **date de debut** et la **prochaine date** de generation.",
        ),
        numberedStep(4, "Optionnellement, fixe une **date de fin**."),
        numberedStep(5, 'Clique sur **"Enregistrer"**.'),
        spacer(),

        h2("Gerer les recurrences"),
        para(
          "Le tableau liste toutes les recurrences avec leur frequence, montant, prochaine date et statut.",
        ),
        bullet(
          "**Icone pause** - Met la recurrence en pause (les transactions ne se generent plus)",
        ),
        bullet("**Icone lecture** - Reactive une recurrence en pause"),
        bullet("**Icone crayon** - Modifier les details"),
        bullet("**Icone poubelle** - Supprimer definitivement"),
        spacer(),

        h2("Generation automatique"),
        para(
          "Chaque fois que tu te connectes, l'application verifie s'il y a des transactions recurrentes a generer et les cree automatiquement. Tu peux aussi forcer la generation en cliquant sur **\"Generer maintenant\"**.",
        ),
        spacer(),

        encadre(
          "Pas de surprise",
          "Les transactions generees automatiquement apparaissent dans la liste des transactions comme des transactions normales. Tu peux les modifier ou les supprimer si necessaire.",
          "astuce",
        ),
        spacer(),

        // ── 10. Doublons ──
        pageBreak(),
        title("10. Doublons"),
        navigation('Transactions > bouton "Doublons"'),
        spacer(),
        para(
          "L'application detecte automatiquement les transactions qui se ressemblent (meme montant, dates proches, descriptions similaires) et qui pourraient etre des doublons.",
        ),
        spacer(),

        h2("Detection automatique"),
        para(
          'Quand tu crees une nouvelle transaction, si une transaction similaire existe deja, un encadre ambre apparait avec le message **"X transaction(s) similaire(s) detectee(s)"**. Tu peux alors :',
        ),
        bullet(
          '**"Ignorer et enregistrer"** - Enregistrer quand meme (ce n\'est pas un doublon)',
        ),
        bullet('**"Annuler"** - Revenir en arriere pour verifier'),
        spacer(),

        h2("Scanner tous les doublons"),
        numberedStep(
          1,
          'Va dans **Transactions** et clique sur le bouton **"Doublons"**.',
        ),
        numberedStep(
          2,
          'L\'application analyse toutes les transactions (message **"Analyse en cours..."**).',
        ),
        numberedStep(
          3,
          "Les paires de doublons potentiels s'affichent cote a cote.",
        ),
        numberedStep(
          4,
          'Pour chaque paire, tu peux **"Supprimer A"**, **"Supprimer B"** ou **"Ignorer cette paire"**.',
        ),
        spacer(),
        encadre(
          "Apres un import CSV",
          "C'est une bonne idee de lancer une detection de doublons apres chaque import CSV, car le releve bancaire peut contenir des transactions deja saisies manuellement.",
          "astuce",
        ),
        spacer(),

        // ── 11. Rapports ──
        pageBreak(),
        title("11. Rapports et exports"),
        navigation("Barre du haut > Rapports"),
        spacer(),
        para(
          "La page Rapports te permet de generer differents types de rapports et de les exporter.",
        ),
        spacer(),

        h2("Types de rapports"),
        bullet(
          "**Mensuel** - Toutes les transactions d'un mois, avec option de filtrer par compte.",
        ),
        bullet(
          "**Trimestriel taxes** - Resume des TPS et TVQ percues et payees pour un trimestre. Utile pour les declarations de taxes. Les trimestres sont : T1 (Fev-Avr), T2 (Mai-Jul), T3 (Aou-Oct), T4 (Nov-Jan).",
        ),
        bullet(
          "**Par projet** - Toutes les transactions liees a un projet specifique.",
        ),
        bullet("**Annuel** - Resume complet de l'annee."),
        spacer(),

        h2("Generer un rapport"),
        numberedStep(1, "Choisis le **type** de rapport."),
        numberedStep(
          2,
          "Remplis les criteres (mois, trimestre, projet ou annee selon le type).",
        ),
        numberedStep(3, 'Clique sur **"Generer"**.'),
        numberedStep(
          4,
          "Le rapport s'affiche avec un resume en haut (revenus, depenses, TPS nette, TVQ nette) et le detail des transactions en dessous.",
        ),
        spacer(),

        h2("Exporter"),
        bullet('Bouton **"PDF"** - Telecharge le rapport au format PDF.'),
        bullet(
          'Bouton **"Excel"** - Telecharge le rapport au format Excel (.xlsx).',
        ),
        bullet(
          'Bouton **"Envoyer a LGCPA"** - Ouvre ton client mail avec un courriel pre-rempli pour envoyer le rapport a ta comptable.',
        ),
        spacer(),

        encadre(
          "Pour la comptable",
          "Le rapport Trimestriel taxes est celui que tu utiliseras le plus souvent pour ta comptable (LGCPA). Il resume les taxes a remettre pour la periode.",
          "astuce",
        ),
        spacer(),

        // ── 12. Pieces jointes ──
        pageBreak(),
        title("12. Pieces jointes"),
        spacer(),
        para(
          "Tu peux attacher un recu ou un document a n'importe quelle transaction.",
        ),
        spacer(),

        h2("Ajouter une piece jointe"),
        para(
          'Dans le formulaire de transaction (creation ou modification), tu trouveras le champ **"Piece jointe (recu / facture)"** en bas. Clique sur **"Choisir un fichier"** et selectionne une image ou un PDF.',
        ),
        para(
          "Si tu utilises le mode Photo ou Document, la piece jointe est ajoutee automatiquement.",
        ),
        spacer(),

        h2("Consulter une piece jointe"),
        para(
          "Dans la liste des transactions, les lignes avec une piece jointe ont une **icone trombone ambre**. Clique dessus : le document s'ouvre dans un nouvel onglet de ton navigateur.",
        ),
        spacer(),

        h2("Supprimer une piece jointe"),
        para(
          'Modifie la transaction (icone crayon), puis clique sur le **bouton rouge** a cote du lien "Voir le recu" pour supprimer la piece jointe.',
        ),
        spacer(),

        // ──── ANNEXE — FICHES ────
        pageBreak(),
        title("Annexe - Fiches resume rapide"),
        para(
          "Ces fiches aide-memoire te rappellent les etapes essentielles pour les taches courantes.",
        ),
        spacer(),

        ...ficheResume("A", "Saisir un recu par photo", [
          "Menu > Saisie > onglet Photo (ou icone camera dans la barre du haut)",
          'Clique sur "Prendre une photo" et photographie le recu',
          "Attends l'analyse automatique (quelques secondes)",
          "Verifie et corrige les informations dans le formulaire",
          'Clique sur "Enregistrer"',
        ]),

        ...ficheResume("B", "Importer un releve bancaire CSV", [
          "Menu > Saisie > onglet Import CSV",
          'Clique sur "Choisir un fichier CSV" et selectionne le releve',
          'Verifie le mapping des colonnes puis clique sur "Appliquer le mapping"',
          "Verifie les categories et projets dans la previsualisation",
          'Clique sur "Valider l\'import"',
        ]),

        ...ficheResume("C", "Creer et envoyer une facture", [
          'Menu > Factures > "Nouvelle facture"',
          "Remplis client, projet, numero, lignes de facturation",
          "Verifie les totaux (sous-total, TPS, TVQ, total)",
          'Clique sur "Enregistrer + PDF" (le PDF se telecharge)',
          "Clique sur l'icone courriel pour envoyer au client",
        ]),

        ...ficheResume("D", "Faire un rapprochement bancaire mensuel", [
          "Menu > Rapprochement",
          "Choisis le compte et la periode du releve",
          "Entre le solde final de ton releve bancaire",
          "Coche chaque transaction qui apparait sur le releve",
          'Verifie que l\'ecart est a 0 $ puis clique sur "Valider le rapprochement"',
        ]),

        ...ficheResume("E", "Verifier les doublons", [
          'Menu > Transactions > bouton "Doublons"',
          "Attends l'analyse automatique",
          "Pour chaque paire, choisis de supprimer A, supprimer B, ou ignorer",
        ]),

        ...ficheResume("F", "Generer un rapport pour LGCPA", [
          "Menu > Rapports",
          'Choisis le type "Trimestriel taxes" et la periode',
          'Clique sur "Generer"',
          'Clique sur "Envoyer a LGCPA" pour ouvrir le courriel pre-rempli',
        ]),
      ],
    },
  ],
});

// ── Generate ──
const buffer = await Packer.toBuffer(doc);
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(
  __dirname,
  "..",
  "Guide_Utilisateur_JAXA_Compta.docx",
);
fs.writeFileSync(outputPath, buffer);
console.log(`Guide genere : ${outputPath}`);
console.log(`Taille : ${(buffer.length / 1024).toFixed(0)} Ko`);

import { config } from "dotenv";
import { runExtractionPipeline } from "../lib/extraction/pipeline";

config({ path: ".env.local" });

const documentId = process.argv[2];
const contractId = process.argv[3];

if (!documentId || !contractId) {
  console.error("Usage: npx tsx scripts/run-extraction.ts <documentId> <contractId>");
  process.exit(1);
}

runExtractionPipeline(documentId, contractId)
  .then(() => {
    console.log("Extraction complete");
  })
  .catch((error) => {
    console.error("Extraction failed:", error);
    process.exit(1);
  });

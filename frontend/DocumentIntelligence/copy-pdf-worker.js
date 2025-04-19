// copy-pdf-worker.js
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url'; // Import for ES Modules

// Get the directory name in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Update source path to correct file
const sourcePath = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
// Update destination path to be inside client/public
const destPath = path.resolve(__dirname, 'client/public/pdf.worker.min.mjs');

async function copyWorkerFile() {
  try {
    await fs.ensureDir(path.dirname(destPath)); // Ensure client/public directory exists
    await fs.copy(sourcePath, destPath, { overwrite: true });
    console.log('Successfully copied pdf.worker.min.mjs to client/public directory.'); // Update log message
  } catch (err) {
    console.error('Error copying pdf.worker.min.mjs:', err);
    process.exit(1); // Exit with error code if copy fails
  }
}

copyWorkerFile();
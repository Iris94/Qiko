const fs = require('fs');
const path = require('path');

require('./generate-config.js');

const srcDir = path.join(__dirname, 'Logic');
const destDir = path.join(__dirname, 'Extension', 'Logic');

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Initial sync
try {
  copyDirSync(srcDir, destDir);
  console.log('Initial sync of Logic/ to Extension/Logic/ completed.');
} catch (err) {
  console.error('Error during initial sync:', err);
  process.exit(1);
}

// Watch mode
if (process.argv.includes('--watch')) {
  console.log('Watching for changes in Logic/...');
  fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const srcPath = path.join(srcDir, filename);
    const destPath = path.join(destDir, filename);

    try {
      if (fs.existsSync(srcPath)) {
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }
        } else {
          fs.copyFileSync(srcPath, destPath);
          console.log(`[Sync] Updated: ${filename}`);
        }
      } else {
        // Handle file deletion
        if (fs.existsSync(destPath)) {
          const stat = fs.statSync(destPath);
          if (stat.isDirectory()) {
            fs.rmdirSync(destPath);
          } else {
            fs.unlinkSync(destPath);
          }
          console.log(`[Sync] Deleted: ${filename}`);
        }
      }
    } catch (err) {
      console.error(`Error syncing ${filename}:`, err);
    }
  });
}

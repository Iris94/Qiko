const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'Logic', 'config.js');
const templatePath = path.join(__dirname, 'Logic', 'config.template.js');

// Helper to parse and load .env files
function loadEnvFile(envPath) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from: ${envPath}`);
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('#') || !line.trim()) continue;
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value.trim();
      }
    }
  }
}

// Load env files from root and Web/ directories
loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, 'Web', '.env'));

// Also load .env.local if present
loadEnvFile(path.join(__dirname, '.env.local'));
loadEnvFile(path.join(__dirname, 'Web', '.env.local'));

if (!fs.existsSync(configPath)) {
  console.log('Logic/config.js not found. Generating...');
  
  const dbUrl = process.env.PUBLIC_FIREBASE_DB_URL || process.env.FIREBASE_DB_URL;
  const apiKey = process.env.PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;

  if (dbUrl && apiKey) {
    console.log('Generating Logic/config.js using environment variables.');
    const content = `export const CONFIG = {
  FIREBASE_DB_URL: "${dbUrl}",
  FIREBASE_API_KEY: "${apiKey}"
};
`;
    fs.writeFileSync(configPath, content, 'utf8');
  } else if (fs.existsSync(templatePath)) {
    console.log('No matching environment variables found. Generating Logic/config.js from template (config.template.js).');
    fs.copyFileSync(templatePath, configPath);
  } else {
    console.error('Error: Neither environment variables nor config.template.js was found.');
    process.exit(1);
  }
} else {
  console.log('Logic/config.js already exists.');
}

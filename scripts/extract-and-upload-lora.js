// Standalone, one-off script - NOT part of the production app. Run manually
// on your own machine, with your own R2 credentials:
//
//   R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... node scripts/extract-and-upload-lora.js
//
// Downloads Bobban's training output .tar from Replicate, extracts just
// lora.safetensors (fal.ai's flux-lora rejects the full .tar with "Failed
// to download the file" - it wants a direct weights file, not an archive),
// and uploads that single file to Cloudflare R2.
//
// Previously uploaded to Supabase Storage (first a plain upload, then TUS
// resumable upload after hitting the free plan's 50MB cap) - both failed
// with "Maximum size exceeded" for this ~164MB file, confirming the 50MB
// limit applies to total object size regardless of upload method, not just
// standard uploads. R2 has no such per-file cap on this scale, so this
// script now uploads there instead, via the S3-compatible API.
//
// Uses R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY (an R2 API token's key pair,
// not the Supabase service role key used before) - create one in the
// Cloudflare dashboard under R2 -> Manage R2 API Tokens if you don't
// already have one. Treat these like passwords: don't commit them, don't
// paste them in chat, only pass them via the environment variables above.

const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const TAR_URL = 'https://replicate.delivery/xezq/1XGMqkf1tnzUQSdLR54GvkBkTaUMW6erLWhEge9Qf05pXPdbB/trained_model.tar';
const R2_ENDPOINT = 'https://d03bf47b7dc44d75a08e0498cfcfc565.r2.cloudflarestorage.com';
const R2_BUCKET = 'storylabz-lora-weights';
const R2_PUBLIC_BASE = 'https://pub-e6c8fa5a665146fda79c681454303294.r2.dev';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

const workDir = path.join(__dirname, '..', '.lora-extract-tmp');
const tarPath = path.join(workDir, 'trained_model.tar');
// Matches the path inside the archive confirmed earlier: output/flux_train_replicate/lora.safetensors
const extractedRelPath = 'output/flux_train_replicate/lora.safetensors';

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error('Download failed: HTTP ' + res.statusCode));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in the environment before running (see the header comment for where to get them).');
    process.exit(1);
  }

  fs.mkdirSync(workDir, { recursive: true });

  try {
    console.log('Downloading ' + TAR_URL + ' ...');
    await downloadFile(TAR_URL, tarPath);
    const tarSize = fs.statSync(tarPath).size;
    console.log('Downloaded trained_model.tar: ' + tarSize + ' bytes');

    console.log('Extracting ' + extractedRelPath + ' ...');
    execSync('tar -xf ' + JSON.stringify(tarPath) + ' -C ' + JSON.stringify(workDir) + ' ' + JSON.stringify(extractedRelPath));

    const extractedPath = path.join(workDir, extractedRelPath);
    const fileBuffer = fs.readFileSync(extractedPath);
    console.log('Extracted lora.safetensors: ' + fileBuffer.length + ' bytes (' + (fileBuffer.length / 1024 / 1024).toFixed(1) + ' MB)');

    const uploadPath = 'bobban/lora-' + Date.now() + '.safetensors';

    const s3 = new S3Client({
      region: 'auto', // R2 doesn't use AWS regions - 'auto' is Cloudflare's documented convention for the S3-compatible API
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    console.log('Uploading to R2 bucket "' + R2_BUCKET + '" at "' + uploadPath + '" (' + (fileBuffer.length / 1024 / 1024).toFixed(1) + ' MB) ...');
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: uploadPath,
      Body: fileBuffer,
      ContentType: 'application/octet-stream',
    }));

    const publicUrl = R2_PUBLIC_BASE + '/' + uploadPath;

    console.log('\nDone. Public URL:');
    console.log(publicUrl);
    console.log('\nPaste this into scripts/ip-adapter-test.js as loraWeightsUrl.');
  } finally {
    // Always clean up the local working directory, whether the upload
    // succeeded or failed - it can be multiple hundred MB (tar + extracted
    // file) and should never linger or get committed by accident.
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

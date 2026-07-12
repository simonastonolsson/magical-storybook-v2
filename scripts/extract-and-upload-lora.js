// Standalone, one-off script - NOT part of the production app. Run manually
// on your own machine, with your own Supabase service role key:
//
//   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node scripts/extract-and-upload-lora.js
//
// Downloads Bobban's training output .tar from Replicate, extracts just
// lora.safetensors (fal.ai's flux-lora rejects the full .tar with "Failed
// to download the file" - it wants a direct weights file, not an archive),
// uploads that single file to Supabase Storage in a new "lora-weights"
// bucket (same public-bucket pattern as "reference-images"/"training-data"),
// and prints the resulting public URL to paste into
// scripts/ip-adapter-test.js's loraWeightsUrl.
//
// Uploads via Supabase Storage's TUS (resumable upload) protocol instead
// of the plain storage.upload() call: confirmed the Supabase free plan
// enforces a hard 50MB limit per file on standard uploads (not a
// configurable bucket setting - "Restrict file size" was already off), and
// lora.safetensors is ~164MB. TUS uploads in 6MB chunks instead, which
// Supabase's free plan supports.
//
// PREREQUISITE: create a public bucket named "lora-weights" in the Supabase
// dashboard (Storage -> New bucket -> name it exactly "lora-weights",
// toggle "Public bucket" on) if it doesn't already exist - this script
// does not create the bucket itself.
//
// Uses the SERVICE ROLE key (not the anon key production code uses),
// since this is a one-off admin upload with no logged-in user session to
// authenticate through - get it from Supabase dashboard -> Project
// Settings -> API -> service_role secret. Treat it like a password: don't
// commit it, don't paste it in chat, only pass it via the environment
// variable above.

const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const tus = require('tus-js-client');

const TAR_URL = 'https://replicate.delivery/xezq/1XGMqkf1tnzUQSdLR54GvkBkTaUMW6erLWhEge9Qf05pXPdbB/trained_model.tar';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xaaduajcznqctcuymrzb.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'lora-weights';

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
  if (!SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_SERVICE_ROLE_KEY in the environment before running (see the header comment for where to get it).');
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

    // Direct storage subdomain, recommended by Supabase for TUS uploads
    // (faster than routing through the general project API domain).
    const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
    const tusEndpoint = 'https://' + projectRef + '.storage.supabase.co/storage/v1/upload/resumable';

    console.log('Uploading to Supabase Storage bucket "' + BUCKET + '" at "' + uploadPath + '" via TUS (' + tusEndpoint + ') ...');

    await new Promise((resolve, reject) => {
      const upload = new tus.Upload(fileBuffer, {
        endpoint: tusEndpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: 'Bearer ' + SERVICE_ROLE_KEY,
          apikey: SERVICE_ROLE_KEY,
          'x-upsert': 'false',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: BUCKET,
          objectName: uploadPath,
          contentType: 'application/octet-stream',
          cacheControl: '3600',
        },
        chunkSize: 6 * 1024 * 1024, // fixed by Supabase's TUS implementation - do not change
        onError: (err) => {
          const body = err && err.originalResponse && typeof err.originalResponse._body === 'string'
            ? err.originalResponse._body
            : null;
          console.error('\nUpload failed: ' + err.message);
          if (body) console.error('Server response: ' + body);
          console.error('If this mentions the bucket, create a public bucket named "' + BUCKET + '" in the Supabase dashboard first.');
          reject(err);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
          process.stdout.write('\r  Uploading... ' + pct + '% (' + bytesUploaded + ' / ' + bytesTotal + ' bytes)');
        },
        onSuccess: () => {
          process.stdout.write('\n');
          resolve();
        },
      });

      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          console.log('Resuming a previous incomplete upload...');
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(uploadPath);

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
  // onError above already printed a clean message for TUS-specific
  // failures; avoid dumping the whole (very verbose) tus-js-client error
  // object again here for those. Anything else (download/extract errors)
  // still gets logged in full.
  if (!err || !err.originalResponse) {
    console.error(err);
  }
  process.exit(1);
});

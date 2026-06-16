const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const PROJECT_ID = process.env.PROJECT_ID;

(async function init() {
  console.log("Executing script...");
  const outDir = path.join(__dirname, "output");

  const p = exec(`cd ${outDir} && npm i && npm run build`);

  p.stdout.on("data", (data) => {
    console.log(data.toString());
  });

  p.stderr.on("data", (data) => {
    console.error("Build Log/Error:", data.toString());
  });

  p.on("error", (err) => {
    console.error("Process error:", err);
  });

  p.on("close", async (code) => {
    if (code !== 0) {
      console.error(`Build failed with exit code ${code}`);
      return;
    }

    console.log("BUILD completed successfully...");

    const distFolderPath = path.join(__dirname, "output", "dist");

    // FIX 1: Use readdirSync to list files recursively
    const distFolderContent = fs.readdirSync(distFolderPath, {
      recursive: true,
    });

    for (const relativePath of distFolderContent) {
      // FIX 2: Resolve absolute path for local file operations
      const absoluteFilePath = path.join(distFolderPath, relativePath);

      if (fs.lstatSync(absoluteFilePath).isDirectory()) continue;
      console.log(`Uploading: ${relativePath}`);

      // FIX 3: Clean up S3 Key slashes for Windows compatibility
      const s3Key = `__outputs/${PROJECT_ID}/${relativePath}`.replace(
        /\\/g,
        "/",
      );

      const command = new PutObjectCommand({
        Bucket: "ghoshkishanrana",
        Key: s3Key,
        Body: fs.createReadStream(absoluteFilePath),
        ContentType:
          mime.lookup(absoluteFilePath) || "application/octet-stream",
      });

      try {
        await s3Client.send(command);
        console.log(`Uploaded: ${relativePath}`);
      } catch (uploadError) {
        console.error(`Failed to upload ${relativePath}:`, uploadError);
      }
    }

    console.log("All uploads completed.");
  });
})();

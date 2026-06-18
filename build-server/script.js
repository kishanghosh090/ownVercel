const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const Redis = require("ioredis");

const publisher = new Redis({
  host: "15.206.63.181",
  port: 6379,
});


const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log) {
  publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}

(async function init() {
  console.log("Executing script...");
  publishLog("Build started...");
  const outDir = path.join(__dirname, "output");

  const p = exec(`cd ${outDir} && npm i && npm run build`);

  p.stdout.on("data", (data) => {
    console.log(data.toString());
    publishLog(data.toString());
  });

  p.stderr.on("data", (data) => {
    console.error("Build Log/Error:", data.toString());
  });

  p.on("error", (err) => {
    console.error("Process error:", err);
    publishLog("ERROR: ", err.toString());
  });

  p.on("close", async (code) => {
    if (code !== 0) {
      console.error(`Build failed with exit code ${code}`);
      return;
    }
    publishLog("BUILD completed successfully...");
    console.log("BUILD completed successfully...");

    // Framework-agnostic path check (Vite uses 'dist', Next.js static export uses 'out', etc.)
    let distFolderPath = path.join(__dirname, "output", "dist");
    if (!fs.existsSync(distFolderPath)) {
      const outPath = path.join(__dirname, "output", "out");
      if (fs.existsSync(outPath)) distFolderPath = outPath;
    }

    const distFolderContent = fs.readdirSync(distFolderPath, {
      recursive: true,
    });
    publishLog("starting to upload...");
    for (const relativePath of distFolderContent) {
      const absoluteFilePath = path.join(distFolderPath, relativePath);
      publishLog("uploading file ", absoluteFilePath);
      if (fs.lstatSync(absoluteFilePath).isDirectory()) continue;
      console.log(`Uploading: ${relativePath}`);

      const s3Key = `__outputs/${PROJECT_ID}/${relativePath}`.replace(
        /\\/g,
        "/",
      );

      // FIX: Standardize lookups to handle modern compiled extensions (.mjs, .css, etc.)
      const resolvedMime = mime.lookup(absoluteFilePath);
      const contentType =
        resolvedMime === "application/javascript" ||
          absoluteFilePath.endsWith(".mjs")
          ? "application/javascript"
          : resolvedMime || "application/octet-stream";

      const command = new PutObjectCommand({
        Bucket: "ghoshkishanrana",
        Key: s3Key,
        ACL: "public-read",
        Body: fs.createReadStream(absoluteFilePath),
        ContentType: contentType,
      });

      try {
        await s3Client.send(command);
        console.log(`Uploaded: ${relativePath}`);
        publishLog("uploaded: ", relativePath);
      } catch (uploadError) {
        console.error(`Failed to upload ${relativePath}:`, uploadError);
      }
    }
    publishLog("All uploads completed.");

    console.log("All uploads completed.");
  });
})();

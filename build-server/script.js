const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
});

async function init() {
  console.log("executing script...");
  const outDir = path.join(__dirname, "output");

  const p = exec(`cd ${outDir} && npm i && npm run build`);

  p.stdout.on("data", (data) => {
    console.log(data.toString());
  });
  p.stdout.on("error", (data) => {
    console.log("Error ", data.toString());
  });

  p.stdout.on("close", async () => {
    console.log("BUILD completed successfully...");

    const distFolderPath = path.join(__dirname, "output", "dist");
    const distFolderContent = fs.readFileSync(distFolderPath, {
      recursive: true,
    });

    for (const filePath of distFolderContent) {
      if (fs.lstatSync(filePath).isDirectory()) continue;

      const command = new PutObjectCommand({
        Bucket: "",
        Key: "",
      });
    }
  });
}

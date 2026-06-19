import "dotenv/config";
import express from "express";
import { generateSlug } from "random-word-slugs";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { Server } from "socket.io"
import { z } from "zod"
import { prisma } from "./lib/db.js";
import { createClient } from "@clickhouse/client"



const app = express();
const PORT = process.env.PORT ?? 9000;
const io = new Server({
  cors: {
    origin: "*",
  },
});

import { createClient } from '@clickhouse/client'

const client = createClient({
  url: "http://15.207.1.102:8123",
  username: "default",
  password: "",
  database: "default"
})


io.on("connection", (socket) => {
  socket.on("subscribe", (channle) => {
    socket.join(channle);
    socket.emit("message", `Subscribed to ${channle}`);
  })
})
io.listen(9001, () => {
  console.log("Socket.IO server is listening on port 9001");
});

const ecsClient = new ECSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const config = {
  CLUSTER: "arn:aws:ecs:ap-south-1:217797467578:cluster/builder-cluster",
  TASK: "arn:aws:ecs:ap-south-1:217797467578:task-definition/builder-task",
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/project", async (req, res) => {
  const schema = z.object({
    name: z.string(),
    githubUrl: z.string()
  })
  const safeParseResult = schema.safeParse(req.body)

  if (safeParseResult.error) {
    return res.status(400).json({ error: safeParseResult.error.flatten() });
  }
  const { name, githubUrl } = safeParseResult.data
  const subdomain = generateSlug();

  const project = await prisma.project.create({
    data: {
      name,
      gitUrl: githubUrl,
      subdomain
    }
  })

  return res.json({ status: "success", data: project });

})

app.post("/deploy", async (req, res) => {
  const { projectId } = req.body;

  // Create project in DB
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    return res.json({ err: "project not found" })
  }


  // Create deployment record
  const deployment = await prisma.deployment.create({
    data: {
      projectId: project.id,
      status: "PENDING",
    }
  });

  // spin the container

  const command = new RunTaskCommand({
    cluster: config.CLUSTER,
    taskDefinition: config.TASK,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        subnets: [
          "subnet-02f1b85e465537d7a",
          "subnet-0b8f2a02fb1a4eecc",
          "subnet-0629cfdf95b50b6c5",
        ],
        securityGroups: ["sg-0cdb7d2e9456cca60"],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "builder-image",
          environment: [
            { name: "GIT_REPOSITORY_URL", value: project.gitUrl },
            { name: "AWS_ACCESS_KEY_ID", value: "" },
            {
              name: "AWS_SECRET_ACCESS_KEY",
              value: "",
            },
            { name: "PROJECT_ID", value: project.id },
            { name: "DEPLOYMENT_ID", value: deployment.id },
          ],
        },
      ],
    },
  });
  await ecsClient.send(command);
  return res.json({
    status: "queued",
    data: { projectSlug, url: `http://${projectSlug}.local:8000` },
  });
});


async function initRedisSubscribe() {
  console.log('subscribe to logs');

  subscriber.psubscribe(`logs:*`,)
  subscriber.on("pmessage", (pattern, channel, message) => {
    // const projectId = channel.split(":")[1];
    io.to(channel).emit("message", message);
  })
}
initRedisSubscribe()
app.listen(PORT, () => {
  console.log(`Api Server is listening at PORT ${PORT}`);
});

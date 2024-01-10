const express = require("express");
const multer = require("multer");
const dotEnv = require("dotenv");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { Readable } = require("stream");
const { Upload } = require("@aws-sdk/lib-storage");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

dotEnv.config();

const s3Client = new S3Client({
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});

const upload_cloud = multer();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

app.post("/upload", upload_cloud.single("image"), async (req, res) => {
  const imageFile = req.file;

  if (!imageFile) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  // Create a readable stream from the buffer
  const readableStream = new Readable({
    read() {
      this.push(imageFile.buffer);
      this.push(null);
    },
  });

  // Define the upload parameters
  const uploadParams = {
    client: s3Client,
    params: {
      Bucket: "mypersonalprojectimageupload",
      Key: imageFile.originalname,
      Body: readableStream,
    },
  };

  try {
    // Create an Upload object and execute the upload
    const upload = new Upload(uploadParams);
    await upload.done();

    res.json({
      message: "Image uploaded successfully",
      imageUrl: `https://mypersonalprojectimageupload.s3.amazonaws.com/${imageFile.originalname}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload image to S3." });
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 },
}).single("image");

app.post("/upload-image-disk", (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      res.status(400).json({ message: "Error uploading file" });
    } else {
      if (req.file === undefined) {
        res.status(400).json({ message: "No file selected" });
      } else {
        res.status(200).json({ message: "File uploaded", file: req.file });
      }
    }
  });
});

app.get("/image/:filename", (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(__dirname, "uploads", filename);

  // Check if the file exists
  if (fs.existsSync(imagePath)) {
    // Send the file as a response
    res.sendFile(imagePath);
  } else {
    // If the file doesn't exist, send a 404 error
    res.status(404).send("Image not found");
  }
});

app.get("/s3-image/:filename", async (req, res) => {
  const fileName = req.params.filename;
  const bucketName = process.env.BUCKET;

  console.log(fileName, "fileneame");

  const key = fileName;

  const getObjectParams = {
    Bucket: bucketName,
    Key: key,
  };

  try {
    const data = await s3Client.send(new GetObjectCommand(getObjectParams));

    res.set("Content-Type", data.ContentType);
    res.set("Content_length", data.ContentLength.toString());
    res.set("ETag", data.ETag);
    res.set("Last-Modified", data.LastModified.toUTCString());

    data.Body.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(404).send("S3 Image not found.");
  }
});

app.get("/", (req, res) => {
  //   exec("aws configure get region", (error, stdout, stderr) => {
  //     if (error) {
  //       console.error(`Error: ${error.message}`);
  //       return;
  //     }
  //     if (stderr) {
  //       console.error(`stderr: ${stderr}`);
  //       return;
  //     }
  //     console.log(`AWS account region: ${stdout.trim()}`);
  //   });
  res.send("<p>Image upload backend is working</p>");
});

app.listen(PORT, () => {
  console.log(`Server is listening on port http://localhost:${PORT}`);
});

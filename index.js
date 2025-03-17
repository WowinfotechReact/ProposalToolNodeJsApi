const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs/promises"); // Using fs/promises for asynchronous file operations
const path = require("path");
const cors = require("cors");
const pdf = require("html-pdf");
const { PDFDocument } = require("pdf-lib");
const AWS = require("aws-sdk");
require("dotenv").config();
const app = express();
const axios = require("axios");
app.use(bodyParser.json({ limit: "50mb" })); // Set the limit to 50MB or any other value as required
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());
app.use(
  cors({
    origin: "*",
  })
);
app.use(bodyParser.json());

const port = process.env.PORT || 3001;
// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

const pdfsDirectory = path.join(__dirname, "pdfs");
app.use("/pdfs", express.static(pdfsDirectory));

const userPdfMap = {};

fs.mkdir(pdfsDirectory, { recursive: true })
  .then(() => console.log("PDFs directory created successfully"))
  .catch((err) => console.error('Error creating "pdfs" directory:', err));

app.get("/", (req, res) => {
  res.send("hello i am on live ");
});

// Endpoint to generate PDF files
app.post("/generatePdf", async (req, res) => {
  try {
    const {
      userId,
      genratedPdfData,
      sequence,
      email,
      mobile,
      fullAddress,
      headingForPage,
      color,
      webSite,
      BrandLogo,
      fontSizeContent,
      fontFamily,
    } = req.body;
    const date = new Date();
    if (!genratedPdfData || !Array.isArray(genratedPdfData)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid genratedPdfData provided." });
    }

    // Sort genratedPdfData based on the order property
    genratedPdfData.sort((a, b) => (a.order || 0) - (b.order || 0));

    let htmlContent = "";
    for (const pdfData of genratedPdfData) {
      if (pdfData.awsLink) {
        const pdfUrl = pdfData.awsLink;
        const pdfFileName = `${userId}_Proposal_${sequence}_aws.pdf`; // Include a suffix to differentiate
        const pdfPath = path.join(pdfsDirectory, pdfFileName);
        await fetchPdfFromUrl(pdfUrl, pdfPath);
        if (!userPdfMap[userId]) {
          userPdfMap[userId] = [];
        }
        userPdfMap[userId].push(pdfPath);
      } else if (pdfData.textbox || pdfData.heading || pdfData.table) {
        htmlContent += pdfData.textbox || pdfData.heading || pdfData.table;
      }
    }
    // for (const pdfData of genratedPdfData) {
    //   debugger;
    //   console.log(pdfData.awsLink, "pdfData.awsLink");

    //   if (pdfData.awsLink) {
    //     const pdfUrl = pdfData.awsLink;
    //     const pdfFileName = `${userId}_Proposal_${sequence}_.pdf`;
    //     const pdfPath = path.join(pdfsDirectory, pdfFileName);
    //     await fetchPdfFromUrl(pdfUrl, pdfPath);
    //     userPdfMap[userId] = userPdfMap[userId] || [];
    //     userPdfMap[userId].push(pdfPath);
    //   } else if (pdfData.textbox || pdfData.heading || pdfData.table) {
    //     htmlContent += pdfData.textbox || pdfData.heading || pdfData.table;
    //   } else if (pdfData.pageBreak) {
    //     // Handle page breaks if needed
    //   } else if (pdfData.content) {
    //     // Handle content if needed
    //   }
    // }

    if (htmlContent) {
      const pdfFileName = `${userId}_Proposal_${sequence}_html.pdf`; // Different suffix for HTML content
      const pdfPath = path.join(pdfsDirectory, pdfFileName);
      await convertHtmlToPdf(
        htmlContent,
        pdfPath,
        email,
        mobile,
        fullAddress,
        headingForPage,
        color,
        webSite,
        BrandLogo,
        fontSizeContent,
        fontFamily
      );
      if (!userPdfMap[userId]) {
        userPdfMap[userId] = [];
      }
      userPdfMap[userId].push(pdfPath);
      return res.status(200).json({
        success: true,
        message: "PDF created and saved successfully.",
        pdfFileName,
      });
    } else {
      return res
        .status(200)
        .json({ success: true, message: "PDFs generated successfully." });
    }
  } catch (error) {
    console.error("Error generating PDF:", error);
    return res.status(500).json({ success: false, message: error });
  }
});

async function fetchPdfFromUrl(pdfUrl, outputPath) {
  try {
    const response = await axios.get(pdfUrl, { responseType: "arraybuffer" });
    await fs.writeFile(outputPath, Buffer.from(response.data));
  } catch (error) {
    console.error("Error fetching PDF from URL:", error);
    throw error;
  }
}

async function convertHtmlToPdf(
  htmlContent,
  outputPath,
  email,
  mobile,
  fullAddress,
  headingForPage,
  color,
  webSite,
  BrandLogo,
  fontSizeContent,
  fontFamily
) {
  const headerSvgMail = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-envelope" viewBox="0 0 16 16" style="fill: ${color}; margin-top: 8px; margin-left: 5px;">
  <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1zm13 2.383-4.708 2.825L15 11.105zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741M1 11.105l4.708-2.897L1 5.383z"/>
</svg>`;

  const headerSvgCalling = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-telephone-fill" viewBox="0 0 16 16" style="fill: ${color};  margin-left: 5px;">
  <path fill-rule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z"/>
</svg>`;

  const headerSvgWebsite = `
<svg id="svg"  width="16" height="16"  version="1.1" viewBox="144 144 512 512" style="fill: ${color};  margin-left: 5px;" >
    <g id="IconSvg_bgCarrier" stroke-width="0"></g>
    <g id="IconSvg_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC"></g>
     <g id="IconSvg_iconCarrier">
      <defs>
  <clipPath id="a">
   <path d="m148.09 148.09h503.81v503.81h-503.81z"/>
  </clipPath>
 </defs>
<g >
  <path d="m400 148.09c66.809 0 130.88 26.539 178.12 73.781 47.242 47.242 73.781 111.31 73.781 178.12 0 66.809-26.539 130.88-73.781 178.12-47.242 47.242-111.31 73.781-178.12 73.781-66.812 0-130.88-26.539-178.12-73.781-47.242-47.242-73.781-111.31-73.781-178.12 0-66.812 26.539-130.88 73.781-178.12s111.31-73.781 178.12-73.781zm185.05 119.8c-19.352 12.973-40 23.898-61.613 32.598 9.3281 28.105 14.703 57.371 15.969 86.957h87.613c-2.3633-43.023-16.922-84.492-41.969-119.55zm-370 0c-25.004 35.09-39.492 76.578-41.766 119.61h87.309c1.2617-29.602 6.6367-58.887 15.973-87.008-21.598-8.6992-42.23-19.625-61.566-32.598zm370 264.2c25.066-35.055 39.625-76.523 41.969-119.55h-87.512c-0.95703 29.633-6.043 58.984-15.113 87.211 21.273 8.6758 41.598 19.516 60.656 32.344zm-411.76-119.66c2.3398 43.062 16.895 84.566 41.965 119.66 19.062-12.828 39.387-23.668 60.66-32.344-9.1641-28.246-14.336-57.633-15.367-87.312zm214.42 63.48v-63.43h-102.18c-1.4102 14.059 8.0117 68.117 13.707 78.848 28.59-9.0938 58.285-14.262 88.266-15.367zm127.16-63.379h-102.32v63.43c29.969 1.1523 59.645 6.3555 88.219 15.469 8.2695-25.535 13.016-52.078 14.105-78.898zm-127.31-25.191v-63.328c-29.699-1.1133-59.113-6.1953-87.461-15.113-6.6484 14.258-16.523 68.973-14.309 78.695h101.77zm112.65-78.594c-28.414 8.9297-57.898 14.016-87.664 15.113v63.633h102.22c-1.2578-26.789-6.1562-53.277-14.559-78.746zm-192.56 206.01c17.723 42.363 45.062 80.016 79.855 109.98v-123.98c-15.469-1.0078-64.336 7.5039-79.855 14.004zm104.84 110.08c34.855-30.051 62.23-67.812 79.957-110.28-25.934-8.0859-52.816-12.73-79.957-13.805zm-103.93-339.32c17.984 6.75 66.855 15.113 78.945 13.551v-121.36c-34.188 29.453-61.191 66.328-78.945 107.81zm183.04 0h-0.003906c-17.785-41.492-44.824-78.371-79.047-107.81v121.52c26.824-1.082 53.395-5.6406 79.047-13.555zm-206.31-8.1602c7.7656-18.379 17.207-36.004 28.215-52.648 11.004-16.516 23.426-32.043 37.129-46.398-46.477 10.281-88.523 34.965-120.16 70.531 17.262 11.336 35.625 20.891 54.816 28.516zm164.14-99.047c27.73 28.73 49.93 62.324 65.496 99.098 19.207-7.707 37.574-17.363 54.812-28.816-31.73-35.477-73.82-60.066-120.31-70.281zm3.4258 442.5v-0.003906c45.121-10.562 85.887-34.789 116.73-69.371-16.906-11.266-34.898-20.801-53.707-28.469-15.039 36.082-36.379 69.195-63.027 97.793zm-222.38-69.375c30.875 34.578 71.652 58.801 116.79 69.371-26.609-28.613-47.902-61.746-62.875-97.84-18.867 7.6836-36.926 17.219-53.91 28.469z"/>
 </g>
      </g>
      </svg>`;
  return new Promise((resolve, reject) => {
    if (!htmlContent || typeof htmlContent !== "string") {
      reject(new Error("Invalid HTML content provided."));
      return;
    }

    //const contentWithWelcomePage = `
    //<div style="padding: 20px; word-break: break-word;">
    //${welcomePageHtml}
    //${htmlContent}
    //</div>
    //`;
    const combinedHtml = `<html>
  <head>
    <style>
      #SignatoryBlock { page-break-inside: avoid; break-inside: avoid; }
    </style>
  </head>
  <body>
    ${htmlContent}
  </body>
</html>`;

    const options = {
      format: "A4",
      header: {
        height: "100px",
        contents: `
      <table style="width: 100%; margin-top: -20px; padding: 0 20px;">
        <tr>
          <td style="width: 50%; vertical-align: middle; overflow: hidden;">
  ${
    BrandLogo
      ? `<div style="display: flex; justify-content: center; align-items: center; width: 150px; height:${
          webSite ? `50px` : "40px"
        };">
          <div style="background-image: url('${BrandLogo}'); background-size: contain; background-repeat: no-repeat; width: 100%; height: 100%;"></div>
        </div>`
      : ""
  }
</td>

          <td style="width: 50%; text-align: right; vertical-align: middle;">
            ${
              email
                ? `<div style="margin-bottom: 5px;">
                    <span style="margin-top: -5px;font-family:${fontFamily};">${email}</span>
                    <span style="margin-left: 10px;">${headerSvgMail}</span>
                   </div>`
                : ""
            }
            ${
              mobile
                ? `<div style="margin-bottom: 5px;">
                    <span style="margin-top: -5px;font-family:${fontFamily};">${mobile}</span>
                    <span style="margin-left: 10px;">${headerSvgCalling}</span>
                   </div>`
                : ""
            }
            ${
              webSite
                ? `<div style="margin-bottom: 5px;">
                    <span style="text-decoration: underline;font-family:${fontFamily};">${webSite}</span>
                    <span style="margin-left: 10px;">${headerSvgWebsite}</span>
                   </div>`
                : ""
            }
          </td>
        </tr>
      </table>
      <hr style="margin-bottom: 20px;">
    `,
      },
      footer: {
        height: "50px",
        contents: `
      <div style="text-align: left;">
        <hr>
        <p style="padding-left: 20px;font-family:${fontFamily};">
          ${fullAddress}
        </p>
      </div>`,
      },
    };

    pdf.create(combinedHtml, options).toFile(outputPath, (err, res) => {
      if (err) {
        console.error("Error creating PDF:", err);
        reject(err);
      } else {
        console.log("PDF created successfully:", res);
        resolve(res);
      }
    });
  });
}

app.post("/mergeUserPdfs", async (req, res) => {
  try {
    const { userId, moduleName } = req.body;

    if (!userPdfMap[userId]) {
      return res.status(404).json({
        success: false,
        message: "No PDFs found for the specified user ID.",
      });
    }

    // Generate a random 4-digit number
    const random4Digit = Math.floor(1000 + Math.random() * 9000);

    // Get current date and time
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0"); // Day with leading zero if needed
    const month = String(now.getMonth() + 1).padStart(2, "0"); // Month with leading zero if needed
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0"); // Hours with leading zero if needed
    const minutes = String(now.getMinutes()).padStart(2, "0"); // Minutes with leading zero if needed
    const seconds = String(now.getSeconds()).padStart(2, "0"); // Seconds with leading zero if needed

    // Construct the S3 key with the desired file name format
    const mergedPdfKey = `pdfs/proposal/${moduleName}_${userId}_${random4Digit}_${day}-${month}-${year}_${hours}-${minutes}-${seconds}.pdf`;

    // Define the output path for the merged PDF
    const mergedPdfPath = path.join(
      pdfsDirectory,
      `Proposal_${userId}_${random4Digit}_${day}-${month}-${year}_${hours}-${minutes}-${seconds}.pdf`
    );

    await mergePdfs(userPdfMap[userId], mergedPdfPath); // Provide the outputPath

    deleteSinglePdfs(userPdfMap[userId], moduleName);

    // Read the merged PDF data
    const mergedPdfData = await fs.readFile(mergedPdfPath);

    // Upload merged PDF file to AWS S3
    const s3Params = {
      Bucket: "proposal-tool-frontend",
      Key: mergedPdfKey, // Use the constructed S3 key
      Body: mergedPdfData, // Use mergedPdfData instead of pdfData
      ACL: "public-read",
      ContentType: "application/pdf",
    };

    s3.upload(s3Params, async (err, uploadData) => {
      if (err) {
        console.error("Error uploading file to S3:", err);
        return res.status(500).json({
          success: false,
          message: "Error uploading file to S3.",
        });
      }
      try {
        // Successfully uploaded, now delete the local file
        await fs.unlink(mergedPdfPath);
      } catch (unlinkErr) {
        console.error("Error deleting local file:", unlinkErr);
      }
      delete userPdfMap[userId];

      const s3Url = uploadData.Location;

      res.status(200).json({
        success: true,
        message: "PDFs merged and uploaded successfully.",
        s3Url,
      });
    });
  } catch (error) {
    console.error("Error merging PDFs:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

app.delete("/deleteUserPdfs/:userId", async (req, res) => {
  try {
    const { userId, moduleName } = req.params;

    // Construct the S3 prefix based on the user ID
    const s3Prefix = `pdfs/${moduleName}_${userId}`;

    // Parameters for listing objects in the S3 bucket
    const s3Params = {
      Bucket: "proposal-tool-frontend",
      Prefix: s3Prefix,
    };

    // Retrieve PDF file keys from AWS S3
    const data = await s3.listObjectsV2(s3Params).promise();

    // If no PDFs found for the user, send a response
    if (!data.Contents || data.Contents.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No PDFs found for the specified user ID.",
      });
    }

    // Extract PDF file keys from the S3 response
    const pdfKeys = data.Contents.map((object) => {
      return { Key: object.Key };
    });

    // Delete PDF files from AWS S3
    const deleteParams = {
      Bucket: "proposal-tool-frontend",
      Delete: {
        Objects: pdfKeys,
        Quiet: false,
      },
    };

    await s3.deleteObjects(deleteParams).promise();

    // If deletion is successful, send a success response
    res.status(200).json({
      success: true,
      message: "PDFs deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting user PDFs:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Function to convert HTML content to PDF
async function mergePdfs(pdfPaths, outputPath) {
  // Create a new PDF document to store the merged pages
  const mergedPdf = await PDFDocument.create();

  // Sort PDF paths based on sequence number in filenames
  // Sort PDF paths based on sequence number in filenames
  pdfPaths.sort((a, b) => {
    // Extract sequence numbers from filenames using path.basename() and regular expression
    const matchA = path.basename(a).match(/(\d+)(?=\.pdf$)/);
    const matchB = path.basename(b).match(/(\d+)(?=\.pdf$)/);

    // Check if matches are found
    if (matchA && matchB) {
      const sequenceA = parseInt(matchA[0]);
      const sequenceB = parseInt(matchB[0]);

      // Compare the sequence numbers and return the difference
      return sequenceA - sequenceB;
    } else {
      // If either match is null, compare the filenames directly
      return a.localeCompare(b);
    }
  });

  // Iterate through sorted PDF paths
  for (const pdfPath of pdfPaths) {
    // Read the bytes of the PDF file
    const pdfBytes = await fs.readFile(pdfPath);
    // Load the PDF document using PDFDocument.load()
    const pdfDoc = await PDFDocument.load(pdfBytes);
    // Copy pages from the loaded PDF document to the merged PDF document
    const copiedPages = await mergedPdf.copyPages(
      pdfDoc,
      pdfDoc.getPageIndices()
    );
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  // Save the merged PDF document to a file
  const mergedPdfBytes = await mergedPdf.save();
  await fs.writeFile(outputPath, mergedPdfBytes);
}

// Function to delete individual PDF files
async function deleteSinglePdfs(pdfPaths) {
  try {
    for (const pdfPath of pdfPaths) {
      // Check if the file path exists in the array
      if (pdfPaths.includes(pdfPath)) {
        try {
          await fs.unlink(pdfPath);
        } catch (unlinkError) {
          console.error(`Error deleting file ${pdfPath}:`, unlinkError);
        }
      } else {
        // console.log(`File not found in array, skipping deletion: ${pdfPath}`);
      }
    }
  } catch (error) {
    console.error("Error deleting single PDFs:", error);
    throw error;
  }
}

//image save api integration
app.post("/save-image", async (req, res) => {
  try {
    const random4Digit = Math.floor(1000 + Math.random() * 9000);

    // Get current date and time
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    const { base64Data, contentType, filename, userKeyID } = req.body;

    // Validate that all required data is present
    if (!base64Data || !filename || !userKeyID) {
      return res
        .status(400)
        .send("Missing base64 data, filename, or userKeyID");
    }

    const imagesDir = path.join(__dirname, "Jodit/Images");

    // Ensure filename includes the extension
    const fileExtension = contentType.split("/")[1];
    const fullFilename = `Proposal_${userKeyID}_${random4Digit}_${day}-${month}-${year}_${hours}-${minutes}-${seconds}.${fileExtension}`;
    const filePath = path.join(imagesDir, fullFilename);
    const ImagesKey = `Jodit/Images/${fullFilename}`;

    // Create the images directory if it doesn't exist
    try {
      await fs.access(imagesDir);
    } catch {
      await fs.mkdir(imagesDir, { recursive: true });
    }

    const buffer = Buffer.from(base64Data, "base64");

    // Write the image file locally
    await fs.writeFile(filePath, buffer);

    // Read the image file to upload to S3
    const imageBuffer = await fs.readFile(filePath);

    // Upload image file to AWS S3
    const s3Params = {
      Bucket: "proposal-tool-frontend",
      Key: ImagesKey,
      Body: imageBuffer,
      ACL: "public-read",
      ContentType: contentType,
    };

    s3.upload(s3Params, async (err, uploadData) => {
      if (err) {
        console.error("Error uploading file to S3:", err);
        return res.status(500).json({
          success: false,
          message: "Error uploading file to S3.",
        });
      }

      const imageUrl = uploadData.Location;
      try {
        // Successfully uploaded, now delete the local file
        await fs.unlink(filePath);
      } catch (unlinkErr) {
        console.error("Error deleting local file:", unlinkErr);
      }
      // Construct the URL
      const timestamp = new Date().toISOString();

      return res.status(200).json({
        statusCode: 200,
        message: "Image saved and uploaded to S3 successfully",
        imageUrl,
        timestamp,
      });
    });
  } catch (err) {
    console.error("Error saving image:", err);
    return res.status(500).send("Error saving image");
  }
});

app.use("/Jodit/Images", express.static(path.join(__dirname, "Jodit/Images")));

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

const express = require("express");
const path = require("path");
const { readdir } = require("fs");
const cors = require("cors");

const app = express();

// Enable CORS for all routes
app.use(cors());

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Define a route to serve JSON files
app.get("/data/:filename", (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, "data", `${filename}.json`);
    console.log("Requesting file:", filePath);

    res.sendFile(filePath, (err) => {
        if (err) {
            console.error("Error sending file:", err);
            res.status(404).send({ error: "File not found" });
        }
    });
});

// Define a route to list all JSON files in the "data" directory
app.get("/builds", (req, res) => {
    const dataFolder = path.join(__dirname, "data");
    readdir(dataFolder, (err, files) => {
        if (err) {
            console.error("Error reading data folder:", err);
            return res.status(500).send("Error reading data folder");
        }
        const jsonFiles = files.filter((file) => file.endsWith(".json"));
        res.setHeader("Content-Type", "application/json"); // Set correct Content-Type header
        res.json(jsonFiles); // Send JSON response
    });
});

// Start the server
const PORT = process.env.PORT || 3001; // Use the PORT environment variable for Render
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { v4 as uuidv4 } from "uuid";
import * as config from "../config/config.json" with { type: "json" };
import { fileTypeFromFile } from "file-type";
import cleanup from "./cleanup.js";
import { scheduleJob } from "node-schedule";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express()

const DESTINATION: string = path.join(__dirname, '..', config.default.UPLOAD_DESTINATION);

let fileName = '';
let removed = false;

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, DESTINATION);
    },
    filename: (req, file, callback) => {
        fileName = uuidv4().split('-')[0] + "." + file.originalname.split('.').pop();
        callback(null, fileName);
    },
});
const upload: multer.Multer = multer({ storage: storage });

const DB_LOCATION = path.join(__dirname, '..', config.default.DATABASE_LOCATION);
const db = new sqlite3.Database(DB_LOCATION, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite3 database!');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS files (
        filename TEXT,
        filepath TEXT,
        mimetype TEXT,
        filesize BIGINTEGER,
        removed BOOLEAN,
        expiration INTEGER,
        uploadDate INTEGER,
        uniqueId TEXT UNIQUE
    )`);
});

export interface FileRow {
    filename: string;
    filepath: string;
    mimetype: string;
    filesize: bigint;
    removed: boolean;
    expiration: number;
    uploadDate: number;
    uniqueId: string;
}

app.use(bodyParser.json());
app.get("/", (req, res) => {
    res.send("App is working!");
})

app.post("/", upload.single('file'), async (req, res) => {
    const file = req.file;

    const qry = `INSERT INTO files (filename, filepath, mimetype, filesize, removed, expiration, uploadDate, uniqueId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const expiration = Math.floor(config.default.MIN_AGE - (config.default.MAX_AGE - config.default.MIN_AGE) * Math.pow((file?.size! / config.default.MAX_FILE_SIZE - 1), 3));
    removed = false;
    const uniqueId = fileName.split('.')[0];
    const filetype = (await fileTypeFromFile(file?.path!))?.mime;
    const uploadDate = Math.ceil(Date.now() / 1000 / 60 / 60 / 24);
    const values = [file?.originalname, file?.path, filetype, file?.size, removed, expiration, uploadDate, uniqueId];

    db.run(qry, values, (err) => {
        if (err) {
            return res.status(500).send("Internal Server Error");
        }

        const baseUrl = req.hostname;
        
        const uniqueUrl = baseUrl === "localhost" ? `${baseUrl}:${config.default.PORT}/files/${fileName}` : `${baseUrl}/files/${fileName}`;
        res.send(`${uniqueUrl}\n`);
        console.log('File uploaded:', values);
    });

});

app.get('/files/:id', (req, res) => {
    const fileId = req.params.id;

    const qry = `SELECT * FROM files WHERE uniqueId = ?`;
    const values = [fileId.split('.')[0]];
    db.get(qry, values, (err, row: FileRow | undefined) => {
        if (err) {
            console.error('Error fetching file data:', err);
            return res.status(500).send(`Internal Server Error.`);
        }

        if (!row) {
            return res.status(404).send('File not found');
        }
        
        const filepath = row.filepath;
        const filetype = row.mimetype; 
        if (filetype) {
            res.setHeader('Content-Type', filetype);
            res.sendFile(filepath, (err) => {
                if (err) {
                    console.error('Error serving file:', err);
                    return res.status(500).send(`Internal Server Error.`);
                }
                console.log('File served successfully!');
            });
        } else {
            res.status(415).send('Unsupported Media type');
        }
    });

})

scheduleJob("0 0 * * *", () => cleanup(db));

app.listen(config.default.PORT, () => console.log("Server running!"));

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
import bcrypt from "bcrypt";
import basicAuth from "basic-auth";

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
        password TEXT,
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
    password: string;
    uniqueId: string;
}

app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.send("App is working!");
})

app.post("/", upload.single('file'), async (req, res) => {
    const file = req.file;
    
    let hashedPassword = '';
    if (req.body.pass) {
        const password = req.body.pass;
        hashedPassword = await bcrypt.hash(password, 10);
    }

    const qry = `INSERT INTO files (filename, filepath, mimetype, filesize, removed, expiration, uploadDate, password, uniqueId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
     
    const expiration = clamp(
        config.default.MIN_AGE, 
        config.default.MAX_AGE, 
        (req.body.expires) && !isNaN(req.body.expires) 
            ? parseInt(req.body.expires) 
            : Math.floor(
                config.default.MIN_AGE - (config.default.MAX_AGE - config.default.MIN_AGE) * Math.pow((file?.size! / config.default.MAX_FILE_SIZE - 1), 3
                )
            )
    );

    removed = false;

    const uniqueId = fileName.split('.')[0];
    
    const filetype = (await fileTypeFromFile(file?.path!))?.mime;
    const uploadDate = Math.ceil(Date.now() / 1000 / 60 / 60 / 24);
    const values = [file?.originalname, file?.path, filetype, file?.size, removed, expiration, uploadDate, hashedPassword, uniqueId];

    db.run(qry, values, (err) => {
        if (err) {
            return res.status(500).send("Internal Server Error");
        }

        const baseUrl = req.hostname;
        
        const uniqueUrl = baseUrl === "localhost" ? `${baseUrl}:${config.default.PORT}/files/${fileName}` : `${baseUrl}/files/${fileName}`;
        res.send(hashedPassword === '' ? `${uniqueUrl}\n` : `${uniqueUrl}\nNo need to enter username when accessing the file.\n`);
        console.log('File uploaded:', values);
    });

});

app.get('/files/:id', async (req, res) => {
    const fileId = req.params.id;

    const qry = `SELECT * FROM files WHERE uniqueId = ?`;
    const values = [fileId.split('.')[0]];
    db.get(qry, values, async (err, row: FileRow | undefined) => {
        if (err) {
            console.error('Error fetching file data:', err);
            return res.status(500).send(`Internal Server Error.`);
        }

        if (!row) {
            return res.status(404).send('File not found');
        }
        
        const filepath = row.filepath;
        const filetype = row.mimetype;
        const password = row.password;
        if (filetype) {
            res.setHeader('Content-Type', filetype);

            if (password === "") {
                res.sendFile(filepath, (err) => {
                    if (err) {
                        console.error('Error serving file:', err);
                        return res.status(500).send(`Internal Server Error.`);
                    }
                    console.log('File served successfully!');
                });
                return;
            }

            const credentials = basicAuth(req);

            if (!credentials) {
                res.setHeader('WWW-Authenticate', 'Basic realm="Secure File Access"');
                return res.status(401).send('Unauthorized');
            }

            const isPassCorrect = await bcrypt.compare(credentials.pass, password);

            if (isPassCorrect) {
                res.sendFile(filepath, (err) => {
                    if (err) {
                        console.error('Error serving file:', err);
                        return res.status(500).send(`Internal Server Error.`);
                    }
                    console.log('File served successfully!');
                });
            } else {
                res.setHeader('WWW-Authenticate', 'Basic realm="Secure File Access"');
                res.status(401).send('Unauthorized');
            }

        } else {
            res.status(415).send('Unsupported Media type');
        }
    });

})

scheduleJob("0 0 * * *", () => cleanup(db));

app.listen(config.default.PORT, () => console.log("Server running!"));

const clamp = (min: number, max: number, value: number): number => {
    if (value > max) return max;
    else if (value < min) return min;
    else return value;
}

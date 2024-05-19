import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import path from "path";
import * as sqlite3 from "sqlite3";
import { v4 as uuidv4 } from "uuid";
import * as config from "../config/config.json";

const app = express();
const PORT = 5000;

const DESTINATION = path.join(__dirname, '..', config.UPLOAD_DESTINATION);

let fileName = '';
const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, DESTINATION);
    },
    filename: (req, file, callback) => {
        fileName = uuidv4().split('-')[0] + "." + file.originalname.split('.').pop();
        callback(null, fileName);
    },
});
const upload = multer({ storage: storage });

const DB_LOCATION = path.join(__dirname, '..', config.DATABASE_LOCATION);
const db = new sqlite3.Database(DB_LOCATION, sqlite3.OPEN_READWRITE, (err) => {
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
        uniqueId TEXT UNIQUE
    )`);
});

interface FileRow {
    filename: string;
    filepath: string;
    mimetype: string;
    uniqueId: string;
}

app.use(bodyParser.json());
//app.use('/uploads', express.static(DESTINATION));
app.get("/", (req, res) => {
    res.send("App is working!");
})

app.post("/", upload.single('file'), async (req, res) => {

    const file = req.file;

    const qry = `INSERT INTO files (filename, filepath, mimetype, uniqueId) VALUES (?, ?, ?, ?)`;
    
    const uniqueId = fileName.split('.')[0];
    const values = [file?.originalname, file?.path, file?.mimetype, uniqueId];

    db.run(qry, values, (err) => {
        if (err) {
            return res.status(500).send("Internal Server Error");
        }

        const baseUrl = config.BASE_URL;
        const uniqueUrl = `${baseUrl}/${fileName}`;
        res.send(`${uniqueUrl}\n`);
        console.log('File uploaded:', file);
    });

});

app.get('/:id', (req, res) => {
    const fileId = req.params.id;

    const qry = `SELECT * FROM files WHERE uniqueId = ?`;
    const values = [fileId];
    db.get(qry, values, (err, row: FileRow | undefined) => {
        if (err) {
            console.error('Error fetching file data:', err);
            return res.status(500).send(`Internal Server Error.`);
        }

        if (!row) {
            return res.status(404).send('File not found');
        }
        
        const filepath = row.filepath;
        res.sendFile(filepath, (err) => {
            if (err) {
                console.error('Error serving file:', err);
                return res.status(500).send(`Internal Server Error.`);
            }
            console.log('File served successfully!');
        })
    });

})

app.listen(PORT, () => console.log("Server running!"));

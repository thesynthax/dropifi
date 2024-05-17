import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const app = express();
const PORT = 5000;

const DESTINATION = path.join(__dirname, '..', 'uploads');
const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, DESTINATION);
    },
    filename: (req, file, callback) => {
        callback(null, uuidv4().split('-')[0] + "." + file.originalname.split('.').pop());
    },
});
const upload = multer({ storage: storage });

app.use(bodyParser.json());
app.use('/uploads', express.static(DESTINATION));
app.get("/", (req, res) => {
    res.send("App is working!");
})

app.post("/", upload.single('file'), (req, res) => {

    const file = req.file;
    console.log('File uploaded:', file);
    const uniqueUrl = `/uploads/${file?.filename}`;
    res.send(req.protocol + '://' + req.hostname + ":" + PORT + uniqueUrl + "\n");
})

app.listen(PORT, () => console.log("Server running!"));

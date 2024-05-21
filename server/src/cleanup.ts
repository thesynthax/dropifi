import fs from "fs";
import { FileRow } from "./server.js";

const cleanup = (db: any) : void => {
    const qry = `SELECT * FROM files WHERE (uploadDate + expiration) <= ? AND removed == 0`;
    const value = Math.ceil(Date.now() / 1000 / 60 / 60 / 24);

    const expiredFiles: Array<FileRow> = [];
    db.all(qry, [value], (err: any, rows: any) => {
        if (err) throw err;
        rows.forEach((row: FileRow) => {
            expiredFiles.push(row);
        });
        expiredFiles.forEach(file => {
            const update = `UPDATE files SET removed = 1 WHERE (uploadDate + expiration) <= ?`;
            db.run(update, value, (err: any) => {
                if (err) throw err;
            })
            fs.rm(file.filepath, (err) => {
                if (err) throw err;
            });
        })
    });
}

export default cleanup;

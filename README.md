# Dropifi (WIP)
### A minimal file-hosting program (0x0.st alternative without uWSGI and censorship written in TypeScript)
### How to use it:
1) Using cURL (for tech-nerds):
   1) Open a terminal (make sure you have curl installed).
   2) type `curl -F "file=@<path/to/file>" https://dropifi.thesynthaxx.tech` (more options below).
   3) A URL pointing to your file will be returned.
2) using a browser (for tech-noobs) [not working yet]:
   1) Open up your favorite browser and go to [dropifi](https://dropifi.thesynthax.tech).
   2) Upload the file in the dialog box shown.
   3) Configure all the options or leave them as it is.
   4) Upload, and there you have your link.

#### All cURL options:
- Set expiry: `-F"expires=<number-of-days (1-30)>"`. For e.g., `curl -F"file=@abc.jpg" -F"expires=15" https://dropifi.example.com`
- SECURE mode: `-F"secure=<on/off>"`. For e.g., `curl -F"file=@abc.jpg" -F"secure=on" https://dropifi.example.com`

### Features:
- A minimal way to host files and retrieve them instantly
- A unique URL pointing to the file
- Retention period of file:
   - Each file has a retention period, a duration for which the file will stay in the server before being deleted.
   - The files will be retained for a minimum of 1 day to a maximum of 30 days, depending on the file size.
   - A maximum file size of 100MB can be hosted on this server.
   - The retention period decreases cubically from 30 days to 1 day as the file size increases to 100MB.
- A configurable MIME type blocklist to block certain file types.
- Cleanup method which runs every day to clear the expired files.
- All the files uploaded would be open-source, i.e., anyone with the link to that file can access it unless specified (refer to next point).
- SECURE mode to upload files with a password, which will be required when accessing the URL.
- Virus Scanner

### What dropifi is not:
- It is not a Google Drive alternative.
- Dropifi will not contain features that will make it bloat. Keeping the software as lean as possible is the aim.
- Features like signing up for an account, management of files through various options, or implementing custom viewers for files are considered bloat for the software.

### How to host the server:
1) Clone this repository using `https://github.com/thesynthax/dropifi.git`
2) `cd dropifi` and `npm i --force`
3) Configure as required in `server/config/config.json` (though the defaults are usually good to go)
4) Now run `npm run start` to run the production server.

#### Reverse-proxy (Nginx setup):
1) Assuming the basic Nginx setup is already done, and the server is working.
2) Make a configuration file (name it as you like) in `/etc/nginx/sites-enabled`.
3) Use this configuration:

        server {
          server_name dropifi.your-server.name ;
     
          location / {
            proxy_pass http://localhost:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
          }
  
          location /files/ {
            proxy_pass http://localhost:5000/files/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
          }
        }
   
5) `systemctl reload nginx`.
6) Optional but recommended: use `certbot --nginx` for HTTPS.
7) Have fun.

## Contributing
If you encounter any bugs or any issues you would like to fix, please open an issue or pull request.

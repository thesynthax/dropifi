import React, { useState } from "react";
import Dragndrop from "./Dragndrop";

const Form = () => {
  const [file, setFile] = useState<File | null>(null);
  const [expires, setExpires] = useState<string>('');
  const [pass, setPass] = useState<string>('');

  const [uploaded, setUploaded] = useState<boolean>(false);
  const [res, setRes] = useState<string>('');

  const handleFile = (file: File) => {
    setFile(file);
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if ( !file ) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('expires', expires);
    formData.append('pass', pass);
    const res = await (await fetch("http://localhost:5000", {
      method: 'POST',
      body: formData
    })).text();
    
    setRes(res);
    setUploaded(true);
  }

  return (
    !uploaded ? <>
      <Dragndrop onDataChange={handleFile} />
      <div className="formContent">
        <h2 className="formTitle">Enter Options (Optional)</h2>
        <form onSubmit={handleSubmit}>
          <label className="formItem1">Set Expiry (1-30 days)</label>
          <input className="formItem2" type="text" onChange={(e) => setExpires(e.target.value)} />
          <label className="formItem3">Set Password</label>
          <input className="formItem4" type="password" onChange={(e) => setPass(e.target.value)} />
          <button className="formItem5">Upload</button>
        </form>
      </div>
    </> : <>
        <div>Link to your file is: </div>
        <div>{res.split('\n')[0]}</div>
        <div>{res.split('\n')[1]}</div>
        <button onClick={() => setUploaded(false)}>Upload More</button>
      </>
  )
}

export default Form;

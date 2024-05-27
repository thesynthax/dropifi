import { useDropzone } from 'react-dropzone'
import { useCallback, useState } from 'react';

const Dragndrop = ({ onDataChange }: any) => {
  const [preview, setPreview] = useState<string | ArrayBuffer | null>(null); 

  const onDrop = useCallback((acceptedFiles: Array<File>) => {
    const fileReader = new FileReader;
    fileReader.onload = () => {
      setPreview(fileReader.result);
    }
    const file = acceptedFiles[0];
    fileReader.readAsDataURL(file);
    onDataChange(file);
  }, []);
  const {acceptedFiles, getRootProps, getInputProps, isDragActive} = useDropzone({onDrop});
  
  return (
    <div {...getRootProps()} className={isDragActive ? "dragndrop dragging" : "dragndrop"}>
      <input {...getInputProps()} />
      {
        acceptedFiles.length === 0 ?
          isDragActive ?
            <p>Drop the files here ...</p> :
            <p>Drag 'n' drop some files here, or click to select files</p>
            : <>
            {preview && <img src={preview as string}/>}
            {acceptedFiles[0].name}
          </>
      }
    </div>
  )
}

export default Dragndrop;

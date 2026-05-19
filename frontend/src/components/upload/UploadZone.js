import React, { useState, useRef } from "react";
import { IC } from "../../icons/Icons";
import Dots from "../common/Dots";
import FilePill from "./FilePill";

export default function UploadZone({ onUpload, uploading, fileStatuses }) {
  const [files, setFiles] = useState([]);
  const [drag,  setDrag]  = useState(false);
  const ref = useRef();

  const addFiles = (inc) => {
    const pdfs=Array.from(inc).filter(f=>f.type==="application/pdf");
    const bad=Array.from(inc).filter(f=>f.type!=="application/pdf");
    if(bad.length) alert(`Skipped ${bad.length} non-PDF file(s).`);
    if(!pdfs.length) return;
    setFiles(prev=>{const n=new Set(prev.map(f=>f.name));return[...prev,...pdfs.filter(f=>!n.has(f.name))];});
  };

  const removeFile = n => setFiles(prev=>prev.filter(f=>f.name!==n));
  const clearAll   = () => setFiles([]);
  const submit     = () => { if(!files.length){alert("Add at least one PDF");return;} onUpload(files,clearAll); };

  return (
    <div className="upload-zone">
      {files.length>0 && (
        <div className="file-queue">
          {files.map(f=><FilePill key={f.name} file={f} onRemove={removeFile} status={fileStatuses[f.name]||"pending"}/>)}
        </div>
      )}
      <div className="upload-controls">
        <div
          className={`drop-area ${drag?"drop-active":""} ${files.length?"drop-has-file":""}`}
          onDragOver={e=>{e.preventDefault();setDrag(true);}}
          onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files);}}
          onClick={()=>ref.current.click()}
        >
          <IC.Upload/>
          <span>{files.length?`${files.length} PDF${files.length>1?"s":""} ready — click to add more`:"Drop PDFs here or click to browse"}</span>
          <input ref={ref} type="file" accept="application/pdf" multiple hidden onChange={e=>{addFiles(e.target.files);e.target.value="";}}/>
        </div>
        <button className="btn-upload" onClick={submit} disabled={!files.length||uploading}>
          {uploading?<Dots/>:<><IC.Upload/><span>Upload {files.length>1?`${files.length} PDFs`:"PDF"}</span></>}
        </button>
      </div>
    </div>
  );
}

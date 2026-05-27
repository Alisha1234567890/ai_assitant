import React, { useState, useRef } from "react";
import { IC } from "../../icons/Icons";
import Dots from "../common/Dots";
import FilePill from "./FilePill";

export default function UploadZone({ onUpload, uploading, fileStatuses }) {
  const [files, setFiles] = useState([]);
  const [drag,  setDrag]  = useState(false);
  const ref = useRef();

  const addFiles = (inc) => {
    const allowedExtensions = [".pdf", ".docx", ".csv", ".xlsx", ".xls", ".txt"];
    const valid = Array.from(inc).filter(f => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      return allowedExtensions.includes(ext);
    });
    const bad = Array.from(inc).filter(f => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      return !allowedExtensions.includes(ext);
    });
    if(bad.length) alert(`Skipped ${bad.length} unsupported file(s). Allowed: PDF, DOCX, CSV, XLSX, TXT`);
    if(!valid.length) return;
    setFiles(prev=>{const n=new Set(prev.map(f=>f.name));return[...prev,...valid.filter(f=>!n.has(f.name))];});
  };

  const removeFile = n => setFiles(prev=>prev.filter(f=>f.name!==n));
  const clearAll   = () => setFiles([]);
  const submit     = () => { if(!files.length){alert("Add at least one file");return;} onUpload(files,clearAll); };

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
          <span>{files.length?`${files.length} file${files.length>1?"s":""} ready — click to add more`:"Drop documents here (PDF, DOCX, CSV, XLSX, TXT)"}</span>
          <input ref={ref} type="file" accept=".pdf,.docx,.csv,.xlsx,.xls,.txt" multiple hidden onChange={e=>{addFiles(e.target.files);e.target.value="";}}/>
        </div>
        <button className="btn-upload" onClick={submit} disabled={!files.length||uploading}>
          {uploading?<Dots/>:<><IC.Upload/><span>Upload {files.length>1?`${files.length} files`:"File"}</span></>}
        </button>
      </div>
    </div>
  );
}

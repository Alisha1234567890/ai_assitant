import React from "react";
import { IC } from "../../icons/Icons";
import Dots from "../common/Dots";

export default function FilePill({ file, onRemove, status }) {
  const cls={pending:"pill-pending",uploading:"pill-uploading",done:"pill-done",error:"pill-error"};
  return (
    <div className={`file-pill ${cls[status]||cls.pending}`}>
      <IC.File/>
      <span className="file-pill-name">{file.name}</span>
      <span className="file-pill-size">{(file.size/1024).toFixed(0)}kb</span>
      {status==="uploading"&&<Dots/>}
      {status==="done"&&<IC.Check/>}
      {status==="error"&&<IC.X/>}
      {status==="pending"&&<button className="pill-remove" onClick={()=>onRemove(file.name)}><IC.X/></button>}
    </div>
  );
}

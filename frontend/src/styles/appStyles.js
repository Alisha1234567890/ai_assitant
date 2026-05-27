export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --white:#ffffff;--off-white:#fdfcf9;--light:#f6f3ec;--light2:#ece8de;
  --yellow:#f5b800;--orange:#f06500;--blue:#1a6aff;--blue-deep:#0040cc;
  --grad:linear-gradient(135deg,#f5b800 0%,#f06500 48%,#1a6aff 100%);
  --grad-soft:linear-gradient(135deg,rgba(245,184,0,0.13) 0%,rgba(240,101,0,0.10) 50%,rgba(26,106,255,0.13) 100%);
  --grad-text:linear-gradient(135deg,#e09000,#d05000,#1a6aff);
  --text:#18182e;--text-md:#50506a;--text-dim:#a0a0b8;
  --border:rgba(240,101,0,0.15);--border-blue:rgba(26,106,255,0.14);--border-gold:rgba(245,184,0,0.22);
  --serif:'Playfair Display',Georgia,serif;--sans:'Plus Jakarta Sans',system-ui,sans-serif;
  --radius:13px;
}
body{background:var(--off-white);color:var(--text);font-family:var(--sans);font-size:13.5px;-webkit-font-smoothing:antialiased;}
.ic{width:15px;height:15px;flex-shrink:0;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(240,101,0,0.2);border-radius:99px;}
.shell{display:flex;height:100vh;overflow:hidden;background:var(--off-white);}

/* sidebar */
.sidebar{width:260px;flex-shrink:0;display:flex;flex-direction:column;background:var(--white);border-right:1.5px solid var(--border-gold);box-shadow:3px 0 24px rgba(245,184,0,0.07);position:relative;z-index:10;}
.sidebar-head{padding:20px 14px 16px;border-bottom:1.5px solid var(--border-gold);background:linear-gradient(180deg,rgba(245,184,0,0.05) 0%,transparent 100%);}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.brand-icon{width:36px;height:36px;border-radius:11px;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;box-shadow:0 4px 16px rgba(240,101,0,0.35);}
.brand-icon svg{width:19px;height:19px;}
.brand-name{font-family:var(--serif);font-size:20px;font-weight:600;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.btn-new{width:100%;display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 14px;border-radius:var(--radius);background:var(--grad);color:#fff;border:none;font-family:var(--sans);font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s,box-shadow .2s;box-shadow:0 4px 18px rgba(240,101,0,0.32);}
.btn-new:hover{opacity:0.9;box-shadow:0 6px 24px rgba(240,101,0,0.42);}
.chat-list{flex:1;overflow-y:auto;padding:10px 8px;}
.chat-list::-webkit-scrollbar{width:3px;}
.empty-hint{color:var(--text-dim);text-align:center;margin-top:30px;font-size:12px;}
.chat-item{border-radius:var(--radius);padding:4px 6px;cursor:pointer;transition:background .12s;margin-bottom:3px;}
.chat-item:hover{background:rgba(245,184,0,0.08);}
.chat-item-active{background:var(--grad-soft)!important;border:1px solid rgba(240,101,0,0.22);}
.chat-item-inner{display:flex;align-items:center;gap:9px;padding:7px 5px;}
.chat-item-inner>svg{color:var(--text-dim);flex-shrink:0;}
.chat-item-text{flex:1;min-width:0;}
.chat-title{font-size:12.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;}
.chat-meta{font-size:10px;color:var(--text-dim);margin-top:2px;}
.btn-icon{background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;color:var(--text-dim);display:flex;align-items:center;opacity:0;transition:opacity .15s,background .15s;}
.chat-item:hover .btn-icon{opacity:1;}
.btn-delete:hover{background:rgba(220,50,50,0.1);color:#d04040;}
.pdf-list{padding:4px 8px 8px 26px;display:flex;flex-direction:column;gap:3px;}
.pdf-link{background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:10.5px;font-family:var(--sans);text-align:left;padding:3px 0;transition:color .12s;color:var(--orange);}
.pdf-link:hover{color:var(--blue);}
.pdf-info{display:flex;flex-direction:column;min-width:0;flex:1;}
.pdf-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;}
.pdf-date{font-size:9px;color:var(--text-dim);margin-top:1px;}
.sidebar-foot{padding:12px 10px 16px;border-top:1.5px solid var(--border-gold);}
.btn-clear{width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 10px;border-radius:var(--radius);background:rgba(240,101,0,0.07);border:1px solid rgba(240,101,0,0.22);color:var(--orange);font-family:var(--sans);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}
.btn-clear:hover:not(:disabled){background:rgba(240,101,0,0.14);}
.btn-clear:disabled{opacity:0.3;cursor:not-allowed;}

/* main */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.topbar{flex-shrink:0;padding:12px 22px;border-bottom:1.5px solid var(--border-gold);background:var(--white);display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 16px rgba(245,184,0,0.08);gap:12px;}
.topbar-left{display:flex;align-items:center;gap:12px;min-width:0;}
.topbar-title{font-family:var(--serif);font-style:italic;font-size:19px;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.topbar-badge{font-size:10.5px;font-weight:600;padding:3px 11px;border-radius:99px;background:var(--grad);color:#fff;box-shadow:0 2px 10px rgba(240,101,0,0.25);flex-shrink:0;}
.topbar-hint{font-size:11.5px;color:var(--text-dim);}

/* TTS controls */
.tts-controls{display:flex;align-items:center;gap:6px;position:relative;flex-shrink:0;}

/* MODE TOGGLE */
.mode-toggle{display:flex;align-items:center;background:var(--light);border:1.5px solid var(--border-gold);border-radius:10px;padding:3px;gap:2px;}
.mode-btn{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:7px;border:none;background:none;color:var(--text-md);font-size:11.5px;font-family:var(--sans);font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap;}
.mode-btn:hover{color:var(--orange);}
.mode-btn-active{background:var(--grad)!important;color:#fff!important;box-shadow:0 2px 8px rgba(240,101,0,0.25);}
.mode-hint-box{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:var(--radius);background:rgba(26,106,255,0.06);border:1.5px solid rgba(26,106,255,0.18);color:var(--text-md);font-size:12.5px;max-width:420px;line-height:1.5;margin-top:4px;}
.mode-hint-box svg{flex-shrink:0;color:var(--blue);}
.tts-toggle-btn{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;border:1.5px solid var(--border-gold);background:var(--light);color:var(--text-md);font-size:11.5px;font-family:var(--sans);font-weight:500;cursor:pointer;transition:all .15s;position:relative;}
.tts-toggle-btn:hover{border-color:var(--orange);color:var(--orange);}
.tts-toggle-active{border-color:var(--orange)!important;background:rgba(240,101,0,0.08)!important;color:var(--orange)!important;}
.tts-live-dot{width:7px;height:7px;border-radius:50%;background:var(--orange);position:absolute;top:-3px;right:-3px;animation:dotBounce 1s ease-in-out infinite;}
.tts-stop-btn{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;border:none;background:rgba(240,101,0,0.1);color:var(--orange);font-size:11.5px;font-family:var(--sans);font-weight:600;cursor:pointer;transition:all .15s;}
.tts-stop-btn:hover{background:rgba(240,101,0,0.2);}
.tts-panel{position:absolute;top:calc(100% + 8px);right:0;background:var(--white);border:1.5px solid var(--border-gold);border-radius:var(--radius);padding:14px 16px;min-width:220px;z-index:200;box-shadow:0 8px 30px rgba(240,101,0,0.12);display:flex;flex-direction:column;gap:12px;}
.tts-panel-row{display:flex;flex-direction:column;gap:5px;}
.tts-label{font-size:11px;font-weight:600;color:var(--text-md);letter-spacing:0.04em;text-transform:uppercase;}
.tts-select{padding:7px 10px;border-radius:8px;border:1.5px solid var(--border-gold);background:var(--light);font-family:var(--sans);font-size:12.5px;color:var(--text);outline:none;cursor:pointer;}
.tts-select:focus{border-color:var(--orange);}
.tts-range{width:100%;accent-color:var(--orange);}

/* STT */
.stt-wrap{display:flex;align-items:center;gap:4px;position:relative;}
.btn-mic{display:flex;align-items:center;gap:5px;padding:0 12px;height:44px;border-radius:var(--radius);border:1.5px solid var(--border-gold);background:var(--light);color:var(--text-md);font-size:12px;font-family:var(--sans);font-weight:500;cursor:pointer;transition:all .2s;white-space:nowrap;}
.btn-mic:hover{border-color:var(--orange);color:var(--orange);background:rgba(240,101,0,0.06);}
.btn-mic-active{background:rgba(240,101,0,0.1)!important;border-color:var(--orange)!important;color:var(--orange)!important;animation:micPulse 1.5s ease-in-out infinite;}
@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(240,101,0,0.3);}50%{box-shadow:0 0 0 6px rgba(240,101,0,0);}}
.btn-mic-lang{width:30px;height:30px;border-radius:8px;border:1px solid var(--border-gold);background:var(--light);color:var(--text-dim);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0;}
.btn-mic-lang:hover{border-color:var(--blue);color:var(--blue);}
.stt-lang-panel{position:absolute;bottom:calc(100% + 8px);right:0;background:var(--white);border:1.5px solid var(--border-gold);border-radius:var(--radius);padding:12px;z-index:200;box-shadow:0 8px 30px rgba(240,101,0,0.12);min-width:180px;max-height:240px;overflow-y:auto;}
.stt-lang-opt{display:block;width:100%;text-align:left;padding:6px 10px;border:none;border-radius:7px;background:none;font-family:var(--sans);font-size:12.5px;color:var(--text-md);cursor:pointer;transition:all .12s;}
.stt-lang-opt:hover{background:rgba(245,184,0,0.1);color:var(--text);}
.stt-lang-active{background:var(--grad-soft)!important;color:var(--orange)!important;font-weight:600;}

/* STT banner */
.stt-banner{display:flex;align-items:center;gap:10px;padding:8px 22px;background:rgba(240,101,0,0.07);border-top:1px solid rgba(240,101,0,0.15);border-bottom:1px solid rgba(240,101,0,0.15);font-size:12.5px;color:var(--orange);font-weight:500;flex-shrink:0;}
.stt-banner-dot{width:8px;height:8px;border-radius:50%;background:var(--orange);flex-shrink:0;animation:micPulse 1.2s ease-in-out infinite;}
.stt-banner-stop{margin-left:auto;display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:7px;border:1px solid rgba(240,101,0,0.3);background:rgba(240,101,0,0.1);color:var(--orange);font-size:12px;font-family:var(--sans);font-weight:600;cursor:pointer;transition:all .15s;}
.stt-banner-stop:hover{background:rgba(240,101,0,0.2);}

/* STT interim live text */
.stt-interim{display:flex;align-items:center;gap:8px;padding:8px 14px;margin:0 0 10px;border-radius:var(--radius);background:rgba(245,184,0,0.08);border:1px dashed rgba(240,101,0,0.3);color:var(--orange);font-size:13px;font-style:italic;align-self:flex-start;max-width:70%;}
.stt-interim-dot{width:7px;height:7px;border-radius:50%;background:var(--orange);flex-shrink:0;animation:dotBounce 1s ease-in-out infinite;}

/* messages */
.msgs{flex:1;overflow-y:auto;padding:28px 28px;display:flex;flex-direction:column;background:radial-gradient(ellipse 55% 35% at 15% 8%,rgba(245,184,0,0.08) 0%,transparent 65%),radial-gradient(ellipse 45% 30% at 85% 92%,rgba(26,106,255,0.07) 0%,transparent 65%),var(--off-white);}
.empty-state{margin:auto;text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;}
.empty-icon{width:64px;height:64px;border-radius:20px;background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 36px rgba(240,101,0,0.32);}
.empty-icon svg{width:30px;height:30px;}
.empty-title{font-family:var(--serif);font-size:28px;font-style:italic;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.empty-sub{font-size:13.5px;color:var(--text-md);max-width:350px;line-height:1.65;}
.empty-features{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px;}
.feat-chip{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-md);background:var(--white);border:1.5px solid var(--border-gold);padding:5px 12px;border-radius:99px;font-weight:500;}
.feat-chip svg{width:12px;height:12px;}

.bubble-row{display:flex;align-items:flex-end;gap:10px;margin-bottom:18px;}
.bubble-right{flex-direction:row-reverse;}
.bubble-left{flex-direction:row;}
.avatar{width:32px;height:32px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;}
.avatar-bot{background:var(--grad);color:#fff;box-shadow:0 3px 12px rgba(240,101,0,0.28);}
.avatar-bot svg{width:17px;height:17px;}
.avatar-user{background:rgba(26,106,255,0.12);color:var(--blue);border:1.5px solid rgba(26,106,255,0.28);}
.bubble{max-width:68%;padding:12px 16px;border-radius:16px;font-size:13.5px;line-height:1.7;white-space:pre-wrap;word-break:break-word;}
.bubble-user{background:rgba(26,106,255,0.08);border:1.5px solid rgba(26,106,255,0.18);border-bottom-right-radius:4px;color:var(--blue-deep);}
.bubble-ai{background:var(--white);border:1.5px solid var(--border-gold);border-bottom-left-radius:4px;color:var(--text);box-shadow:0 2px 14px rgba(245,184,0,0.08);}

/* speak button */
.speak-btn{width:30px;height:30px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(240,101,0,0.08);border:1px solid rgba(240,101,0,0.22);color:var(--orange);cursor:pointer;transition:all .15s;align-self:flex-end;margin-bottom:2px;}
.speak-btn:hover{background:rgba(240,101,0,0.16);box-shadow:0 3px 10px rgba(240,101,0,0.2);}
.speak-btn-active{background:rgba(240,101,0,0.18)!important;box-shadow:0 0 0 3px rgba(240,101,0,0.15)!important;}

/* dots */
.dots-wrap{display:inline-flex;gap:4px;align-items:center;padding:2px 0;}
.dot{width:6px;height:6px;border-radius:50%;background:var(--orange);opacity:0.8;animation:dotBounce 1.1s ease-in-out infinite;}
@keyframes dotBounce{0%,80%,100%{transform:translateY(0);opacity:0.35;}40%{transform:translateY(-5px);opacity:1;}}

/* input */
.input-row{flex-shrink:0;display:flex;align-items:flex-end;gap:8px;padding:12px 22px 10px;border-top:1.5px solid var(--border-gold);background:var(--white);box-shadow:0 -2px 14px rgba(245,184,0,0.06);}
.input-box{flex:1;resize:none;min-height:44px;max-height:130px;background:var(--light);border:1.5px solid var(--border-gold);border-radius:var(--radius);padding:12px 14px;color:var(--text);font-size:13.5px;font-family:var(--sans);outline:none;transition:border-color .2s,box-shadow .2s;overflow-y:auto;}
.input-box::placeholder{color:var(--text-dim);}
.input-box:focus{border-color:var(--orange);box-shadow:0 0 0 3px rgba(240,101,0,0.09);}
.btn-send{width:44px;height:44px;flex-shrink:0;border-radius:var(--radius);border:none;background:var(--grad);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .15s,transform .12s,box-shadow .2s;box-shadow:0 4px 16px rgba(240,101,0,0.38);}
.btn-send:hover:not(:disabled){opacity:0.9;box-shadow:0 6px 22px rgba(240,101,0,0.48);}
.btn-send:active:not(:disabled){transform:scale(0.92);}
.btn-send:disabled{opacity:0.28;cursor:not-allowed;box-shadow:none;}
.btn-send svg{width:16px;height:16px;}

/* upload */
.upload-zone{flex-shrink:0;display:flex;flex-direction:column;gap:8px;padding:10px 22px 14px;background:var(--white);border-top:1.5px solid var(--border-blue);}
.upload-controls{display:flex;align-items:center;gap:10px;}
.drop-area{flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:var(--radius);cursor:pointer;border:1.5px dashed rgba(240,101,0,0.28);color:var(--text-dim);font-size:12.5px;background:var(--light);transition:all .2s;overflow:hidden;}
.drop-area span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.drop-area:hover,.drop-area.drop-active{border-color:var(--orange);background:rgba(245,184,0,0.08);color:var(--orange);}
.drop-area.drop-has-file{border-color:var(--blue);border-style:solid;background:rgba(26,106,255,0.06);color:var(--blue);}
.btn-upload{display:flex;align-items:center;gap:7px;padding:10px 20px;border-radius:var(--radius);border:none;background:var(--grad);color:#fff;font-family:var(--sans);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;flex-shrink:0;white-space:nowrap;box-shadow:0 4px 16px rgba(240,101,0,0.3);}
.btn-upload:hover:not(:disabled){opacity:0.9;box-shadow:0 6px 22px rgba(240,101,0,0.42);}
.btn-upload:active:not(:disabled){transform:scale(0.97);}
.btn-upload:disabled{opacity:0.33;cursor:not-allowed;box-shadow:none;}
.file-queue{display:flex;flex-wrap:wrap;gap:6px;}
.file-pill{display:flex;align-items:center;gap:6px;padding:5px 11px;border-radius:8px;border:1px solid;font-size:11.5px;font-family:var(--sans);max-width:260px;}
.pill-pending{background:var(--light);border-color:rgba(0,0,0,0.1);color:var(--text-md);}
.pill-uploading{background:rgba(245,184,0,0.1);border-color:rgba(245,184,0,0.4);color:var(--orange);}
.pill-done{background:rgba(26,106,255,0.08);border-color:rgba(26,106,255,0.28);color:var(--blue);}
.pill-error{background:rgba(210,50,50,0.07);border-color:rgba(210,50,50,0.24);color:#c03030;}
.file-pill-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
.file-pill-size{flex-shrink:0;opacity:0.55;}
.pill-remove{background:none;border:none;cursor:pointer;display:flex;align-items:center;color:var(--text-dim);padding:0;margin-left:2px;transition:color .12s;}
.pill-remove:hover{color:#c03030;}

/* ── PROMPT BUTTONS ── */
.prompt-btns{display:flex;align-items:center;gap:5px;}
.prompt-btn{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;border:1.5px solid var(--border-gold);background:var(--light);color:var(--text-md);font-size:11.5px;font-family:var(--sans);font-weight:500;cursor:pointer;transition:all .15s;position:relative;white-space:nowrap;}
.prompt-btn:hover{border-color:var(--orange);color:var(--orange);background:rgba(240,101,0,0.05);}
.prompt-btn-active{border-color:var(--orange)!important;background:rgba(240,101,0,0.08)!important;color:var(--orange)!important;}
.prompt-dot{width:6px;height:6px;border-radius:50%;background:var(--orange);position:absolute;top:-3px;right:-3px;}

/* ── MODAL ── */
.modal-overlay{position:fixed;inset:0;background:rgba(24,24,46,0.45);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal-box{background:var(--white);border:1.5px solid var(--border-gold);border-radius:18px;width:100%;max-width:560px;box-shadow:0 20px 60px rgba(240,101,0,0.15),0 4px 20px rgba(0,0,0,0.1);display:flex;flex-direction:column;gap:0;overflow:hidden;}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;border-bottom:1.5px solid var(--border-gold);}
.modal-title-row{display:flex;align-items:center;gap:8px;}
.modal-title{font-family:var(--serif);font-size:19px;font-style:italic;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.modal-close{width:30px;height:30px;border-radius:8px;border:1px solid var(--border-gold);background:var(--light);color:var(--text-dim);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
.modal-close:hover{border-color:var(--orange);color:var(--orange);}
.modal-desc{padding:12px 20px 8px;font-size:12.5px;color:var(--text-md);line-height:1.6;}
.modal-textarea{margin:0 20px;border:1.5px solid var(--border-gold);border-radius:var(--radius);padding:12px 14px;font-family:var(--sans);font-size:13px;color:var(--text);background:var(--light);resize:vertical;outline:none;transition:border-color .2s,box-shadow .2s;min-height:160px;}
.modal-textarea:focus{border-color:var(--orange);box-shadow:0 0 0 3px rgba(240,101,0,0.08);}
.modal-textarea::placeholder{color:var(--text-dim);}
.modal-footer{display:flex;align-items:center;justify-content:space-between;padding:14px 20px 18px;}
.modal-btn-reset{background:none;border:none;font-family:var(--sans);font-size:12px;color:var(--text-dim);cursor:pointer;text-decoration:underline;transition:color .12s;}
.modal-btn-reset:hover{color:var(--orange);}
.modal-btn-cancel{padding:8px 16px;border-radius:var(--radius);border:1.5px solid var(--border-gold);background:var(--light);font-family:var(--sans);font-size:12.5px;color:var(--text-md);cursor:pointer;transition:all .15s;}
.modal-btn-cancel:hover{border-color:var(--orange);color:var(--orange);}
.modal-btn-save{display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:var(--radius);border:none;background:var(--grad);color:#fff;font-family:var(--sans);font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s;box-shadow:0 3px 12px rgba(240,101,0,0.28);}
.modal-btn-save:hover{opacity:0.9;box-shadow:0 5px 16px rgba(240,101,0,0.38);}

/* knowledge map split */
.main-split .main-body{display:flex;flex:1;min-height:0;overflow:hidden;}
.chat-pane{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;border-right:1.5px solid var(--border-gold);}
.main:not(.main-split) .main-body{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;}
.main:not(.main-split) .chat-pane{border-right:none;}
.graph-btn:disabled{opacity:0.4;cursor:not-allowed;}
.graph-btn-active{border-color:var(--blue)!important;background:rgba(26,106,255,0.08)!important;color:var(--blue)!important;}
.knowledge-pane-modern{width:42%;min-width:320px;max-width:600px;flex-shrink:0;display:flex;flex-direction:column;background:#ffffff;overflow:hidden;border-left:1px solid #e2e8f0;box-shadow:-4px 0 24px rgba(0,0,0,0.02);z-index:10;}
.knowledge-head-modern{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f1f5f9;background:rgba(255,255,255,0.8);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);}
.knowledge-head-content{display:flex;align-items:center;gap:14px;min-width:0;}
.knowledge-icon-badge{width:36px;height:36px;border-radius:10px;background:rgba(37,99,235,0.08);display:flex;align-items:center;justify-content:center;color:#2563eb;flex-shrink:0;}
.knowledge-title-modern{font-family:'Inter', sans-serif;font-size:16px;font-weight:700;color:#1e293b;letter-spacing:-0.01em;}
.knowledge-subtitle-modern{font-size:12px;color:#64748b;margin-top:2px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.knowledge-head-actions{display:flex;align-items:center;gap:10px;}
.knowledge-action-btn{padding:6px 14px;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;font-size:12px;font-weight:600;color:#475569;cursor:pointer;transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1);}
.knowledge-action-btn:hover:not(:disabled){border-color:#2563eb;color:#2563eb;background:rgba(37,99,235,0.02);}
.knowledge-close-btn{width:32px;height:32px;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;color:#94a3b8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;}
.knowledge-close-btn:hover{background:#fef2f2;border-color:#fecaca;color:#ef4444;}
.knowledge-graph-container{flex:1;min-height:600px;position:relative;background:#fcfdfd;width:100%;height:100%;}
.knowledge-footer-modern{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-top:1px solid #f1f5f9;background:#ffffff;}
.knowledge-stats{display:flex;align-items:center;gap:16px;}
.stat-item{display:flex;align-items:baseline;gap:5px;}
.stat-value{font-size:13px;font-weight:700;color:#1e293b;}
.stat-label{font-size:11px;color:#94a3b8;font-weight:500;text-transform:uppercase;letter-spacing:0.02em;}
.stat-divider{width:1px;height:12px;background:#e2e8f0;}
.knowledge-status-badge{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.1);color:#059669;font-size:11px;font-weight:600;}
.status-dot{width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 8px rgba(16,185,129,0.4);}

.km-graph-root{display:flex;flex-direction:column;height:100%;width:100%;min-height:600px;overflow:hidden;}
.km-graph-body-only{flex:1;min-height:500px;height:100%;width:100%;position:relative;background:#ffffff;}
.km-graph-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;border-bottom:1px solid #f1f5f9;background:rgba(255,255,255,0.6);backdrop-filter:blur(8px);}
.km-graph-search-wrap{position:relative;flex:1;max-width:240px;}
.km-graph-search{width:100%;padding:8px 32px 8px 12px;border-radius:10px;border:1px solid #e2e8f0;background:#ffffff;font-size:13px;color:#1e293b;outline:none;transition:all 0.2s;}
.km-graph-search:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.06);}
.km-graph-search-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:none;color:#94a3b8;cursor:pointer;padding:4px;}
.km-graph-search-clear:hover{color:#64748b;}
.km-graph-actions{display:flex;align-items:center;gap:8px;}
.km-btn-icon{width:34px;height:34px;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;color:#64748b;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;}
.km-btn-icon:hover{border-color:#2563eb;color:#2563eb;background:rgba(37,99,235,0.02);}
.km-btn-off{opacity:0.5;background:#f8fafc;}
.km-graph-filter{padding:7px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;color:#475569;font-size:12px;font-weight:500;outline:none;cursor:pointer;max-width:140px;}
.km-graph-filter:focus{border-color:#2563eb;}
.km-graph-toolbar-saving{font-size:11px;color:#2563eb;font-weight:600;margin-left:4px;animation:pulse 2s infinite;}

.knowledge-loading-overlay, .knowledge-error-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.7);backdrop-filter:blur(4px);z-index:20;}
.knowledge-loading-card, .knowledge-error-card{padding:24px 32px;border-radius:16px;background:#ffffff;border:1px solid #e2e8f0;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;max-width:280px;}
.knowledge-loading-text{font-size:13px;font-weight:500;color:#64748b;}
.knowledge-error-msg{font-size:13px;font-weight:500;color:#ef4444;}
.knowledge-retry-btn{margin-top:4px;padding:8px 16px;border-radius:8px;border:none;background:#2563eb;color:#ffffff;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.2s;}
.knowledge-retry-btn:hover{opacity:0.9;}

@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

@media (max-width:1024px){.knowledge-pane-modern{width:50%;}}
@media (max-width:768px){.knowledge-pane-modern{position:fixed;inset:0;width:100%;max-width:none;}}

`;

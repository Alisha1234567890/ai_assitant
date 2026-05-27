export const AUTH_CSS = `
.auth-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--off-white);background-image:radial-gradient(ellipse 55% 45% at 20% 15%,rgba(245,184,0,0.12) 0%,transparent 65%),radial-gradient(ellipse 45% 40% at 85% 85%,rgba(26,106,255,0.1) 0%,transparent 65%);}
.auth-card{width:100%;max-width:420px;background:var(--white);border:1.5px solid var(--border-gold);border-radius:20px;padding:28px 26px 24px;box-shadow:0 16px 48px rgba(240,101,0,0.12),0 4px 16px rgba(0,0,0,0.06);}
.auth-brand{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:22px;}
.auth-brand-icon{width:44px;height:44px;border-radius:12px;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 16px rgba(240,101,0,0.35);}
.auth-brand-icon svg{width:22px;height:22px;}
.auth-brand-name{font-family:var(--serif);font-size:24px;font-weight:600;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.auth-tabs{display:flex;background:var(--light);border:1.5px solid var(--border-gold);border-radius:10px;padding:3px;margin-bottom:22px;}
.auth-tab{flex:1;padding:8px 12px;border:none;border-radius:7px;background:none;font-family:var(--sans);font-size:13px;font-weight:600;color:var(--text-md);cursor:pointer;transition:all .15s;}
.auth-tab-active{background:var(--grad)!important;color:#fff!important;box-shadow:0 2px 8px rgba(240,101,0,0.25);}
.auth-form{display:flex;flex-direction:column;gap:14px;}
.auth-field{display:flex;flex-direction:column;gap:5px;}
.auth-label{font-size:11px;font-weight:600;color:var(--text-md);text-transform:uppercase;letter-spacing:0.04em;}
.auth-input{padding:11px 13px;border-radius:var(--radius);border:1.5px solid var(--border-gold);background:var(--light);font-family:var(--sans);font-size:14px;color:var(--text);outline:none;transition:border-color .2s,box-shadow .2s;}
.auth-input:focus{border-color:var(--orange);box-shadow:0 0 0 3px rgba(240,101,0,0.09);}
.auth-input::placeholder{color:var(--text-dim);}
.auth-submit{width:100%;padding:11px 16px;border:none;border-radius:var(--radius);background:var(--grad);color:#fff;font-family:var(--sans);font-size:14px;font-weight:600;cursor:pointer;transition:opacity .15s,box-shadow .2s;box-shadow:0 4px 16px rgba(240,101,0,0.32);margin-top:4px;}
.auth-submit:hover:not(:disabled){opacity:0.92;box-shadow:0 6px 22px rgba(240,101,0,0.4);}
.auth-submit:disabled{opacity:0.45;cursor:not-allowed;box-shadow:none;}
.auth-error{padding:10px 12px;border-radius:var(--radius);background:rgba(210,50,50,0.08);border:1px solid rgba(210,50,50,0.25);color:#c03030;font-size:12.5px;line-height:1.5;}
.auth-foot{text-align:center;margin-top:16px;font-size:12.5px;color:var(--text-dim);}
.auth-foot button{background:none;border:none;color:var(--orange);font-family:var(--sans);font-size:12.5px;font-weight:600;cursor:pointer;text-decoration:underline;padding:0;}
.auth-loading{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:var(--sans);color:var(--text-md);font-size:14px;}
.sidebar-user{padding:10px 12px 6px;border-top:1px solid var(--border-gold);font-size:11px;color:var(--text-dim);line-height:1.4;}
.sidebar-user strong{display:block;color:var(--text);font-size:12px;font-weight:600;margin-bottom:2px;}
.btn-logout{width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 10px;margin-top:6px;border-radius:var(--radius);background:rgba(26,106,255,0.07);border:1px solid rgba(26,106,255,0.22);color:var(--blue);font-family:var(--sans);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}
.btn-logout:hover{background:rgba(26,106,255,0.14);}
`;

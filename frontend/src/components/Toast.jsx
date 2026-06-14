import React, { useState, useEffect, createContext, useContext } from 'react'
const ToastContext = createContext()
export function useToast() { return useContext(ToastContext) }
export function ToastProvider({children}) {
  const [toasts, setToasts] = useState([])
  const add = (t) => { const id=Date.now(); setToasts(p=>[...p,{...t,id}]); setTimeout(()=>setToasts(p=>p.filter(x=>x.id!=id)),t.duration||3000) }
  const success = (msg) => add({type:'success',title:msg})
  const error = (msg) => add({type:'error',title:msg})
  return <ToastContext.Provider value={{add,success,error}}>
    {children}
    <div style={{position:'fixed',top:16,right:16,zIndex:9999,display:'flex',flexDirection:'column',gap:8}}>
      {toasts.map(t => <div key={t.id} style={{padding:'12px 20px',borderRadius:10,background:t.type==='error'?'#fef2f2':'#f0fdf4',border:'1px solid '+(t.type==='error'?'#fecaca':'#bbf7d0'),color:t.type==='error'?'#991b1b':'#166534',fontSize:14,fontWeight:500,boxShadow:'0 2px 8px rgba(0,0,0,0.1)',maxWidth:360}}>{t.title}</div>)}
    </div>
  </ToastContext.Provider>
}

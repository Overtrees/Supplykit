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
      {toasts.map(t => <div key={t.id} style={{padding:'12px 20px',borderRadius:32,
        background:t.type==='error'?'rgba(225,29,72,0.1)':'rgba(5,150,105,0.1)',
        border:'1px solid '+(t.type==='error'?'rgba(225,29,72,0.25)':'rgba(5,150,105,0.25)'),
        color:t.type==='error'?'var(--danger)':'var(--success)',
        fontSize:14,fontWeight:500,boxShadow:'0 2px 8px rgba(0,0,0,0.1)',maxWidth:360}}>{t.title}</div>)}
    </div>
  </ToastContext.Provider>
}
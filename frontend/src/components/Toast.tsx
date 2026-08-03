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
    <div style={{position:'fixed',top:'calc(env(safe-area-inset-top) + 12px)',right:16,zIndex:9999,display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
      {toasts.map(t => <div key={t.id} style={{padding:'12px 20px',borderRadius:32,
        background:t.type==='error'?'rgba(225,29,72,0.12)':'rgba(5,150,105,0.12)',
        border:'1px solid '+(t.type==='error'?'rgba(225,29,72,0.25)':'rgba(5,150,105,0.25)'),
        color:t.type==='error'?'var(--danger)':'var(--success)',
        fontSize:14,fontWeight:500,boxShadow:'0 2px 8px rgba(0,0,0,0.1)',maxWidth:360,
        backdropFilter:'blur(var(--glass-blur))',WebkitBackdropFilter:'blur(var(--glass-blur))'}}>{t.title}</div>)}
    </div>
  </ToastContext.Provider>
}
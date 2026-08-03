import React from "react"

const HistorySheet = React.memo(({ show, loading, data, onClose }) => {
  if (!show) return null
  return <>
    <div onPointerDown={(e) => { e.stopPropagation(); onClose() }} className="history-sheet" style={{position:'fixed',inset:0,zIndex:4000,background:'transparent'}} />
    <div style={{
      position:'fixed',left:0,right:0,
      bottom:'calc(env(safe-area-inset-bottom) + 14px)',
      zIndex:4001,display:'flex',justifyContent:'center',
      padding:'0 14px',pointerEvents:'none',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',maxWidth:600,
        background:'var(--glass-bg)',
        backdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',
        WebkitBackdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',
        border:'0.5px solid var(--glass-border)',
        borderRadius:32,
        padding:'18px 14px calc(14px + env(safe-area-inset-bottom))',
        boxShadow:'0 -8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.25)',
        pointerEvents:'auto',
        maxHeight:'70vh',overflowY:'auto',
      }}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:12,textAlign:'center',color:'var(--text)'}}>配置变更历史</div>
        {loading ? (
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {[1,2,3].map(i => (
              <div key={i} style={{padding:'10px 12px',background:'var(--card)',borderRadius:16,fontSize:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <div className="skeleton" style={{width:'40%',height:12,borderRadius:6}} />
                  <div className="skeleton" style={{width:'20%',height:12,borderRadius:6}} />
                </div>
                <div className="skeleton" style={{width:'70%',height:12,borderRadius:6}} />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div style={{padding:20,textAlign:'center',color:'var(--muted2)'}}>暂无变更记录</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {data.map((h, i) => {
              const key = h.key.replace(/^mode_(bbcc|traditional)_/, '')
              const modeInfo = h.mode ? (h.mode === 'bbcc' ? 'BBCC' : '传统') : ''
              return <div key={h.id || i} style={{padding:'10px 12px',background:'var(--card)',borderRadius:16,fontSize:12}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:6,marginBottom:4}}>
                  <span style={{fontWeight:600,fontSize:11}}>
                    {key}{modeInfo ? ` (${modeInfo})` : ''}
                    <span style={{fontWeight:400,fontSize:10,color:'var(--muted2)',marginLeft:4}}>{h.channel === 'jd' ? '京东' : '其他'}</span>
                  </span>
                  <span style={{fontSize:10,color:'var(--muted2)',flexShrink:0}}>{h.created_at?.slice(5,16) || ''}</span>
                </div>
                <div style={{fontSize:11,color:'var(--muted2)',display:'flex',gap:4,flexWrap:'wrap'}}>
                  <span style={{color:'var(--danger)',textDecoration:'line-through'}}>{h.old_value || '(空)'}</span>
                  <span style={{color:'var(--muted2)'}}>→</span>
                  <span style={{color:'var(--success)'}}>{h.new_value || '(空)'}</span>
                </div>
              </div>
            })}
          </div>
        )}
        {!loading && <div style={{flexShrink:0,marginTop:10}}>
          <div onPointerDown={(e) => { e.stopPropagation(); onClose() }} className="clickable" style={{
            borderRadius:22,padding:14,
            background:'var(--primary)',
            cursor:'pointer',textAlign:'center',
          }}>
            <span style={{fontSize:15,fontWeight:600,color:'#fff'}}>关闭</span>
          </div>
        </div>}
      </div>
    </div>
  </>
})

